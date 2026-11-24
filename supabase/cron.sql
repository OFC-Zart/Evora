-- Agendador dos lembretes (rode DEPOIS de publicar o app na Vercel).
--
-- O cron do plano Hobby da Vercel roda no máximo 1 vez por dia e sem horário
-- exato, então quem chama o app a cada minuto é o pg_cron do Supabase (via
-- pg_net). A rota /api/cron/tick envia os pushes vencidos, os lembretes
-- diários e fecha a semana no domingo às 20h.
--
-- 1) No painel do Supabase: Database → Extensions → ative pg_cron e pg_net.
-- 2) Troque os dois valores abaixo e rode este arquivo no SQL Editor.

select vault.create_secret('https://SEU-APP.vercel.app', 'evora_app_url');
select vault.create_secret('COLE-AQUI-O-MESMO-CRON_SECRET-DA-VERCEL', 'evora_cron_secret');

select cron.unschedule('evora-tick') where exists (select 1 from cron.job where jobname = 'evora-tick');

select cron.schedule(
  'evora-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'evora_app_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'evora_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Conferir: select * from cron.job_run_details order by start_time desc limit 5;
-- Limpar o histórico de chamadas do pg_net de vez em quando é automático (6 h).
