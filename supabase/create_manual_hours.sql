-- Create manual_hours table if it doesn't exist
create table if not exists public.manual_hours (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid references public.motoristas(id) on delete cascade not null,
  admin_id uuid references auth.users(id) on delete set null,
  date text not null, -- Format YYYY-MM-DD
  start_time text not null, -- Format HH:mm
  end_time text not null, -- Format HH:mm
  break_duration integer default 60, -- Minutes
  obs text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.manual_hours enable row level security;

-- Policies
create policy "Enable read access for all users"
on public.manual_hours for select
using (true);

create policy "Enable insert for authenticated users only"
on public.manual_hours for insert
with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users only"
on public.manual_hours for update
using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users only"
on public.manual_hours for delete
using (auth.role() = 'authenticated');
