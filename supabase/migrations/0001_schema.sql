-- Nepal Development Projects Map: core schema (plan §8). Idempotent.

create table if not exists public.admin_areas (
  code        text primary key,
  level       text not null check (level in ('province','district','palika')),
  parent_code text references public.admin_areas(code),
  name_en     text not null,
  name_ne     text not null,
  kind        text not null
);
create index if not exists admin_areas_parent_idx on public.admin_areas(parent_code);

create table if not exists public.partners (
  id      text primary key,               -- slug, e.g. 'japan', 'adb'
  name_en text not null,
  name_ne text not null,
  type    text not null check (type in ('bilateral','multilateral','ingo','other')),
  iso2    text,
  short   text not null,
  hq_lng  double precision not null,
  hq_lat  double precision not null,
  ring_lng double precision,
  ring_lat double precision
);

create table if not exists public.sectors (
  code      text primary key,
  name_en   text not null,
  name_ne   text not null,
  dac_codes text[] not null default '{}'
);

create table if not exists public.projects (
  id                   text primary key,
  mofa_ref             text,
  title_en             text not null,
  title_ne             text not null,
  description_en       text not null default '',
  sector_code          text not null references public.sectors(code),
  flow_type            text not null check (flow_type in ('grant','loan','technical_assistance','in_kind')),
  status               text not null check (status in ('pipeline','ongoing','completed','suspended')),
  progress_pct         numeric not null default 0 check (progress_pct between 0 and 100),
  implementing_partner text not null default '',
  start_date           date,
  end_date             date,
  agreement_date       date,
  source               text not null default '',
  links                jsonb not null default '[]'::jsonb,
  is_sample            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);

create table if not exists public.project_funding (
  project_id         text not null references public.projects(id) on delete cascade,
  partner_id         text not null references public.partners(id),
  committed_usd      numeric not null default 0,
  disbursed_usd      numeric not null default 0,
  currency_original  text,
  committed_original numeric,
  primary key (project_id, partner_id)
);

create table if not exists public.project_locations (
  project_id text not null references public.projects(id) on delete cascade,
  area_code  text not null references public.admin_areas(code),
  share_pct  numeric check (share_pct is null or share_pct between 0 and 100),
  primary key (project_id, area_code)
);
create index if not exists project_locations_area_idx on public.project_locations(area_code);

create table if not exists public.transactions (
  id         bigint generated always as identity primary key,
  project_id text not null references public.projects(id) on delete cascade,
  partner_id text not null references public.partners(id),
  date       date not null,
  type       text not null check (type in ('commitment','disbursement','expenditure')),
  amount_usd numeric not null,
  note       text
);
create index if not exists transactions_project_idx on public.transactions(project_id);

create table if not exists public.project_updates (
  id           bigint generated always as identity primary key,
  project_id   text not null references public.projects(id) on delete cascade,
  author_id    uuid,                         -- Phase 2: auth.users
  date         date not null,
  body_en      text not null,
  progress_pct numeric,
  status       text,
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists project_updates_project_idx on public.project_updates(project_id);

create table if not exists public.fx_rates (
  year    int primary key,
  usd_npr numeric not null
);
