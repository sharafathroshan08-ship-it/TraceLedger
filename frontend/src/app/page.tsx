import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  GitBranch,
  Network,
  ScanSearch,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waypoints className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">TraceLedger</span>
          </div>
          <nav className="hidden items-center gap-7 text-xs text-zinc-500 sm:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#algorithm" className="transition-colors hover:text-foreground">
              The algorithm
            </a>
          </nav>
          <Link href="/dashboard">
            <Button size="sm">
              Enter demo <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-2xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
              Graph algorithms · DFS · Fraud heuristics
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Follow the money.
              <br />
              <span className="text-zinc-400">Understand the network.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              TraceLedger is a banking investigation simulator. Accounts become graph
              vertices, transactions become directed edges, and depth-first search walks the
              network to surface chains, cycles and suspicious intermediaries.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard">
                <Button size="lg">
                  Enter the demo <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#algorithm">
                <Button size="lg" variant="outline">
                  Read the algorithm
                </Button>
              </a>
            </div>
            <p className="mt-5 text-2xs text-zinc-400">
              No sign-up. A private synthetic workspace is created for every visitor.
            </p>
          </div>

          <HeroPanel />
        </div>
      </section>

      {/* Strip */}
      <section className="border-b border-border bg-[#fafafa]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-border text-center sm:grid-cols-4">
          {[
            ["15", "synthetic accounts"],
            ["28", "directed transfers"],
            ["5", "detection rules"],
            ["O(V + E)", "DFS complexity"],
          ].map(([value, label]) => (
            <div key={label} className="px-4 py-6">
              <p className="text-lg font-semibold tracking-tight tabular sm:text-xl">{value}</p>
              <p className="mt-1 text-2xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps from raw transfers to a readable investigation"
          description="The app keeps the graph, the detection engine and the interface deliberately separate so each part can be explained on its own."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Model the workspace",
              body: "Accounts are stored as vertices. Every transaction becomes a directed edge with an amount, timestamp and description. All amounts are integer paise.",
            },
            {
              step: "02",
              title: "Walk with DFS",
              body: "Pick a starting account and run an iterative depth-first search. A stack, a visited set and the adjacency list return the real traversal order.",
            },
            {
              step: "03",
              title: "Read the evidence",
              body: "Five rule-based detectors look for chains, cycles, rapid movement, high-value transfers and intermediaries — each finding carries its evidence.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-lg border border-border bg-white p-6">
              <span className="font-mono text-2xs text-zinc-400">{item.step}</span>
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-border bg-[#fafafa]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHeading
            eyebrow="Features"
            title="A compact investigation tool, not a dashboard demo"
            description="Every control writes to the backend and every graph view is generated from live session data."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Network,
                title: "Interactive network",
                body: "React Flow renders real accounts and directed edges. Select a node or an edge to inspect it, then zoom and pan.",
              },
              {
                icon: GitBranch,
                title: "Live DFS traversal",
                body: "Run DFS from any account and see the actual order returned by the Python backend, replayed on the graph.",
              },
              {
                icon: ScanSearch,
                title: "Five heuristics",
                body: "Chains, circular flows, rapid movement, high-value transfers and intermediary accounts, each with severity and evidence.",
              },
              {
                icon: CircleDollarSign,
                title: "Exact money",
                body: "Amounts are stored as integer paise and formatted with Indian currency grouping. No floating-point arithmetic.",
              },
              {
                icon: ShieldCheck,
                title: "Isolated sessions",
                body: "A server-issued HttpOnly cookie scopes every query. Two visitors can never read each other's accounts.",
              },
              {
                icon: Waypoints,
                title: "Reproducible demo",
                body: "A preloaded dataset covers every pattern. Reset it at any time from Settings to start over.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white p-6">
                  <Icon className="h-4 w-4 text-zinc-700" strokeWidth={1.75} />
                  <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Algorithm */}
      <section id="algorithm" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="label-xs">The algorithm</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Depth-first search, built from first principles
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              The graph is a hand-written adjacency list. No NetworkX, no graph library. DFS is
              iterative: start with the chosen account on a stack, pop a node, mark it visited,
              then push its unvisited neighbours. A visited set makes cycles safe, and accounts
              with no edges are simply never reached.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="label-xs">Time</p>
                <p className="mt-2 font-mono text-lg">O(V + E)</p>
                <p className="mt-1 text-2xs text-zinc-500">each vertex and edge once</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="label-xs">Space</p>
                <p className="mt-2 font-mono text-lg">O(V)</p>
                <p className="mt-1 text-2xs text-zinc-500">stack + visited set</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-zinc-950 p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-mono text-2xs uppercase tracking-[0.14em] text-zinc-400">
                graph.py — iterative_dfs
              </span>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-2xs text-zinc-400">
                Python
              </span>
            </div>
            <pre className="mt-4 overflow-x-auto font-mono text-[11px] leading-relaxed text-zinc-300">
{`visited = set()
order = []
stack = [start]

while stack:
    node = stack.pop()
    if node in visited:
        continue
    visited.add(node)
    order.append(node)

    for neighbor in reversed(adj[node]):
        if neighbor not in visited:
            stack.append(neighbor)

return order`}
            </pre>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-2xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Executed by FastAPI, never re-implemented in the browser
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-[#fafafa]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Open a demo workspace</h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-600">
              You will get fifteen synthetic accounts, twenty-eight transfers and every
              detection rule already seeded. Reset at any time.
            </p>
          </div>
          <Link href="/dashboard">
            <Button size="lg">
              Enter TraceLedger <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-8 text-2xs text-zinc-500 sm:flex-row sm:items-center sm:px-8">
          <p>TraceLedger · Mini banking fraud detection simulator · Educational use only.</p>
          <p>Next.js · FastAPI · SQLite · React Flow</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="label-xs">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{description}</p>
    </div>
  );
}

function HeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-2xs uppercase tracking-[0.14em] text-zinc-400">Investigation</p>
            <p className="mt-0.5 text-sm font-semibold">ACC1001 · Aarav Sharma</p>
          </div>
          <span className="rounded-full bg-zinc-900 px-2 py-1 text-2xs font-medium text-white">
            13 reached
          </span>
        </div>

        <div className="relative mt-4 h-56 overflow-hidden rounded-md border border-border bg-[#fafafa]">
          <svg viewBox="0 0 360 224" className="h-full w-full">
            <g stroke="#d4d4d8" strokeWidth="1.2" fill="none">
              <path d="M60 60 L150 42" />
              <path d="M150 42 L250 70" />
              <path d="M250 70 L300 140" />
              <path d="M300 140 L210 180" />
              <path d="M210 180 L105 160" />
              <path d="M105 160 L60 60" />
              <path d="M150 42 L105 160" />
              <path d="M250 70 L210 180" />
            </g>
            <g stroke="#18181b" strokeWidth="2" fill="none">
              <path d="M60 60 L150 42" />
              <path d="M150 42 L250 70" />
              <path d="M250 70 L300 140" />
            </g>
            {[
              [60, 60, "1"],
              [150, 42, "2"],
              [250, 70, "3"],
              [300, 140, "4"],
              [210, 180, "5"],
              [105, 160, "6"],
            ].map(([x, y, label], index) => (
              <g key={label}>
                <circle
                  cx={x as number}
                  cy={y as number}
                  r={index < 3 ? 15 : 12}
                  fill={index < 3 ? "#18181b" : "#ffffff"}
                  stroke="#18181b"
                  strokeWidth="1.5"
                />
                <text
                  x={x as number}
                  y={(y as number) + 3.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="monospace"
                  fill={index < 3 ? "#ffffff" : "#18181b"}
                >
                  {label}
                </text>
              </g>
            ))}
            <text x="24" y="212" fontSize="8" fill="#a1a1aa" fontFamily="monospace">
              DFS 1 → 2 → 3 → 4 → 5 → 6
            </text>
          </svg>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-2xs text-zinc-500">Circular flow</span>
            <span className="text-2xs font-medium">ACC1011 → 1012 → 1013 → 1011</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-white">
            <span className="text-2xs text-zinc-300">High-value transfer</span>
            <span className="text-2xs font-medium tabular">₹5,00,000.00</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-3 -left-3 hidden rounded-md border border-border bg-white px-3 py-2 shadow-sm sm:block">
        <p className="font-mono text-2xs text-zinc-500">stack · visited · adjacency</p>
      </div>
    </div>
  );
}
