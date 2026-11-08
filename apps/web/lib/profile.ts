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
export const AVATAR_IMAGE_SCALE = 1;
export const SHARE_CARD_AVATAR_IMAGE_SCALE = 1;

export function isPersonaKey(value: unknown): value is PersonaKey {
  return (
    typeof value === "string" && PERSONA_KEYS.includes(value as PersonaKey)
  );
}

export function avatarSrc(personaKey: PersonaKey | null | undefined) {
  const key = isPersonaKey(personaKey) ? personaKey : DEFAULT_PERSONA_KEY;
  return `/avatars/storybook/${key}.webp`;
}

export function avatarLayerStyle(_personaKey: PersonaKey | null | undefined) {
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
