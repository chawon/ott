import Image from "next/image";
import { avatarLayerStyle, avatarSrc } from "@/lib/profile";
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
        "relative block shrink-0 overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute h-full w-full"
        style={avatarLayerStyle(personaKey)}
      >
        <Image
          src={avatarSrc(personaKey)}
          alt={alt}
          fill
          sizes={`${size}px`}
          className={cn("scale-[1.85] object-cover", imageClassName)}
        />
      </span>
    </span>
  );
}
