import type { PersonaKey, UserProfile } from "./types";

export const PERSONA_KEYS = [
  "cinema_keeper",
  "book_drifter",
  "deep_watcher",
  "midnight_logger",
  "weekend_curator",
  "archive_collector",
] as const satisfies readonly PersonaKey[];

export const DEFAULT_PERSONA_KEY: PersonaKey = "cinema_keeper";
export const AVATAR_IMAGE_SCALE = 2.25;
export const SHARE_CARD_AVATAR_IMAGE_SCALE = 1.75;

export function isPersonaKey(value: unknown): value is PersonaKey {
  return (
    typeof value === "string" && PERSONA_KEYS.includes(value as PersonaKey)
  );
}

export function avatarSrc(personaKey: PersonaKey | null | undefined) {
  const key = isPersonaKey(personaKey) ? personaKey : DEFAULT_PERSONA_KEY;
  return `/avatars/clean-bg/avatar-${key.replaceAll("_", "-")}.webp`;
}

export function avatarLayerStyle(personaKey: PersonaKey | null | undefined) {
  if (personaKey === "archive_collector") {
    return { top: "10%", left: "8%" };
  }

  if (personaKey === "deep_watcher") {
    return { top: "-14%", left: "8%" };
  }

  if (personaKey === "midnight_logger" || personaKey === "weekend_curator") {
    return { top: "10%", left: 0 };
  }

  if (personaKey === "book_drifter" || personaKey === "cinema_keeper") {
    return { top: "-14%", left: 0 };
  }

  return { top: 0, left: 0 };
}

export function isProfileComplete(profile: UserProfile | null | undefined) {
  return Boolean(profile?.nickname?.trim() && isPersonaKey(profile.personaKey));
}

export function broadcastProfileUpdated(profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UserProfile | null>("profile:updated", {
      detail: profile,
    }),
  );
}
