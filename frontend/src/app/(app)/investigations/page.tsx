"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  GitBranch,
  Play,
  ShieldCheck,
  Trash2,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  ErrorBanner,
  FindingTypeLabel,
  KeyValue,
  LoadingRows,
  Money,
  PageHeader,
  SeverityBadge,
} from "@/components/shared";
import {
  analyzeInvestigation,
  createInvestigation,
  deleteInvestigation,
  getInvestigationFindings,
  listAccounts,
  listInvestigations,
  runInvestigationDfs,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import type {
  Account,
  DFSResult,
  Finding,
  Investigation,
  InvestigationAnalysis,
} from "@/types";

export default function InvestigationsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [history, setHistory] = React.useState<Investigation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [startAccountId, setStartAccountId] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [dfs, setDfs] = React.useState<DFSResult | null>(null);
  const [analysis, setAnalysis] = React.useState<InvestigationAnalysis | null>(null);
  const [findings, setFindings] = React.useState<Finding[]>([]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [accountData, investigations] = await Promise.all([
        listAccounts(),
        listInvestigations(),
      ]);
      setAccounts(accountData);
      setHistory(investigations);
      setStartAccountId((current) => current || String(accountData[0]?.id ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load investigations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const accountMap = React.useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const activeInvestigation = history.find((item) => item.id === activeId) || null;

  async function runInvestigation(event: React.FormEvent) {
    event.preventDefault();
    if (!startAccountId) {
      setError("Choose a start account first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const investigation = await createInvestigation(Number(startAccountId));
      const [dfsResult, analysisResult] = await Promise.all([
        runInvestigationDfs(investigation.id),
        analyzeInvestigation(investigation.id),
      ]);
      setActiveId(investigation.id);
      setDfs(dfsResult);
      setAnalysis(analysisResult);
      setFindings(analysisResult.findings);
      const [investigations, refreshedFindings] = await Promise.all([
        listInvestigations(),
        getInvestigationFindings(investigation.id),
      ]);
      setHistory(investigations);
      setFindings(refreshedFindings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setRunning(false);
    }
  }

  async function openInvestigation(investigation: Investigation) {
    setActiveId(investigation.id);
    setAnalysis(null);
    setDfs(null);
    setFindings([]);
    try {
      const [found, detail] = await Promise.all([
        getInvestigationFindings(investigation.id),
        Promise.resolve(investigation),
      ]);
      setFindings(found);
      const traversal = detail.dfs_traversal;
      if (traversal) {
        setDfs({
          start_account: traversal.start_account,
          traversal_order: traversal.traversal_order ?? [],
          visited: traversal.visited ?? [],
          adjacency_list: traversal.adjacency_list ?? {},
          time_complexity: traversal.time_complexity ?? "O(V + E)",
          space_complexity: traversal.space_complexity ?? "O(V)",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open investigation");
    }
  }

  async function handleDelete(investigation: Investigation) {
    const confirmed = window.confirm(`Delete investigation #${investigation.id}?`);
    if (!confirmed) return;
    try {
      await deleteInvestigation(investigation.id);
      if (activeId === investigation.id) {
        setActiveId(null);
        setDfs(null);
        setAnalysis(null);
        setFindings([]);
      }
      setHistory(await listInvestigations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete investigation");
    }
  }

  const startAccount = activeInvestigation
    ? accountMap.get(activeInvestigation.start_account_id)
    : null;

  return (
    <div>
      <PageHeader
        title="Investigations"
        description="Pick a starting account, run the real iterative DFS on the server, then let the five detectors score the network."
      />

      <ErrorBanner message={error} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Start a new investigation</h2>
                <p className="mt-1 text-2xs text-muted-foreground">
                  DFS follows transaction direction. Cycles are handled by the visited set.
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fafafa]">
                <ShieldCheck className="h-4 w-4 text-zinc-600" strokeWidth={1.75} />
              </span>
            </div>

            <form onSubmit={runInvestigation} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="start_account">Start account</Label>
                <Select
                  id="start_account"
                  value={startAccountId}
                  onChange={(event) => setStartAccountId(event.target.value)}
                  disabled={loading || accounts.length === 0}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number} · {account.account_holder}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={running || !startAccountId} className="sm:w-auto">
                <Play className="h-3.5 w-3.5" />
                {running ? "Tracing…" : "Run investigation"}
              </Button>
            </form>
          </section>

          {!dfs && !analysis ? (
            <EmptyState
              title="No investigation open"
              description="Run a new investigation or open one from the history panel to see the traversal and findings."
            />
          ) : (
            <>
              <section className="rounded-lg border border-border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-zinc-500" />
                    <div>
                      <h2 className="text-sm font-semibold">
                        DFS traversal
                        {activeId ? (
                          <span className="ml-2 font-mono text-2xs font-normal text-zinc-400">
                            #{activeId}
                          </span>
                        ) : null}
                      </h2>
                      <p className="text-2xs text-muted-foreground">
                        Iterative stack · visited set · ordered as the backend returned it
                      </p>
                    </div>
                  </div>
                  {activeId && (
                    <Link href={`/reports?investigation=${activeId}`}>
                      <Button size="sm" variant="outline">
                        <FileText className="h-3.5 w-3.5" /> Open report
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="p-5">
                  {dfs ? (
                    <>
                      <div
                        data-testid="dfs-traversal"
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        {dfs.traversal_order.map((number, index) => (
                          <React.Fragment key={`${number}-${index}`}>
                            <span
                              className={
                                index === 0
                                  ? "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 font-mono text-2xs text-white"
                                  : "inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 font-mono text-2xs"
                              }
                            >
                              <span
                                className={
                                  index === 0
                                    ? "text-white/50"
                                    : "text-zinc-400"
                                }
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              {number}
                            </span>
                            {index < dfs.traversal_order.length - 1 && (
                              <ChevronRight className="h-3 w-3 text-zinc-300" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric label="Visited" value={dfs.traversal_order.length} />
                        <Metric label="Start" value={dfs.start_account} mono />
                        <Metric label="Time" value={dfs.time_complexity} mono />
                        <Metric label="Space" value={dfs.space_complexity} mono />
                      </div>

                      <p className="mt-4 text-2xs leading-relaxed text-zinc-500">
                        Accounts outside this traversal are not reachable from{" "}
                        <span className="font-mono">{dfs.start_account}</span> following
                        transaction direction. They may still belong to another weakly connected
                        component.
                      </p>
                    </>
                  ) : (
                    <LoadingRows rows={2} />
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <div>
                    <h2 className="text-sm font-semibold">Findings</h2>
                    <p className="text-2xs text-muted-foreground">
                      Rule-based indicators. None of these is proof of fraud.
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-2xs tabular text-zinc-500">
                    {analysis?.findings_summary.total_findings ?? findings.length}
                  </span>
                </div>

                <div className="p-5">
                  {findings.length === 0 ? (
                    <p className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-xs text-muted-foreground">
                      No findings touch this account. Try an account inside the main network.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {findings.map((finding) => (
                        <li key={finding.id} className="rounded-md border border-border p-3.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={finding.severity} />
                            <FindingTypeLabel type={finding.finding_type} />
                            <span className="ml-auto text-2xs text-zinc-400">
                              #{finding.id}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed">{finding.description}</p>
                          <EvidenceBlock evidence={finding.evidence} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* History */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">History</h2>
              <p className="text-2xs text-muted-foreground">
                Saved in your private workspace
              </p>
            </div>

            {loading ? (
              <div className="p-4">
                <LoadingRows rows={4} />
              </div>
            ) : history.length === 0 ? (
              <div className="p-4">
                <p className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-muted-foreground">
                  No investigations yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((investigation) => {
                  const account = accountMap.get(investigation.start_account_id);
                  const active = investigation.id === activeId;
                  const patternCount =
                    investigation.suspicious_patterns?.total_findings ?? 0;
                  return (
                    <li
                      key={investigation.id}
                      className={
                        active
                          ? "flex items-start gap-2 bg-[#fafafa] px-4 py-3"
                          : "flex items-start gap-2 px-4 py-3"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => openInvestigation(investigation)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="flex items-center gap-1.5 font-mono text-xs font-medium">
                          {account?.account_number ?? `#${investigation.start_account_id}`}
                          <ArrowRight className="h-3 w-3 text-zinc-400" />
                          <span className="text-zinc-500">
                            {investigation.dfs_traversal
                              ? `${investigation.dfs_traversal.traversal_order.length} reached`
                              : "not run"}
                          </span>
                        </p>
                        <p className="mt-1 truncate text-2xs text-muted-foreground">
                          {formatDateShort(investigation.start_time)} ·{" "}
                          {patternCount} finding{patternCount === 1 ? "" : "s"}
                          {investigation.report_generated ? " · report" : ""}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <Link
                          href={`/reports?investigation=${investigation.id}`}
                          aria-label={`Open report for investigation ${investigation.id}`}
                          className="rounded-sm p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(investigation)}
                          aria-label={`Delete investigation ${investigation.id}`}
                          className="rounded-sm p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {activeInvestigation && (
            <section className="rounded-lg border border-border bg-white p-4">
              <p className="label-xs">Selected investigation</p>
              <div className="mt-2 rounded-md border border-border px-3">
                <KeyValue label="Investigation" value={`#${activeInvestigation.id}`} />
                <KeyValue
                  label="Start account"
                  value={
                    <span className="font-mono">
                      {startAccount?.account_number ??
                        `#${activeInvestigation.start_account_id}`}
                    </span>
                  }
                />
                <KeyValue
                  label="Holder"
                  value={startAccount?.account_holder ?? "—"}
                />
                <KeyValue
                  label="Reached"
                  value={
                    activeInvestigation.dfs_traversal?.traversal_order.length ??
                    dfs?.traversal_order.length ??
                    "—"
                  }
                />
                <KeyValue
                  label="Started"
                  value={formatDateShort(activeInvestigation.start_time)}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-2xs text-zinc-500">
                <Waypoints className="h-3.5 w-3.5" />
                Directional reachability only
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-[#fafafa] px-3 py-2.5">
      <p className="label-xs">{label}</p>
      <p className={mono ? "mt-1 font-mono text-xs" : "mt-1 text-xs font-medium"}>{value}</p>
    </div>
  );
}

function EvidenceBlock({ evidence }: { evidence?: Record<string, unknown> | null }) {
  if (!evidence) return null;

  const chain = evidence.chain as string[] | undefined;
  const cycle = evidence.cycle as string[] | undefined;
  const accountNumber = evidence.account_number as string | undefined;
  const transactionCount = evidence.transaction_count as number | undefined;
  const amountPaise = evidence.amount_paise as number | undefined;
  const thresholdPaise = evidence.threshold_paise as number | undefined;
  const receivers = evidence.receivers_count as number | undefined;
  const distributors = evidence.distributors_count as number | undefined;
  const involved = (evidence.involved_transactions as string[] | undefined) ?? [];

  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
      {(chain || cycle) && (
        <p className="break-words font-mono text-2xs text-zinc-500">
          {(chain ?? cycle ?? []).join(" → ")}
        </p>
      )}
      {accountNumber && (
        <p className="font-mono text-2xs text-zinc-500">account {accountNumber}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-zinc-500">
        {typeof amountPaise === "number" && (
          <span className="inline-flex items-center gap-1">
            amount <Money paise={amountPaise} className="font-medium text-zinc-700" />
          </span>
        )}
        {typeof thresholdPaise === "number" && (
          <span>threshold {formatShortPaise(thresholdPaise)}</span>
        )}
        {typeof transactionCount === "number" && <span>{transactionCount} transactions</span>}
        {typeof receivers === "number" && <span>{receivers} senders</span>}
        {typeof distributors === "number" && <span>{distributors} receivers</span>}
        {involved.length > 0 && (
          <span>
            {involved.length} linked transaction{involved.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function formatShortPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
