"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Org = { id: string; name: string };

type Account = {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit_card" | "loan" | "investment" | "other";
  currency: string;
  opening_balance: number;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

export default function SettingsPage() {
  const orgId = useActiveOrgId();

  // Workspace creation
  const [orgName, setOrgName] = useState("");

  // Invite (optional)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "admin">("viewer");

  // Data
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Account form
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<Account["type"]>("bank");
  const [accCurrency, setAccCurrency] = useState("USD");
  const [accOpening, setAccOpening] = useState("0");

  // Add Category form
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<Category["type"]>("expense");

  // ✅ Edit Account state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccType, setEditAccType] = useState<Account["type"]>("bank");
  const [editAccCurrency, setEditAccCurrency] = useState("USD");
  const [editAccOpening, setEditAccOpening] = useState("0");

  // ✅ Edit Category state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<Category["type"]>("expense");

  // ---------- Load ----------
  async function load() {
    setLoading(true);

    // Orgs user can see (RLS should allow members)
    const o = await supabase.from("orgs").select("id,name").order("created_at", { ascending: false });
    if (!o.error) setOrgs((o.data ?? []) as any);
    else console.error(o.error);

    if (orgId) {
      const [a, c] = await Promise.all([
        supabase
          .from("accounts")
          .select("id,name,type,currency,opening_balance")
          .eq("org_id", orgId)
          .order("name"),

        supabase
          .from("categories")
          .select("id,name,type")
          .eq("org_id", orgId)
          .order("type")
          .order("name"),
      ]);

      if (!a.error) setAccounts((a.data ?? []) as any);
      else console.error(a.error);

      if (!c.error) setCategories((c.data ?? []) as any);
      else console.error(c.error);
    } else {
      setAccounts([]);
      setCategories([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // ---------- Workspace ----------
  async function createWorkspace() {
    if (!orgName.trim()) return alert("Enter a workspace name");
    const { data, error } = await supabase.rpc("create_org", { p_name: orgName.trim() });

    if (error) return alert(error.message);
    setOrgName("");
    await load();

    // If your useActiveOrgId hook reads from local storage / a setting,
    // you may want to set it there (depends on your implementation).
    // Example (only if your hook uses localStorage key):
    // localStorage.setItem("active_org_id", data);
    // location.reload();
  }

  async function createInvite() {
    if (!orgId) return alert("Create/select a workspace first");
    if (!inviteEmail.trim()) return alert("Enter an email");
    const { error } = await supabase.rpc("invite_member", {
      p_org_id: orgId,
      p_email: inviteEmail.trim(),
      p_role: inviteRole,
    });
    if (error) return alert(error.message);
    setInviteEmail("");
    alert("Invite created.");
  }

  // ---------- Accounts ----------
  async function addAccount() {
    if (!orgId) return alert("Create/select a workspace first");
    if (!accName.trim()) return alert("Enter account name");

    const { error } = await supabase.from("accounts").insert({
      org_id: orgId,
      name: accName.trim(),
      type: accType,
      currency: accCurrency || "USD",
      opening_balance: Number(accOpening || 0),
    });

    if (error) return alert(error.message);

    setAccName("");
    setAccOpening("0");
    await load();
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this account?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) return alert(error.message);
    await load();
  }

  function startEditAccount(a: Account) {
    setEditingAccount(a);
    setEditAccName(a.name);
    setEditAccType(a.type);
    setEditAccCurrency(a.currency || "USD");
    setEditAccOpening(String(a.opening_balance ?? 0));
  }

  async function saveAccountEdit() {
    if (!editingAccount) return;

    const { error } = await supabase
      .from("accounts")
      .update({
        name: editAccName.trim(),
        type: editAccType,
        currency: editAccCurrency || "USD",
        opening_balance: Number(editAccOpening || 0),
      })
      .eq("id", editingAccount.id);

    if (error) return alert(error.message);

    setEditingAccount(null);
    await load();
  }

  // ---------- Categories ----------
  async function addCategory() {
    if (!orgId) return alert("Create/select a workspace first");
    if (!catName.trim()) return alert("Enter category name");

    const { error } = await supabase.from("categories").insert({
      org_id: orgId,
      name: catName.trim(),
      type: catType,
    });

    if (error) return alert(error.message);

    setCatName("");
    await load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return alert(error.message);
    await load();
  }

  function startEditCategory(c: Category) {
    setEditingCategory(c);
    setEditCatName(c.name);
    setEditCatType(c.type);
  }

  async function saveCategoryEdit() {
    if (!editingCategory) return;

    const { error } = await supabase
      .from("categories")
      .update({
        name: editCatName.trim(),
        type: editCatType,
      })
      .eq("id", editingCategory.id);

    if (error) return alert(error.message);

    setEditingCategory(null);
    await load();
  }

  // ---------- UI ----------
  return (
    <div className="space-y-4">
      <Card title="Workspace (Organization)">
        <div className="text-sm text-zinc-600 mb-3">
          {orgId ? (
            <span>Active workspace selected.</span>
          ) : (
            <span>No workspace selected yet. Create one below.</span>
          )}
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Create a new workspace</Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Maan Personal"
            />
          </div>
          <Button type="button" onClick={createWorkspace} disabled={loading}>
            Create
          </Button>
        </div>

        <div className="text-xs text-zinc-500 mt-2">
          If you don’t see your new workspace selected automatically, we can wire it to auto-select based on how your
          <code className="mx-1">useActiveOrgId</code> hook works.
        </div>
      </Card>

      <Card title="Users">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Invite by email</Label>
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@email.com"
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <Button type="button" onClick={createInvite} disabled={loading}>
            Create invite
          </Button>
        </div>

        <div className="text-xs text-zinc-500 mt-2">
          Invites require your RLS + <code className="mx-1">invite_member</code> function to be enabled.
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Accounts */}
        <Card title="Accounts">
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="e.g., Chase Checking" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={accType} onChange={(e) => setAccType(e.target.value as any)}>
                  <option value="bank">bank</option>
                  <option value="cash">cash</option>
                  <option value="credit_card">credit_card</option>
                  <option value="loan">loan</option>
                  <option value="investment">investment</option>
                  <option value="other">other</option>
                </Select>
              </div>

              <div>
                <Label>Currency</Label>
                <Input value={accCurrency} onChange={(e) => setAccCurrency(e.target.value)} placeholder="USD" />
              </div>
            </div>

            <div>
              <Label>Opening balance</Label>
              <Input value={accOpening} onChange={(e) => setAccOpening(e.target.value)} />
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={addAccount} disabled={loading}>
                Add
              </Button>
            </div>

            {/* ✅ Edit Account block */}
            {editingAccount && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="font-semibold">Edit account</div>

                <div>
                  <Label>Name</Label>
                  <Input value={editAccName} onChange={(e) => setEditAccName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={editAccType} onChange={(e) => setEditAccType(e.target.value as any)}>
                      <option value="bank">bank</option>
                      <option value="cash">cash</option>
                      <option value="credit_card">credit_card</option>
                      <option value="loan">loan</option>
                      <option value="investment">investment</option>
                      <option value="other">other</option>
                    </Select>
                  </div>

                  <div>
                    <Label>Currency</Label>
                    <Input value={editAccCurrency} onChange={(e) => setEditAccCurrency(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>Opening balance</Label>
                  <Input value={editAccOpening} onChange={(e) => setEditAccOpening(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 rounded border" onClick={() => setEditingAccount(null)}>
                    Cancel
                  </button>
                  <button className="px-4 py-2 rounded bg-black text-white" onClick={saveAccountEdit}>
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              {!accounts.length ? (
                <div className="text-sm text-zinc-600">No accounts yet.</div>
              ) : (
                accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div className="truncate">{a.name}</div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{a.type}</span>

                      <button className="text-blue-600 hover:underline" onClick={() => startEditAccount(a)}>
                        Edit
                      </button>

                      <button className="text-red-600 hover:underline" onClick={() => deleteAccount(a.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Categories */}
        <Card title="Categories">
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g., Groceries" />
            </div>

            <div>
              <Label>Type</Label>
              <Select value={catType} onChange={(e) => setCatType(e.target.value as any)}>
                <option value="expense">expense</option>
                <option value="income">income</option>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={addCategory} disabled={loading}>
                Add
              </Button>
            </div>

            {/* ✅ Edit Category block */}
            {editingCategory && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="font-semibold">Edit category</div>

                <div>
                  <Label>Name</Label>
                  <Input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                </div>

                <div>
                  <Label>Type</Label>
                  <Select value={editCatType} onChange={(e) => setEditCatType(e.target.value as any)}>
                    <option value="expense">expense</option>
                    <option value="income">income</option>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 rounded border" onClick={() => setEditingCategory(null)}>
                    Cancel
                  </button>
                  <button className="px-4 py-2 rounded bg-black text-white" onClick={saveCategoryEdit}>
                    Save
                  </button>
                </div>

                <div className="text-xs text-zinc-500">
                  If you change a category from expense ↔ income, we can optionally auto-fix existing transaction signs
                  too (tell me if you want that).
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              {!categories.length ? (
                <div className="text-sm text-zinc-600">No categories yet.</div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="truncate">
                      <span className="text-xs text-zinc-500 mr-2">{c.type}:</span>
                      {c.name}
                    </div>

                    <div className="flex items-center gap-3">
                      <button className="text-blue-600 hover:underline" onClick={() => startEditCategory(c)}>
                        Edit
                      </button>

                      <button className="text-red-600 hover:underline" onClick={() => deleteCategory(c.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
