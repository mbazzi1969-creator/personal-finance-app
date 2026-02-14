"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Card } from "@/components/ui";

type BalanceRow = { name: string; balance: number };

type AccountRow = { id: string; name: string };

type CategoryRow = { id: string; name: string; type: "income" | "expense" };

type TxnRow = {
  id: string;
  txn_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  account_id: string;
  category_id: string | null;
};

export default function NetWorthPage() {
  const orgId = useActiveOrgId();

  const [net, setNet] = useState(0);
  const [byAccount, setByAccount] = useState<BalanceRow[]>([]);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Map for quick lookup
  const catById = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const txnsByAccount = useMemo(() => {
    const m = new Map<string, TxnRow[]>();
    for (const t of txns) {
      const arr = m.get(t.account_id) ?? [];
      arr.push(t);
      m.set(t.account_id, arr);
    }
    // Already ordered by txn_date desc in query, so each list stays newest-first
    return m;
  }, [txns]);

  useEffect(() => {
    if (!orgId) return;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1) balances (rpc)
        const { data: balData, error: balErr } = await supabase.rpc("account_balances", {
          p_org_id: orgId,
        });
        if (balErr) throw balErr;

        const rows: BalanceRow[] = (balData ?? []).map((r: any) => ({
          name: r.account_name,
          balance: Number(r.balance || 0),
        }));
        setByAccount(rows);
        setNet(rows.reduce((s, r) => s + r.balance, 0));

        // 2) accounts + categories + recent transactions (for statements)
        const [aRes, cRes, tRes] = await Promise.all([
          supabase.from("accounts").select("id,name").eq("org_id", orgId).order("name"),
          supabase.from("categories").select("id,name,type").eq("org_id", orgId).order("type").order("name"),
          supabase
            .from("transactions")
            .select("id,txn_date,description,amount,account_id,category_id")
            .eq("org_id", orgId)
            .order("txn_date", { ascending: false })
            .limit(500), // enough to cover statements across accounts
        ]);

        if (aRes.error) throw aRes.error;
        if (cRes.error) throw cRes.error;
        if (tRes.error) throw tRes.error;

        setAccounts((aRes.data ?? []) as AccountRow[]);
        setCategories((cRes.data ?? []) as CategoryRow[]);
        setTxns((tRes.data ?? []) as TxnRow[]);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message ?? "Failed to load net worth data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  function fmtMoney(n: number) {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return `${sign}$${abs.toFixed(2)}`;
  }

  return (
    <div className="space-y-4">
      <Card title="Net worth (accounts total)">
        <div className="text-2xl font-semibold">${net.toFixed(2)}</div>
        <div className="text-xs text-zinc-500 mt-2">
          Balances = opening balance + sum(transactions) per account.
        </div>
        {loading ? <div className="text-sm text-zinc-600 mt-3">Loading…</div> : null}
        {errorMsg ? <div className="text-sm text-red-600 mt-3">{errorMsg}</div> : null}
      </Card>

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

      {/* STATEMENTS */}
      <Card title="Statements by account (latest transactions)">
        {!accounts.length ? (
          <div className="text-sm text-zinc-600">No accounts yet.</div>
        ) : (
          <div className="space-y-6">
            {accounts.map((acc) => {
              const list = (txnsByAccount.get(acc.id) ?? []).slice(0, 10);

              return (
                <div key={acc.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">{acc.name}</div>
                    <div className="text-xs text-zinc-500">Last {Math.min(10, list.length)} transactions</div>
                  </div>

                  {!list.length ? (
                    <div className="text-sm text-zinc-600">No transactions for this account yet.</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-zinc-600">
                          <tr className="border-b border-zinc-200">
                            <th className="text-left py-2 pr-2 whitespace-nowrap">Date</th>
                            <th className="text-left py-2 pr-2">Description</th>
                            <th className="text-left py-2 pr-2">Category</th>
                            <th className="text-right py-2 pr-2 whitespace-nowrap">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((t) => {
                            const cat = t.category_id ? catById.get(t.category_id) : undefined;
                            const catLabel = cat ? `${cat.type}: ${cat.name}` : "Uncategorized";

                            return (
                              <tr key={t.id} className="border-b border-zinc-100">
                                <td className="py-2 pr-2 whitespace-nowrap">{t.txn_date}</td>
                                <td className="py-2 pr-2">{t.description}</td>
                                <td className="py-2 pr-2">{catLabel}</td>
                                <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(t.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
