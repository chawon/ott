"use client";

import { useLocale, useTranslations } from "next-intl";
import FeelingIcon from "@/components/FeelingIcon";
import type { Title } from "@/lib/types";
import { ratingDisplay, ratingOptionsForType } from "@/lib/utils";
import styles from "./recording.module.css";

export default function RecordFeelings({
  value,
  type,
  onChange,
}: {
  value: number | "";
  type?: Title["type"];
  onChange: (value: number | "") => void;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickLogCard");
  // Legacy 2/4/4.5 values select a display bucket, but stay unchanged until a click.
  const selected = ratingDisplay(value === "" ? null : value, type, t)?.value;
  return (
    <fieldset className={styles.feelings}>
      <legend>
        {locale === "ko"
          ? "어떤 느낌으로 남았나요? (선택)"
          : "How did it feel? (optional)"}
      </legend>
      <div className={styles.feelingChoices}>
        {ratingOptionsForType(type, t).map((option) => {
          const label = ratingDisplay(option.value, type, t)?.label;
          return (
            <button
              key={option.value}
              data-testid={`record-feeling-${option.value}`}
              type="button"
              aria-pressed={selected === option.value}
              onClick={() => onChange(option.value)}
            >
              <FeelingIcon value={option.value} type={type} size={24} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {value !== "" ? (
        <button
          type="button"
          className={styles.quiet}
          onClick={() => onChange("")}
        >
          {locale === "ko" ? "느낌 선택 지우기" : "Clear feeling"}
        </button>
      ) : null}
    </fieldset>
  );
}
