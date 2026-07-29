-- HEADBANG DEALERS cloud persistence, Phase 3.
-- VERSIONED RECORD ONLY: this migration was applied manually in Supabase.
-- Do not execute it automatically from the browser or deployment workflow.
--
-- Incremental and idempotent:
-- - does not recreate game_progress;
-- - does not remove legacy columns;
-- - does not alter RLS policies;
-- - does not modify private.score_submissions;
-- - grants public.score_top_10 read access only.

alter table public.game_progress
  add column if not exists cloud_save jsonb not null default '{}'::jsonb;

alter table public.game_progress
  add column if not exists cloud_schema_version integer not null default 1;

alter table public.game_progress
  add column if not exists game_build_version text;

alter table public.game_progress
  add column if not exists local_save_format text;

alter table public.game_progress
  add column if not exists last_device_id text;

alter table public.game_progress
  add column if not exists last_synced_at timestamptz;

alter table public.game_progress
  add column if not exists sync_revision bigint not null default 0;

alter table public.game_progress
  add column if not exists points bigint not null default 0;

alter table public.game_progress
  add column if not exists achievements jsonb not null default '{}'::jsonb;

create or replace function public.sync_headbang_cloud_save(
  p_expected_revision bigint,
  p_cloud_save jsonb,
  p_cloud_schema_version integer,
  p_game_build_version text,
  p_local_save_format text,
  p_last_device_id text
)
returns table (
  sync_revision bigint,
  last_synced_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_points_text text;
  v_points bigint;
  v_achievements jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  if p_cloud_save is null
    or jsonb_typeof(p_cloud_save) <> 'object'
    or octet_length(p_cloud_save::text) > 65536 then
    raise exception using
      errcode = '22023',
      message = 'invalid_cloud_save';
  end if;

  if p_cloud_schema_version <> 1 then
    raise exception using
      errcode = '22023',
      message = 'unsupported_cloud_schema';
  end if;

  v_points_text := coalesce(
    p_cloud_save #>> '{economy,points,total}',
    '0'
  );

  if v_points_text !~ '^[0-9]+$' then
    raise exception using
      errcode = '22023',
      message = 'invalid_points';
  end if;

  begin
    v_points := v_points_text::bigint;
  exception
    when numeric_value_out_of_range then
      raise exception using
        errcode = '22003',
        message = 'points_out_of_range';
  end;

  v_achievements := coalesce(
    p_cloud_save -> 'achievements',
    '{}'::jsonb
  );

  if jsonb_typeof(v_achievements) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'invalid_achievements';
  end if;

  return query
  update public.game_progress
  set
    cloud_save = p_cloud_save,
    cloud_schema_version = p_cloud_schema_version,
    game_build_version = left(p_game_build_version, 64),
    local_save_format = left(p_local_save_format, 128),
    last_device_id = left(p_last_device_id, 64),
    last_synced_at = timezone('utc', now()),
    sync_revision = public.game_progress.sync_revision + 1,
    points = v_points,
    achievements = v_achievements
  where user_id = v_user_id
    and public.game_progress.sync_revision = p_expected_revision
  returning
    public.game_progress.sync_revision,
    public.game_progress.last_synced_at;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'revision_conflict';
  end if;
end;
$function$;

revoke all on function public.sync_headbang_cloud_save(
  bigint,
  jsonb,
  integer,
  text,
  text,
  text
) from public;

revoke all on function public.sync_headbang_cloud_save(
  bigint,
  jsonb,
  integer,
  text,
  text,
  text
) from anon;

grant execute on function public.sync_headbang_cloud_save(
  bigint,
  jsonb,
  integer,
  text,
  text,
  text
) to authenticated;

revoke insert, update, delete
  on table public.score_top_10
  from anon, authenticated;

grant select
  on table public.score_top_10
  to anon, authenticated;
