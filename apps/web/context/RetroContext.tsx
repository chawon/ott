"use client";

// Retro mode has been disabled. This stub keeps existing call sites compiling
// while always returning isRetro=false. Component-level retro code can be
// cleaned up in a follow-up task.

export function RetroProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRetro() {
  return { isRetro: false, isRetroReady: true, toggleRetro: () => {} };
}
