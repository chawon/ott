import { api } from "./api";
import { setCachedUserProfile } from "./localStore";
import { broadcastProfileUpdated } from "./profile";
import type { UpdateUserProfileRequest, UserProfile } from "./types";

export async function fetchUserProfile() {
  const profile = await api<UserProfile>("/auth/profile");
  setCachedUserProfile(profile);
  broadcastProfileUpdated(profile);
  return profile;
}

export async function saveUserProfile(request: UpdateUserProfileRequest) {
  const profile = await api<UserProfile>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(request),
  });
  setCachedUserProfile(profile);
  broadcastProfileUpdated(profile);
  return profile;
}
