create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.sync_lalapan_daily_to_ruang_arus()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_date date := (now() at time zone 'Asia/Makassar')::date - 1;
  v_record jsonb;
  v_turnover numeric;
  v_hpp numeric;
  v_ops numeric;
  v_net numeric;
  v_cost numeric;
  v_token text;
  v_request_id bigint;
begin
  select payload->'records'->v_date::text
    into v_record
    from public.owner_app_state
    order by updated_at desc
    limit 1;

  if v_record is null or jsonb_typeof(v_record) is distinct from 'object' then
    return 0;
  end if;

  v_turnover := coalesce((v_record->>'revenue')::numeric, 0);
  v_hpp := coalesce((v_record->>'recipeCost')::numeric, 0);
  v_ops := coalesce((v_record->>'opsTotal')::numeric, 0)
         + coalesce((v_record->>'dailyExtra')::numeric, 0);
  v_net := coalesce((v_record->>'profit')::numeric, v_turnover - v_hpp - v_ops);
  v_cost := v_turnover - v_hpp - v_net;

  if v_turnover < 0 or v_hpp < 0 or v_ops < 0 or v_cost < 0 then
    raise exception 'Daily recap contains a negative turnover, HPP, or cost.';
  end if;
  if abs(v_cost - v_ops) > 1 then
    raise exception 'Daily recap profit does not reconcile with operating cost.';
  end if;

  select decrypted_secret
    into v_token
    from vault.decrypted_secrets
    where name = 'ruang_arus_lalapan_import_token_v1'
    limit 1;
  if v_token is null then
    raise exception 'Ruang Arus import token is not configured.';
  end if;

  select net.http_post(
    url := 'https://ejewpmpnhwyvzxsmuqmj.supabase.co/functions/v1/import-lalapan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_z1o9H0NT4H9plI3byjTxxA_I-mQb_7f',
      'x-lalapan-sync', v_token
    ),
    body := jsonb_build_object(
      'date', v_date,
      'turnover', v_turnover,
      'hpp', v_hpp,
      'cost', v_cost,
      'net_profit', v_net
    )
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.sync_lalapan_daily_to_ruang_arus() from public, anon, authenticated;
grant execute on function public.sync_lalapan_daily_to_ruang_arus() to postgres;

select cron.schedule(
  'lalapan-to-ruang-arus-daily',
  '0 16 * * *',
  'select public.sync_lalapan_daily_to_ruang_arus();'
);
