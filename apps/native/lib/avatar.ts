import type { PersonaKey } from './types';

const AVATAR_BASE_URL = 'https://ottline.app/avatars/clean-bg';

export function avatarUri(personaKey?: PersonaKey | null) {
  const key = personaKey ?? 'cinema_keeper';
  return `${AVATAR_BASE_URL}/avatar-${key.replaceAll('_', '-')}.webp`;
}
