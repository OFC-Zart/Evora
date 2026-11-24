-- Agendador dos lembretes (rode DEPOIS de publicar o app na Vercel).
--
-- O cron do plano Hobby da Vercel roda no máximo 1 vez por dia e sem horário
-- exato, então quem chama o app a cada minuto é o pg_cron do Supabase (via
-- pg_net). A rota /api/cron/tick envia os pushes vencidos, os lembretes
-- diários e fecha a semana no domingo às 20h.
--
-- Pré-requisitos: extensões pg_cron e pg_net ativas e a migração 0002 rodada
-- (ela gera o cron_secret dentro do banco; o app lê o mesmo valor).
-- Troque só a URL abaixo pela URL de produção da Vercel.

insert into public.app_secrets (nome, valor)
values ('app_url', 'https://SEU-APP.vercel.app')
on conflict (nome) do update set valor = excluded.valor;

select cron.unschedule('evora-tick') where exists (select 1 from cron.job where jobname = 'evora-tick');

select cron.schedule(
  'evora-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select valor from public.app_secrets where nome = 'app_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select valor from public.app_secrets where nome = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Conferir: select * from cron.job_run_details order by start_time desc limit 5;
