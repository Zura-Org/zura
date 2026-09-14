import clsx from "clsx";
import Link from "next/link";
import type { Complexity } from "@/lib/types";
import { WAVE_STATUS_LABEL } from "@/lib/format";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  href?: string;
  loading?: boolean;
};

const buttonClasses = (variant: ButtonProps["variant"] = "primary", size: ButtonProps["size"] = "md") =>
  clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    {
      "bg-zura text-white hover:bg-zura-600": variant === "primary",
      "border border-ink-600 bg-ink-850 text-white hover:border-mist-400": variant === "secondary",
      "text-mist-300 hover:bg-ink-800 hover:text-white": variant === "ghost",
      "bg-critical/15 text-critical hover:bg-critical/25": variant === "danger",
    },
    { "h-8 px-3 text-xs": size === "sm", "h-10 px-4 text-sm": size === "md", "h-12 px-6 text-base": size === "lg" },
  );

export function Button({ variant, size, href, loading, className, children, disabled, ...rest }: ButtonProps) {
  const cls = clsx(buttonClasses(variant, size), className);
  if (href) {
    const external = href.startsWith("http");
    return external ? (
      <a href={href} className={cls}>
        {children}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

const COMPLEXITY_STYLE: Record<Complexity, string> = {
  easy: "bg-easy/10 text-easy ring-easy/30",
  medium: "bg-medium/10 text-medium ring-medium/30",
  hard: "bg-hard/10 text-hard ring-hard/30",
  critical: "bg-critical/10 text-critical ring-critical/30",
};

export function ComplexityBadge({ complexity, points }: { complexity: Complexity; points?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", COMPLEXITY_STYLE[complexity])}>
      {complexity}
      {points !== undefined && <span className="num opacity-80">· {points} pts</span>}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const live = status === "active";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        live ? "bg-easy/10 text-easy" : "bg-ink-800 text-mist-300",
      )}
    >
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-easy" />}
      {WAVE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-mist-400">{label}</div>
      <div className={clsx("num mt-2 text-2xl font-semibold", accent ? "text-usdc" : "text-white")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-mist-400">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-sm font-medium text-white">{title}</div>
      {children && <div className="max-w-md text-sm text-mist-400">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: { message: string } | string | null | undefined }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
      {typeof error === "string" ? error : error.message}
    </div>
  );
}

export function Avatar({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="rounded-full bg-ink-700" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full bg-ink-700 text-xs font-semibold uppercase text-mist-300"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-ink-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-mist-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
