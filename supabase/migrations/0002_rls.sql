-- Phase 1 access: anyone can read; nobody can write through the API (service role bypasses RLS).
do $$
declare t text;
begin
  foreach t in array array['admin_areas','partners','sectors','projects','project_funding','project_locations','transactions','project_updates','fx_rates']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "phase1 public read" on public.%I', t);
    execute format('create policy "phase1 public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;
