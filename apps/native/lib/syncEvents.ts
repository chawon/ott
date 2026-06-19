import { useSyncExternalStore } from 'react';

let logRevision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getLogRevision() {
  return logRevision;
}

export function notifyLogsChanged() {
  logRevision += 1;
  listeners.forEach((listener) => listener());
}

export function useLogRevision() {
  return useSyncExternalStore(subscribe, getLogRevision, getLogRevision);
}
