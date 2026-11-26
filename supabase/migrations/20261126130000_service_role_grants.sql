-- Let the scraper (secret key = service_role) write prices.
-- Needed because "grant API access to new tables automatically" is off in this project.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.stores, public.products to service_role;
grant usage, select on all sequences in schema public to service_role;
