"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn, formatINR } from "@/lib/utils";
import type { GraphData, GraphTransaction } from "@/types";

export interface AccountNodeData extends Record<string, unknown> {
  number: string;
  holder: string;
  balance: number;
  transactionCount: number;
  highlighted: boolean;
}

export type AccountNode = Node<AccountNodeData>;

const RADIUS = 320;
const CENTER_X = 500;
const CENTER_Y = 340;

function buildNodes(graph: GraphData, highlighted: Set<string>): AccountNode[] {
  const total = graph.accounts.length || 1;
  return graph.accounts.map((account, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
    return {
      id: account.id,
      type: "account",
      position: {
        x: CENTER_X + RADIUS * Math.cos(angle) - 63,
        y: CENTER_Y + RADIUS * Math.sin(angle) - 27,
      },
      data: {
        number: account.id,
        holder: account.name,
        balance: account.balance,
        transactionCount: account.transaction_count,
        highlighted: highlighted.has(account.id),
      },
    };
  });
}

function buildEdges(
  transactions: GraphTransaction[],
  highlighted: Set<string>,
  selectedId: string | null,
): Edge[] {
  return transactions.map((transaction) => {
    const onPath =
      highlighted.has(transaction.source) && highlighted.has(transaction.destination);
    const selected = selectedId === transaction.id;
    const showLabel = transaction.amount >= 10_000_000; // ₹1,00,000+
    return {
      id: transaction.id,
      source: transaction.source,
      target: transaction.destination,
      type: "default",
      label: showLabel ? formatINR(transaction.amount, { compact: true }) : undefined,
      labelStyle: { fontSize: 9, fill: "#71717a", fontFamily: "monospace" },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
      labelBgPadding: [3, 2] as [number, number],
      labelBgBorderRadius: 2,
      style: {
        stroke: selected || onPath ? "#18181b" : "#d4d4d8",
        strokeWidth: selected ? 2.4 : onPath ? 1.6 : 1.1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: selected || onPath ? "#18181b" : "#a1a1aa",
        width: 13,
        height: 13,
      },
      data: { transaction },
    };
  });
}

function AccountNodeView({ data, selected }: NodeProps<AccountNode>) {
  const node = data as AccountNodeData;
  return (
    <div
      className={cn(
        "w-[126px] rounded-md border bg-white px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-zinc-900 ring-2 ring-zinc-900/10"
          : "border-zinc-200 hover:border-zinc-400",
        node.highlighted && "border-zinc-900 bg-zinc-900 text-white",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 2, height: 2 }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-tight">
          {node.number}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[8px]",
            node.highlighted
              ? "bg-white/15 text-white"
              : "bg-zinc-100 text-zinc-500",
          )}
        >
          {node.transactionCount}
        </span>
      </div>
      <p
        className={cn(
          "mt-0.5 truncate text-[9px] leading-tight",
          node.highlighted ? "text-white/70" : "text-zinc-500",
        )}
      >
        {node.holder}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-[9px] tabular",
          node.highlighted ? "text-white/90" : "text-zinc-700",
        )}
      >
        {formatINR(node.balance, { compact: true })}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 2, height: 2 }}
      />
    </div>
  );
}

const nodeTypes = { account: AccountNodeView };

export function GraphCanvas({
  graph,
  highlighted,
  selectedEdgeId,
  onNodeSelect,
  onEdgeSelect,
}: {
  graph: GraphData;
  highlighted: Set<string>;
  selectedEdgeId: string | null;
  onNodeSelect: (accountNumber: string) => void;
  onEdgeSelect: (transaction: GraphTransaction) => void;
}) {
  const initialNodes = React.useMemo(() => buildNodes(graph, highlighted), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<AccountNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const graphKey = React.useMemo(
    () =>
      `${graph.accounts.length}:${graph.transactions.length}:${graph.transactions[0]?.id ?? ""}`,
    [graph.accounts.length, graph.transactions.length, graph.transactions],
  );

  // Rebuild geometry only when the underlying graph changes.
  React.useEffect(() => {
    const transactions = graph.transactions;
    const built = buildEdges(transactions, new Set(), null);
    setNodes(buildNodes(graph, new Set()));
    setEdges(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  // Recolour nodes and edges without losing dragged positions.
  React.useEffect(() => {
    setNodes((previous) =>
      previous.map((node) => ({
        ...node,
        data: { ...node.data, highlighted: highlighted.has(node.id) },
      })),
    );
    setEdges((previous) =>
      previous.map((edge) => {
        const onPath =
          highlighted.has(edge.source) && highlighted.has(edge.target);
        const selected = edge.id === selectedEdgeId;
        return {
          ...edge,
          style: {
            stroke: selected || onPath ? "#18181b" : "#d4d4d8",
            strokeWidth: selected ? 2.4 : onPath ? 1.6 : 1.1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selected || onPath ? "#18181b" : "#a1a1aa",
            width: 13,
            height: 13,
          },
        };
      }),
    );
  }, [highlighted, selectedEdgeId, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onNodeSelect(node.id)}
      onEdgeClick={(_, edge) => {
        const transaction = (edge.data as { transaction?: GraphTransaction } | undefined)
          ?.transaction;
        if (transaction) onEdgeSelect(transaction);
      }}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.35}
      maxZoom={1.8}
      nodesConnectable={false}
      edgesFocusable
      proOptions={{ hideAttribution: true }}
      className="bg-white"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="#e4e4e7"
      />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor={(node) =>
          (node.data as AccountNodeData | undefined)?.highlighted
            ? "#18181b"
            : "#e4e4e7"
        }
        maskColor="rgba(250,250,250,0.7)"
        style={{ width: 130, height: 90 }}
      />
    </ReactFlow>
  );
}
