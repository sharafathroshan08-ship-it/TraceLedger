"use client";

import * as React from "react";
import { Plus, Search, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorBanner,
  KeyValue,
  LoadingRows,
  Money,
  PageHeader,
} from "@/components/shared";
import { useSession } from "@/components/session-provider";
import {
  createAccount,
  deleteAccount,
  getAccountNeighbors,
  listAccounts,
} from "@/lib/api";
import { formatDate, formatINR, initials, rupeesToPaise } from "@/lib/utils";
import type { Account } from "@/types";

export default function AccountsPage() {
  const { refresh: refreshSession } = useSession();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    account_number: "",
    account_holder: "",
    balance: "100000",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Account | null>(null);
  const [neighbors, setNeighbors] = React.useState<string[]>([]);
  const [neighborsLoading, setNeighborsLoading] = React.useState(false);

  const loadAccounts = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter(
      (account) =>
        account.account_number.toLowerCase().includes(needle) ||
        account.account_holder.toLowerCase().includes(needle),
    );
  }, [accounts, query]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const paise = rupeesToPaise(form.balance);
      if (paise < 0) throw new Error("Opening balance cannot be negative");
      await createAccount({
        account_number: form.account_number.trim().toUpperCase(),
        account_holder: form.account_holder.trim(),
        balance: paise,
      });
      setCreateOpen(false);
      setForm({ account_number: "", account_holder: "", balance: "100000" });
      await Promise.all([loadAccounts(), refreshSession()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(account: Account) {
    const confirmed = window.confirm(
      `Delete ${account.account_number}? Its transactions will also be removed.`,
    );
    if (!confirmed) return;
    try {
      await deleteAccount(account.id);
      if (selected?.id === account.id) setSelected(null);
      await Promise.all([loadAccounts(), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    }
  }

  async function openDetails(account: Account) {
    setSelected(account);
    setNeighbors([]);
    setNeighborsLoading(true);
    try {
      const data = await getAccountNeighbors(account.id);
      setNeighbors(data.neighbors);
    } catch {
      setNeighbors([]);
    } finally {
      setNeighborsLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Vertices of the transaction graph. Opening balances and every transfer are stored as integer paise."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add account
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by account number or holder"
            className="pl-9"
          />
        </div>
        <p className="shrink-0 text-2xs text-muted-foreground">
          {filtered.length} of {accounts.length}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {loading ? (
          <div className="p-5">
            <LoadingRows rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={accounts.length ? "No matching accounts" : "No accounts yet"}
              description={
                accounts.length
                  ? "Try a different account number or holder name."
                  : "Add an account to begin building the graph."
              }
              action={
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add account
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openDetails(account)}
                      className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                    >
                      {account.account_number}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[#fafafa] text-[10px] font-medium">
                        {initials(account.account_holder)}
                      </span>
                      {account.account_holder}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money paise={account.balance} className="text-xs" />
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? "default" : "outline"}>
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-2xs text-muted-foreground">
                    {formatDate(account.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${account.account_number}`}
                      onClick={() => handleDelete(account)}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add account dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              Create a synthetic account. Numbers must be 5–20 letters or digits.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="account_number">Account number</Label>
              <Input
                id="account_number"
                value={form.account_number}
                onChange={(event) => setForm({ ...form, account_number: event.target.value })}
                placeholder="ACC2001"
                required
                minLength={5}
                maxLength={20}
                pattern="[A-Za-z0-9]{5,20}"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account_holder">Account holder</Label>
              <Input
                id="account_holder"
                value={form.account_holder}
                onChange={(event) => setForm({ ...form, account_holder: event.target.value })}
                placeholder="Full name"
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="balance">Opening balance (₹)</Label>
              <Input
                id="balance"
                type="number"
                min="0"
                step="0.01"
                value={form.balance}
                onChange={(event) => setForm({ ...form, balance: event.target.value })}
                required
              />
              <p className="text-2xs text-muted-foreground">
                Stored as paise: {formatINR(rupeesToPaise(form.balance))}
              </p>
            </div>
            <ErrorBanner message={formError} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-2xs">
                    {initials(selected.account_holder)}
                  </span>
                  {selected.account_holder}
                </DialogTitle>
                <DialogDescription>
                  Account details and directly connected accounts in the directed graph.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-border px-3">
                <KeyValue label="Account number" value={<span className="font-mono">{selected.account_number}</span>} />
                <KeyValue label="Balance" value={<Money paise={selected.balance} />} />
                <KeyValue label="Status" value={selected.is_active ? "Active" : "Inactive"} />
                <KeyValue label="Opened" value={formatDate(selected.created_at)} />
                <KeyValue label="Account id" value={<span className="font-mono">#{selected.id}</span>} />
              </div>

              <div className="mt-4">
                <p className="label-xs">Connected accounts</p>
                {neighborsLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Loading neighbours…</p>
                ) : neighbors.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" /> No outgoing transactions from this account.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {neighbors.map((neighbor) => (
                      <span
                        key={neighbor}
                        className="rounded-full border border-border bg-[#fafafa] px-2 py-0.5 font-mono text-2xs"
                      >
                        {neighbor}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
