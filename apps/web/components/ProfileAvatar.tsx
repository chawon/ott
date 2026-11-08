import { UserRound } from "lucide-react";
import Image from "next/image";
import { avatarSrc, isPersonaKey } from "@/lib/profile";
import type { PersonaKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProfileAvatar({
  personaKey,
  size = 40,
  className,
  imageClassName,
  alt = "",
}: {
  personaKey?: PersonaKey | null;
  size?: number;
  className?: string;
  imageClassName?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ott-paper-strong text-brand-navy dark:text-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {isPersonaKey(personaKey) ? (
        <Image
          src={avatarSrc(personaKey)}
          alt={alt}
          fill
          sizes={`${size}px`}
          className={cn("object-contain", imageClassName)}
        />
      ) : (
        <UserRound
          aria-hidden={alt ? undefined : true}
          aria-label={alt || undefined}
          size={Math.round(size * 0.45)}
          strokeWidth={1.5}
        />
      )}
    </span>
  );
}
