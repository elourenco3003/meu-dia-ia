-- Meu Dia IA · aviso quando a outra pessoa da família inclui itens numa lista compartilhada.
-- Vale para listas das duas pessoas (quem compartilhou e quem recebeu) e junta os itens:
-- no máximo um aviso por lista a cada 15 min, para não encher o celular de notificação durante a compra.
do $do$
declare
  d text;
  marca text := $m$  union all
  select v.id, 'vencer',$m$;
begin
  d := pg_get_functiondef('public.pending_notifications()'::regprocedure);
  if position($q$'item'$q$ in d) > 0 then return; end if;
  if position(marca in d) = 0 then raise exception 'ponto de inserção não encontrado'; end if;
  d := replace(d, marca, $s$  union all
  select v.id, 'item', l.id::text || ':' || to_char(now(), 'HH24MI'), v.ld,
         initcap(lower(split_part(coalesce(nullif(op.name, ''), 'Sua dupla'), ' ', 1)))
         || ' incluiu ' || a.n || case when a.n = 1 then ' item' else ' itens' end || ' na lista "' || l.name || '"',
         a.amostra || case when a.n > 3 then '…' else '' end
  from v
  join public.family_members me on me.user_id = v.id
  join public.family_members ot on ot.group_id = me.group_id and ot.user_id <> v.id
  join public.lists l on l.shared and l.user_id in (v.id, ot.user_id)
  left join public.profiles op on op.id = ot.user_id
  cross join lateral (
    select (select count(*) from public.list_items i
            where i.list_id = l.id and i.added_by = ot.user_id and i.created_at > now() - interval '6 minutes') as n,
           (select string_agg(t.text, ', ')
            from (select i2.text from public.list_items i2
                  where i2.list_id = l.id and i2.added_by = ot.user_id and i2.created_at > now() - interval '6 minutes'
                  order by i2.created_at desc limit 3) t) as amostra
  ) a
  where a.n > 0 and coalesce(v.cats->>'item', 'true') <> 'false' and not v.quiet
    and not exists (select 1 from public.notifications_sent s
                    where s.user_id = v.id and s.kind = 'item'
                      and s.ref like l.id::text || ':%' and s.sent_at > now() - interval '15 minutes')
$s$ || marca);
  execute d;
end
$do$;

-- rede de segurança no nome de quem entra: login social manda "name" ou "full_name"
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''),
                           nullif(new.raw_user_meta_data->>'full_name', ''),
                           initcap(split_part(coalesce(new.email, ''), '@', 1)), ''));
  return new;
end $$;
