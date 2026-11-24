-- Evora 0003: o plano só começa quando a pessoa toca em "Começar meu plano".
-- plan_inicio nulo = plano ainda não iniciado (o app mostra só a prévia e o
-- botão; o agendador não manda lembrete nem fecha semana).

alter table public.profiles alter column plan_inicio drop not null;
