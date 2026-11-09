import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { monogram } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";

export interface LogoProps {
  readonly name: string;
  /** The company's own domain; skills and professions carry none and show a monogram. */
  readonly domain?: string | null;
  /** Companies are round, professions and skills are square tiles. */
  readonly shape?: "round" | "square";
  /** 24, 32 or 40 px. */
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE = { sm: "sm", md: "default", lg: "lg" } as const;

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
      {src ? (
        <AvatarImage
          src={src}
          alt=""
          loading="lazy"
          className={cn("bg-card p-px", square && "rounded-lg")}
        />
      ) : null}
      <AvatarFallback
        delayMs={src ? 300 : 0}
        className={cn(
          "bg-tile font-semibold text-subtle",
          "text-eyebrow",
          square && "rounded-lg",
        )}
      >
        {monogram(name)}
      </AvatarFallback>
    </Avatar>
  );
}
