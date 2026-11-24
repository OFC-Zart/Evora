# Como colocar o Evora no ar (tudo no plano gratuito)

Tempo estimado: 30–40 min. Você precisa de contas gratuitas no **Supabase**, na **Vercel** e no **GitHub** (o repositório já existe).

## 1. Supabase (banco, login e agendador)

1. Crie um projeto em <https://supabase.com> (região São Paulo, `sa-east-1`).
2. **SQL Editor → New query**: cole e rode `supabase/migrations/0001_schema.sql`.
3. Rode `supabase/seed.sql` (os dois planos das planilhas, zonas iniciais e metas).
   - O plano começa em **23/11/2026**. Para outra segunda-feira: `npm run seed:gen -- --inicio 2026-11-30` e rode o novo `seed.sql`.
4. **Authentication → Sign In / Providers → Email**: deixe ligado e **desligue "Allow new users to sign up"** (sem cadastro público).
5. **Authentication → Users → Add user** (marque *Auto Confirm User*): crie a conta do Danilo e a da Letícia com e-mail e senha.
6. No SQL Editor, ligue cada conta ao atleta:
   ```sql
   select public.link_athlete('email-do-danilo@exemplo.com', 'danilo');
   select public.link_athlete('email-da-leticia@exemplo.com', 'leticia');
   ```
7. **Authentication → URL Configuration**: em *Site URL* coloque `https://SEU-APP.vercel.app` e em *Redirect URLs* adicione `https://SEU-APP.vercel.app/auth/callback` (para o link mágico).
8. **Project Settings → API**: copie a *Project URL*, a chave *anon/publishable* e a *service_role/secret*.

## 2. Chaves do Web Push

```powershell
npm install
npm run vapid
```

Guarde as duas linhas que aparecem (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`).

## 3. Vercel

1. <https://vercel.com/new> → importe o repositório `OFC-Zart/Evora` (framework: Next.js, sem mudar nada).
2. Em **Environment Variables**, cadastre (veja `.env.example`):

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role/secret (só servidor) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | do passo 2 |
| `VAPID_PRIVATE_KEY` | do passo 2 |
| `VAPID_SUBJECT` | `mailto:seu-email` |
| `CRON_SECRET` | um texto longo e aleatório |
| `ANTHROPIC_API_KEY` | opcional (coach de IA) |
| `ANTHROPIC_MODEL` | opcional, padrão `claude-sonnet-5-5` |

3. Deploy. Anote a URL (`https://SEU-APP.vercel.app`) e volte ao passo 1.7 se ainda não tinha.

## 4. Agendador dos lembretes (pg_cron)

O cron do plano Hobby da Vercel roda no máximo 1×/dia e sem hora exata, então quem chama o app a cada minuto é o Supabase:

1. **Database → Extensions**: ative `pg_cron` e `pg_net`.
2. Abra `supabase/cron.sql`, troque a URL do app e o `CRON_SECRET` (o mesmo da Vercel) e rode no SQL Editor.
3. Confira depois de 2 minutos: `select * from cron.job_run_details order by start_time desc limit 5;`

A rota `/api/cron/tick` envia os lembretes de corridas agendadas, o lembrete diário do treino e fecha a semana no domingo às 20h. São ~43 mil chamadas por mês, dentro do limite gratuito da Vercel.

## 5. No celular

- **Android (Chrome)**: abra o app → menu ⋮ → *Instalar app*. Depois, **Agenda → Ativar lembretes**.
- **iPhone (iOS 16.4+)**: no Safari, *Compartilhar → Adicionar à Tela de Início*, abra **pelo ícone** e então **Agenda → Ativar lembretes**. O iPhone só entrega push de app instalado.

## Desenvolvimento local

```powershell
npm install
npm test
npm run dev
```

Sem Supabase configurado, crie `.env.development.local` com `EVORA_DEMO=1` (e `EVORA_DEMO_ATHLETE=leticia`, se quiser) para ver as telas com dados de exemplo. O modo demo nunca liga em produção.

## Problemas comuns

- **"Conta ainda não ligada a um atleta"**: rode o `link_athlete` do passo 1.6 com o e-mail exato.
- **Não chega push**: confira as chaves VAPID na Vercel, a permissão do navegador e, no iPhone, se abriu pelo ícone da Tela de Início. Use **Agenda → Enviar teste**.
- **Lembrete atrasado**: veja `cron.job_run_details` e se o `CRON_SECRET` do `cron.sql` é igual ao da Vercel (a rota responde 401 se não for).
