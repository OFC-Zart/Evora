-- Evora: esquema, RLS e views.
-- Rode no SQL Editor do Supabase (ou `supabase db push`). Depois rode o seed
-- (supabase/seed.sql) e, com o app publicado, o supabase/cron.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis (2 atletas). Ligados a auth.users pela função link_athlete().
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  athlete_id text primary key check (athlete_id in ('danilo', 'leticia')),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  nivel text not null check (nivel in ('intermediario', 'iniciante_sedentaria')),
  altura_m numeric(4, 2),
  peso_kg numeric(5, 1),
  idade int check (idade between 10 and 100),
  fc_max int check (fc_max between 120 and 230),
  fc_repouso int check (fc_repouso between 30 and 110),
  plan_inicio date not null,
  calibrado boolean not null default false,
  bloqueio_dor boolean not null default false,
  lat numeric(8, 5) default -23.55052,
  lon numeric(8, 5) default -46.63331,
  hora_treino time default '07:00',
  lembrete_diario boolean not null default false,
  lembrete_diario_hora time not null default '07:00',
  lembrete_diario_ultimo date,
  notif_ajustes boolean not null default true,
  notif_semana boolean not null default true,
  created_at timestamptz not null default now()
);

-- athlete_id do usuário logado (security definer evita recursão no RLS)
create or replace function public.current_athlete()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select athlete_id from public.profiles where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Plano
-- ---------------------------------------------------------------------------
create table if not exists public.plan_workouts (
  id text primary key,
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  semana int not null,
  dia text not null check (dia in ('seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom')),
  tipo text not null,
  segmentos jsonb not null,
  observacao text,
  km_total numeric(5, 2),
  meta_texto text,
  opcional boolean not null default false,
  ordem int not null default 0
);
create index if not exists plan_workouts_athlete_idx on public.plan_workouts (athlete_id, semana);

-- semana do calendário → semana do plano (repetições e semanas leves deslocam o plano)
create table if not exists public.plan_schedule (
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  semana_calendario int not null,
  semana_plano int not null,
  modo text not null default 'normal' check (modo in ('normal', 'repetida', 'leve30', 'leve20')),
  motivo text,
  primary key (athlete_id, semana_calendario)
);

create table if not exists public.plan_overrides (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  plan_workout_id text not null references public.plan_workouts (id) on delete cascade,
  semana_calendario int,
  segmentos jsonb not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  unique (athlete_id, plan_workout_id, semana_calendario)
);

-- ---------------------------------------------------------------------------
-- Zonas e histórico
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  zona text not null,
  pace_s_por_km int not null check (pace_s_por_km between 120 and 1200),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, zona)
);

create table if not exists public.zone_history (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  zona text not null,
  antes_s int not null,
  depois_s int not null,
  motivo text not null,
  origem text not null check (origem in ('regra', 'teste', 'ia', 'manual')),
  semana_calendario int,
  revertido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists zone_history_athlete_idx on public.zone_history (athlete_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Registros de treino
-- ---------------------------------------------------------------------------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  plan_workout_id text references public.plan_workouts (id) on delete set null,
  semana_calendario int,
  tipo_treino text not null default 'Livre',
  data date not null,
  hora time,
  distancia_km numeric(6, 2) not null default 0 check (distancia_km >= 0 and distancia_km <= 100),
  tempo_s int not null check (tempo_s > 0 and tempo_s < 86400),
  pace_s_por_km numeric(7, 2),
  pace_alvo_s numeric(7, 2),
  rep_alvo_s numeric(7, 2),
  rep_dist_km numeric(5, 3),
  fc_media int check (fc_media between 40 and 230),
  fc_max int check (fc_max between 40 and 240),
  rpe int not null check (rpe between 0 and 10),
  completou text not null default 'sim' check (completou in ('sim', 'parcial', 'nao')),
  dor text not null default 'nenhuma' check (dor in ('nenhuma', 'muscular', 'articulacao')),
  reps jsonb,
  notas text check (char_length(notas) <= 1000),
  atividade text not null default 'corrida' check (atividade in ('corrida', 'futebol', 'forca', 'outro')),
  teste_dist_km numeric(5, 2),
  teste_tempo_s int,
  temp_c numeric(4, 1),
  orvalho_c numeric(4, 1),
  created_at timestamptz not null default now()
);
create index if not exists workout_logs_athlete_idx on public.workout_logs (athlete_id, data desc);

-- ---------------------------------------------------------------------------
-- Metas, estimativas, agenda, push, coach, fechamentos
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  distancia_km numeric(6, 3) not null check (distancia_km > 0),
  tempo_alvo_s int check (tempo_alvo_s > 0),
  prazo date,
  status text not null default 'ativa' check (status in ('ativa', 'concluida', 'arquivada')),
  created_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  data date not null,
  vdot numeric(5, 2) not null,
  est_5k_s int not null,
  fonte text not null check (fonte in ('teste', 'treino', 'projecao')),
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_runs (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  inicio timestamptz not null,
  local text check (char_length(local) <= 200),
  plan_workout_id text references public.plan_workouts (id) on delete set null,
  lembrete text not null default '30' check (lembrete in ('na_hora', '30', '60', 'vespera')),
  lembrete_min int,
  lembrete_em timestamptz not null,
  enviado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_runs_due_idx on public.scheduled_runs (enviado, lembrete_em);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  semana int,
  texto text not null,
  dicas jsonb not null default '[]',
  sugestoes jsonb not null default '[]',
  repetir_semana boolean not null default false,
  fonte text not null default 'regras' check (fonte in ('regras', 'ia')),
  aplicado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.week_closures (
  athlete_id text not null references public.profiles (athlete_id) on delete cascade,
  semana_calendario int not null,
  resumo jsonb not null,
  closed_at timestamptz not null default now(),
  primary key (athlete_id, semana_calendario)
);

-- Permissões da Data API (não depende da opção "Grant API access" do painel).
-- O acesso real a cada linha é decidido pelo RLS abaixo; o anon não recebe nada.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- RLS: cada atleta lê e escreve só o que é seu.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.plan_workouts enable row level security;
alter table public.plan_schedule enable row level security;
alter table public.plan_overrides enable row level security;
alter table public.zones enable row level security;
alter table public.zone_history enable row level security;
alter table public.workout_logs enable row level security;
alter table public.goals enable row level security;
alter table public.estimates enable row level security;
alter table public.scheduled_runs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.coach_messages enable row level security;
alter table public.week_closures enable row level security;

drop policy if exists "perfil próprio: ler" on public.profiles;
create policy "perfil próprio: ler" on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "perfil próprio: editar" on public.profiles;
create policy "perfil próprio: editar" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- o plano não é dado pessoal: todos os logados leem (o ranking precisa)
drop policy if exists "plano: ler" on public.plan_workouts;
create policy "plano: ler" on public.plan_workouts for select to authenticated using (true);
drop policy if exists "agenda do plano: ler" on public.plan_schedule;
create policy "agenda do plano: ler" on public.plan_schedule for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['plan_schedule', 'plan_overrides', 'zones', 'zone_history', 'workout_logs', 'goals',
                           'estimates', 'scheduled_runs', 'push_subscriptions', 'coach_messages', 'week_closures']
  loop
    if t <> 'plan_schedule' then
      execute format('drop policy if exists "próprio: ler" on public.%I', t);
      execute format('create policy "próprio: ler" on public.%I for select to authenticated using (athlete_id = public.current_athlete())', t);
    end if;
    execute format('drop policy if exists "próprio: inserir" on public.%I', t);
    execute format('create policy "próprio: inserir" on public.%I for insert to authenticated with check (athlete_id = public.current_athlete())', t);
    execute format('drop policy if exists "próprio: editar" on public.%I', t);
    execute format('create policy "próprio: editar" on public.%I for update to authenticated using (athlete_id = public.current_athlete()) with check (athlete_id = public.current_athlete())', t);
    execute format('drop policy if exists "próprio: apagar" on public.%I', t);
    execute format('create policy "próprio: apagar" on public.%I for delete to authenticated using (athlete_id = public.current_athlete())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Ranking: views agregadas (rodam com os privilégios do dono, então leem os
-- dois atletas), SEM notas pessoais nem dados de dor.
-- ---------------------------------------------------------------------------
create or replace view public.ranking_stats as
select
  p.athlete_id,
  p.nome,
  p.nivel,
  p.plan_inicio,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'plan_workout_id', l.plan_workout_id, 'semana_calendario', l.semana_calendario,
      'tipo_treino', l.tipo_treino, 'data', l.data, 'distancia_km', l.distancia_km, 'tempo_s', l.tempo_s,
      'pace_s_por_km', l.pace_s_por_km, 'pace_alvo_s', l.pace_alvo_s, 'rpe', l.rpe, 'completou', l.completou,
      'atividade', l.atividade, 'fc_media', l.fc_media, 'temp_c', l.temp_c, 'orvalho_c', l.orvalho_c
    ) order by l.data)
    from public.workout_logs l
    where l.athlete_id = p.athlete_id and l.data >= current_date - 120
  ), '[]'::jsonb) as logs,
  coalesce((
    select jsonb_agg(jsonb_build_object('data', e.data, 'vdot', e.vdot, 'est_5k_s', e.est_5k_s, 'fonte', e.fonte) order by e.data)
    from public.estimates e where e.athlete_id = p.athlete_id
  ), '[]'::jsonb) as estimates,
  coalesce((
    select jsonb_agg(jsonb_build_object('semana', c.semana_calendario, 'adesao', (c.resumo ->> 'adesao')::numeric) order by c.semana_calendario)
    from public.week_closures c where c.athlete_id = p.athlete_id
  ), '[]'::jsonb) as fechamentos,
  coalesce((
    select jsonb_object_agg(z.zona, z.pace_s_por_km) from public.zones z where z.athlete_id = p.athlete_id
  ), '{}'::jsonb) as zonas
from public.profiles p;

create or replace view public.ranking_feed as
select * from (
  select
    'treino'::text as tipo,
    l.created_at,
    l.athlete_id,
    p.nome,
    l.data,
    l.tipo_treino as titulo,
    jsonb_build_object('distancia_km', l.distancia_km, 'tempo_s', l.tempo_s, 'pace_s_por_km', l.pace_s_por_km,
                       'rpe', l.rpe, 'atividade', l.atividade, 'completou', l.completou) as detalhe
  from public.workout_logs l join public.profiles p using (athlete_id)
  union all
  select
    'ajuste'::text, h.created_at, h.athlete_id, p.nome, h.created_at::date, h.zona,
    jsonb_build_object('antes_s', h.antes_s, 'depois_s', h.depois_s, 'origem', h.origem, 'revertido', h.revertido)
  from public.zone_history h join public.profiles p using (athlete_id)
) f
order by created_at desc
limit 40;

revoke all on public.ranking_stats from anon, public;
revoke all on public.ranking_feed from anon, public;
grant select on public.ranking_stats to authenticated;
grant select on public.ranking_feed to authenticated;

-- ---------------------------------------------------------------------------
-- Ligar uma conta criada no painel a um atleta. Rode no SQL Editor:
--   select public.link_athlete('email-do-danilo@exemplo.com', 'danilo');
-- ---------------------------------------------------------------------------
create or replace function public.link_athlete(p_email text, p_athlete text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'Usuário % não encontrado em auth.users. Crie a conta no painel primeiro.', p_email;
  end if;
  update public.profiles set user_id = uid where athlete_id = p_athlete;
  if not found then
    raise exception 'Atleta % não existe. Rode o seed antes.', p_athlete;
  end if;
end $$;

revoke all on function public.link_athlete(text, text) from public, anon, authenticated;
