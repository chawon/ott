"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

type RetroContextType = {
  isRetro: boolean;
  isRetroReady: boolean;
  toggleRetro: () => void;
};

const RetroContext = createContext<RetroContextType | undefined>(undefined);

export function RetroProvider({ children }: { children: React.ReactNode }) {
  const [isRetro, setIsRetro] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("retro-mode");
    if (saved === "true") {
      setIsRetro(true);
      document.documentElement.classList.add("retro");
    }
  }, []);

  const toggleRetro = () => {
    setIsRetro((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("retro");
        localStorage.setItem("retro-mode", "true");
      } else {
        document.documentElement.classList.remove("retro");
        localStorage.setItem("retro-mode", "false");
      }
      void trackEvent("retro_mode_toggle", { enabled: next });
      return next;
    });
  };

  return (
    <RetroContext.Provider value={{ isRetro, isRetroReady: mounted, toggleRetro }}>
      {children}
    </RetroContext.Provider>
  );
}

export function useRetro() {
  const context = useContext(RetroContext);
  if (context === undefined) {
    throw new Error("useRetro must be used within a RetroProvider");
  }
  return context;
}
