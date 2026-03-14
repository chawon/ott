"use client";
import { useEffect } from "react";
import { ensureAuth } from "@/lib/auth";

export default function AuthMigrator() {
  useEffect(() => {
    console.log("[AuthMigrator] Initializing...");
    ensureAuth();
  }, []);

  return null;
}
