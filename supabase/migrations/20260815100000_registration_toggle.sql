-- Toggle globale per le registrazioni: chiave in app_config, RPC di
-- lettura/scrittura (solo admin) ed enforcement reale su auth.users.

insert into app_config (key, value)
values ('registrations_enabled', 'true')
on conflict (key) do nothing;

-- Lettura pubblica (anon inclusi: serve per mostrare l'avviso sul form di
-- registrazione prima ancora di tentare la signUp).
create or replace function public.get_registrations_enabled()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select value = 'true' from app_config where key = 'registrations_enabled'),
    true
  );
$$;

grant execute on function public.get_registrations_enabled() to anon, authenticated;

-- Scrittura riservata agli admin (is_admin esiste già, vedi 20260319000000).
create or replace function public.set_registrations_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo gli amministratori possono modificare questa impostazione';
  end if;

  insert into app_config (key, value, updated_at)
  values ('registrations_enabled', p_enabled::text, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.set_registrations_enabled(boolean) to authenticated;

-- Enforcement a livello DB: blocca ogni nuova signup quando il toggle è off.
create or replace function public.block_signups_when_disabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.get_registrations_enabled() then
    raise exception 'Registrazioni temporaneamente disabilitate';
  end if;
  return new;
end;
$$;

drop trigger if exists block_signups_when_disabled on auth.users;
create trigger block_signups_when_disabled
  before insert on auth.users
  for each row execute function public.block_signups_when_disabled();
