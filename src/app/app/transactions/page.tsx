"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Account = { id: string; name: string; };
type Category = { id: string; name: string; type: "income" | "expense"; };
type Txn = { id: string; txn_date: string; description: string; amount: number; account_id: string; category_id: string | null; };

export default function TransactionsPage() {
  const orgId = useActiveOrgId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ txn_date: new Date().toISOString().slice(0,10), description: "", amount: "", account_id: "", category_id: "" });

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [a,c,t] = await Promise.all([
      supabase.from("accounts").select("id,name").eq("org_id", orgId).order("name"),
      supabase.from("categories").select("id,name,type").eq("org_id", orgId).order("type").order("name"),
      supabase.from("transactions").select("id,txn_date,description,amount,account_id,category_id").eq("org_id", orgId).order("txn_date", { ascending: false }).limit(200),
    ]);
    if (!a.error) setAccounts(a.data as any); else console.error(a.error);
    if (!c.error) setCategories(c.data as any); else console.error(c.error);
    if (!t.error) setTxns(t.data as any); else console.error(t.error);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, [orgId]);

  async function addTxn(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const { error } = await supabase.from("transactions").insert({
      org_id: orgId,
      txn_date: form.txn_date,
      description: form.description,
      amount: Number(form.amount),
      account_id: form.account_id,
      category_id: form.category_id || null,
    });
    if (error) return alert(error.message);
    setForm({ ...form, description: "", amount: "" });
    await load();
  }

  async function del(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card title="Add transaction">
        <form onSubmit={addTxn} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div><Label>Date</Label><Input type="date" value={form.txn_date} onChange={e=>setForm({...form, txn_date:e.target.value})} required /></div>
          <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} placeholder="e.g., Groceries, Salary" required /></div>
          <div><Label>Amount</Label><Input value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} placeholder="-50.25 or 2000" required /></div>
          <div><Label>Account</Label>
            <Select value={form.account_id} onChange={e=>setForm({...form, account_id:e.target.value})} required>
              <option value="" disabled>Select…</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category_id} onChange={e=>setForm({...form, category_id:e.target.value})}>
              <option value="">Uncategorized</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.type}: {c.name}</option>)}
            </Select>
          </div>
          <div className="md:col-span-5 flex items-center justify-between">
            <div className="text-xs text-zinc-500">Tip: expenses are negative numbers. Income is positive.</div>
            <Button type="submit" disabled={loading}>Add</Button>
          </div>
        </form>
      </Card>

      <Card title="Recent transactions (last 200)">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-600"><tr className="border-b border-zinc-200">
              <th className="text-left py-2 pr-2">Date</th><th className="text-left py-2 pr-2">Description</th>
              <th className="text-right py-2 pr-2">Amount</th><th className="text-left py-2 pr-2">Account</th>
              <th className="text-left py-2 pr-2">Category</th><th className="py-2"></th>
            </tr></thead>
            <tbody>
              {txns.map(t=>(
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-2 whitespace-nowrap">{t.txn_date}</td>
                  <td className="py-2 pr-2">{t.description}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{t.amount.toFixed(2)}</td>
                  <td className="py-2 pr-2">{accounts.find(a=>a.id===t.account_id)?.name ?? "—"}</td>
                  <td className="py-2 pr-2">{categories.find(c=>c.id===t.category_id)?.name ?? "—"}</td>
                  <td className="py-2 text-right"><button className="text-red-600 hover:underline" onClick={()=>del(t.id)}>Delete</button></td>
                </tr>
              ))}
              {!txns.length ? <tr><td colSpan={6} className="py-4 text-zinc-600">No transactions yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
