# Evora — treino de corrida que se ajusta a cada passo

App (PWA) de corrida para dois atletas: **Danilo** (intermediário, meta de 5 km em 19:00, futebol às quartas) e **Letícia** (iniciante, meta de correr 5 km). Cada um tem o plano de 8 semanas das planilhas em `data/planilhas/`. O app mostra o treino do dia com pace e tempo, recebe os dados do relógio e recalcula paces, volume e metas com regras de ciência do esporte.

Stack: Next.js 16 (App Router) + TypeScript, Tailwind 4 + componentes no estilo shadcn/ui (Radix), Recharts, lucide-react, framer-motion, Supabase (Auth, Postgres com RLS, pg_cron), Web Push (VAPID), Vitest. Coach de IA opcional pela API da Anthropic, só no servidor.

Para colocar no ar: **[SETUP.md](SETUP.md)**.

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `lib/engine/` | Motor de cálculo: funções puras, sem banco e sem rede, todas testadas |
| `lib/server/` | Estado do atleta, fechamento de semana, push, clima, coach |
| `app/(app)/` | Telas: Hoje, Plano, Registrar, Ritmos e metas, Ranking, Perfil, Agenda |
| `app/api/` | `coach` (Pedir análise) e `cron/tick` (chamado pelo pg_cron) |
| `supabase/` | Esquema + RLS + views, seed gerado dos planos, agendador |
| `data/planos.json` | Os dois planos (mesmos dados das planilhas) |
| `data/brand/` | Logo original; `npm run icons` gera todos os ícones (sem a borda preta) |
| `tests/engine.test.ts` | 44 testes, incluindo os 6 obrigatórios do briefing |

## Cálculos e fontes

| Cálculo | Como | Onde |
| --- | --- | --- |
| VDOT | Daniels e Gilbert (1979): `VO2 = −4,60 + 0,182258v + 0,000104v²`, `%max = 0,8 + 0,1894393e^(−0,012778t) + 0,2989558e^(−0,1932605t)` | `vdot.ts` |
| Zonas do Danilo | regenerativo 0,60 · leve 0,70 · moderado 0,86 · forte 0,98 do VDOT | `vdot.ts` |
| Tempo de prova pelo VDOT | bisseção em `t` (VDOT é decrescente em `t`) | `vdot.ts` |
| Outras distâncias | VDOT e Riegel (1981) `T2 = T1 × (D2/D1)^1,06` lado a lado | `physiology.ts` |
| Carga | sRPE de Foster (2001): esforço × minutos, futebol incluído | `load.ts` |
| ACWR | 7 dias ÷ média semanal das 4 semanas anteriores (desacoplado); só indicador | `load.ts` |
| Pico de sessão | Frandsen et al., BJSM 2025 (5.200 corredores): risco sobe quando um treino passa 10% do maior dos últimos 30 dias | `load.ts` |
| 80/20 | Seiler: fração do tempo em intensidade baixa nas últimas 4 semanas | `load.ts` |
| Projeção | ganho de VDOT/mês com retornos decrescentes; vira regressão linear com 3+ estimativas em 4+ semanas | `projection.ts` |

### O que acrescentei além do briefing

- **Correção de pace pelo calor.** O clima vem da Open-Meteo (gratuita, sem chave) para o horário do treino e usa a tabela "temperatura + ponto de orvalho" (°F). Serve para duas coisas: mostrar o pace do dia já ajustado e normalizar o pace registrado antes do motor comparar com o alvo. Assim, um leve "lento" num dia de 32 °C não deixa a zona mais lenta.
- **FC máxima estimada** por Tanaka (2001), `208 − 0,7 × idade` (erro de ~10 bpm), e faixas de FC por zona (Karvonen se houver FC de repouso). A regra de FC do motor só usa a FC máxima medida.
- **Gasto calórico**: ~1 kcal/kg/km correndo (Margaria, 1963), 0,75 andando, MET 7 no futebol.
- **Equivalências de prova** (1 km até maratona) pelo VDOT e por Riegel.
- **Pace médio planejado guardado em cada registro**, para comparar treinos mistos (corre/anda) e para que um ajuste posterior não mude a comparação.
- **Apagar registro** enquanto a semana não fechou; modo demo para ver as telas sem Supabase.

### Decisões de interpretação (vale revisar)

- **Teste da semana 1 do Danilo** é "confortável", não no máximo, então ele **calibra** (8.1) em vez de recalcular o VDOT como teste (8.5). Um teste só conta como máximo se tiver trecho `maximo` ou esforço ≥ 8.
- **Zona "corrida" da Letícia** usa 0,74 do VDOT (topo da faixa leve de Daniels): com 0,70 a fórmula dá um leve lento demais para VDOT baixo.
- **Regra de qualidade (8.3)** olha os treinos de qualidade dos últimos 14 dias (precisa de 2, com pelo menos 1 novo), porque o plano tem só 1 por semana e o briefing proíbe mudar com 1 treino. "Parcial" conta como não completou (lado seguro).
- **ACWR nas primeiras semanas**: com menos de 2 semanas de histórico ele fica vazio (dividir por 4 inflava o índice e gerava alarme falso).
- **Agendador**: o pg_cron chama `/api/cron/tick` na Vercel direto (via pg_net), em vez de passar por uma Edge Function. Faz o mesmo papel, tem um ponto de falha a menos e dá para testar localmente.
- **Coach de IA** usa `claude-sonnet-5-5` por padrão (o modelo pedido no briefing), com saída validada por zod, fallback automático do servidor se o modelo recusar, e sugestões sempre limitadas pelo motor (±10 s/semana). Sem chave, as mensagens saem de templates.

## Comandos

```powershell
npm test            # motor de cálculo
npm run typecheck
npm run build
npm run seed:gen    # regenera supabase/seed.sql a partir de data/planos.json
npm run vapid       # chaves do Web Push
```

Este app não substitui orientação médica ou de um profissional de educação física.
