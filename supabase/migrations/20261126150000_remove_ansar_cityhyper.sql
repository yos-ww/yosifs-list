-- Owner's decision (2026-11-26): only Al Meera, Carrefour, Lulu, Spar and Monoprix for now.
-- Removes Ansar Gallery and City Hypermarket and their products (cascade).
-- This file re-runs on every migration, so delete it before ever adding these chains back.
delete from public.stores where id in ('ansar', 'cityhyper');
