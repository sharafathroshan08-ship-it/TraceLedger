"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorBanner,
  LoadingRows,
  Money,
  PageHeader,
  SeverityBadge,
  StatCard,
} from "@/components/shared";
import { useSession } from "@/components/session-provider";
import {
  getDetectionSummary,
  listAccounts,
  listTransactions,
} from "@/lib/api";
import { formatDateShort, formatINR } from "@/lib/utils";
import type { Account, Finding, Transaction } from "@/types";

export default function DashboardPage() {
  const { session, loading: sessionLoading } = useSession();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [summary, setSummary] = React.useState<{
    total: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [accountData, transactionData, detection] = await Promise.all([
          listAccounts(),
          listTransactions(),
          getDetectionSummary(),
        ]);
        if (cancelled) return;
        setAccounts(accountData);
        setTransactions(transactionData);
        setSummary(detection);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountNumbers = React.useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((account) => map.set(account.id, account.account_number));
    return map;
  }, [accounts]);

  const totalValue = React.useMemo(
    () => transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions],
  );

  const recent = React.useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6),
    [transactions],
  );

  const severityRows = ["critical", "high", "medium", "low"] as const;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A live view of the current synthetic workspace. Every number is read from the backend."
        actions={
          <>
            <Link href="/investigations">
              <Button size="sm">
                Run an investigation <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/network">
              <Button size="sm" variant="outline">
                Open network
              </Button>
            </Link>
          </>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total accounts"
          value={sessionLoading ? "—" : session?.accounts_count ?? accounts.length}
          hint={`${accounts.filter((account) => account.is_active).length} active`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Transactions"
          value={sessionLoading ? "—" : session?.transactions_count ?? transactions.length}
          hint="Directed edges in the graph"
          icon={<ArrowLeftRight className="h-4 w-4" />}
        />
        <StatCard
          label="Transferred value"
          value={<span className="text-xl">{formatINR(totalValue, { compact: true })}</span>}
          hint={formatINR(totalValue)}
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label="Suspicious findings"
          value={loading ? "—" : summary?.total ?? 0}
          hint="Rule-based indicators, not proof"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">Recent transactions</h2>
              <p className="text-2xs text-muted-foreground">Latest six transfers in this workspace</p>
            </div>
            <Link href="/transactions" className="text-2xs font-medium text-zinc-500 hover:text-foreground">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="p-5">
              <LoadingRows rows={5} />
            </div>
          ) : recent.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No transactions yet"
                description="Add a transfer to start building the directed graph."
                action={
                  <Link href="/transactions">
                    <Button size="sm" variant="outline">
                      Add transaction
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-2xs font-medium">
                      {accountNumbers.get(transaction.source_account_id)?.slice(-2) ?? "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">
                        {accountNumbers.get(transaction.source_account_id) ?? "unknown"}
                        <span className="mx-1.5 text-zinc-400">→</span>
                        {accountNumbers.get(transaction.destination_account_id) ?? "unknown"}
                      </p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {transaction.description || transaction.transaction_id} ·{" "}
                        {formatDateShort(transaction.timestamp)}
                      </p>
                    </div>
                  </div>
                  <Money paise={transaction.amount} className="shrink-0 text-xs font-medium" />
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Detection breakdown</h2>
              <Link href="/reports" className="text-2xs font-medium text-zinc-500 hover:text-foreground">
                Reports
              </Link>
            </div>
            <p className="mt-1 text-2xs text-muted-foreground">
              Five educational heuristics run across today&apos;s graph.
            </p>

            <div className="mt-4 space-y-2">
              {severityRows.map((severity) => {
                const count = summary?.by_severity?.[severity] ?? 0;
                const total = summary?.total ?? 0;
                const width = total ? Math.max(6, Math.round((count / total) * 100)) : 0;
                return (
                  <div key={severity}>
                    <div className="mb-1 flex items-center justify-between">
                      <SeverityBadge severity={severity} />
                      <span className="text-2xs tabular text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4">
              {[
                ["Chains", "transaction_chain"],
                ["Cycles", "circular_transaction"],
                ["Rapid", "rapid_movement"],
                ["High value", "high_value_transfer"],
                ["Intermediary", "suspicious_intermediary"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between rounded-md bg-[#fafafa] px-2.5 py-2">
                  <span className="text-2xs text-zinc-500">{label}</span>
                  <span className="text-2xs font-medium tabular">
                    {summary?.by_type?.[key] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-900 bg-zinc-900 p-5 text-white">
            <p className="text-2xs uppercase tracking-[0.14em] text-zinc-400">Quick start</p>
            <h2 className="mt-2 text-sm font-semibold">Pick a start account, run DFS</h2>
            <p className="mt-1 text-2xs leading-relaxed text-zinc-400">
              The backend returns the real traversal order and the detection engine scores the
              connected network.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/investigations">
                <Button size="sm" className="bg-white text-zinc-900 hover:bg-zinc-200">
                  Investigate <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/network">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  View graph
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
