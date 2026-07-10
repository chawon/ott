"use client";

import { Check, Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_PERSONA_KEY, isPersonaKey, PERSONA_KEYS } from "@/lib/profile";
import { saveUserProfile } from "@/lib/profileApi";
import type { PersonaKey, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import ProfileAvatar from "./ProfileAvatar";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ProfileEditor({
  profile,
  onSaved,
  onDismiss,
  submitLabel,
  disabled = false,
}: {
  profile: UserProfile | null;
  onSaved?: (profile: UserProfile) => void;
  onDismiss?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("Profile");
  const initialPersona = useMemo(
    () =>
      isPersonaKey(profile?.personaKey)
        ? profile.personaKey
        : DEFAULT_PERSONA_KEY,
    [profile?.personaKey],
  );
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [personaKey, setPersonaKey] = useState<PersonaKey>(initialPersona);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(profile?.nickname ?? "");
    setPersonaKey(initialPersona);
  }, [initialPersona, profile?.nickname]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || disabled) return;
    const normalizedNickname = nickname.trim();
    setMessage(null);
    setError(null);

    if (!normalizedNickname) {
      setError(t("nicknameRequired"));
      return;
    }
    if (normalizedNickname.length > 32) {
      setError(t("nicknameTooLong"));
      return;
    }

    setSaving(true);
    try {
      const saved = await saveUserProfile({
        nickname: normalizedNickname,
        personaKey,
      });
      setNickname(saved.nickname ?? normalizedNickname);
      setMessage(t("saved"));
      onSaved?.(saved);
    } catch (err) {
      setError(getErrorMessage(err, t("saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("nicknameLabel")}
          </span>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={32}
            placeholder={t("nicknamePlaceholder")}
            disabled={disabled || saving}
            className={cn(
              "min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition",
              "focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
            )}
          />
        </label>
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
          <ProfileAvatar
            personaKey={personaKey}
            size={44}
            alt={t("avatarAlt")}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {t(`personas.${personaKey}`)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("personaCurrent")}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {t("personaLabel")}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PERSONA_KEYS.map((key) => {
            const selected = personaKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPersonaKey(key)}
                disabled={disabled || saving}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition",
                  selected
                    ? "border-[#1E4D8C]/40 bg-ott-paper-strong text-[#1E4D8C] shadow-sm ring-1 ring-[#1E4D8C]/15 dark:border-border dark:text-foreground dark:ring-border"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                  "disabled:opacity-50",
                )}
              >
                <ProfileAvatar personaKey={key} size={48} alt="" />
                <span className="break-keep">{t(`personas.${key}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : null}
      {message ? (
        <p className="text-xs font-medium text-[#1E4D8C] dark:text-foreground">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={disabled || saving || !nickname.trim()}
          className={cn(
            "inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40",
          )}
        >
          <Check className="h-4 w-4" />
          {saving ? t("saving") : (submitLabel ?? t("saveAction"))}
        </button>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Clock3 className="h-4 w-4" />
            {t("laterAction")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
