"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Card } from "@/components/ui";

type BalanceRow = { name: string; balance: number };

type AccountRow = {
  id: string;
  name: string;
  opening_balance: number;
  currency: string | null;
  type: string | null;
};

type TxnRow = {
  id: string;
  txn_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  account_id: string;
  created_at: string | null;
  category_name: string | null;
};

function formatMoney(amount: number, currency?: string | null) {
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDate(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export default function NetWorthPage() {
  const orgId = useActiveOrgId();

  const [net, setNet] = useState(0);
  const [byAccount, setByAccount] = useState<BalanceRow[]>([]);

  // NEW: for statements
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [txnsByAccountId, setTxnsByAccountId] = useState<Record<string, TxnRow[]>>({});

  // helpful lookup for showing balances inside statement headers
  const balanceByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of byAccount) m[r.name] = r.balance;
    return m;
  }, [byAccount]);

  useEffect(() => {
    if (!orgId) return;

    (async () => {
      // Keep your existing summary balances logic as-is ✅
      const { data, error } = await supabase.rpc("account_balances", { p_org_id: orgId });
      if (error) return console.error(error);

      const rows = (data ?? []).map((r: { account_name: string; balance: number }) => ({
        name: r.account_name,
        balance: Number(r.balance || 0),
      }));

      setByAccount(rows);
      setNet(rows.reduce((s: number, r: { balance: number }) => s + r.balance, 0));
    })();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    (async () => {
      // 1) Load accounts
      const { data: accData, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,opening_balance,currency,type")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (accErr) {
        console.error(accErr);
        return;
      }

      const accRows: AccountRow[] = (accData ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        opening_balance: Number(a.opening_balance || 0),
        currency: a.currency ?? null,
        type: a.type ?? null,
      }));

      setAccounts(accRows);

      // 2) Load recent transactions + categories
      const { data: txnData, error: txnErr } = await supabase
        .from("transactions")
        .select("id,txn_date,description,amount,account_id,created_at,categories(name)")
        .eq("org_id", orgId)
        .order("txn_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);

      if (txnErr) {
        console.error(txnErr);
        return;
      }

      const grouped: Record<string, TxnRow[]> = {};

      for (const t of txnData ?? []) {
        const accountId = t.account_id;
        if (!grouped[accountId]) grouped[accountId] = [];

        // ✅ FIX: categories may come back as array OR object depending on relationship
        const cat = (t as any).categories;
        const categoryName =
          Array.isArray(cat) ? (cat[0]?.name ?? null) : (cat?.name ?? null);

        grouped[accountId].push({
          id: t.id,
          txn_date: t.txn_date,
          description: t.description,
          amount: Number(t.amount || 0),
          account_id: t.account_id,
          created_at: t.created_at ?? null,
          category_name: categoryName,
        });
      }

      setTxnsByAccountId(grouped);
    })();
  }, [orgId]);

  return (
    <div className="space-y-4">
      {/* KEEP AS-IS ✅ */}
      <Card title="Net worth (accounts total)">
        <div className="text-2xl font-semibold">${net.toFixed(2)}</div>
        <div className="text-xs text-zinc-500 mt-2">
          Balances = opening balance + sum(transactions) per account.
        </div>
      </Card>

      {/* KEEP AS-IS ✅ */}
      <Card title="Balances by account">
        <div className="space-y-2">
          {byAccount.map((a) => (
            <div key={a.name} className="flex items-center justify-between text-sm">
              <div className="truncate">{a.name}</div>
              <div className="tabular-nums">${a.balance.toFixed(2)}</div>
            </div>
          ))}
          {!byAccount.length ? (
            <div className="text-sm text-zinc-600">No accounts yet. Add them in Settings.</div>
          ) : null}
        </div>
      </Card>

      {/* NEW ✅ Account statements/details */}
      <Card title="Account statements">
        {!accounts.length ? (
          <div className="text-sm text-zinc-600">No accounts yet. Add them in Settings.</div>
        ) : (
          <div className="divide-y">
            {accounts.map((acc) => {
              const txns = txnsByAccountId[acc.id] ?? [];

              // build running balance using ASC order
              const asc = [...txns].sort((a, b) => {
                if (a.txn_date !== b.txn_date) return a.txn_date.localeCompare(b.txn_date);
                return (a.created_at || "").localeCompare(b.created_at || "");
              });

              let running = acc.opening_balance || 0;
              const withRunningAsc = asc.map((t) => {
                running += Number(t.amount || 0);
                return { ...t, running_balance: running };
              });

              // show newest first
              const rowsToShow = 25;
              const desc = [...withRunningAsc].sort((a: any, b: any) => {
                if (a.txn_date !== b.txn_date) return b.txn_date.localeCompare(a.txn_date);
                return (b.created_at || "").localeCompare(a.created_at || "");
              });

              const displayBalance =
                balanceByName[acc.name] ??
                (withRunningAsc.length
                  ? (withRunningAsc[withRunningAsc.length - 1] as any).running_balance
                  : acc.opening_balance);

              return (
                <details key={acc.id} className="py-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{acc.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Opening: {formatMoney(acc.opening_balance || 0, acc.currency)}
                          {acc.type ? <span className="ml-2">• {acc.type}</span> : null}
                        </div>
                      </div>
                      <div className="tabular-nums font-semibold">
                        {formatMoney(Number(displayBalance || 0), acc.currency)}
                      </div>
                    </div>
                  </summary>

                  <div className="mt-3 overflow-x-auto">
                    {desc.length === 0 ? (
                      <div className="text-sm text-zinc-600">No transactions yet for this account.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-zinc-600">
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Description</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3 text-right">Amount</th>
                            <th className="py-2 pr-0 text-right">Running</th>
                          </tr>
                        </thead>
                        <tbody>
                          {desc.slice(0, rowsToShow).map((t: any) => (
                            <tr key={t.id} className="border-b last:border-b-0">
                              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(t.txn_date)}</td>
                              <td className="py-2 pr-3">{t.description}</td>
                              <td className="py-2 pr-3 text-zinc-600">{t.category_name || "-"}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {formatMoney(Number(t.amount || 0), acc.currency)}
                              </td>
                              <td c
