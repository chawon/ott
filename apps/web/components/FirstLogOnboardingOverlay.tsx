"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FirstLogOnboardingStep = 1 | 2 | 3 | 4;

type StepConfig = {
  selector: string;
  title: string;
  body: string;
  primary: string;
  requirementSelector?: string;
  requirementLabel?: string;
};

const STEP_CONFIG: Record<FirstLogOnboardingStep, StepConfig> = {
  1: {
    selector: '[data-onboarding-target="content-type"]',
    title: "먼저 영상이나 책을 선택해요",
    body: "지금 남길 기록이 영상인지 책인지 먼저 골라 주세요.",
    primary: "다음",
    requirementLabel: "영상 또는 책 버튼을 한 번 눌러 주세요.",
  },
  2: {
    selector: '[data-onboarding-target="title-search"]',
    title: "먼저 작품을 검색해요",
    body: "보고 있거나 읽은 작품 이름을 입력해 주세요.",
    primary: "다음",
    requirementSelector: '[data-onboarding-target="selected-title"]',
    requirementLabel: "작품을 선택하면 다음으로 넘어갈 수 있어요.",
  },
  3: {
    selector: '[data-onboarding-target="status-save"]',
    title: "상태를 고르고 저장해요",
    body: "상태를 선택한 뒤 기록 저장 버튼을 눌러 주세요. 저장하면 다음 단계로 자동 이동해요.",
    primary: "저장 후 자동 이동",
  },
  4: {
    selector: '[data-onboarding-target="timeline-confirm"]',
    title: "타임라인에서 바로 확인해요",
    body: "방금 저장한 기록이 타임라인에 쌓였는지 확인해 주세요.",
    primary: "완료",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function FirstLogOnboardingOverlay({
  open,
  step,
  contentTypePicked,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}: {
  open: boolean;
  step: FirstLogOnboardingStep;
  contentTypePicked: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [requirementMet, setRequirementMet] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => STEP_CONFIG[step], [step]);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const element = document.querySelector(current.selector) as HTMLElement | null;

    if (!element) {
      setRect(null);
      return;
    }

    const update = () => {
      let nextRect = element.getBoundingClientRect();

      if (step === 2) {
        const panel = document.querySelector('[data-onboarding-target="title-search-panel"]') as HTMLElement | null;
        if (panel) {
          const panelRect = panel.getBoundingClientRect();
          const top = Math.min(nextRect.top, panelRect.top);
          const left = Math.min(nextRect.left, panelRect.left);
          const right = Math.max(nextRect.right, panelRect.right);
          const bottom = Math.max(nextRect.bottom, panelRect.bottom);
          nextRect = new DOMRect(left, top, right - left, bottom - top);
        }
      }

      setRect(nextRect);
    };

    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: prefersReduced ? "auto" : "smooth",
    });

    const timer = window.setTimeout(update, prefersReduced ? 0 : 150);
    const interval = window.setInterval(update, 180);
    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current.selector, open, step]);

  useEffect(() => {
    if (!open) {
      setRequirementMet(false);
      return;
    }

    if (step === 1) {
      setRequirementMet(contentTypePicked);
      return;
    }

    if (!current.requirementSelector) {
      setRequirementMet(true);
      return;
    }

    const check = () => {
      setRequirementMet(Boolean(document.querySelector(current.requirementSelector!)));
    };

    check();
    const interval = window.setInterval(check, 200);
    window.addEventListener("resize", check);
    window.addEventListener("scroll", check, true);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", check);
      window.removeEventListener("scroll", check, true);
    };
  }, [contentTypePicked, current.requirementSelector, open, step]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
        return;
      }

      if (e.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onSkip]);

  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    if (!root) return;
    const firstButton = root.querySelector<HTMLElement>("button");
    firstButton?.focus();
  }, [open, step]);

  if (!open) return null;

  const isLastStep = step === 4;
  const showNextButton = step !== 3;
  const canProceed = (step === 1 || step === 2) ? requirementMet : true;

  return (
    <div className="pointer-events-none fixed inset-0 z-[130]">
      <div className="pointer-events-none absolute inset-0 bg-black/55 transition-opacity duration-200 motion-reduce:transition-none" />

      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl border-2 border-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: clamp(rect.top - 8, 8, window.innerHeight - 16),
            left: clamp(rect.left - 8, 8, window.innerWidth - 16),
            width: clamp(rect.width + 16, 64, window.innerWidth - 16),
            height: clamp(rect.height + 16, 44, window.innerHeight - 16),
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="첫 기록 가이드"
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
        >
          <div className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {step}/4
          </div>
          {step <= 2 ? (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              처음 오셨나요? 첫 기록을 30초 안에 남길 수 있게 안내해 드려요.
            </div>
          ) : null}
          <div className="mt-1 text-base font-semibold text-foreground">{current.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{current.body}</p>
          {(step === 1 || step === 2) && !requirementMet ? (
            <p className="mt-2 text-xs text-amber-600">{current.requirementLabel}</p>
          ) : null}
          {step === 3 ? (
            <p className="mt-2 text-xs text-muted-foreground">저장 후 자동으로 다음 단계가 열려요.</p>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              건너뛰기
            </button>
            <div className="flex items-center gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={onPrev}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  이전
                </button>
              ) : null}
              {showNextButton ? (
                <button
                  type="button"
                  onClick={isLastStep ? onComplete : onNext}
                  disabled={!canProceed}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {current.primary}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {current.primary}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
