alter table if exists public.requisicoes
    add column if not exists supplier_confirmed boolean default false,
    add column if not exists supplier_confirmed_at timestamptz,
    add column if not exists supplier_refused boolean default false,
    add column if not exists supplier_refused_at timestamptz,
    add column if not exists supplier_rejected boolean default false,
    add column if not exists supplier_comment text,
    add column if not exists supplier_response_date timestamptz;

update public.requisicoes
set
    supplier_refused = coalesce(supplier_refused, supplier_rejected, false),
    supplier_confirmed_at = case
        when supplier_confirmed = true and supplier_confirmed_at is null then supplier_response_date
        else supplier_confirmed_at
    end,
    supplier_refused_at = case
        when coalesce(supplier_refused, supplier_rejected, false) = true and supplier_refused_at is null then supplier_response_date
        else supplier_refused_at
    end;
