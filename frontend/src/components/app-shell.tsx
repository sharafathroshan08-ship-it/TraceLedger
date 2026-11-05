"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Waypoints,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/session-provider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/investigations", label: "Investigations", icon: ShieldCheck },
  { href: "/network", label: "Network", icon: Network },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading } = useSession();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const shortSession = session ? session.id.slice(0, 8) : "--------";

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark />
          <span className="text-sm font-semibold tracking-tight">TraceLedger</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md border border-border p-2"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 shrink-0 border-r border-border bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="hidden h-16 items-center gap-2.5 border-b border-border px-5 lg:flex">
              <LogoMark />
              <div>
                <p className="text-sm font-semibold leading-none tracking-tight">TraceLedger</p>
                <p className="mt-1 text-2xs text-muted-foreground">Follow the money</p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              <p className="label-xs px-2 pb-2 pt-3">Workspace</p>
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-zinc-600 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border p-3">
              <div className="rounded-md border border-border bg-[#fafafa] p-3">
                <div className="flex items-center justify-between">
                  <span className="label-xs">Demo workspace</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      loading ? "bg-zinc-300" : session ? "bg-emerald-500" : "bg-red-500",
                    )}
                  />
                </div>
                <p className="mt-2 font-mono text-2xs text-zinc-500">
                  {loading ? "connecting…" : `session ${shortSession}`}
                </p>
                <p className="mt-1 text-2xs text-zinc-400">Isolated anonymous data</p>
              </div>
              <p className="mt-3 px-1 text-2xs leading-relaxed text-zinc-400">
                Educational simulation. Synthetic data only.
              </p>
            </div>
          </div>
        </aside>

        {open && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-zinc-950/20 lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Waypoints className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}
