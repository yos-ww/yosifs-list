-- Search-as-you-type dropdown.
-- Safe to re-run (the migrate workflow re-runs every file).

-- Turn "fresh mil" into whole-word regex patterns: ['\mfresh(s|es)?\M', '\mmil'].
-- Plurals are folded (eggs→egg, tomatoes→tomato). With prefix_last, the last word only has to
-- START a word, so suggestions appear while it's still being typed.
create or replace function public.word_patterns(q text, prefix_last boolean default false)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(
           '\m'
           || regexp_replace(
                regexp_replace(regexp_replace(words.w, 'oes$', 'o'), 's$', ''),
                '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')
           || case when prefix_last and words.ord = words.n then '' else '(s|es)?\M' end
           order by words.ord), '{}')
  from (
    select t.w, t.ord, count(*) over () as n
    from unnest(regexp_split_to_array(lower(trim(q)), '\s+')) with ordinality as t (w, ord)
    where length(t.w) > 0
  ) as words;
$$;

grant execute on function public.word_patterns(text, boolean) to anon, authenticated;

-- Up to `max_results` products for the dropdown. The same product name at several stores is
-- grouped into one suggestion with its price range and how many stores have it.
create or replace function public.suggest_products(q text, max_results int default 6)
returns table (
  name        text,
  size        text,
  image_url   text,
  min_price   numeric,
  max_price   numeric,
  store_count int,
  score       real
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
      and (input.typed <% pr.name or pr.name ilike '%' || input.typed || '%')  -- trigram index
  )
  select
    min(hits.pname), min(hits.psize), max(hits.pimage),
    min(hits.pprice), max(hits.pprice), count(distinct hits.pstore)::int, max(hits.pscore)
  from hits
  where hits.in_name >= 0.5
  group by lower(regexp_replace(hits.pname, '\s+', ' ', 'g'))
  order by max(hits.pscore) desc, count(distinct hits.pstore) desc, min(hits.pprice) asc
  limit least(greatest(max_results, 1), 10);
$$;

grant execute on function public.suggest_products(text, int) to anon, authenticated;
