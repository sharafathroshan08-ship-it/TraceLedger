"use client";

import * as React from "react";
import {
  ArrowRight,
  GitBranch,
  Info,
  Layers,
  Play,
  RotateCcw,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GraphCanvas } from "@/components/graph-canvas";
import {
  ErrorBanner,
  KeyValue,
  LoadingRows,
  Money,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { getComponents, getCycles, getGraph, runDfs } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { DFSResult, GraphAccount, GraphData, GraphTransaction } from "@/types";

export default function NetworkPage() {
  const [graph, setGraph] = React.useState<GraphData | null>(null);
  const [components, setComponents] = React.useState<string[][]>([]);
  const [cycles, setCycles] = React.useState<string[][]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [startAccount, setStartAccount] = React.useState("");
  const [dfs, setDfs] = React.useState<DFSResult | null>(null);
  const [running, setRunning] = React.useState(false);

  const [selectedNode, setSelectedNode] = React.useState<GraphAccount | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<GraphTransaction | null>(null);

  const loadGraph = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [graphData, componentData, cycleData] = await Promise.all([
        getGraph(),
        getComponents(),
        getCycles(),
      ]);
      setGraph(graphData);
      setComponents(componentData);
      setCycles(cycleData);
      setStartAccount((current) => current || graphData.accounts[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the graph");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const highlighted = React.useMemo(
    () => new Set(dfs?.traversal_order ?? []),
    [dfs],
  );

  const selectedNodeData = React.useMemo(() => {
    if (!selectedNode || !graph) return null;
    return graph.accounts.find((account) => account.id === selectedNode.id) ?? null;
  }, [selectedNode, graph]);

  async function handleRunDfs(accountNumber?: string) {
    const target = accountNumber || startAccount;
    if (!target) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runDfs(target);
      setDfs(result);
      setStartAccount(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DFS failed");
    } finally {
      setRunning(false);
    }
  }

  function clearHighlight() {
    setDfs(null);
  }

  const outgoing = selectedNodeData
    ? graph?.adjacency_list[selectedNodeData.id] ?? []
    : [];

  return (
    <div>
      <PageHeader
        title="Network"
        description="A live rendering of the directed transaction graph. Run DFS from any account and watch the traversal light up."
        actions={
          <Button size="sm" variant="outline" onClick={loadGraph} disabled={loading}>
            <RotateCcw className="h-3.5 w-3.5" /> Reload graph
          </Button>
        }
      />

      <ErrorBanner message={error} />

      {loading || !graph ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <LoadingRows rows={8} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Accounts"
              value={graph.stats.account_count}
              hint="Graph vertices"
              icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
              label="Transfers"
              value={graph.stats.transaction_count}
              hint="Directed edges"
              icon={<ArrowRight className="h-4 w-4" />}
            />
            <StatCard
              label="Components"
              value={graph.stats.component_count}
              hint="Weakly connected islands"
              icon={<Waypoints className="h-4 w-4" />}
            />
            <StatCard
              label="Directed reach"
              value={graph.stats.is_connected ? "Reaches all" : "Fragmented"}
              hint={
                graph.stats.is_connected
                  ? "Every account reachable from one"
                  : "Some accounts are unreachable"
              }
              icon={<GitBranch className="h-4 w-4" />}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <section className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-2xs text-zinc-500">
                    <span className="h-2 w-2 rounded-full bg-zinc-900" /> visited
                  </span>
                  <span className="flex items-center gap-1.5 text-2xs text-zinc-500">
                    <span className="h-2 w-2 rounded-full border border-zinc-300 bg-white" />{" "}
                    unvisited
                  </span>
                  <span className="hidden items-center gap-1.5 text-2xs text-zinc-500 sm:flex">
                    <span className="h-px w-4 bg-zinc-900" /> path edge
                  </span>
                </div>
                <p className="text-2xs text-zinc-400">
                  Drag nodes · click a node or edge to inspect
                </p>
              </div>
              <div className="h-[640px] w-full">
                <GraphCanvas
                  graph={graph}
                  highlighted={highlighted}
                  selectedEdgeId={selectedEdge?.id ?? null}
                  onNodeSelect={(id) => {
                    const account = graph.accounts.find((item) => item.id === id);
                    setSelectedNode(account ?? null);
                    setSelectedEdge(null);
                  }}
                  onEdgeSelect={(transaction) => {
                    setSelectedEdge(transaction);
                    setSelectedNode(null);
                  }}
                />
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold">Run DFS</h2>
                <p className="mt-1 text-2xs text-muted-foreground">
                  The backend executes an iterative stack walk over directed edges.
                </p>

                <div className="mt-3 space-y-2">
                  <Label htmlFor="dfs_start">Start account</Label>
                  <Select
                    id="dfs_start"
                    value={startAccount}
                    onChange={(event) => setStartAccount(event.target.value)}
                  >
                    {graph.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.id} · {account.name}
                      </option>
                    ))}
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => handleRunDfs()}
                      disabled={running}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {running ? "Tracing…" : "Run DFS"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearHighlight}
                      disabled={!dfs}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {dfs && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <p className="label-xs">Traversal order</p>
                      <span className="text-2xs tabular text-muted-foreground">
                        {dfs.traversal_order.length} accounts
                      </span>
                    </div>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                      {dfs.traversal_order.map((number, index) => (
                        <div
                          key={`${number}-${index}`}
                          className="flex items-center gap-2 rounded-md bg-[#fafafa] px-2 py-1"
                        >
                          <span className="w-5 shrink-0 font-mono text-2xs text-zinc-400">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-2xs">{number}</span>
                          <span className="ml-auto truncate text-2xs text-zinc-400">
                            {graph.accounts.find((a) => a.id === number)?.name ?? ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-2xs text-zinc-400">
                      time {dfs.time_complexity} · space {dfs.space_complexity}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold">Selection</h2>
                {!selectedNodeData && !selectedEdge && (
                  <p className="mt-2 flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Click a node to see its account details, or an edge to inspect the transfer.
                  </p>
                )}

                {selectedNodeData && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs font-semibold">
                        {selectedNodeData.id}
                      </p>
                      <span className="text-2xs text-zinc-400">
                        {selectedNodeData.transaction_count} transfers
                      </span>
                    </div>
                    <p className="mt-0.5 text-2xs text-zinc-500">
                      {selectedNodeData.name}
                    </p>
                    <div className="mt-3 rounded-md border border-border px-3">
                      <KeyValue
                        label="Balance"
                        value={<Money paise={selectedNodeData.balance} />}
                      />
                      <KeyValue
                        label="Status"
                        value={selectedNodeData.is_active ? "Active" : "Inactive"}
                      />
                      <KeyValue label="Outgoing" value={outgoing.length} />
                    </div>

                    {outgoing.length > 0 && (
                      <>
                        <p className="label-xs mt-3">Points to</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {outgoing.map((neighbor) => (
                            <span
                              key={neighbor}
                              className="rounded-full border border-border bg-[#fafafa] px-2 py-0.5 font-mono text-2xs"
                            >
                              {neighbor}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => handleRunDfs(selectedNodeData.id)}
                    >
                      <GitBranch className="h-3.5 w-3.5" /> Trace from here
                    </Button>
                  </div>
                )}

                {selectedEdge && (
                  <div className="mt-3">
                    <p className="flex flex-wrap items-center gap-1 font-mono text-xs font-semibold">
                      {selectedEdge.source}
                      <ArrowRight className="h-3 w-3 text-zinc-400" />
                      {selectedEdge.destination}
                    </p>
                    <div className="mt-3 rounded-md border border-border px-3">
                      <KeyValue
                        label="Amount"
                        value={<Money paise={selectedEdge.amount} />}
                      />
                      <KeyValue label="Type" value={selectedEdge.type} />
                      <KeyValue label="When" value={formatDate(selectedEdge.timestamp)} />
                      <KeyValue
                        label="Transaction"
                        value={
                          <span className="font-mono text-2xs">
                            {selectedEdge.id.slice(0, 8)}
                          </span>
                        }
                      />
                    </div>
                    {selectedEdge.description && (
                      <p className="mt-2 text-2xs text-zinc-500">
                        {selectedEdge.description}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold">Structure</h2>

                <p className="label-xs mt-3">Weakly connected components</p>
                <div className="mt-2 space-y-1.5">
                  {components.map((component, index) => (
                    <div
                      key={index}
                      className={cn(
                        "rounded-md border px-2.5 py-2",
                        component.length > 2
                          ? "border-border bg-white"
                          : "border-zinc-200 bg-[#fafafa]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-medium">
                          Component {index + 1}
                        </span>
                        <span className="text-2xs tabular text-zinc-400">
                          {component.length}
                        </span>
                      </div>
                      <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-zinc-500">
                        {component.join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="label-xs mt-4">Directed cycles</p>
                {cycles.length === 0 ? (
                  <p className="mt-1.5 text-2xs text-zinc-500">No cycles detected.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {cycles.map((cycle, index) => (
                      <p
                        key={index}
                        className="break-words rounded-md bg-[#fafafa] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-zinc-600"
                      >
                        {cycle.join(" → ")}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
