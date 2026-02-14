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

  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "expense" as "income" | "expense",
  });

  // ===== EDIT STATE =====
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState({
    name: "",
    type: "bank",
    currency: "USD",
    opening_balance: "0",
  });

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState({
    name: "",
    type: "expense" as "income" | "expense",
  });

  async function load() {
    if (!orgId) return;

    const [org, mem, acc, cat] = await Promise.all([
      supabase.from("orgs").select("name").eq("id", orgId).single(),
      supabase.rpc("list_members", { p_org_id: orgId }),
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

    if (!org.error) setOrgName((org.data as any)?.name ?? "");
    if (!mem.error) setMembers((mem.data ?? []) as any);
    if (!acc.error) setAccounts((acc.data ?? []) as any);
    if (!cat.error) setCategories((cat.data ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function saveOrgName() {
    const { error } = await supabase.from("orgs").update({ name: orgName }).eq("id", orgId);
    if (error) alert(error.message);
    else alert("Saved!");
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

  function startEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setEditAccount({
      name: a.name,
      type: a.type,
      currency: a.currency,
      opening_balance: String(a.opening_balance),
    });
  }

  function cancelEditAccount() {
    setEditingAccountId(null);
  }

  async function saveEditAccount(id: string) {
    const { error } = await supabase
      .from("accounts")
      .update({
        name: editAccount.name,
        type: editAccount.type,
        currency: editAccount.currency,
        opening_balance: Number(editAccount.opening_balance || 0),
      })
      .eq("id", id);

    if (error) return alert(error.message);

    cancelEditAccount();
    await load();
  }

  async function addCategory() {
    if (!orgId) return;

    const { error } = await supabase.from("categories").insert({
      org_id: orgId,
      name: newCategory.name,
      type: newCategory.type,
    });

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

  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id);
    setEditCategory({ name: c.name, type: c.type });
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
  }

  async function saveEditCategory(id: string) {
    const { error } = await supabase
      .from("categories")
      .update({
        name: editCategory.name,
        type: editCategory.type,
      })
      .eq("id", id);

    if (error) return alert(error.message);

    cancelEditCategory();
    await load();
  }

  return (
    <div className="space-y-4">
      <Card title="Workspace">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label>Name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <Button onClick={saveOrgName}>Save</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ================= ACCOUNTS ================= */}
        <Card title="Accounts">
          {/* Add */}
          <div className="space-y-3">
            <Input
              placeholder="Account name"
              value={newAccount.name}
              onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
            />
            <Select
              value={newAccount.type}
              onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
            >
              <option value="bank">bank</option>
              <option value="cash">cash</option>
              <option value="credit_card">credit_card</option>
              <option value="loan">loan</option>
              <option value="investment">investment</option>
              <option value="other">other</option>
            </Select>
            <Input
              placeholder="Currency"
              value={newAccount.currency}
              onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
            />
            <Input
              placeholder="Opening balance"
              value={newAccount.opening_balance}
              onChange={(e) => setNewAccount({ ...newAccount, opening_balance: e.target.value })}
            />
            <Button onClick={addAccount}>Add</Button>
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {accounts.map((a) => {
              const isEditing = editingAccountId === a.id;

              return (
                <div key={a.id} className="border rounded p-2">
                  {!isEditing ? (
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-zinc-500">
                          {a.type} • {a.currency} • {a.opening_balance}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="text-blue-600" onClick={() => startEditAccount(a)}>
                          Edit
                        </button>
                        <button className="text-red-600" onClick={() => delAccount(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={editAccount.name}
                        onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                      />
                      <Input
                        value={editAccount.currency}
                        onChange={(e) => setEditAccount({ ...editAccount, currency: e.target.value })}
                      />
                      <Input
                        value={editAccount.opening_balance}
                        onChange={(e) =>
                          setEditAccount({ ...editAccount, opening_balance: e.target.value })
                        }
                      />
                      <div className="flex gap-2 justify-end">
                        <Button onClick={() => saveEditAccount(a.id)}>Save</Button>
                        <Button onClick={cancelEditAccount} variant="ghost">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ================= CATEGORIES ================= */}
        <Card title="Categories">
          {/* Add */}
          <div className="space-y-3">
            <Input
              placeholder="Category name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            />
            <Select
              value={newCategory.type}
              onChange={(e) =>
                setNewCategory({ ...newCategory, type: e.target.value as any })
              }
            >
              <option value="expense">expense</option>
              <option value="income">income</option>
            </Select>
            <Button onClick={addCategory}>Add</Button>
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {categories.map((c) => {
              const isEditing = editingCategoryId === c.id;

              return (
                <div key={c.id} className="border rounded p-2">
                  {!isEditing ? (
                    <div className="flex justify-between items-center">
                      <div>
                        {c.type}: <span className="font-medium">{c.name}</span>
                      </div>
                      <div className="flex gap-3">
                        <button className="text-blue-600" onClick={() => startEditCategory(c)}>
                          Edit
                        </button>
                        <button className="text-red-600" onClick={() => delCategory(c.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={editCategory.name}
                        onChange={(e) =>
                          setEditCategory({ ...editCategory, name: e.target.value })
                        }
                      />
                      <Select
                        value={editCategory.type}
                        onChange={(e) =>
                          setEditCategory({ ...editCategory, type: e.target.value as any })
                        }
                      >
                        <option value="expense">expense</option>
                        <option value="income">income</option>
                      </Select>
                      <div className="flex gap-2 justify-end">
                        <Button onClick={() => saveEditCategory(c.id)}>Save</Button>
                        <Button onClick={cancelEditCategory} variant="ghost">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
