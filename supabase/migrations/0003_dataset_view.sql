-- One row per project, children nested, field names matching lib/data/types.ts `Project`.
drop view if exists public.project_dataset;
create view public.project_dataset with (security_invoker = true) as
select
  p.id,
  p.mofa_ref,
  p.title_en,
  p.title_ne,
  p.description_en,
  p.sector_code,
  p.flow_type,
  p.status,
  p.progress_pct::float8 as progress_pct,
  p.implementing_partner,
  to_char(p.start_date, 'YYYY-MM-DD')     as start_date,
  to_char(p.end_date, 'YYYY-MM-DD')       as end_date,
  to_char(p.agreement_date, 'YYYY-MM-DD') as agreement_date,
  p.source,
  p.links,
  p.is_sample,
  coalesce((select jsonb_agg(jsonb_build_object(
      'partner_id', f.partner_id,
      'committed_usd', f.committed_usd::float8,
      'disbursed_usd', f.disbursed_usd::float8) order by f.committed_usd desc)
    from public.project_funding f where f.project_id = p.id), '[]'::jsonb) as funding,
  coalesce((select jsonb_agg(jsonb_build_object(
      'area_code', l.area_code,
      'share_pct', l.share_pct::float8) order by l.area_code)
    from public.project_locations l where l.project_id = p.id), '[]'::jsonb) as locations,
  coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(t.date, 'YYYY-MM-DD'),
      'type', t.type,
      'partner_id', t.partner_id,
      'amount_usd', t.amount_usd::float8,
      'note', t.note) order by t.date, t.id)
    from public.transactions t where t.project_id = p.id), '[]'::jsonb) as transactions,
  coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(u.date, 'YYYY-MM-DD'),
      'body_en', u.body_en,
      'progress_pct', u.progress_pct::float8) order by u.date desc, u.id desc)
    from public.project_updates u where u.project_id = p.id), '[]'::jsonb) as updates
from public.projects p;

grant select on public.project_dataset to anon, authenticated;
