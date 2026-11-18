import { cn } from "~/lib/utils";

export type CoworkerAvatarStatus = "working" | "warning" | "ready" | "error" | "idle" | null;

interface CoworkerAvatarProps {
  readonly variant?: "orb" | "cube";
  readonly shape?: "orb" | "cube";
  readonly color?: string;
  readonly colorHex?: string;
  readonly size?: "xs" | "sm" | "md" | "lg" | "xl";
  readonly statusDot?: CoworkerAvatarStatus;
  readonly status?: CoworkerAvatarStatus;
  readonly className?: string;
}

const SIZE_MAP = {
  xs: "size-4",
  sm: "size-6",
  md: "size-7",
  lg: "size-14",
  xl: "size-16",
} as const;

const STATUS_DOT_CLASS = {
  working: "bg-emerald-400 shadow-[0_0_6px_#34d399]",
  warning: "bg-amber-400 shadow-[0_0_6px_#fbbf24]",
  ready: "bg-indigo-400",
  idle: "bg-zinc-400",
  error: "bg-rose-500 shadow-[0_0_6px_#f43f5e]",
} as const;

export function CoworkerAvatar({
  variant,
  shape,
  color,
  colorHex,
  size = "md",
  statusDot,
  status,
  className,
}: CoworkerAvatarProps) {
  const resolvedVariant = variant ?? shape ?? "cube";
  const resolvedColor = colorHex ?? color ?? "#6366f1";
  const resolvedStatus = statusDot ?? status ?? null;
  const dimensionClass = SIZE_MAP[size];

  if (resolvedVariant === "orb") {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center select-none",
          dimensionClass,
          className,
        )}
      >
        {size === "lg" || size === "xl" ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full opacity-35 blur-xl"
            style={{
              background: `radial-gradient(circle, ${resolvedColor} 0%, transparent 70%)`,
            }}
          />
        ) : null}
        <svg viewBox="0 0 64 64" className="size-full overflow-visible" aria-hidden>
          <defs>
            <radialGradient
              id={`orb-grad-${resolvedColor.replace(/[^a-zA-Z0-9]/g, "")}`}
              cx="35%"
              cy="28%"
              r="70%"
            >
              <stop offset="0%" stopColor="var(--color-primary-foreground)" />
              <stop offset="40%" stopColor={resolvedColor} />
              <stop offset="100%" stopColor="var(--color-background)" />
            </radialGradient>
          </defs>
          <circle
            cx="32"
            cy="32"
            r="28"
            fill={`url(#orb-grad-${resolvedColor.replace(/[^a-zA-Z0-9]/g, "")})`}
          />
          <ellipse
            cx="24"
            cy="18"
            rx="10"
            ry="5"
            transform="rotate(-18 24 18)"
            fill="var(--color-zinc-25)"
            fillOpacity="0.28"
          />
          <rect
            x="14"
            y="25"
            width="28"
            height="15"
            rx="7.5"
            transform="rotate(-6 28 32)"
            fill="var(--color-background)"
            fillOpacity="0.88"
          />
          <ellipse
            cx="23"
            cy="32"
            rx="2.6"
            ry="3.6"
            transform="rotate(-6 23 32)"
            fill="var(--color-zinc-25)"
          />
          <ellipse
            cx="33"
            cy="31"
            rx="2.6"
            ry="3.6"
            transform="rotate(-6 33 31)"
            fill="var(--color-zinc-25)"
          />
        </svg>
        {resolvedStatus ? (
          <span
            aria-hidden
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-background",
              STATUS_DOT_CLASS[resolvedStatus],
            )}
          />
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center select-none",
        dimensionClass,
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-full overflow-visible" aria-hidden>
        <polygon points="32,6 56,18 32,30 8,18" fill={resolvedColor} fillOpacity="0.95" />
        <polygon points="32,6 56,18 32,30 8,18" fill="var(--color-zinc-25)" fillOpacity="0.22" />
        <polygon points="8,18 32,30 32,56 8,44" fill={resolvedColor} />
        <polygon points="8,18 32,30 32,56 8,44" fill="var(--color-background)" fillOpacity="0.12" />
        <polygon points="32,30 56,18 56,44 32,56" fill={resolvedColor} />
        <polygon
          points="32,30 56,18 56,44 32,56"
          fill="var(--color-background)"
          fillOpacity="0.34"
        />
        <polygon
          points="12,28 28,36 28,45 12,37"
          fill="var(--color-background)"
          fillOpacity="0.82"
        />
        <circle cx="16.5" cy="34.5" r="2.1" fill="var(--color-zinc-25)" />
        <circle cx="23.5" cy="38" r="2.1" fill="var(--color-zinc-25)" />
      </svg>
      {resolvedStatus ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-background",
            STATUS_DOT_CLASS[resolvedStatus],
          )}
        />
      ) : null}
    </span>
  );
}

export function CoworkerAvatarStack({
  colors,
  items,
  maxVisible = 6,
}: {
  readonly colors?: ReadonlyArray<string>;
  readonly items?: ReadonlyArray<{
    readonly id: string;
    readonly color: string;
    readonly name?: string;
  }>;
  readonly maxVisible?: number;
}) {
  const defaultStack = [
    { id: "c1", color: "#6366f1" },
    { id: "c2", color: "#ec4899" },
    { id: "c3", color: "#10b981" },
    { id: "c4", color: "#f59e0b" },
    { id: "c5", color: "#06b6d4" },
  ];
  const entries =
    items ??
    (colors
      ? Array.from(new Set(colors)).map((colorValue) => ({ id: colorValue, color: colorValue }))
      : defaultStack);
  const visible = entries.slice(0, maxVisible);

  return (
    <span className="inline-flex items-center -space-x-1.5">
      {visible.map((entry) => (
        <CoworkerAvatar key={entry.id} variant="cube" colorHex={entry.color} size="xs" />
      ))}
    </span>
  );
}
