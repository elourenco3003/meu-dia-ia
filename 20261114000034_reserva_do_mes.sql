-- Meu Dia IA · quanto da receita do mês a pessoa quer guardar antes de gastar
alter table public.profiles add column if not exists reserve_pct int not null default 0
  check (reserve_pct between 0 and 90);
