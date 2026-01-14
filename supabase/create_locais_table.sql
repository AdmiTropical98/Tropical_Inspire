-- Create Locais (POI) Table
create table public.locais (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  latitude double precision not null,
  longitude double precision not null,
  raio integer default 50, -- radius in meters
  tipo text default 'outros', -- 'hotel', 'aeroporto', 'oficina', 'outros'
  cor text default '#3b82f6', -- default blue
  user_id uuid references auth.users(id) -- optional: who created it
);

-- RLS Policies
alter table public.locais enable row level security;

create policy "Enable read access for all users"
on public.locais for select
using (true);

create policy "Enable insert for authenticated users"
on public.locais for insert
with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users"
on public.locais for update
using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users"
on public.locais for delete
using (auth.role() = 'authenticated');

-- Add realtime
alter publication supabase_realtime add table public.locais;
