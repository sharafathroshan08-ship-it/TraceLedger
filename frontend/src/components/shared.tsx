import * as React from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatINR } from "@/lib/utils";
import type { Severity } from "@/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="label-xs">{label}</p>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-1 text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const severityStyles: Record<Severity, string> = {
  low: "border-zinc-200 bg-zinc-50 text-zinc-600",
  medium: "border-zinc-300 bg-white text-zinc-800",
  high: "border-zinc-900 bg-zinc-900 text-white",
  critical: "border-black bg-black text-white",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.08em]",
        severityStyles[severity] ?? severityStyles.low,
      )}
    >
      {severity}
    </span>
  );
}

export function FindingTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    transaction_chain: "Transaction chain",
    circular_transaction: "Circular flow",
    rapid_movement: "Rapid movement",
    high_value_transfer: "High-value transfer",
    suspicious_intermediary: "Suspicious intermediary",
  };
  return <Badge variant="outline">{labels[type] ?? type.replace(/_/g, " ")}</Badge>;
}

export function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={cn("tabular", className)}>{formatINR(paise)}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-[#fafafa]">
        <Inbox className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}
