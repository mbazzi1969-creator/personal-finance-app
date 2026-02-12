"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Select } from "@/components/ui";

type Org = { id: string; name: string; created_at: string };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data, error } = await supabase.from("org_members").select("orgs(id,name,created_at)").order("created_at", { ascending: true });
      if (error) { console.error(error); return; }
      const rows = (data ?? []).map((r: any) => r.orgs).filter(Boolean) as Org[];
      setOrgs(rows);
      const stored = localStorage.getItem("active_org_id");
      const pick = stored && rows.find(o => o.id === stored) ? stored : (rows[0]?.id ?? "");
      setActiveOrgId(pick);
    })();
  }, [session?.user]);

  useEffect(() => { if (activeOrgId) localStorage.setItem("active_org_id", activeOrgId); }, [activeOrgId]);

  if (loading) return <div className="p-6">Loading…</div>;

  if (!session?.user) return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 p-6">
        <h1 className="text-xl font-semibold">Finance MVP</h1>
        <p className="text-sm text-zinc-600 mt-1">Sign in to continue.</p>
        <AuthForm />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <div className="font-semibold">Finance</div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/app">Dashboard</Link>
            <Link href="/app/transactions">Transactions</Link>
            <Link href="/app/budget">Budget</Link>
            <Link href="/app/net-worth">Net Worth</Link>
            <Link href="/app/settings">Settings</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-56">
              <Select value={activeOrgId} onChange={(e) => setActiveOrgId(e.target.value)}>
                {orgs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </Select>
            </div>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><div data-active-org-id={activeOrgId}>{children}</div></main>
    </div>
  );
}

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={onSubmit}>
      <div><div className="text-xs font-medium text-zinc-700 mb-1">Email</div>
        <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
      </div>
      <div><div className="text-xs font-medium text-zinc-700 mb-1">Password</div>
        <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={password} onChange={e => setPassword(e.target.value)} type="password" required />
      </div>
      <button className="w-full rounded-xl bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800">
        {mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-zinc-700 hover:underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
        </button>
      </div>
      {msg ? <div className="text-sm text-zinc-700">{msg}</div> : null}
    </form>
  );
}
