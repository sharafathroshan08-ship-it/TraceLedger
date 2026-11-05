"use client";

import * as React from "react";
import { ArrowRight, ArrowUpDown, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import {
  EmptyState,
  ErrorBanner,
  LoadingRows,
  Money,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { useSession } from "@/components/session-provider";
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listTransactions,
} from "@/lib/api";
import { formatDate, formatINR, rupeesToPaise } from "@/lib/utils";
import type { Account, Transaction } from "@/types";

export default function TransactionsPage() {
  const { refresh: refreshSession, session } = useSession();

  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<"newest" | "oldest" | "largest">("newest");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    source_account_id: "",
    destination_account_id: "",
    amount: "",
    transaction_type: "transfer",
    description: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [accountData, transactionData] = await Promise.all([
        listAccounts(),
        listTransactions(),
      ]);
      setAccounts(accountData);
      setTransactions(transactionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transactions");
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

  const sorted = React.useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [transactions],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sorted.filter((transaction) => {
      if (!needle) return true;
      const source = accountMap.get(transaction.source_account_id)?.account_number ?? "";
      const destination =
        accountMap.get(transaction.destination_account_id)?.account_number ?? "";
      return (
        source.toLowerCase().includes(needle) ||
        destination.toLowerCase().includes(needle) ||
        (transaction.description ?? "").toLowerCase().includes(needle) ||
        transaction.transaction_id.toLowerCase().includes(needle)
      );
    });
  }, [sorted, query, accountMap]);

  const totalAmount = React.useMemo(
    () => transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions],
  );

  const largest = React.useMemo(
    () => transactions.reduce((max, transaction) => Math.max(max, transaction.amount), 0),
    [transactions],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!form.source_account_id || !form.destination_account_id) {
        throw new Error("Choose both a source and a destination account");
      }
      if (form.source_account_id === form.destination_account_id) {
        throw new Error("Source and destination accounts must differ");
      }
      const paise = rupeesToPaise(form.amount);
      if (paise <= 0) throw new Error("Enter an amount greater than zero");

      await createTransaction({
        source_account_id: Number(form.source_account_id),
        destination_account_id: Number(form.destination_account_id),
        amount: paise,
        transaction_type: form.transaction_type,
        description: form.description.trim() || undefined,
      });

      setCreateOpen(false);
      setForm({
        source_account_id: "",
        destination_account_id: "",
        amount: "",
        transaction_type: "transfer",
        description: "",
      });
      await Promise.all([loadData(), refreshSession()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create transaction");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(transaction: Transaction) {
    const confirmed = window.confirm(
      `Delete transaction ${transaction.transaction_id.slice(0, 8)}? Account balances will be reversed.`,
    );
    if (!confirmed) return;
    try {
      await deleteTransaction(transaction.id);
      await Promise.all([loadData(), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete transaction");
    }
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every transfer is a directed edge from a source account to a destination account. Amounts are integer paise."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={accounts.length < 2}>
            <Plus className="h-3.5 w-3.5" /> Add transaction
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Transfers"
          value={session?.transactions_count ?? transactions.length}
          hint="Directed edges"
        />
        <StatCard
          label="Total moved"
          value={<span className="text-xl">{formatINR(totalAmount, { compact: true })}</span>}
          hint={formatINR(totalAmount)}
        />
        <StatCard
          label="Largest transfer"
          value={<span className="text-xl">{formatINR(largest, { compact: true })}</span>}
          hint={formatINR(largest)}
        />
        <StatCard
          label="Average"
          value={
            <span className="text-xl">
              {formatINR(
                transactions.length ? Math.round(totalAmount / transactions.length) : 0,
                { compact: true },
              )}
            </span>
          }
          hint="Per transfer"
        />
      </div>

      <div className="mb-4 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by account, description or id"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
          <Select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
            className="h-8 w-36 text-xs"
            aria-label="Sort transactions"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="largest">Largest first</option>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {loading ? (
          <div className="p-5">
            <LoadingRows rows={8} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={transactions.length ? "No matching transactions" : "No transactions yet"}
              description={
                transactions.length
                  ? "Try a different account number, description or id."
                  : "Add a transfer to create the first directed edge in the graph."
              }
              action={
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add transaction
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortTransactions(filtered, sortMode).map((transaction) => {
                const source = accountMap.get(transaction.source_account_id);
                const destination = accountMap.get(transaction.destination_account_id);
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <span className="font-mono text-2xs text-zinc-500">
                        {transaction.transaction_id.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <span>{source?.account_number ?? "?"}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-400" />
                        <span>{destination?.account_number ?? "?"}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[220px] truncate text-xs text-zinc-600">
                        {transaction.description || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money paise={transaction.amount} className="text-xs font-medium" />
                    </TableCell>
                    <TableCell className="text-2xs text-muted-foreground">
                      {formatDate(transaction.timestamp)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete transaction ${transaction.transaction_id}`}
                        onClick={() => handleDelete(transaction)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="mt-3 text-2xs text-muted-foreground">
        Showing {filtered.length} of {transactions.length} transfers.
      </p>

      {/* Add transaction dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>
              Creates a directed edge. The source balance must cover the amount.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="source_account_id">From account</Label>
                <Select
                  id="source_account_id"
                  value={form.source_account_id}
                  onChange={(event) =>
                    setForm({ ...form, source_account_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number} · {account.account_holder}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination_account_id">To account</Label>
                <Select
                  id="destination_account_id"
                  value={form.destination_account_id}
                  onChange={(event) =>
                    setForm({ ...form, destination_account_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number} · {account.account_holder}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="2500.00"
                  required
                />
                {form.amount && (
                  <p className="text-2xs text-muted-foreground">
                    Stored as {rupeesToPaise(form.amount).toLocaleString("en-IN")} paise
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transaction_type">Type</Label>
                <Select
                  id="transaction_type"
                  value={form.transaction_type}
                  onChange={(event) =>
                    setForm({ ...form, transaction_type: event.target.value })
                  }
                >
                  <option value="transfer">Transfer</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Vendor settlement"
                maxLength={200}
              />
            </div>

            <ErrorBanner message={formError} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sortTransactions(rows: Transaction[], mode: "newest" | "oldest" | "largest") {
  if (mode === "oldest") {
    return [...rows].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }
  if (mode === "largest") {
    return [...rows].sort((a, b) => b.amount - a.amount);
  }
  return rows;
}
