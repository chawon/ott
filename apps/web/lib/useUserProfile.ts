"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCachedUserProfile,
  getDeviceId,
  getUserId,
  setCachedUserProfile,
} from "./localStore";
import { fetchUserProfile } from "./profileApi";
import type { UserProfile } from "./types";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!getUserId() || !getDeviceId()) {
      setProfile(null);
      setCachedUserProfile(null);
      return null;
    }
    setLoading(true);
    try {
      const next = await fetchUserProfile();
      setProfile(next);
      return next;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getUserId() && getDeviceId()) {
      setProfile(getCachedUserProfile());
    }
    refresh();

    function handleProfileUpdated(event: Event) {
      const next = (event as CustomEvent<UserProfile | null>).detail ?? null;
      setProfile(next);
      setCachedUserProfile(next);
    }

    function handleAuthRevoked() {
      setProfile(null);
      setCachedUserProfile(null);
    }

    window.addEventListener("profile:updated", handleProfileUpdated);
    window.addEventListener("auth:revoked", handleAuthRevoked);
    window.addEventListener("auth:changed", refresh);
    window.addEventListener("sync:updated", refresh);
    return () => {
      window.removeEventListener("profile:updated", handleProfileUpdated);
      window.removeEventListener("auth:revoked", handleAuthRevoked);
      window.removeEventListener("auth:changed", refresh);
      window.removeEventListener("sync:updated", refresh);
    };
  }, [refresh]);

  return { profile, loading, refresh };
}
