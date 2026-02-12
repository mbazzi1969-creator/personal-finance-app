"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Category = { id: string; name: string; type: "income" | "expense"; };
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

export default function BudgetPage() {
  const orgId = useActiveOrgId();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [planned, setPlanned] = useState<Record<string, string>>({});

  const months = useMemo(() => {
    const now = new Date(); const list:string[]=[];
    for (let i=0;i<12;i++){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); list.push(monthKey(d)); }
    return list;
  }, []);

  async function load() {
    if (!orgId) return;
    const [c,b] = await Promise.all([
      supabase.from("categories").select("id,name,type").eq("org_id", orgId).order("type").order("name"),
      supabase.from("budgets").select("category_id,planned").eq("org_id", orgId).eq("month", month),
    ]);
    if (!c.error) setCategories(c.data as any); else console.error(c.error);
    if (!b.error) {
      const map: Record<string,string> = {};
      for (const r of (b.data as any[])) map[r.category_id] = String(r.planned);
      setPlanned(map);
    } else console.error(b.error);
  }
  useEffect(()=>{ load(); }, [orgId, month]);

  async function save() {
    if (!orgId) return;
    const payload = Object.entries(planned).map(([category_id,v])=>({ org_id: orgId, month, category_id, planned: Number(v||0) }));
    const { error } = await supabase.rpc("upsert_budget_rows", { p_org_id: orgId, p_month: month, p_rows: payload });
    if (error) alert(error.message); else alert("Saved!");
    await load();
  }

  const expenseCats = categories.filter(c=>c.type==="expense");

  return (
    <div className="space-y-4">
      <Card title="Budget">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>Month</Label><div className="w-40">
            <Select value={month} onChange={(e)=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{m}</option>)}</Select>
          </div></div>
          <div className="ml-auto"><Button onClick={save}>Save budget</Button></div>
        </div>
      </Card>

      <Card title="Planned expenses (enter positive numbers)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {expenseCats.map(c=>(
            <div key={c.id} className="flex items-center gap-3">
              <div className="flex-1 text-sm">{c.name}</div>
              <div className="w-40"><Input value={planned[c.id] ?? ""} onChange={(e)=>setPlanned({...planned, [c.id]: e.target.value})} placeholder="e.g., 500" /></div>
            </div>
          ))}
          {!expenseCats.length ? <div className="text-sm text-zinc-600">No expense categories yet. Add them in Settings.</div> : null}
        </div>
      </Card>
    </div>
  );
}
