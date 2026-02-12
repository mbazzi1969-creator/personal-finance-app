create extension if not exists "pgcrypto";

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank','cash','credit_card','loan','investment','other')),
  currency text not null default 'USD',
  opening_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  txn_date date not null,
  description text not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_org_date on public.transactions(org_id, txn_date desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  month text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  planned numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, month, category_id)
);

create or replace function public.user_role(p_org_id uuid)
returns text language sql stable as $$
  select role from public.org_members where org_id = p_org_id and user_id = auth.uid()
$$;

create or replace function public.is_member(p_org_id uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.org_members where org_id = p_org_id and user_id = auth.uid())
$$;

create or replace function public.can_write(p_org_id uuid)
returns boolean language sql stable as $$
  select coalesce(public.user_role(p_org_id), '') in ('owner','admin','editor')
$$;

create or replace function public.is_admin(p_org_id uuid)
returns boolean language sql stable as $$
  select coalesce(public.user_role(p_org_id), '') in ('owner','admin')
$$;

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs for select using (public.is_member(id));
drop policy if exists orgs_update on public.orgs;
create policy orgs_update on public.orgs for update using (public.is_admin(id)) with check (public.is_admin(id));

drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members for select using (public.is_member(org_id));
drop policy if exists org_members_modify on public.org_members;
create policy org_members_modify on public.org_members for all using (public.is_admin(org_id)) with check (public.is_admin(org_id));

drop policy if exists org_invites_select on public.org_invites;
create policy org_invites_select on public.org_invites for select using (public.is_admin(org_id));
drop policy if exists org_invites_insert on public.org_invites;
create policy org_invites_insert on public.org_invites for insert with check (public.is_admin(org_id));
drop policy if exists org_invites_delete on public.org_invites;
create policy org_invites_delete on public.org_invites for delete using (public.is_admin(org_id));

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select using (public.is_member(org_id));
create policy accounts_insert on public.accounts for insert with check (public.can_write(org_id));
create policy accounts_update on public.accounts for update using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy accounts_delete on public.accounts for delete using (public.can_write(org_id));

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select using (public.is_member(org_id));
create policy categories_insert on public.categories for insert with check (public.can_write(org_id));
create policy categories_update on public.categories for update using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy categories_delete on public.categories for delete using (public.can_write(org_id));

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select using (public.is_member(org_id));
create policy transactions_insert on public.transactions for insert with check (public.can_write(org_id));
create policy transactions_update on public.transactions for update using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy transactions_delete on public.transactions for delete using (public.can_write(org_id));

drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets for select using (public.is_member(org_id));
create policy budgets_insert on public.budgets for insert with check (public.can_write(org_id));
create policy budgets_update on public.budgets for update using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy budgets_delete on public.budgets for delete using (public.can_write(org_id));

create or replace function public.create_org(p_name text)
returns uuid language plpgsql security definer as $$
declare v_org_id uuid;
begin
  insert into public.orgs(name) values (p_name) returning id into v_org_id;
  insert into public.org_members(org_id, user_id, role) values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end; $$;

create or replace function public.invite_member(p_org_id uuid, p_email text, p_role text)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin(p_org_id) then raise exception 'Not authorized'; end if;
  insert into public.org_invites(org_id, email, role) values (p_org_id, lower(p_email), p_role);
end; $$;

create or replace function public.list_members(p_org_id uuid)
returns table(user_email text, role text) language plpgsql security definer as $$
begin
  if not public.is_member(p_org_id) then raise exception 'Not authorized'; end if;
  return query
  select u.email as user_email, m.role
  from public.org_members m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
  order by m.created_at asc;
end; $$;

create or replace function public.accept_invites()
returns int language plpgsql security definer as $$
declare v_email text; v_count int := 0; r record;
begin
  select email into v_email from auth.users where id = auth.uid();
  for r in select * from public.org_invites where email = lower(v_email)
  loop
    insert into public.org_members(org_id, user_id, role) values (r.org_id, auth.uid(), r.role) on conflict do nothing;
    delete from public.org_invites where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

create or replace function public.monthly_summary(p_org_id uuid, p_months int)
returns table(month text, income numeric, expense numeric, net numeric)
language sql security definer as $$
  with months as (
    select to_char(date_trunc('month', (current_date - (n||' months')::interval)),'YYYY-MM') as month
    from generate_series(0, p_months-1) as n
  ),
  t as (
    select to_char(date_trunc('month', txn_date),'YYYY-MM') as month,
           sum(case when amount > 0 then amount else 0 end) as income,
           sum(case when amount < 0 then amount else 0 end) as expense,
           sum(amount) as net
    from public.transactions
    where org_id = p_org_id
    group by 1
  )
  select m.month, coalesce(t.income,0), coalesce(t.expense,0), coalesce(t.net,0)
  from months m left join t on t.month = m.month
  order by m.month desc;
$$;

create or replace function public.top_categories_for_month(p_org_id uuid, p_month text, p_limit int)
returns table(category_name text, total numeric)
language sql security definer as $$
  select coalesce(c.name,'Uncategorized') as category_name, sum(t.amount) as total
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.org_id = p_org_id and to_char(date_trunc('month', t.txn_date),'YYYY-MM') = p_month
  group by 1
  order by abs(sum(t.amount)) desc
  limit p_limit;
$$;

create or replace function public.account_balances(p_org_id uuid)
returns table(account_name text, balance numeric)
language sql security definer as $$
  select a.name as account_name, (a.opening_balance + coalesce(sum(t.amount),0)) as balance
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  where a.org_id = p_org_id
  group by a.id
  order by a.name;
$$;

create or replace function public.upsert_budget_rows(p_org_id uuid, p_month text, p_rows jsonb)
returns void language plpgsql security definer as $$
declare r jsonb;
begin
  if not public.can_write(p_org_id) then raise exception 'Not authorized'; end if;
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.budgets(org_id, month, category_id, planned)
    values (p_org_id, p_month, (r->>'category_id')::uuid, coalesce((r->>'planned')::numeric,0))
    on conflict (org_id, month, category_id) do update set planned = excluded.planned;
  end loop;
end; $$;

grant execute on function public.create_org(text) to anon, authenticated;
grant execute on function public.invite_member(uuid,text,text) to anon, authenticated;
grant execute on function public.accept_invites() to anon, authenticated;
grant execute on function public.list_members(uuid) to anon, authenticated;
grant execute on function public.monthly_summary(uuid,int) to anon, authenticated;
grant execute on function public.top_categories_for_month(uuid,text,int) to anon, authenticated;
grant execute on function public.account_balances(uuid) to anon, authenticated;
grant execute on function public.upsert_budget_rows(uuid,text,jsonb) to anon, authenticated;
