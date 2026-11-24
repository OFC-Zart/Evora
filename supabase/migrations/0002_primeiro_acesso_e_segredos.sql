-- Evora 0002: primeiro acesso (troca de senha e e-mail real) e segredos gerados
-- pelo próprio app/banco, para ninguém precisar copiar chaves para a Vercel.

alter table public.profiles add column if not exists trocar_senha boolean not null default false;
alter table public.profiles add column if not exists precisa_email boolean not null default false;

-- Segredos internos: RLS ligado e nenhuma política = só a service role (servidor) lê.
create table if not exists public.app_secrets (
  nome text primary key,
  valor text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
grant select, insert, update on public.app_secrets to service_role;

-- segredo do agendador (pg_cron → /api/cron/tick), gerado aqui dentro
insert into public.app_secrets (nome, valor)
values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;
