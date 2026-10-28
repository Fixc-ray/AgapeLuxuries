create table public.analytics_visitors (
  visitor_hash text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  total_sessions integer not null default 0 check (total_sessions >= 0),
  total_page_views integer not null default 0 check (total_page_views >= 0)
);

create table public.analytics_sessions (
  session_hash text primary key,
  visitor_hash text not null references public.analytics_visitors(visitor_hash) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null,
  last_path text not null,
  referrer_host text,
  page_views integer not null default 1 check (page_views > 0)
);

create table public.analytics_daily_visitors (
  visit_date date not null default current_date,
  visitor_hash text not null references public.analytics_visitors(visitor_hash) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_count integer not null default 0 check (session_count >= 0),
  page_views integer not null default 1 check (page_views > 0),
  primary key(visit_date, visitor_hash)
);

create table public.analytics_page_visitors (
  visit_date date not null default current_date,
  path text not null,
  visitor_hash text not null references public.analytics_visitors(visitor_hash) on delete cascade,
  page_views integer not null default 1 check (page_views > 0),
  primary key(visit_date, path, visitor_hash)
);

create index analytics_sessions_visitor_idx on public.analytics_sessions(visitor_hash,last_seen_at desc);
create index analytics_daily_date_idx on public.analytics_daily_visitors(visit_date desc);
create index analytics_pages_date_idx on public.analytics_page_visitors(visit_date desc,path);

alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_daily_visitors enable row level security;
alter table public.analytics_page_visitors enable row level security;

create policy analytics_visitors_admin_read on public.analytics_visitors for select to authenticated using (public.is_admin());
create policy analytics_sessions_admin_read on public.analytics_sessions for select to authenticated using (public.is_admin());
create policy analytics_daily_admin_read on public.analytics_daily_visitors for select to authenticated using (public.is_admin());
create policy analytics_pages_admin_read on public.analytics_page_visitors for select to authenticated using (public.is_admin());

grant select on public.analytics_visitors,public.analytics_sessions,public.analytics_daily_visitors,public.analytics_page_visitors to authenticated;
grant all on public.analytics_visitors,public.analytics_sessions,public.analytics_daily_visitors,public.analytics_page_visitors to service_role;

create function public.record_site_visit(
  p_visitor_hash text,
  p_session_hash text,
  p_path text,
  p_referrer_host text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_session integer := 0;
  v_path text := left(coalesce(nullif(p_path,''),'/'),500);
begin
  if p_visitor_hash !~ '^[a-f0-9]{64}$' or p_session_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid analytics identifier.';
  end if;

  insert into public.analytics_visitors(visitor_hash,total_sessions,total_page_views)
  values(p_visitor_hash,0,0)
  on conflict(visitor_hash) do nothing;

  insert into public.analytics_sessions(session_hash,visitor_hash,entry_path,last_path,referrer_host)
  values(p_session_hash,p_visitor_hash,v_path,v_path,left(p_referrer_host,255))
  on conflict(session_hash) do nothing;
  get diagnostics v_new_session = row_count;

  update public.analytics_sessions
  set last_seen_at=now(),last_path=v_path,page_views=page_views+case when v_new_session=1 then 0 else 1 end
  where session_hash=p_session_hash and visitor_hash=p_visitor_hash;

  update public.analytics_visitors
  set last_seen_at=now(),total_sessions=total_sessions+v_new_session,total_page_views=total_page_views+1
  where visitor_hash=p_visitor_hash;

  insert into public.analytics_daily_visitors(visit_date,visitor_hash,session_count,page_views)
  values(current_date,p_visitor_hash,v_new_session,1)
  on conflict(visit_date,visitor_hash) do update
  set last_seen_at=now(),session_count=public.analytics_daily_visitors.session_count+v_new_session,page_views=public.analytics_daily_visitors.page_views+1;

  insert into public.analytics_page_visitors(visit_date,path,visitor_hash,page_views)
  values(current_date,v_path,p_visitor_hash,1)
  on conflict(visit_date,path,visitor_hash) do update set page_views=public.analytics_page_visitors.page_views+1;
end;
$$;

revoke execute on function public.record_site_visit(text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_visit(text,text,text,text) to service_role;
