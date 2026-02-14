"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Role = "owner" | "admin" | "editor" | "viewer";
type Member = { user_email: string; role: Role };
type Account = { id: string; name: string; type: string; currency: string; opening_balance: number };
type Category = { id: string; name: string; type: "income" | "expense" };

export default function SettingsPage() {
  const orgId = useActiveOrgId();
  const [orgName, setOrgName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newOrg, setNewOrg] = useState({ name: "" });
  const [invite, setInvite] = useState({ email: "", role: "viewer" as Role });
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "bank",
    currency: "USD",
    opening_balance: "0",
  });
  const [newCategory, setNewCategory] = useState({ name: "", type: "expense" as "income" | "expense" });

  // ✅ NEW: edit state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState({
    name: "",
    type: "bank",
    currency: "USD",
    opening_balance: "0",
  });

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState({ name: "", type: "expense" as "income" | "expense" });

  async function load() {
    if (!orgId) return;
    const [org, mem, acc, cat] = await Promise.all([
      supabase.from("orgs").select("name").eq("id", orgId).single(),
      supabase.rpc("list_members", { p_org_id: orgId }),
      supabase.from("accounts").select("id,name,type,currency,opening_balance").eq("org_id", orgId).order("name"),
      supabase.from("categories").select("id,name,type").eq("org_id", orgId).order("type").order("name"),
    ]);
    if (!org.error) setOrgName((org.data as any)?.name ?? "");
    if (!mem.error) setMembers((mem.data ?? []) as any);
    if (!acc.error) setAccounts((acc.data ?? []) as any);
    if (!cat.error) setCategories((cat.data ?? []) as any);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function createOrg() {
    const { error } = await supabase.rpc("create_org", { p_name: newOrg.name });
    if (error) return alert(error.message);
    alert("Workspace created. Refresh and select it in the workspace dropdown.");
    setNewOrg({ name: "" });
  }

  async function saveOrgName() {
    const { error } = await supabase.from("orgs").update({ name: orgName }).eq("id", orgId);
    if (error) alert(error.message);
    else alert("Saved!");
    await load();
  }

  async function sendInvite() {
    if (!orgId) return;
    const { error } = await supabase.rpc("invite_member", {
      p_org_id: orgId,
      p_email: invite.email,
      p_role: invite.role,
    });
    if (error) alert(error.message);
    else alert("Invite created. User should sign up with that email, then run accept_invites().");
    setInvite({ email: "", role: "viewer" });
    await load();
  }

  async function addAccount() {
    if (!orgId) return;
    const { error } = await supabase.from("accounts").insert({
      org_id: orgId,
      name: newAccount.name,
      type: newAccount.type,
      currency: newAccount.currency,
      opening_balance: Number(newAccount.opening_balance || 0),
    });
    if (error) alert(error.message);
    else setNewAccount({ name: "", type: "bank", currency: "USD", opening_balance: "0" });
    await load();
  }

  async function delAccount(id: string) {
    if (!confirm("Delete this account?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  // ✅ NEW: account edit handlers
  function startEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setEditAccount({
      name: a.name ?? "",
      type: a.type ?? "bank",
      currency: a.currency ?? "USD",
      opening_balance: String(a.opening_balance ?? 0),
    });
  }

  function cancelEditAccount() {
    setEditingAccountId(null);
    setEditAccount({ name: "", type: "bank", currency: "USD", opening_balance: "0" });
  }

  async function saveEditAccount(id: string) {
    const payload = {
      name: editAccount.name,
      type: editAccount.type,
      currency: editAccount.currency,
      opening_balance: Number(editAccount.opening_balance || 0),
    };

    const { error } = await supabase.from("accounts").update(payload).eq("id", id);
    if (error) return alert(error.message);

    cancelEditAccount();
    await load();
  }

  async function addCategory() {
    if (!orgId) return;
    const { error } = await supabase
      .from("categories")
      .insert({ org_id: orgId, name: newCategory.name, type: newCategory.type });
    if (error) alert(error.message);
    else setNewCategory({ name: "", type: "expense" });
    await load();
  }

  async function delCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  // ✅ NEW: category edit handlers
  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id);
    setEditCategory({ name: c.name ?? "", type: c.type ?? "expense" });
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setEditCategory({ name: "", type: "expense" });
  }

  async function saveEditCategory(id: string) {
    const payload = { name: editCategory.name, type: editCategory.type };
    const { error } = await supabase.from("categories").update(payload).eq("id", id);
    if (error) return alert(error.message);

    cancelEditCategory();
    await load();
  }

  return (
    <div className="space-y-4">
      <Card title="Workspace (Organization)">
        {!orgId ? (
          <div className="text-sm text-zinc-600">No workspace selected yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Workspace name</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <Button onClick={saveOrgName}>Save</Button>
          </div>
        )}

        <div className="mt-6 border-t border-zinc-200 pt-4">
          <div className="font-medium text-sm mb-2">Create a new workspace</div>
          <div className="flex gap-2 max-w-md">
            <Input
              value={newOrg.name}
              onChange={(e) => setNewOrg({ name: e.target.value })}
              placeholder="e.g., Maan Personal"
            />
            <Button onClick={createOrg} disabled={!newOrg.name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Users">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Invite by email</Label>
            <Input
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="user@email.com"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </Select>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={sendInvite} disabled={!invite.email.trim() || !orgId}>
              Create invite
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {members.map((m) => (
            <div key={m.user_email} className="flex items-center justify-between">
              <div className="truncate">{m.user_email}</div>
              <div className="text-zinc-600">{m.role}</div>
            </div>
          ))}
          {!members.length ? <div className="text-zinc-600">No members found.</div> : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Accounts">
          {/* Add */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="e.g., Chase Checking"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newAccount.type} onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}>
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
              <Input value={newAccount.currency} onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Opening balance</Label>
              <Input
                value={newAccount.opening_balance}
                onChange={(e) => setNewAccount({ ...newAccount, opening_balance: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button onClick={addAccount} disabled={!orgId || !newAccount.name.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* List + Edit */}
          <div className="mt-4 space-y-3 text-sm">
            {accounts.map((a) => {
              const isEditing = editingAccountId === a.id;
              return (
                <div key={a.id} className="border border-zinc-200 rounded-md p-2">
                  {!isEditing ? (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.name}</div>
                        <div className="text-xs text-zinc-600 mt-0.5">
                          {a.type} • {a.currency} • opening {a.opening_balance.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => startEditAccount(a)}>
                          Edit
                        </button>
                        <button className="text-red-600 hover:underline" onClick={() => delAccount(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div className="col-span-2">
                        <Label>Name</Label>
                        <Input value={editAccount.name} onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={editAccount.type} onChange={(e) => setEditAccount({ ...editAccount, type: e.target.value })}>
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
                        <Input
                          value={editAccount.currency}
                          onChange={(e) => setEditAccount({ ...editAccount, currency: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Opening balance</Label>
                        <Input
                          value={editAccount.opening_balance}
                          onChange={(e) => setEditAccount({ ...editAccount, opening_balance: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <Button
                          onClick={() => saveEditAccount(a.id)}
                          disabled={!editAccount.name.trim() || !orgId}
                        >
                          Save
                        </Button>
                        <Button onClick={cancelEditAccount} variant="secondary">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!accounts.length ? <div className="text-zinc-600">No accounts yet.</div> : null}
          </div>
        </Card>

        <Card title="Categories">
          {/* Add */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Groceries"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newCategory.type} onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as any })}>
                <option value="expense">expense</option>
                <option value="income">income</option>
              </Select>
            </div>
            <div className="col-span-2 flex justify-end">
              <Button onClick={addCategory} disabled={!orgId || !newCategory.name.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* List + Edit */}
          <div className="mt-4 space-y-3 text-sm">
            {categories.map((c) => {
              const isEditing = editingCategoryId === c.id;
              return (
                <div key={c.id} className="border border-zinc-200 rounded-md p-2">
                  {!isEditing ? (
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        {c.type}: <span className="font-medium">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => startEditCategory(c)}>
                          Edit
                        </button>
                        <button className="text-red-600 hover:underline" onClick={() => delCategory(c.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div className="col-span-2">
                        <Label>Name</Label>
                        <Input value={editCategory.name} onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={editCategory.type}
                          onChange={(e) => setEditCategory({ ...editCategory, type: e.target.value as any })}
                        >
                          <option value="expense">expense</option>
                          <option value="income">income</option>
                        </Select>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <Button
                          onClick={() => saveEditCategory(c.id)}
                          disabled={!editCategory.name.trim() || !orgId}
                        >
                          Save
                        </Button>
                        <Button onClick={cancelEditCategory} variant="secondary">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!categories.length ? <div className="text-zinc-600">No categories yet.</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
