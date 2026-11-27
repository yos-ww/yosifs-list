-- When the user PICKS a product from the dropdown, the results should:
--   • main row  = that exact product at each store (near-identical name), else "not found"
--   • "N more"  = other products of the same kind at that store (same aisle, e.g. "rice"),
--                 most similar to the picked product first.
-- Typed (not picked) items work exactly as before.
-- This file is the current definition of search_list; it re-runs on every migration.

create index if not exists products_category_trgm_idx
  on public.products using gin (category extensions.gin_trgm_ops);

drop function if exists public.search_list(text[], int);

-- kinds[i] = the aisle of the picked product for item i (e.g. 'rice'), or null for typed items.
create or replace function public.search_list(
  queries   text[],
  per_store int    default 4,
  kinds     text[] default null
)
returns table (
  query_idx  int,
  store_id   text,
  product_id bigint,
  name       text,
  size       text,
  category   text,
  price_qar  numeric,
  image_url  text,
  source_url text,
  score      real,
  rank       int,
  is_main    boolean   -- true = a real match for the item; false = an alternative of the same kind
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      qq.idx::int as idx,
      lower(trim(qq.q)) as q,
      public.word_patterns(qq.q, false) as pats,
      nullif(lower(trim(coalesce(kinds[qq.idx], ''))), '') as kind
    from unnest(queries[1:50]) with ordinality as qq (q, idx)
    where length(trim(qq.q)) > 0
  ),
  q2 as (
    select
      q.*,
      public.word_patterns(coalesce(q.kind, ''), false) as kind_pats,
      (select w from unnest(regexp_split_to_array(coalesce(q.kind, ''), '\s+')) as w
       order by length(w) desc limit 1) as kind_key,
      -- A picked product needs a near-identical name (75% of its words) to count as "the same product".
      case when q.kind is null then 0.5 else 0.75 end as main_min
    from q
  )
  select
    q2.idx, s.store_id, s.id, s.name, s.size, s.category,
    s.price_qar, s.image_url, s.source_url, s.score, s.rn::int, s.is_main
  from q2
  cross join lateral (
    select p.*, sc.score, sc.is_main,
      row_number() over (
        partition by p.store_id order by sc.is_main desc, sc.score desc, p.price_qar asc
      ) as rn
    from public.products p
    cross join lateral (
      select
        (select count(*) from unnest(q2.pats) pat where p.name ~* pat)::real
          / greatest(cardinality(q2.pats), 1) as in_name,
        (select count(*) from unnest(q2.pats) pat where coalesce(p.category, '') ~* pat)::real
          / greatest(cardinality(q2.pats), 1) as in_category,
        case when cardinality(q2.kind_pats) > 0 then
          (select count(*) from unnest(q2.kind_pats) pat
            where split_part(coalesce(p.category, ''), ' / ', 2) ~* pat)::real
            / cardinality(q2.kind_pats)
        else 0 end as in_kind,
        word_similarity(q2.q, p.name) as fuzzy
    ) m
    cross join lateral (
      select
        (m.in_name >= q2.main_min) as is_main,
        (case when m.in_name >= q2.main_min
              then m.in_name + 0.4 * m.in_category + 0.2 * m.fuzzy
              else 0.5 * m.fuzzy                 -- alternatives: most similar to the picked product first
         end)::real as score
    ) sc
    where p.in_stock
      and (q2.q <% p.name                                                     -- trigram index (name)
           or (q2.kind_key is not null and p.category ilike '%' || q2.kind_key || '%'))  -- (category)
      and (m.in_name >= q2.main_min or m.in_kind >= 0.5)
  ) s
  where s.rn <= least(greatest(per_store, 1), 10)
  order by q2.idx, s.store_id, s.rn;
$$;

grant execute on function public.search_list(text[], int, text[]) to anon, authenticated;

-- Dropdown suggestions now also return the product's aisle ("kind"), e.g. 'rice'.
drop function if exists public.suggest_products(text, int);
create or replace function public.suggest_products(q text, max_results int default 6)
returns table (
  name        text,
  size        text,
  image_url   text,
  min_price   numeric,
  max_price   numeric,
  store_count int,
  score       real,
  kind        text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select public.word_patterns(q, true) as pats, lower(trim(q)) as typed
  ),
  hits as (
    select
      pr.name as pname, pr.size as psize, pr.image_url as pimage,
      pr.price_qar as pprice, pr.store_id as pstore,
      split_part(coalesce(pr.category, ''), ' / ', 2) as pkind,
      m.in_name,
      (m.in_name + 0.4 * m.in_category + 0.2 * word_similarity(input.typed, pr.name))::real as pscore
    from public.products pr
    cross join input
    cross join lateral (
      select
        (select count(*) from unnest(input.pats) pat where pr.name ~* pat)::real
          / greatest(cardinality(input.pats), 1) as in_name,
        (select count(*) from unnest(input.pats) pat where coalesce(pr.category, '') ~* pat)::real
          / greatest(cardinality(input.pats), 1) as in_category
    ) m
    where pr.in_stock
      and length(input.typed) >= 2
      and (input.typed <% pr.name or pr.name ilike '%' || input.typed || '%')
  )
  select
    min(hits.pname), min(hits.psize), max(hits.pimage),
    min(hits.pprice), max(hits.pprice), count(distinct hits.pstore)::int, max(hits.pscore),
    mode() within group (order by hits.pkind)
  from hits
  where hits.in_name >= 0.5
  group by lower(regexp_replace(hits.pname, '\s+', ' ', 'g'))
  order by max(hits.pscore) desc, count(distinct hits.pstore) desc, min(hits.pprice) asc
  limit least(greatest(max_results, 1), 20);
$$;

grant execute on function public.suggest_products(text, int) to anon, authenticated;
