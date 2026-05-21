import Image from "next/image";
import { AVATAR_IMAGE_SCALE, avatarLayerStyle, avatarSrc } from "@/lib/profile";
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
  const imageRequestSize = Math.ceil(size * AVATAR_IMAGE_SCALE);

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
          sizes={`${imageRequestSize}px`}
          className={cn("object-cover", imageClassName)}
          style={{ transform: `scale(${AVATAR_IMAGE_SCALE})` }}
        />
      </span>
    </span>
  );
}
