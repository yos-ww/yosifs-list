-- Better list search: match whole words, so "bread" no longer finds "Breaded"
-- and "eggs" no longer finds "Eggplant". Plurals still match ("egg" ↔ "eggs").
--
-- Score per product = share of query words found as whole words in the name
--                   + 0.4 × share found in the category (e.g. "dairy eggs / milk")
--                   + 0.2 × fuzzy similarity (tie-breaker).
-- Note: the migrate workflow re-runs every file in order, so this file is the current definition.
create or replace function public.search_list(queries text[], per_store int default 4)
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
  rank       int
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
      array(
        select '\m'
          || regexp_replace(                                   -- escape regex characters
               regexp_replace(regexp_replace(w, 'oes$', 'o'), 's$', ''),  -- tomatoes→tomato, eggs→egg
               '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')
          || '(s|es)?\M'
        from unnest(regexp_split_to_array(lower(trim(qq.q)), '\s+')) as w
        where length(w) > 0
      ) as pats
    from unnest(queries[1:50]) with ordinality as qq (q, idx)
    where length(trim(qq.q)) > 0
  )
  select
    q.idx, s.store_id, s.id, s.name, s.size, s.category,
    s.price_qar, s.image_url, s.source_url, s.score, s.rn::int
  from q
  cross join lateral (
    select p.*, sc.score,
      row_number() over (partition by p.store_id order by sc.score desc, p.price_qar asc) as rn
    from public.products p
    cross join lateral (
      select
        (select count(*) from unnest(q.pats) pat where p.name ~* pat)::real
          / greatest(cardinality(q.pats), 1) as in_name,
        (select count(*) from unnest(q.pats) pat where coalesce(p.category, '') ~* pat)::real
          / greatest(cardinality(q.pats), 1) as in_category,
        word_similarity(q.q, p.name) as fuzzy
    ) m
    cross join lateral (
      select (m.in_name + 0.4 * m.in_category + 0.2 * m.fuzzy)::real as score
    ) sc
    where p.in_stock
      and q.q <% p.name                          -- quick pre-filter using the trigram index
      and m.in_name >= 0.5                       -- at least half the typed words, as whole words
                                                 -- (typo-tolerant "smarter search" comes later)
  ) s
  where s.rn <= least(greatest(per_store, 1), 10)
  order by q.idx, s.store_id, s.rn;
$$;

grant execute on function public.search_list(text[], int) to anon, authenticated;
