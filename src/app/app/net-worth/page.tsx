"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Card } from "@/components/ui";

export default function NetWorthPage() {
  const orgId = useActiveOrgId();
  const [net, setNet] = useState(0);
  const [byAccount, setByAccount] = useState<{ name: string; balance: number }[]>([]);

  useEffect(()=> {
    if (!orgId) return;
    (async ()=>{
      const { data, error } = await supabase.rpc("account_balances", { p_org_id: orgId });
      if (error) return console.error(error);
      const rows = (data ?? []).map((r: { account_name: string; balance: number })=>({ name:r.account_name, balance:Number(r.balance||0) }));
      setByAccount(rows);
      setNet(rows.reduce((s: number, r: { balance: number }) => s + r.balance, 0));
    })();
  }, [orgId]);

  return (
    <div className="space-y-4">
      <Card title="Net worth (accounts total)">
        <div className="text-2xl font-semibold">${net.toFixed(2)}</div>
        <div className="text-xs text-zinc-500 mt-2">Balances = opening balance + sum(transactions) per account.</div>
      </Card>
      <Card title="Balances by account">
        <div className="space-y-2">
          {byAccount.map(a=>(
            <div key={a.name} className="flex items-center justify-between text-sm">
              <div className="truncate">{a.name}</div>
              <div className="tabular-nums">${a.balance.toFixed(2)}</div>
            </div>
          ))}
          {!byAccount.length ? <div className="text-sm text-zinc-600">No accounts yet. Add them in Settings.</div> : null}
        </div>
      </Card>
    </div>
  );
}
