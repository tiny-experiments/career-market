import { useState } from "react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { monogram } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";

export interface LogoProps {
  readonly name: string;
  /** The website the mark belongs to; without one the monogram shows. */
  readonly domain?: string | null;
  /** Companies are round, professions and skills are square tiles. */
  readonly shape?: "round" | "square";
  /** 24, 32 or 40 px. */
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE = { sm: "sm", md: "default", lg: "lg" } as const;

/**
 * A plain lazy image over the monogram. Avatar's own image preloads every mark
 * up front, which a long table cannot afford, and it would ignore lazy loading.
 */
function LogoMark({
  src,
  square,
}: {
  readonly src: string;
  readonly square: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  if (state === "failed") return null;
  return (
    <img
      data-slot="logo-mark"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
      className={cn(
        "absolute inset-0 size-full bg-card object-contain p-px",
        square ? "rounded-lg" : "rounded-full",
        state === "loaded" ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * One logo component for companies, professions and skills: the real mark
 * when the domain is known, a monogram on a tinted tile when it is not.
 * Theme-aware, lazy, and decorative beside the name that labels it.
 */
export function Logo({
  name,
  domain,
  shape = "round",
  size = "md",
  className,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const src = logoUrl(domain, resolvedTheme === "light" ? "light" : "dark");
  const square = shape === "square";
  const radius = square ? "rounded-lg after:rounded-lg" : "";

  return (
    <Avatar
      size={SIZE[size]}
      data-shape={shape}
      className={cn("bg-tile", radius, className)}
    >
      <AvatarFallback
        className={cn(
          "bg-tile font-semibold text-subtle",
          "text-eyebrow",
          square && "rounded-lg",
        )}
      >
        {monogram(name)}
      </AvatarFallback>
      {src ? <LogoMark key={src} src={src} square={square} /> : null}
    </Avatar>
  );
}
