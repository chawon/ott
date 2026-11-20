"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { trackEvent } from "./analytics";
import { getUserId, listLogsLocal } from "./localStore";
import {
  RECOMMENDATION_GENERATION_TIMEOUT_MS,
  RecommendationRequestError,
  recommendationDeadline,
  recommendationRequest,
} from "./recommendationApi";
import {
  effectiveRecommendationExclusions,
  importLegacyRecommendationChoices,
  type RecommendationQueue,
  readRecommendationQueue,
  recommendationIsDismissed,
  saveRecommendationQueue,
  withRecommendationRequest,
} from "./recommendations";
import type {
  RecommendationExclusion,
  RecommendationItem,
  RecommendationState,
  WatchLog,
} from "./types";
import { safeUUID } from "./utils";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Scope = {
  userId: string;
  locale: string;
  controller: AbortController;
  queue: RecommendationQueue;
  server: RecommendationState | null;
  chain: Promise<unknown>;
  autoAttempted: Set<string>;
};

type Undo = { item: RecommendationItem; sourceId: string; key?: string };

/** Server state owns quota and exclusions; this queue only carries unacknowledged intentions. */
export function useRecommendations(locale: string, active = true) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [server, setServer] = useState<RecommendationState | null>(null);
  const [queue, setQueue] = useState<RecommendationQueue>({
    legacyImported: false,
    operations: [],
    generationRequestIds: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"load" | "generate" | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [lastDismissed, setLastDismissed] = useState<RecommendationItem | null>(
    null,
  );
  const [restored, setRestored] = useState<RecommendationItem[]>([]);
  const [recorded, setRecorded] = useState<WatchLog[]>([]);
  const scopeRef = useRef<Scope | null>(null);
  const undoRef = useRef<Undo | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const busyRef = useRef(false);
  const refreshRef = useRef(false);

  function current(scope: Scope) {
    return (
      scopeRef.current === scope &&
      !scope.controller.signal.aborted &&
      getUserId() === scope.userId
    );
  }

  function updateQueue(scope: Scope, next: RecommendationQueue) {
    if (!current(scope)) return;
    scope.queue = next;
    saveRecommendationQueue(scope.userId, next, browserStorage());
    setQueue(next);
  }

  function accept(scope: Scope, next: RecommendationState) {
    if (!current(scope)) return;
    scope.server = next;
    setServer(next);
  }

  function exclusive(scope: Scope, task: () => Promise<void>) {
    const promise = scope.chain
      .catch(() => undefined)
      .then(async () => {
        if (current(scope)) await task();
      });
    scope.chain = promise.catch(() => undefined);
    return promise;
  }

  async function readState(scope: Scope, signal = scope.controller.signal) {
    const response = await recommendationRequest<RecommendationState>(
      "/state",
      { ...scope, signal },
    );
    if (current(scope)) accept(scope, response.data);
    return response.data;
  }

  async function flush(scope: Scope): Promise<boolean> {
    if (!current(scope)) return false;
    if (navigator.onLine === false) return scope.queue.operations.length === 0;
    try {
      while (current(scope) && scope.queue.operations.length) {
        const operation = scope.queue.operations[0];
        const requestScope = { ...scope, signal: scope.controller.signal };
        let key = operation.key;
        if (operation.kind === "exclude" || !key) {
          const response = await recommendationRequest<RecommendationExclusion>(
            "/exclusions",
            requestScope,
            {
              method: "PUT",
              body: JSON.stringify(operation.item),
            },
          );
          if (!current(scope)) return false;
          key = response.data.key;
          if (operation.kind === "exclude") {
            if (scope.server)
              accept(scope, {
                ...scope.server,
                exclusions: [
                  ...scope.server.exclusions.filter((item) => item.key !== key),
                  response.data,
                ],
              });
            if (undoRef.current?.sourceId === operation.id)
              undoRef.current.key = key;
          }
        }
        if (operation.kind === "restore") {
          await recommendationRequest(
            `/exclusions/${encodeURIComponent(key ?? "")}`,
            requestScope,
            { method: "DELETE" },
          );
          if (!current(scope)) return false;
          if (scope.server)
            accept(scope, {
              ...scope.server,
              exclusions: scope.server.exclusions.filter(
                (item) => item.key !== key,
              ),
            });
        }
        updateQueue(scope, {
          ...scope.queue,
          operations: scope.queue.operations
            .filter((item) => item.id !== operation.id)
            .map((item) =>
              item.sourceId === operation.id ? { ...item, key } : item,
            ),
        });
      }
      if (current(scope)) setSyncError(false);
      return current(scope);
    } catch {
      if (current(scope)) setSyncError(true);
      return false;
    }
  }

  async function poll(scope: Scope, initial: RecommendationState) {
    const { signal, dispose } = recommendationDeadline(
      scope.controller.signal,
      RECOMMENDATION_GENERATION_TIMEOUT_MS,
    );
    try {
      let next = initial;
      while (next.generating && current(scope)) {
        if (signal.aborted) throw signal.reason;
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(done, 1500);
          function done() {
            signal.removeEventListener("abort", abort);
            resolve();
          }
          function abort() {
            clearTimeout(timer);
            reject(signal.reason);
          }
          signal.addEventListener("abort", abort, { once: true });
        });
        if (current(scope)) next = await readState(scope, signal);
      }
      return next;
    } finally {
      dispose();
    }
  }

  async function generateInside(scope: Scope) {
    if (!current(scope)) return;
    if (
      !scope.queue.generationRequestIds[scope.locale] &&
      (!scope.server?.eligible || scope.server.quota.remaining <= 0)
    ) {
      busyRef.current = false;
      setLoading(false);
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setError(null);
    setRestored([]);
    try {
      const requestId =
        scope.queue.generationRequestIds[scope.locale] ?? safeUUID();
      updateQueue(
        scope,
        withRecommendationRequest(scope.queue, scope.locale, requestId),
      );
      if (!(await flush(scope)))
        throw new Error("Pending changes are not connected yet");
      if (!current(scope)) return;
      const previousGenerationId = scope.server?.generationId;
      const response = await recommendationRequest<RecommendationState>(
        "/generate",
        { ...scope, signal: scope.controller.signal },
        {
          method: "POST",
          body: JSON.stringify({ requestId }),
        },
      );
      if (!current(scope)) return;
      accept(scope, response.data);
      const final = response.data.generating
        ? await poll(scope, response.data)
        : response.data;
      if (!current(scope)) return;
      if (final.quota.remaining > 0 && final.generationId !== requestId) {
        if (!final.hasBatch)
          throw new Error("There is no completed batch in this language yet");
        // The shared quota can change without a new batch in this language.
        const beforeWait = response.data.generating
          ? response.data.generationId
          : previousGenerationId;
        if (response.status === 202 && final.generationId === beforeWait)
          throw new Error(
            "The concurrent generation did not complete in this language",
          );
      }
      updateQueue(
        scope,
        withRecommendationRequest(scope.queue, scope.locale, null),
      );
      setError(null);
    } catch (failure) {
      if (!current(scope)) return;
      if (failure instanceof RecommendationRequestError && failure.state)
        accept(scope, failure.state);
      if (
        failure instanceof RecommendationRequestError &&
        failure.status === 429 &&
        failure.state?.quota.remaining === 0
      ) {
        updateQueue(
          scope,
          withRecommendationRequest(scope.queue, scope.locale, null),
        );
      } else {
        setError("generate");
      }
    } finally {
      if (current(scope)) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  function reload(retryPending = false) {
    const scope = scopeRef.current;
    if (!scope || !activeRef.current || refreshRef.current) return;
    refreshRef.current = true;
    void exclusive(scope, async () => {
      if (!scope.server) setLoading(true);
      try {
        await flush(scope);
        const initial = await readState(scope);
        if (!current(scope)) return;
        setError(null);
        let next = initial;
        if (initial.generating) {
          scope.autoAttempted.add(initial.quota.date);
          busyRef.current = true;
          setLoading(true);
          next = await poll(scope, initial);
          if (!current(scope)) return;
        }
        const pendingId = scope.queue.generationRequestIds[scope.locale];
        if (pendingId) {
          if (next.quota.remaining === 0 || next.generationId === pendingId) {
            updateQueue(
              scope,
              withRecommendationRequest(scope.queue, scope.locale, null),
            );
          } else if (retryPending && !initial.generating && next.eligible) {
            await generateInside(scope);
          } else {
            setError("generate");
          }
        } else if (initial.generating) {
          if (!next.hasBatch && next.quota.remaining > 0) setError("generate");
        } else if (
          next.eligible &&
          !next.hasBatch &&
          next.quota.remaining > 0 &&
          (retryPending || !scope.autoAttempted.has(next.quota.date))
        ) {
          scope.autoAttempted.add(next.quota.date);
          await generateInside(scope);
        }
      } catch {
        if (current(scope))
          setError(
            scope.queue.generationRequestIds[scope.locale]
              ? "generate"
              : "load",
          );
      } finally {
        if (current(scope)) {
          setLoading(false);
          busyRef.current = false;
          refreshRef.current = false;
        }
      }
    });
  }

  function flushChanges() {
    const scope = scopeRef.current;
    if (!scope) return;
    void exclusive(scope, async () => {
      if (await flush(scope)) {
        try {
          await readState(scope);
        } catch {
          if (current(scope)) setSyncError(true);
        }
      }
    });
  }

  async function readLocal(scope: Scope) {
    try {
      const logs = await listLogsLocal({});
      if (current(scope))
        setRecorded(logs.filter((log) => (log.origin ?? "LOG") === "LOG"));
    } catch {
      /* Server history filtering remains available when the local store is unavailable. */
    }
  }

  const reloadFromEffect = useEffectEvent(reload);
  const readLocalFromEffect = useEffectEvent(readLocal);

  useEffect(() => {
    function updateScope() {
      const userId = getUserId();
      if (
        scopeRef.current?.userId === userId &&
        scopeRef.current.locale === locale
      )
        return;
      scopeRef.current?.controller.abort();
      const scope: Scope | null = userId
        ? {
            userId,
            locale,
            controller: new AbortController(),
            server: null,
            chain: Promise.resolve(),
            autoAttempted: new Set(),
            queue: importLegacyRecommendationChoices(
              userId,
              readRecommendationQueue(userId, browserStorage()),
              browserStorage(),
              safeUUID,
            ),
          }
        : null;
      scopeRef.current = scope;
      busyRef.current = false;
      refreshRef.current = false;
      undoRef.current = null;
      setOwnerId(userId);
      setServer(null);
      setQueue(
        scope?.queue ?? {
          legacyImported: false,
          operations: [],
          generationRequestIds: {},
        },
      );
      setLastDismissed(null);
      setRestored([]);
      setRecorded([]);
      setError(null);
      setSyncError(false);
      setLoading(false);
      if (scope) void readLocalFromEffect(scope);
    }
    function reconcile() {
      if (activeRef.current) reloadFromEffect();
    }
    function reconnect() {
      const scope = scopeRef.current;
      if (!scope || !refreshRef.current) {
        reconcile();
        return;
      }
      // An online event can arrive before the previous read has timed out.
      void scope.chain.then(() => {
        if (scopeRef.current === scope) reconcile();
      });
    }
    function syncUpdated() {
      const scope = scopeRef.current;
      if (scope) void readLocalFromEffect(scope);
      reconcile();
    }
    function storageUpdated(event: StorageEvent) {
      updateScope();
      const scope = scopeRef.current;
      if (
        scope &&
        event.key === `watchlog.recommendations.sync.v1:${scope.userId}`
      ) {
        scope.queue = readRecommendationQueue(scope.userId, browserStorage());
        setQueue(scope.queue);
      }
      reconcile();
    }
    updateScope();
    window.addEventListener("auth:changed", updateScope);
    window.addEventListener("auth:revoked", updateScope);
    window.addEventListener("storage", storageUpdated);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconnect);
    window.addEventListener("sync:updated", syncUpdated);
    return () => {
      window.removeEventListener("auth:changed", updateScope);
      window.removeEventListener("auth:revoked", updateScope);
      window.removeEventListener("storage", storageUpdated);
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("sync:updated", syncUpdated);
      scopeRef.current?.controller.abort();
      scopeRef.current = null;
    };
  }, [locale]);

  useEffect(() => {
    if (active && ownerId && scopeRef.current?.locale === locale)
      reloadFromEffect();
  }, [active, ownerId, locale]);

  function generate() {
    const scope = scopeRef.current;
    if (!scope || busyRef.current) return;
    if (scope.queue.generationRequestIds[scope.locale]) {
      reload(true);
      return;
    }
    if (
      !scope.server?.eligible ||
      scope.server.generating ||
      scope.server.quota.remaining <= 0
    )
      return;
    busyRef.current = true;
    setLoading(true);
    trackEvent("recommendation_refresh");
    void exclusive(scope, () => generateInside(scope));
  }

  function dismiss(item: RecommendationItem) {
    const scope = scopeRef.current;
    if (!scope || !current(scope)) return;
    const id = safeUUID();
    updateQueue(scope, {
      ...scope.queue,
      operations: [...scope.queue.operations, { id, kind: "exclude", item }],
    });
    undoRef.current = { item, sourceId: id };
    setLastDismissed(item);
    setRestored((current) =>
      current.filter(
        (previous) => !recommendationIsDismissed(item, [previous]),
      ),
    );
    trackEvent("recommendation_dismiss", { title: item.name });
    flushChanges();
  }

  function undoDismiss() {
    const scope = scopeRef.current;
    const undo = undoRef.current;
    if (!scope || !undo || !current(scope)) return;
    updateQueue(scope, {
      ...scope.queue,
      operations: [
        ...scope.queue.operations,
        {
          id: safeUUID(),
          kind: "restore",
          item: undo.item,
          sourceId: undo.sourceId,
          key: undo.key,
        },
      ],
    });
    setRestored((items) =>
      recommendationIsDismissed(undo.item, items)
        ? items
        : [undo.item, ...items],
    );
    undoRef.current = null;
    setLastDismissed(null);
    flushChanges();
  }

  function recordCreated(log: WatchLog) {
    setRecorded((logs) => [
      log,
      ...logs.filter((previous) => previous.id !== log.id),
    ]);
  }

  const exclusions = effectiveRecommendationExclusions(
    server?.exclusions ?? [],
    queue.operations,
  );
  const restoredPending = queue.operations.flatMap((operation) =>
    operation.kind === "restore" && operation.item.type
      ? [
          {
            ...operation.item,
            type: operation.item.type,
            reason: operation.item.reason ?? "",
            genres: operation.item.genres ?? [],
          },
        ]
      : [],
  );
  const items = [
    ...restored,
    ...restoredPending,
    ...(server?.items ?? []),
  ].filter(
    (item, index, all) =>
      !all
        .slice(0, index)
        .some((previous) => recommendationIsDismissed(item, [previous])),
  );
  const visible = items.filter(
    (item) =>
      !recommendationIsDismissed(item, exclusions) &&
      !recommendationIsDismissed(
        item,
        recorded.map((log) => log.title),
      ),
  );
  return {
    ownerId,
    visible,
    loading,
    error,
    quota: server?.quota ?? null,
    generating: server?.generating ?? false,
    eligible: server?.eligible ?? false,
    canRefresh:
      !!server &&
      server.eligible &&
      server.quota.remaining > 0 &&
      !server.generating,
    pendingCount: queue.operations.length,
    syncError,
    load: () => reload(),
    generate,
    retry: () => reload(error === "generate"),
    dismiss,
    lastDismissed,
    undoDismiss,
    recordCreated,
  };
}
