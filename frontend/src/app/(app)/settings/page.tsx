"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ErrorBanner,
  KeyValue,
  PageHeader,
  SeverityBadge,
} from "@/components/shared";
import { useSession } from "@/components/session-provider";
import { API_BASE, deleteWorkspace } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { session, loading, error, reset } = useSession();

  const [busy, setBusy] = React.useState<"reset" | "delete" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function handleReset() {
    const confirmed = window.confirm(
      "Restore the original demo dataset? Any accounts, transactions and investigations you added will be removed.",
    );
    if (!confirmed) return;
    setBusy("reset");
    setActionError(null);
    setNotice(null);
    try {
      await reset();
      setNotice("Demo dataset restored: 15 accounts, 28 transactions, no investigations.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteWorkspace() {
    const confirmed = window.confirm(
      "Delete this workspace and every row inside it? This cannot be undone.",
    );
    if (!confirmed) return;
    setBusy("delete");
    setActionError(null);
    setNotice(null);
    try {
      await deleteWorkspace();
      router.push("/");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete workspace");
    } finally {
      setBusy(null);
    }
  }

  async function copySession() {
    if (!session?.id) return;
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Clipboard access was blocked by the browser.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace controls, data boundaries and the reference dataset used by the demo."
      />

      <ErrorBanner message={error || actionError} />

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Session */}
        <section className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Workspace</h2>
            <p className="text-2xs text-muted-foreground">
              Anonymous, server-managed and scoped by an HttpOnly cookie.
            </p>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="rounded-md border border-border px-3">
              <KeyValue
                label="Session id"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono text-2xs">
                      {loading ? "loading…" : session?.id ?? "—"}
                    </span>
                    <button
                      type="button"
                      onClick={copySession}
                      disabled={!session?.id}
                      aria-label="Copy session id"
                      className="rounded-sm p-1 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </span>
                }
              />
              <KeyValue label="Accounts" value={session?.accounts_count ?? "—"} />
              <KeyValue label="Transactions" value={session?.transactions_count ?? "—"} />
              <KeyValue
                label="Investigations"
                value={session?.investigations_count ?? "—"}
              />
              <KeyValue
                label="API base"
                value={
                  <span className="font-mono text-2xs">
                    {API_BASE || "same origin (proxied)"}
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-md bg-[#fafafa] p-3">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <p className="text-2xs leading-relaxed text-zinc-500">
                The token is never exposed to JavaScript. Every account, transaction,
                investigation and finding query is filtered by this session on the server.
              </p>
            </div>

            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-2xs font-medium text-zinc-600 underline-offset-4 hover:underline"
            >
              Open FastAPI docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {/* Data controls */}
        <section className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Demo data</h2>
            <p className="text-2xs text-muted-foreground">
              Reset restores the seed; delete removes the workspace entirely.
            </p>
          </div>
          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <RotateCcw className="h-3.5 w-3.5 text-zinc-500" /> Reset demo dataset
                </p>
                <p className="mt-1 max-w-xs text-2xs leading-relaxed text-zinc-500">
                  Replaces everything in this workspace with the original 15 accounts and 28
                  transactions. Useful before a fresh walkthrough.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                disabled={busy !== null || loading}
              >
                {busy === "reset" ? "Resetting…" : "Reset"}
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                    <Trash2 className="h-3.5 w-3.5" /> Delete workspace
                  </p>
                  <p className="mt-1 max-w-xs text-2xs leading-relaxed text-zinc-500">
                    Permanently removes this session and every row scoped to it. A new empty
                    workspace is created the next time you enter the demo.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteWorkspace}
                  disabled={busy !== null || loading}
                >
                  {busy === "delete" ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p className="text-2xs leading-relaxed text-amber-800">
                All data here is synthetic. Do not enter real customer or account information.
              </p>
            </div>
          </div>
        </section>

        {/* Reference dataset */}
        <section className="rounded-lg border border-border bg-white lg:col-span-2">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Database className="h-3.5 w-3.5 text-zinc-500" /> What the seed contains
            </h2>
            <p className="text-2xs text-muted-foreground">
              Five rule families and two disconnected accounts, so the algorithms have something
              real to find.
            </p>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                title: "Transaction chain",
                severity: "high" as const,
                body: "A layered path through several accounts: ACC1001 → 1002 → 1003 → 1004 → 1005 …",
              },
              {
                title: "Circular flow",
                severity: "high" as const,
                body: "Funds returning to their origin: ACC1011 → 1012 → 1013 → 1011.",
              },
              {
                title: "Rapid movement",
                severity: "medium" as const,
                body: "Four sweeps inside a two-hour window through ACC1006–ACC1009.",
              },
              {
                title: "High-value transfer",
                severity: "critical" as const,
                body: "A single ₹5,00,000.00 property advance from ACC1008 to ACC1012.",
              },
              {
                title: "Suspicious intermediary",
                severity: "high" as const,
                body: "ACC1007 aggregates from several accounts and redistributes onward.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white p-4">
                <SeverityBadge severity={item.severity} />
                <h3 className="mt-2 text-xs font-semibold">{item.title}</h3>
                <p className="mt-1 text-2xs leading-relaxed text-zinc-500">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-5 py-3 text-2xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              ACC1014 and ACC1015 form a disconnected two-account component, which is why a DFS
              from the main network never reaches them.
            </p>
            <p className="font-mono">15 vertices · 28 edges · 2 components</p>
          </div>
        </section>
      </div>
    </div>
  );
}
