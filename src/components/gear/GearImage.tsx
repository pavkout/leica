import type { ReactNode } from "react";
import manifest from "../../data/gearImages.json";

interface Entry {
  w320: string;
  w640: string;
  credit?: string;
}

const images = manifest as { bodies: Record<string, Entry>; lenses: Record<string, Entry>; credits: string[] };

export const GEAR_IMAGE_CREDITS = images.credits;

export function hasGearImage(kind: "bodies" | "lenses", id: string) {
  return id in images[kind];
}

/**
 * A licensed product photo when one has been added (see scripts/gear-images.mjs),
 * otherwise the drawing passed as children.
 */
export default function GearImage({
  kind,
  id,
  alt,
  sizes = "(min-width: 720px) 240px, 45vw",
  className,
  children,
}: {
  kind: "bodies" | "lenses";
  id: string;
  alt: string;
  sizes?: string;
  className?: string;
  children: ReactNode;
}) {
  const entry = images[kind][id];
  if (!entry) return <>{children}</>;
  return (
    <img
      className={className ? `gear-photo ${className}` : "gear-photo"}
      src={entry.w640}
      srcSet={`${entry.w320} 320w, ${entry.w640} 640w`}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={640}
      height={427}
    />
  );
}
