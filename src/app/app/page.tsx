"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Card, Select } from "@/components/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type MonthRow = { month: string; income: number; expense: number; net: number; };
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

export default function Dashboard() {
  const orgId = useActiveOrgId();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [topCats, setTopCats] = useState<{ name: string; total: number }[]>([]);

  const months = useMemo(() => {
    const now = new Date(); const list: string[] = [];
    for (let i=0;i<12;i++){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); list.push(monthKey(d)); }
    return list;
  }, []);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data, error } = await supabase.rpc("monthly_summary", { p_org_id: orgId, p_months: 12 });
      if (error) return console.error(error);
      setRows((data ?? []).map((r: { month: string; income: number; expense: number; net: number }) => ({ month: r.month, income: Number(r.income || 0), expense: Number(r.expense || 0), net: Number(r.net || 0) })));
    })();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data, error } = await supabase.rpc("top_categories_for_month", { p_org_id: orgId, p_month: month, p_limit: 8 });
      if (error) return console.error(error);
      setTopCats((data ?? []).map((r: { category_name: string; total: number }) => ({ name: r.category_name, total: Number(r.total || 0) })));
    })();
  }, [orgId, month]);

  const current = rows.find(r=>r.month===month) ?? { month, income:0, expense:0, net:0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-700 mb-1">Month</div>
          <div className="w-40">
            <Select value={month} onChange={(e)=>setMonth(e.target.value)}>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        </div>
        <div className="text-sm text-zinc-600">Income and expenses come from your Transactions.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Income"><div className="text-2xl font-semibold">${current.income.toFixed(2)}</div></Card>
        <Card title="Expenses"><div className="text-2xl font-semibold">${Math.abs(current.expense).toFixed(2)}</div></Card>
        <Card title="Net"><div className="text-2xl font-semibold">${current.net.toFixed(2)}</div></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="12-month cashflow trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...rows].reverse()}>
                <XAxis dataKey="month" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="net" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-zinc-500 mt-2">Tip: Expenses should be entered as negative numbers.</div>
        </Card>

        <Card title="Top categories (selected month)">
          <div className="space-y-2">
            {topCats.length ? topCats.map(c=>(
              <div key={c.name} className="flex items-center justify-between text-sm">
                <div className="truncate">{c.name}</div>
                <div className="tabular-nums">${Math.abs(c.total).toFixed(2)}</div>
              </div>
            )) : <div className="text-sm text-zinc-600">No data yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
