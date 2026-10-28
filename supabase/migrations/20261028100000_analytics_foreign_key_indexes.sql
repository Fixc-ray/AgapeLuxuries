create index if not exists analytics_daily_visitor_idx
  on public.analytics_daily_visitors(visitor_hash);

create index if not exists analytics_pages_visitor_idx
  on public.analytics_page_visitors(visitor_hash);
