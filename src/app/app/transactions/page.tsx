"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useActiveOrgId } from "@/lib/useActiveOrg";
import { Card } from "@/components/ui";

type AccountType =
  | "bank"
  | "cash"
  | "credit_card"
  | "loan"
  | "investment"
  | "other";

type AccountRow = {
  id: string;
  org_id: string;
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number;
};

type CategoryType = "income" | "expense";

type CategoryRow = {
  id: string;
  org_id: string;
  name: string;
  type: CategoryType;
};

export default function SettingsPage() {
  const orgId = useActiveOrgId();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ---------- ADD FORMS ----------
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<AccountType>("bank");
  const [accCurrency, setAccCurrency] = useState("USD");
  const [accOpening, setAccOpening] = useState("0");

  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<CategoryType>("expense");

  // ---------- EDIT STATE ----------
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccType, setEditAccType] = useState<AccountType>("bank");
  const [editAccCurrency, setEditAccCurrency] = useState("USD");
  const [editAccOpening, setEditAccOpening] = useState("0");

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<CategoryType>("expense");

  const editingAccount = useMemo(
    () => accounts.find((a) => a.id === editingAccountId) ?? null,
    [accounts, editingAccountId]
  );

  const editingCategory = useMemo(
    () => categories.find((c) => c.id === editingCategoryId) ?? null,
    [categories, editingCategoryId]
  );

  // ---------- LOAD ----------
  async function loadAll() {
    if (!orgId) return;
    setLoading(true);

    const [a, c] = await Promise.all([
      supabase
        .from("accounts")
        .select("id,org_id,name,type,currency,opening_balance")
        .eq("org_id", orgId)
        .order("name"),
      supabase
        .from("categories")
        .select("id,org_id,name,type")
        .eq("org_id", orgId)
        .order("type")
        .order("name"),
    ]);

    if (a.error) console.error(a.error);
    if (c.error) console.error(c.error);

    setAccounts((a.data ?? []) as any);
    setCategories((c.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // ---------- ACCOUNTS: ADD / DELETE / EDIT ----------
  async function addAccount() {
    if (!orgId) return;

    const opening = Number(accOpening || 0);

    const { error } = await supabase.from("accounts").insert({
      org_id: orgId,
      name: accName.trim(),
      type: accType,
      currency: accCurrency.trim() || "USD",
      opening_balance: opening,
    });

    if (error) return alert(error.message);

    setAccName("");
    setAccOpening("0");
    await loadAll();
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this account?")) return;

    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) return alert(error.message);

    // if you were editing this one, close edit mode
    if (editingAccountId === id) setEditingAccountId(null);

    await loadAll();
  }

  function startEditAccount(a: AccountRow) {
    setEditingAccountId(a.id);
    setEditAccName(a.name);
    setEditAccType(a.type);
    setEditAccCurrency(a.currency || "USD");
    setEditAccOpening(String(a.opening_balance ?? 0));
  }

  async function saveAccountEdit() {
    if (!editingAccountId) return;

    const opening = Number(editAccOpening || 0);

    const { error } = await supabase
      .from("accounts")
      .update({
        name: editAccName.trim(),
        type: editAccType,
        currency: editAccCurrency.trim() || "USD",
        opening_balance: opening,
      })
      .eq("id", editingAccountId);

    if (error) return alert(error.message);

    setEditingAccountId(null);
    await loadAll();
  }

  // ---------- CATEGORIES: ADD / DELETE / EDIT ----------
  async function addCategory() {
    if (!orgId) return;

    const { error } = await supabase.from("categories").insert({
      org_id: orgId,
      name: catName.trim(),
      type: catType,
    });

    if (error) return alert(error.message);

    setCatName("");
    await loadAll();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return alert(error.message);

    if (editingCategoryId === id) setEditingCategoryId(null);

    await loadAll();
  }

  function startEditCategory(c: CategoryRow) {
    setEditingCategoryId(c.id);
    setEditCatName(c.name);
    setEditCatType(c.type);
  }

  async function saveCategoryEdit() {
    if (!editingCategoryId) return;

    const { error } = await supabase
      .from("categories")
      .update({
        name: editCatName.trim(),
        type: editCatType,
      })
      .eq("id", editingCategoryId);

    if (error) return alert(error.message);

    setEditingCategoryId(null);
    await loadAll();
  }

  return (
    <div className="space-y-4">
      {/* ACCOUNTS */}
      <Card title="Accounts">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-4">
            <div className="text-sm font-medium mb-2">Add account</div>
          </div>

          <input
            className="border rounded px-3 py-2"
            placeholder="e.g., Chase Checking"
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
          />

          <select
            className="border rounded px-3 py-2"
            value={accType}
            onChange={(e) => setAccType(e.target.value as AccountType)}
          >
            <option value="bank">bank</option>
            <option value="cash">cash</option>
            <option value="credit_card">credit_card</option>
            <option value="loan">loan</option>
            <option value="investment">investment</option>
            <option value="other">other</option>
          </select>

          <input
            className="border rounded px-3 py-2"
            placeholder="USD"
            value={accCurrency}
            onChange={(e) => setAccCurrency(e.target.value)}
          />

          <input
            className="border rounded px-3 py-2"
            placeholder="Opening balance"
            value={accOpening}
            onChange={(e) => setAccOpening(e.target.value)}
          />

          <div className="md:col-span-4 flex justify-end">
            <button
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
              disabled={loading || !orgId || !accName.trim()}
              onClick={addAccount}
            >
              Add
            </button>
          </div>

          {/* EDIT ACCOUNT PANEL */}
          {editingAccount ? (
            <div className="md:col-span-4 border rounded-lg p-4">
              <div className="font-semibold mb-3">Edit account</div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  className="border rounded px-3 py-2"
                  value={editAccName}
                  onChange={(e) => setEditAccName(e.target.value)}
                  placeholder="Name"
                />

                <select
                  className="border rounded px-3 py-2"
                  value={editAccType}
                  onChange={(e) => setEditAccType(e.target.value as AccountType)}
                >
                  <option value="bank">bank</option>
                  <option value="cash">cash</option>
                  <option value="credit_card">credit_card</option>
                  <option value="loan">loan</option>
                  <option value="investment">investment</option>
                  <option value="other">other</option>
                </select>

                <input
                  className="border rounded px-3 py-2"
                  value={editAccCurrency}
                  onChange={(e) => setEditAccCurrency(e.target.value)}
                  placeholder="Currency"
                />

                <input
                  className="border rounded px-3 py-2"
                  value={editAccOpening}
                  onChange={(e) => setEditAccOpening(e.target.value)}
                  placeholder="Opening balance"
                />

                <div className="md:col-span-4 flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded border"
                    onClick={() => setEditingAccountId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-black text-white"
                    onClick={saveAccountEdit}
                    disabled={!editAccName.trim()}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="text-xs text-zinc-500 mt-2">
                Note: opening balance is separate from transactions and affects net worth.
              </div>
            </div>
          ) : null}

          {/* LIST */}
          <div className="md:col-span-4 mt-2">
            {accounts.length === 0 ? (
              <div className="text-sm text-zinc-600">No accounts yet.</div>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-sm border-b border-zinc-100 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{a.name}</div>
                      <div className="text-xs text-zinc-500">
                        {a.type} • {a.currency} • opening {Number(a.opening_balance ?? 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => startEditAccount(a)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => deleteAccount(a.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* CATEGORIES */}
      <Card title="Categories">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <div className="text-sm font-medium mb-2">Add category</div>
          </div>

          <input
            className="border rounded px-3 py-2"
            placeholder="e.g., Groceries"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />

          <select
            className="border rounded px-3 py-2"
            value={catType}
            onChange={(e) => setCatType(e.target.value as CategoryType)}
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>

          <div className="flex justify-end">
            <button
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
              disabled={loading || !orgId || !catName.trim()}
              onClick={addCategory}
            >
              Add
            </button>
          </div>

          {/* EDIT CATEGORY PANEL */}
          {editingCategory ? (
            <div className="md:col-span-3 border rounded-lg p-4">
              <div className="font-semibold mb-3">Edit category</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="border rounded px-3 py-2"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  placeholder="Name"
                />
                <select
                  className="border rounded px-3 py-2"
                  value={editCatType}
                  onChange={(e) => setEditCatType(e.target.value as CategoryType)}
                >
                  <option value="expense">expense</option>
                  <option value="income">income</option>
                </select>

                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded border"
                    onClick={() => setEditingCategoryId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-black text-white"
                    onClick={saveCategoryEdit}
                    disabled={!editCatName.trim()}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                Category type controls transaction sign automatically (income = +, expense = -).
              </div>
            </div>
          ) : null}

          {/* LIST */}
          <div className="md:col-span-3 mt-2">
            {categories.length === 0 ? (
              <div className="text-sm text-zinc-600">No categories yet.</div>
            ) : (
              <div className="space-y-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm border-b border-zinc-100 py-2"
                  >
                    <div className="truncate">
                      {c.type}: {c.name}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => startEditCategory(c)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => deleteCategory(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
