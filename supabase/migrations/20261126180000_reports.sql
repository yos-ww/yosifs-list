-- Shopper reports from the results page ("wrong price", "not in store", ...).
-- Anyone can SEND a report; nobody can read them through the public API.
-- The owner reads them in Supabase → Table Editor → reports.
-- Safe to re-run.

create table if not exists public.reports (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  store_id      text references public.stores (id) on delete set null,
  product_id    bigint references public.products (id) on delete set null,
  item_text     text check (char_length(item_text) <= 200),     -- what was on the list, e.g. "rice"
  product_name  text check (char_length(product_name) <= 200),  -- what the site showed
  shown_price   numeric(10, 2),
  problem       text not null
                check (problem in ('wrong_price', 'not_available', 'wrong_product', 'other')),
  correct_price numeric(10, 2) check (correct_price is null or (correct_price >= 0 and correct_price < 10000)),
  note          text check (char_length(note) <= 500),
  status        text not null default 'new' check (status in ('new', 'approved', 'rejected', 'done'))
);

create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Anyone can send a report" on public.reports;
create policy "Anyone can send a report" on public.reports
  for insert to anon, authenticated
  with check (status = 'new');

grant insert on public.reports to anon, authenticated;
grant select, insert, update, delete on public.reports to service_role;
