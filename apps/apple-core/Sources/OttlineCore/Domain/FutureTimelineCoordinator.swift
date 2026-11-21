import Foundation
import Combine

// MARK: - Transport & Durable Attempt Protocols (shared by iOS, iPadOS, macOS & tests)

public protocol RecommendationTransport: Sendable {
    func getRecommendationState() async throws -> RecommendationState
    func generateRecommendations(requestId: String) async throws -> (statusCode: Int, state: RecommendationState)
    func excludeRecommendation(_ item: RecommendationItem) async throws -> RecommendationExclusion
    func restoreRecommendationExclusion(key: String) async throws
}

extension OttlineApiClient: RecommendationTransport {}

public protocol RecommendationAttemptStore: AnyObject {
    func pendingRecommendationRequestId(userId: String, locale: String) -> String?
    func setPendingRecommendationRequestId(_ requestId: String?, userId: String, locale: String)
}

extension AppPreferences: RecommendationAttemptStore {}

// MARK: - Shared Future Timeline Generation & Recovery Coordinator

public final class FutureTimelineCoordinator: ObservableObject, @unchecked Sendable {
    @Published public private(set) var state: RecommendationState = RecommendationState()
    @Published public private(set) var isLoadingState: Bool = false
    @Published public private(set) var isGenerating: Bool = false
    @Published public private(set) var errorMessage: String? = nil
    @Published public private(set) var lastExcludedItem: RecommendationExclusion? = nil
    @Published public private(set) var hasPendingAttempt: Bool = false

    private let transport: any RecommendationTransport
    private let attemptStore: any RecommendationAttemptStore
    private let ensureUserId: () async throws -> String?
    private let pollIntervalNanoseconds: UInt64
    private let maxPollAttempts: Int
    private let maxConsecutivePollErrors: Int
    private let uuidGenerator: () -> String

    private var activeScopeKey: String = ""
    private var activeGenerationInFlight: Bool = false
    private var activePollingInFlight: Bool = false

    public init(
        transport: any RecommendationTransport,
        attemptStore: any RecommendationAttemptStore,
        ensureUserId: @escaping () async throws -> String?,
        pollIntervalNanoseconds: UInt64 = 1_500_000_000,
        maxPollAttempts: Int = 80,
        maxConsecutivePollErrors: Int = 5,
        uuidGenerator: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.transport = transport
        self.attemptStore = attemptStore
        self.ensureUserId = ensureUserId
        self.pollIntervalNanoseconds = pollIntervalNanoseconds
        self.maxPollAttempts = maxPollAttempts
        self.maxConsecutivePollErrors = maxConsecutivePollErrors
        self.uuidGenerator = uuidGenerator
    }

    public convenience init(repository: OttlineRepository) {
        self.init(
            transport: repository.api,
            attemptStore: repository.prefs,
            ensureUserId: {
                let snap = try await repository.ensureAuthenticated()
                return snap.userId
            }
        )
    }

    private func normalizedLocale(_ locale: String) -> String {
        locale.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("ko") ? "ko" : "en"
    }

    private func scopeKey(userId: String, locale: String) -> String {
        "\(userId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())|\(normalizedLocale(locale))"
    }

    @MainActor
    private func refreshPendingFlag(userId: String, locale: String) {
        hasPendingAttempt = attemptStore.pendingRecommendationRequestId(userId: userId, locale: locale) != nil
    }

    /// Loads `/recommendations/state`, recovers any completed or still-running attempt for `(userId, locale)`,
    /// and resumes polling if `state.generating` is true. Preserves any previously loaded items on error.
    @MainActor
    public func loadState(locale: String) async {
        let lang = normalizedLocale(locale)
        isLoadingState = true
        defer { isLoadingState = false }

        let userId: String
        do {
            guard let resolved = try await ensureUserId()?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !resolved.isEmpty else {
                errorMessage = loadErrorText(lang)
                return
            }
            userId = resolved
        } catch {
            errorMessage = loadErrorText(lang)
            return
        }

        let scope = scopeKey(userId: userId, locale: lang)
        if activeScopeKey != scope {
            // Switching account or language resets displayed batch so another language's items are never mixed in.
            activeScopeKey = scope
            state = RecommendationState()
            lastExcludedItem = nil
            errorMessage = nil
        }
        refreshPendingFlag(userId: userId, locale: lang)

        let baselineGenerationId = state.generationId
        do {
            let fetched = try await transport.getRecommendationState()
            guard activeScopeKey == scope else { return }
            state = fetched
            errorMessage = nil

            let pendingId = attemptStore.pendingRecommendationRequestId(userId: userId, locale: lang)
            if fetched.generating {
                await pollUntilSettled(
                    scope: scope,
                    userId: userId,
                    locale: lang,
                    pendingRequestId: pendingId,
                    baselineGenerationId: baselineGenerationId,
                    startedWith202: false
                )
            } else if let pendingId {
                reconcileSettledPendingAttempt(
                    settled: fetched,
                    pendingRequestId: pendingId,
                    baselineGenerationId: baselineGenerationId,
                    userId: userId,
                    locale: lang,
                    startedWith202: false
                )
            }
        } catch {
            guard activeScopeKey == scope else { return }
            errorMessage = loadErrorText(lang)
        }
        refreshPendingFlag(userId: userId, locale: lang)
    }

    /// Starts a first generation, explicit regeneration, or safe retry using a durable per-(account, locale) `requestId`.
    /// Double taps while already running are ignored. Dropped responses automatically check `/state` and resume polling if needed.
    @MainActor
    public func requestGeneration(locale: String) async {
        guard !activeGenerationInFlight && !activePollingInFlight else { return }
        let lang = normalizedLocale(locale)

        activeGenerationInFlight = true
        isGenerating = true
        errorMessage = nil
        defer {
            activeGenerationInFlight = false
            if !activePollingInFlight {
                isGenerating = false
            }
        }

        let userId: String
        do {
            guard let resolved = try await ensureUserId()?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !resolved.isEmpty else {
                errorMessage = generateErrorText(lang)
                return
            }
            userId = resolved
        } catch {
            errorMessage = generateErrorText(lang)
            return
        }

        let scope = scopeKey(userId: userId, locale: lang)
        if activeScopeKey != scope {
            activeScopeKey = scope
            state = RecommendationState()
            lastExcludedItem = nil
        }

        let baselineGenerationId = state.generationId
        var requestId = attemptStore.pendingRecommendationRequestId(userId: userId, locale: lang)

        // 1. If a previous attempt in this (userId, locale) is still unconfirmed, check `/state` first.
        if let existingPendingId = requestId {
            if let checked = try? await transport.getRecommendationState() {
                guard activeScopeKey == scope else { return }
                state = checked
                if checked.generating {
                    await pollUntilSettled(
                        scope: scope,
                        userId: userId,
                        locale: lang,
                        pendingRequestId: existingPendingId,
                        baselineGenerationId: baselineGenerationId,
                        startedWith202: false
                    )
                    refreshPendingFlag(userId: userId, locale: lang)
                    return
                }
                if checked.hasBatch && checked.generationId == existingPendingId {
                    // Already completed on the server — recover cleanly without firing another POST.
                    attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                    errorMessage = nil
                    refreshPendingFlag(userId: userId, locale: lang)
                    return
                }
            }
        } else {
            if !state.eligible || state.quota.remaining <= 0 {
                if state.quota.limit > 0 && state.quota.remaining <= 0 {
                    errorMessage = limitErrorText(lang)
                }
                return
            }
            let fresh = uuidGenerator().trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            requestId = fresh
            attemptStore.setPendingRecommendationRequestId(fresh, userId: userId, locale: lang)
            refreshPendingFlag(userId: userId, locale: lang)
        }

        guard let effectiveRequestId = requestId, !effectiveRequestId.isEmpty else { return }

        // 2. Fire idempotent POST `/recommendations/generate` with `effectiveRequestId`.
        do {
            let (statusCode, returnedState) = try await transport.generateRecommendations(requestId: effectiveRequestId)
            guard activeScopeKey == scope else { return }
            state = returnedState

            if statusCode == 429 {
                attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                errorMessage = limitErrorText(lang)
                refreshPendingFlag(userId: userId, locale: lang)
                return
            }

            if statusCode == 202 || returnedState.generating {
                await pollUntilSettled(
                    scope: scope,
                    userId: userId,
                    locale: lang,
                    pendingRequestId: effectiveRequestId,
                    baselineGenerationId: baselineGenerationId,
                    startedWith202: statusCode == 202
                )
                refreshPendingFlag(userId: userId, locale: lang)
                return
            }

            // 200 OK and not generating
            if !returnedState.eligible {
                attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                errorMessage = nil
            } else if returnedState.hasBatch && (
                returnedState.generationId == effectiveRequestId ||
                (returnedState.generationId != nil && returnedState.generationId != baselineGenerationId)
            ) {
                attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                errorMessage = nil
            } else if returnedState.hasBatch {
                // Server returned REUSED for an already-completed batch.
                attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                errorMessage = nil
            } else if returnedState.quota.remaining <= 0 {
                attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
                errorMessage = limitErrorText(lang)
            } else {
                errorMessage = generateErrorText(lang)
            }
        } catch let apiErr as ApiError where apiErr.statusCode == 429 {
            guard activeScopeKey == scope else { return }
            attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: lang)
            errorMessage = limitErrorText(lang)
        } catch {
            guard activeScopeKey == scope else { return }
            // Network drop / timeout / 5xx: preserve existing `state.items` & `effectiveRequestId`,
            // then immediately attempt `/state` recovery in case the server is still running or already finished.
            await recoverAfterDroppedGenerateResponse(
                scope: scope,
                userId: userId,
                locale: lang,
                pendingRequestId: effectiveRequestId,
                baselineGenerationId: baselineGenerationId
            )
        }

        refreshPendingFlag(userId: userId, locale: lang)
    }

    @MainActor
    public func excludeItem(_ item: RecommendationItem, locale: String) async {
        let lang = normalizedLocale(locale)
        do {
            let exclusion = try await transport.excludeRecommendation(item)
            lastExcludedItem = exclusion
            if let refreshed = try? await transport.getRecommendationState() {
                state = refreshed
            } else {
                var nextState = state
                nextState.items.removeAll { $0.id == item.id }
                nextState.exclusions.insert(exclusion, at: 0)
                state = nextState
            }
        } catch {
            errorMessage = OttlineStrings.tr("제외하지 못했어요.", "Couldn't exclude.", locale: lang)
        }
    }

    @MainActor
    public func restoreExclusion(key: String, locale: String) async {
        let lang = normalizedLocale(locale)
        do {
            try await transport.restoreRecommendationExclusion(key: key)
            if lastExcludedItem?.key == key {
                lastExcludedItem = nil
            }
            if let refreshed = try? await transport.getRecommendationState() {
                state = refreshed
            } else {
                var nextState = state
                nextState.exclusions.removeAll { $0.key == key }
                state = nextState
            }
        } catch {
            errorMessage = OttlineStrings.tr("되돌리지 못했어요.", "Couldn't restore.", locale: lang)
        }
    }

    // MARK: - Recovery & Resilient Polling

    @MainActor
    private func recoverAfterDroppedGenerateResponse(
        scope: String,
        userId: String,
        locale: String,
        pendingRequestId: String,
        baselineGenerationId: String?
    ) async {
        do {
            let recovered = try await transport.getRecommendationState()
            guard activeScopeKey == scope else { return }
            state = recovered

            if recovered.generating {
                await pollUntilSettled(
                    scope: scope,
                    userId: userId,
                    locale: locale,
                    pendingRequestId: pendingRequestId,
                    baselineGenerationId: baselineGenerationId,
                    startedWith202: false
                )
                return
            }

            reconcileSettledPendingAttempt(
                settled: recovered,
                pendingRequestId: pendingRequestId,
                baselineGenerationId: baselineGenerationId,
                userId: userId,
                locale: locale,
                startedWith202: false
            )
        } catch {
            guard activeScopeKey == scope else { return }
            // Keep `state` (previous batch untouched) and keep `pendingRequestId` for next retry/re-entry.
            errorMessage = retryableRecoveryErrorText(locale)
        }
    }

    @MainActor
    private func pollUntilSettled(
        scope: String,
        userId: String,
        locale: String,
        pendingRequestId: String?,
        baselineGenerationId: String?,
        startedWith202: Bool
    ) async {
        guard !activePollingInFlight else { return }
        activePollingInFlight = true
        isGenerating = true
        defer {
            activePollingInFlight = false
            if !activeGenerationInFlight {
                isGenerating = false
            }
        }

        var consecutiveErrors = 0
        for _ in 0..<maxPollAttempts {
            if Task.isCancelled || activeScopeKey != scope { return }
            if pollIntervalNanoseconds > 0 {
                try? await Task.sleep(nanoseconds: pollIntervalNanoseconds)
            }
            if Task.isCancelled || activeScopeKey != scope { return }

            do {
                let polled = try await transport.getRecommendationState()
                guard activeScopeKey == scope else { return }
                consecutiveErrors = 0
                state = polled

                if !polled.generating {
                    if let pendingRequestId {
                        reconcileSettledPendingAttempt(
                            settled: polled,
                            pendingRequestId: pendingRequestId,
                            baselineGenerationId: baselineGenerationId,
                            userId: userId,
                            locale: locale,
                            startedWith202: startedWith202
                        )
                    } else {
                        errorMessage = nil
                    }
                    return
                }
            } catch {
                consecutiveErrors += 1
                if consecutiveErrors >= maxConsecutivePollErrors {
                    guard activeScopeKey == scope else { return }
                    errorMessage = retryableRecoveryErrorText(locale)
                    return
                }
            }
        }

        // Poll window exhausted while server still reported generating: keep pendingRequestId & allow retry/re-check.
        guard activeScopeKey == scope else { return }
        errorMessage = stillGeneratingErrorText(locale)
    }

    /// Decides whether a settled (`generating == false`) server state confirms our locale's pending attempt.
    /// Crucially checks `generationId` (per-language batch identity), NEVER relying on `quota.used` alone,
    /// so quota changes caused by another locale on the same account are never mistaken for success here.
    @MainActor
    private func reconcileSettledPendingAttempt(
        settled: RecommendationState,
        pendingRequestId: String,
        baselineGenerationId: String?,
        userId: String,
        locale: String,
        startedWith202: Bool
    ) {
        let confirmedSameRequest = settled.hasBatch && settled.generationId == pendingRequestId
        let confirmedNewBatchInThisLocale = startedWith202
            && settled.hasBatch
            && settled.generationId != nil
            && settled.generationId != baselineGenerationId

        if confirmedSameRequest || confirmedNewBatchInThisLocale {
            attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: locale)
            errorMessage = nil
            return
        }

        if settled.quota.remaining <= 0 {
            attemptStore.setPendingRecommendationRequestId(nil, userId: userId, locale: locale)
            errorMessage = limitErrorText(locale)
            return
        }

        // Not confirmed in this locale (e.g., server failed, response dropped before claim,
        // or another locale's generation finished while we received 202).
        // Preserve `pendingRequestId` so tapping Retry safely reuses the exact same `requestId`.
        errorMessage = startedWith202 ? concurrentOtherFinishErrorText(locale) : retryableRecoveryErrorText(locale)
    }

    // MARK: - Copy Helpers

    private func loadErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "추천 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
            "Couldn't load recommendations. Please try again in a moment.",
            locale: locale
        )
    }

    private func generateErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "다음 작품을 찾지 못했어요. 잠시 후 다시 시도해 주세요.",
            "Could not generate new recommendations right now.",
            locale: locale
        )
    }

    private func limitErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "오늘 사용할 수 있는 생성 횟수를 모두 썼어요.",
            "You've reached today's generation limit.",
            locale: locale
        )
    }

    private func retryableRecoveryErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "응답 확인이 잠시 끊겼어요. 다시 누르면 같은 요청으로 이어서 확인해요.",
            "We couldn't confirm the response yet. Tap again to continue safely with the same request.",
            locale: locale
        )
    }

    private func concurrentOtherFinishErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "진행 중이던 다른 추천 요청이 마무리됐어요. 다시 눌러 추천을 받아보세요.",
            "Another recommendation request just finished. Tap again to get recommendations.",
            locale: locale
        )
    }

    private func stillGeneratingErrorText(_ locale: String) -> String {
        OttlineStrings.tr(
            "추천을 만드는 데 시간이 조금 더 걸리고 있어요. 잠시 후 다시 확인해 주세요.",
            "Recommendations are still being prepared. Check again in a moment.",
            locale: locale
        )
    }
}
