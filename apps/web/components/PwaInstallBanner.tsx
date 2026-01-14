"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "watchlog.pwa.install.dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) return;
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isIos() || promptEvent) {
      setVisible(true);
    }
  }, [promptEvent]);

  if (!visible) return null;

  const isIosBanner = isIos() && !promptEvent;

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-neutral-900">홈 화면에 추가</div>
            <div className="mt-1 text-xs text-neutral-600">
              {isIosBanner
                ? "Safari 공유 버튼에서 “홈 화면에 추가”를 선택하면 앱처럼 사용할 수 있어요."
                : "설치하면 홈 화면에서 바로 열 수 있어요."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {promptEvent ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await promptEvent.prompt();
                    await promptEvent.userChoice;
                  } finally {
                    setPromptEvent(null);
                    setVisible(false);
                  }
                }}
                className="rounded-md border border-neutral-900 bg-neutral-900 px-2 py-1 text-xs text-white"
              >
                설치
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(DISMISS_KEY, "1");
                }
              }}
              className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
