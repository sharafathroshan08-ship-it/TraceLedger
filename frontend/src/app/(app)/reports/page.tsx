"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Download,
  FileText,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  ErrorBanner,
  FindingTypeLabel,
  LoadingRows,
  Money,
  PageHeader,
  SeverityBadge,
} from "@/components/shared";
import { getInvestigationReport, listInvestigations } from "@/lib/api";
import { downloadCsv, formatDate, formatDateShort, formatINR } from "@/lib/utils";
import type { Investigation, Report } from "@/types";

export default function ReportsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-lg border border-border bg-white p-5">
          <LoadingRows rows={6} />
        </div>
      }
    >
      <ReportsContent />
    </React.Suspense>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("investigation");

  const [investigations, setInvestigations] = React.useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>(initialId ?? "");
  const [report, setReport] = React.useState<Report | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadList() {
      try {
        setLoading(true);
        const data = await listInvestigations();
        if (cancelled) return;
        setInvestigations(data);
        setSelectedId((current) => current || String(data[0]?.id ?? ""));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load investigations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    let cancelled = false;
    async function loadReport() {
      try {
        setReportLoading(true);
        setError(null);
        const data = await getInvestigationReport(Number(selectedId));
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to generate report");
          setReport(null);
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    }
    loadReport();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function exportFindings() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ["Finding ID", "Type", "Severity", "Description", "Evidence"],
      ...report.findings.map((finding) => [
        finding.id,
        finding.type,
        finding.severity,
        finding.description,
        finding.evidence ? JSON.stringify(finding.evidence) : "",
      ]),
    ];
    downloadCsv(`traceledger-investigation-${report.investigation_id}-findings.csv`, rows);
  }

  function exportTraversal() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ["Position", "Account"],
      ...report.dfs_results.traversal_order.map((account, index) => [index + 1, account]),
    ];
    downloadCsv(`traceledger-investigation-${report.investigation_id}-dfs.csv`, rows);
  }

  const selected = investigations.find((item) => String(item.id) === selectedId);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Reports"
          description="Generate a readable investigation report from a saved DFS run and its findings."
          actions={
            report ? (
              <>
                <Button size="sm" variant="outline" onClick={exportFindings}>
                  <Download className="h-3.5 w-3.5" /> Findings CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportTraversal}>
                  <Download className="h-3.5 w-3.5" /> DFS CSV
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </>
            ) : undefined
          }
        />

        <ErrorBanner message={error} />

        {loading ? (
          <div className="rounded-lg border border-border bg-white p-5">
            <LoadingRows rows={5} />
          </div>
        ) : investigations.length === 0 ? (
          <EmptyState
            title="No investigations to report on"
            description="Reports are built from saved investigations. Run one first, then come back here."
            action={
              <a href="/investigations">
                <Button size="sm">Open investigations</Button>
              </a>
            }
          />
        ) : (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="investigation" className="label-xs block">
                Investigation
              </label>
              <Select
                id="investigation"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {investigations.map((investigation) => (
                  <option key={investigation.id} value={investigation.id}>
                    #{investigation.id} · start account {investigation.start_account_id} ·{" "}
                    {formatDateShort(investigation.start_time)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 text-2xs text-zinc-500">
              <FileText className="h-3.5 w-3.5" />
              {selected?.report_generated ? "Report already generated" : "Generated on demand"}
            </div>
          </div>
        )}
      </div>

      {reportLoading ? (
        <div className="mt-4 rounded-lg border border-border bg-white p-5">
          <LoadingRows rows={7} />
        </div>
      ) : report ? (
        <ReportDocument report={report} />
      ) : (
        !loading &&
        investigations.length > 0 && (
          <EmptyState
            title="Select an investigation"
            description="Pick an investigation above to generate its report."
          />
        )
      )}
    </div>
  );
}

function ReportDocument({ report }: { report: Report }) {
  const severities = ["critical", "high", "medium", "low"] as const;
  const types = Object.keys(report.findings_summary.findings_by_type);

  return (
    <article className="print-plain mt-4 overflow-hidden rounded-lg border border-border bg-white">
      <header className="border-b border-border px-6 py-6 sm:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-2xs uppercase tracking-[0.18em] text-zinc-400">
              TraceLedger · Fraud investigation report
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              Investigation #{report.investigation_id}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Subject{" "}
              <span className="font-mono text-zinc-800">
                {report.start_account.account_number}
              </span>{" "}
              · {report.start_account.account_holder}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="label-xs">Generated</p>
            <p className="mt-1 text-xs">{formatDate(report.generated_at)}</p>
            <p className="mt-1 font-mono text-2xs text-zinc-400">
              session {report.session_id.slice(0, 8)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-0 border-b border-border sm:grid-cols-4">
        <SummaryCell label="Accounts visited" value={report.dfs_results.traversal_order.length} />
        <SummaryCell label="Total findings" value={report.findings_summary.total_findings} />
        <SummaryCell label="Critical" value={report.findings_summary.findings_by_severity.critical ?? 0} />
        <SummaryCell label="High" value={report.findings_summary.findings_by_severity.high ?? 0} />
      </div>

      <section className="border-b border-border px-6 py-6 sm:px-8">
        <h3 className="text-sm font-semibold">1. Subject account</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Account number" value={report.start_account.account_number} mono />
          <Fact label="Account holder" value={report.start_account.account_holder} />
          <Fact
            label="Balance"
            value={formatINR(report.start_account.balance)}
          />
          <Fact label="Started" value={formatDate(report.start_time)} />
        </div>
        {report.end_time && (
          <p className="mt-3 text-2xs text-zinc-400">
            Analysis completed {formatDate(report.end_time)}
          </p>
        )}
      </section>

      <section className="border-b border-border px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">2. Depth-first search</h3>
          <p className="font-mono text-2xs text-zinc-400">
            time {report.dfs_results.time_complexity} · space{" "}
            {report.dfs_results.space_complexity}
          </p>
        </div>

        {report.dfs_results.traversal_order.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No DFS run was recorded for this investigation.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {report.dfs_results.traversal_order.map((account, index) => (
              <React.Fragment key={`${account}-${index}`}>
                <span
                  className={
                    index === 0
                      ? "rounded-full bg-zinc-900 px-2 py-0.5 font-mono text-2xs text-white"
                      : "rounded-full border border-border px-2 py-0.5 font-mono text-2xs"
                  }
                >
                  {account}
                </span>
                {index < report.dfs_results.traversal_order.length - 1 && (
                  <ArrowRight className="h-2.5 w-2.5 text-zinc-300" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <p className="mt-3 text-2xs leading-relaxed text-zinc-500">
          The traversal follows outgoing transaction edges from the subject account. Accounts not
          listed were unreachable by direction, which does not mean they are unrelated.
        </p>
      </section>

      <section className="border-b border-border px-6 py-6 sm:px-8">
        <h3 className="text-sm font-semibold">3. Findings summary</h3>

        {types.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No rule-based findings were attached to this investigation.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="label-xs">By severity</p>
              <div className="mt-2 space-y-1.5">
                {severities.map((severity) => (
                  <div key={severity} className="flex items-center justify-between">
                    <SeverityBadge severity={severity} />
                    <span className="text-xs tabular">
                      {report.findings_summary.findings_by_severity[severity] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="label-xs">By rule</p>
              <div className="mt-2 space-y-1.5">
                {types.map((type) => (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <FindingTypeLabel type={type} />
                    <span className="text-xs tabular">
                      {report.findings_summary.findings_by_type[type]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="px-6 py-6 sm:px-8">
        <h3 className="text-sm font-semibold">4. Findings</h3>
        {report.findings.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Nothing to list.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {report.findings.map((finding) => (
              <li key={finding.id} className="rounded-md border border-border p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  <FindingTypeLabel type={finding.type} />
                  <span className="ml-auto font-mono text-2xs text-zinc-400">
                    F-{String(finding.id).padStart(3, "0")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed">{finding.description}</p>
                {finding.evidence && (
                  <p className="mt-2 break-words border-t border-border pt-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                    {compactEvidence(finding.evidence)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-md border border-border bg-[#fafafa] p-3">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <p className="text-2xs leading-relaxed text-zinc-500">
            This report is generated from synthetic demo data by rule-based heuristics. A finding
            is an indicator for human review, not evidence of wrongdoing or a determination of
            fraud.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <p className="font-mono text-2xs text-zinc-400">traceledger · educational simulation</p>
          <Money paise={report.start_account.balance} className="text-2xs text-zinc-400" />
        </div>
      </section>
    </article>
  );
}

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border px-6 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="label-xs">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular">{value}</p>
    </div>
  );
}

function Fact({
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

function compactEvidence(evidence: Record<string, unknown>): string {
  const entries = Object.entries(evidence).filter(([, value]) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.length > 6 ? `${value.slice(0, 6).join(", ")}…` : value.join(", ")}`;
      }
      if (typeof value === "number" && key.endsWith("_paise")) {
        return `${key}: ${formatINR(value)}`;
      }
      return `${key}: ${String(value)}`;
    })
    .join(" · ");
}
