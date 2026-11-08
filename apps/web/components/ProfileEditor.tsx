"use client";

import { Check, Clock3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_PERSONA_KEY, isPersonaKey, PERSONA_KEYS } from "@/lib/profile";
import { saveUserProfile } from "@/lib/profileApi";
import type { PersonaKey, UserProfile } from "@/lib/types";
import ProfileAvatar from "./ProfileAvatar";
import styles from "./ProfileEditor.module.css";

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
  const ko = useLocale() === "ko";
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
    <form onSubmit={handleSubmit} className={styles.editor}>
      <div className={styles.preview} aria-live="polite">
        <ProfileAvatar personaKey={personaKey} size={72} alt={t("avatarAlt")} />
        <div>
          <strong>
            {nickname.trim() || (ko ? "나의 타임라인" : "My timeline")}
          </strong>
          <p>
            {personaKey === "archive_collector" && !ko
              ? "Timeline keeper"
              : t(`personas.${personaKey}`)}
          </p>
        </div>
      </div>
      <label className={styles.field}>
        <span>{t("nicknameLabel")}</span>
        <input
          name="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={32}
          placeholder={t("nicknamePlaceholder")}
          autoComplete="off"
          disabled={disabled || saving}
          required
        />
      </label>
      <fieldset className={styles.choices} disabled={disabled || saving}>
        <legend>
          {ko ? "나와 닮은 아바타" : "An avatar that feels like you"}
        </legend>
        <div className={styles.choiceGrid}>
          {PERSONA_KEYS.map((key) => (
            <label key={key} className={styles.choice}>
              <input
                type="radio"
                name="persona"
                value={key}
                checked={personaKey === key}
                onChange={() => setPersonaKey(key)}
              />
              <ProfileAvatar personaKey={key} size={72} />
              <span>
                {key === "archive_collector" && !ko
                  ? "Timeline keeper"
                  : t(`personas.${key}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.privacy}>
        {ko
          ? "닉네임과 아바타는 내 화면에서만 보여요. 함께 화면에는 공개되지 않아요."
          : "Your nickname and avatar stay on your own screens. They are not shown in Together."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p
          aria-live="polite"
          className="text-sm text-brand-navy dark:text-foreground"
        >
          {message}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="submit"
          disabled={disabled || saving || !nickname.trim()}
          className={styles.save}
        >
          <Check aria-hidden="true" size={18} />
          {saving ? t("saving") : (submitLabel ?? t("saveAction"))}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className={styles.dismiss}
          >
            <Clock3 aria-hidden="true" size={18} />
            {t("laterAction")}
          </button>
        )}
      </div>
    </form>
  );
}
