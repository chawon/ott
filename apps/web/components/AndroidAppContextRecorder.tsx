"use client";

import { useEffect } from "react";
import { recordAndroidAppContextFromCurrentUrl } from "@/lib/androidAppContext";

export default function AndroidAppContextRecorder() {
  useEffect(() => {
    recordAndroidAppContextFromCurrentUrl();
  }, []);

  return null;
}
