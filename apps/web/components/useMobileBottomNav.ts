"use client";

import { useEffect, useState } from "react";

const MOBILE_BOTTOM_NAV_QUERY = "(max-width: 639.98px) and (pointer: coarse)";

export function useMobileBottomNav() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_BOTTOM_NAV_QUERY);
    const update = () => setEnabled(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return enabled;
}
