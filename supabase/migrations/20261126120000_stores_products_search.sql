-- Phase 3: stores, products and list search.
-- Safe to run more than once (everything is "if not exists" / "or replace").

create extension if not exists pg_trgm with schema extensions;

-- ── Stores ───────────────────────────────────────────────────────────────
create table if not exists public.stores (
  id         text primary key,            -- e.g. 'carrefour'
  name       text not null,               -- e.g. 'Carrefour'
  website    text,
  created_at timestamptz not null default now()
);

-- ── Products: one row per product per store, from a source (e.g. Rafeeq) ─
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  store_id    text not null references public.stores (id) on delete cascade,
  source      text not null,              -- where the price came from, e.g. 'rafeeq'
  source_sku  text not null,              -- the source's product id
  name        text not null,
  size        text,
  category    text,
  price_qar   numeric(10, 2) not null check (price_qar >= 0),
  in_stock    boolean not null default true,
  image_url   text,
  source_url  text,
  scraped_at  timestamptz not null default now(),
  unique (store_id, source, source_sku)
);

create index if not exists products_store_idx on public.products (store_id);
create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

-- ── Security: anyone can read; nobody can write through the public API ───
-- (Scrapers write with the secret key, which bypasses these rules.)
alter table public.stores enable row level security;
alter table public.products enable row level security;

drop policy if exists "Anyone can read stores" on public.stores;
create policy "Anyone can read stores" on public.stores
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can read products" on public.products;
create policy "Anyone can read products" on public.products
  for select to anon, authenticated using (true);

grant select on public.stores, public.products to anon, authenticated;

-- ── Search a whole list in one call ──────────────────────────────────────
-- For each query (e.g. 'milk'), returns the best few matches at every store,
-- ranked by fuzzy name match (+ a bonus when the category matches), then price.
create or replace function public.search_list(queries text[], per_store int default 4)
returns table (
  query_idx  int,      -- 1-based position in `queries`
  store_id   text,
  product_id bigint,
  name       text,
  size       text,
  category   text,
  price_qar  numeric,
  image_url  text,
  source_url text,
  score      real,
  rank       int       -- 1 = best match at that store
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    qq.idx::int, s.store_id, s.id, s.name, s.size, s.category,
    s.price_qar, s.image_url, s.source_url, s.score, s.rn::int
  from unnest(queries[1:50]) with ordinality as qq (q, idx)
  cross join lateral (
    select p.*, sc.score,
      row_number() over (partition by p.store_id order by sc.score desc, p.price_qar asc) as rn
    from public.products p
    cross join lateral (
      select (
        greatest(word_similarity(qq.q, p.name), similarity(qq.q, p.name))
        + case when p.category ilike '%' || qq.q || '%' then 0.3 else 0 end
      )::real as score
    ) sc
    where p.in_stock
      and length(trim(qq.q)) > 0
      and (qq.q <% p.name or p.name ilike '%' || qq.q || '%')
  ) s
  where s.rn <= least(greatest(per_store, 1), 10)
  order by qq.idx, s.store_id, s.rn;
$$;

grant execute on function public.search_list(text[], int) to anon, authenticated;
