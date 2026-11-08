"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import QuickLogCard from "./QuickLogCard";
import styles from "./recording.module.css";

export type QuickLogDialogProps = ComponentProps<typeof QuickLogCard> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function QuickLogDialog({
  open,
  onOpenChange,
  ...props
}: QuickLogDialogProps) {
  const locale = useLocale();
  const [stage, setStage] = useState("search");
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open && stage !== "search")
      content.current
        ?.querySelector<HTMLHeadingElement>("h2")
        ?.focus({ preventScroll: true });
  }, [open, stage]);
  useEffect(() => {
    if (!open) setStage("search");
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      frame = 0;
      content.current?.style.setProperty(
        "--record-viewport-top",
        `${Math.max(0, viewport?.offsetTop ?? 0)}px`,
      );
      content.current?.style.setProperty(
        "--record-viewport-height",
        `${Math.max(1, viewport?.height ?? window.innerHeight)}px`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);
  const ko = locale === "ko";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          ref={content}
          className={styles.dialog}
          data-record-stage={stage}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current?.isConnected
              ? opener.current
              : document.querySelector<HTMLElement>("main h1, main");
            if (!target) return;
            if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
              target.setAttribute("tabindex", "-1");
              target.addEventListener(
                "blur",
                () => target.removeAttribute("tabindex"),
                { once: true },
              );
            }
            target.focus({ preventScroll: true });
          }}
          onOpenAutoFocus={(event) => {
            const active = document.activeElement;
            opener.current =
              active instanceof HTMLElement &&
              active !== document.body &&
              !content.current?.contains(active)
                ? active
                : null;
            if (props.activationTitleSelection || props.initialCatalogTitle)
              return;
            event.preventDefault();
            content.current
              ?.querySelector<HTMLInputElement>('input[type="search"]')
              ?.focus({ preventScroll: true });
          }}
        >
          <header className={styles.dialogHeader}>
            <div>
              <p className={styles.eyebrow}>ON THE TIMELINE</p>
              <Dialog.Title tabIndex={-1}>
                {stage === "search"
                  ? ko
                    ? "오늘은 어떤 이야기를 남길까요?"
                    : "What story will you keep today?"
                  : stage === "saved"
                    ? ko
                      ? "타임라인에 한 순간이 더해졌어요."
                      : "One more moment on your timeline."
                    : ko
                      ? "그날의 순간을 남겨요"
                      : "Keep this moment"}
              </Dialog.Title>
              <Dialog.Description className={styles.description}>
                {ko
                  ? "영화, 시리즈, 책. 남겨두고 싶은 만큼만 적어요."
                  : "Films, series, books. Keep as much as you want."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className={styles.close}
              aria-label={ko ? "기록 창 닫기" : "Close recording"}
            >
              <X size={22} />
            </Dialog.Close>
          </header>
          <div className={styles.dialogBody}>
            <QuickLogCard
              {...props}
              dialogLayout
              autoFocusSearch={false}
              searchFocusSignal={0}
              onStageChange={setStage}
              onDone={() => onOpenChange(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
