import Dexie, { Table } from "dexie";
import { Title, WatchLog, WatchLogHistory } from "./types";

export type LocalTitle = Title & { updatedAt: string };
export type LocalWatchLog = WatchLog & { titleId: string; updatedAt: string };
export type LocalWatchLogHistory = WatchLogHistory;

export type OutboxItem =
  | {
      id: string;
      type: "create_log";
      localLogId: string;
      payload: unknown;
      createdAt: string;
      attempts: number;
      lastError?: string | null;
    }
  | {
      id: string;
      type: "update_log";
      logId: string;
      payload: unknown;
      createdAt: string;
      attempts: number;
      lastError?: string | null;
    }
  | {
      id: string;
      type: "delete_log";
      logId: string;
      payload: unknown;
      createdAt: string;
      attempts: number;
      lastError?: string | null;
    };

class WatchLogDB extends Dexie {
  titles!: Table<LocalTitle, string>;
  logs!: Table<LocalWatchLog, string>;
  history!: Table<LocalWatchLogHistory, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super("watchlog");
    this.version(1).stores({
      titles: "id, provider, providerId, type, name, updatedAt",
      logs: "id, titleId, status, watchedAt, updatedAt",
      history: "id, logId, recordedAt",
    });
    this.version(2).stores({
      titles: "id, provider, providerId, type, name, updatedAt",
      logs: "id, titleId, status, watchedAt, updatedAt",
      history: "id, logId, recordedAt",
      outbox: "id, type, createdAt, attempts",
    });
  }
}

export const db = new WatchLogDB();
