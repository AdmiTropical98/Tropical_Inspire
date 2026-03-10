alter table if exists public.requisicoes
    add column if not exists supplier_confirmed boolean default false,
    add column if not exists supplier_rejected boolean default false,
    add column if not exists supplier_comment text,
    add column if not exists supplier_response_date timestamptz;
