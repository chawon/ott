import Foundation

// MARK: - Together Filtering, Sorting, Selection & Reaction Race Guard

public enum TogetherFilterSort {
    public static func filterAndSort(
        _ discussions: [DiscussionListItem],
        selectedType: String,
        searchQuery: String,
        sortBy: String
    ) -> [DiscussionListItem] {
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = discussions.filter { item in
            let typeOk = selectedType == "all" || item.titleType.rawValue == selectedType
            let queryOk = q.isEmpty || item.titleName.lowercased().contains(q)
            return typeOk && queryOk
        }
        if sortBy == "comments" {
            return filtered.sorted { lhs, rhs in
                if lhs.commentCount != rhs.commentCount {
                    return lhs.commentCount > rhs.commentCount
                }
                return RecordDate.parseInstantMillis(lhs.createdAt) > RecordDate.parseInstantMillis(rhs.createdAt)
            }
        }
        return filtered.sorted { lhs, rhs in
            RecordDate.parseInstantMillis(lhs.createdAt) > RecordDate.parseInstantMillis(rhs.createdAt)
        }
    }

    public static func resolveSelectedDiscussionId(
        currentId: String?,
        initialId: String?,
        filtered: [DiscussionListItem]
    ) -> String? {
        if let initialId, !initialId.isEmpty, filtered.contains(where: { $0.id == initialId }) {
            return initialId
        }
        if let currentId, !currentId.isEmpty, filtered.contains(where: { $0.id == currentId }) {
            return currentId
        }
        return filtered.first?.id
    }
}

/// Prevents out-of-order async reaction fetches (`GET /reactions/me`) from overwriting
/// fresher user toggles (`PUT /reactions`) or leaking across rapid discussion switches.
public struct TogetherReactionGuard: Sendable {
    private var nextToken: UInt64 = 0
    private var latestTokenByDiscussion: [String: UInt64] = [:]

    public init() {}

    @discardableResult
    public mutating func beginLoad(for discussionId: String) -> UInt64 {
        nextToken &+= 1
        latestTokenByDiscussion[discussionId] = nextToken
        return nextToken
    }

    public func shouldApplyLoad(for discussionId: String, token: UInt64) -> Bool {
        latestTokenByDiscussion[discussionId] == token
    }

    public mutating func markMutation(for discussionId: String) {
        nextToken &+= 1
        latestTokenByDiscussion[discussionId] = nextToken
    }
}

// MARK: - Server Account Deletion Outcome (`#163` Safe Preservation Contract)

public enum ServerAccountDeletionOutcome: Equatable, Sendable {
    case deleted(message: String)
    case notConnected(message: String)
    case failed(message: String)

    public var isSuccess: Bool {
        if case .deleted = self { return true }
        return false
    }

    public var message: String {
        switch self {
        case .deleted(let msg), .notConnected(let msg), .failed(let msg):
            return msg
        }
    }
}
