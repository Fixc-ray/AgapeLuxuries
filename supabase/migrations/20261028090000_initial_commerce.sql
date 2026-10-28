create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  address text not null,
  county text not null,
  town text not null,
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  brand text not null,
  description text not null default '',
  category_id text not null references public.categories(id),
  subcategory_id text,
  gender text not null default 'unisex' check (gender in ('men','women','unisex')),
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  attributes jsonb not null default '{}'::jsonb,
  fragrance_notes jsonb,
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new_arrival boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  external_id text not null,
  label text not null,
  sku text not null unique,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  attributes jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, external_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, position)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, variant_id)
);

create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);

create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  type text not null check (type in ('percentage','fixed')),
  value numeric(12,2) not null check (value > 0),
  minimum_purchase numeric(12,2) not null default 0 check (minimum_purchase >= 0),
  maximum_discount numeric(12,2) check (maximum_discount is null or maximum_discount > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percentage' or value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  guest_email text,
  customer jsonb not null,
  shipping_address jsonb not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  coupon_code text references public.coupons(code) on delete set null,
  delivery_method text not null check (delivery_method in ('standard','express','pickup')),
  payment_method text not null check (payment_method in ('mpesa','cod','stripe')),
  payment_status text not null check (payment_status in ('pending','uncollected','paid','failed','refunded','partially_refunded')),
  order_status text not null check (order_status in ('received','processing','packed','shipped','delivered','cancelled','returned')),
  payment_reference text,
  tracking_number text,
  courier text,
  provider_payload jsonb not null default '{}'::jsonb,
  idempotency_key_hash text not null unique,
  status_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  slug text not null,
  image_url text,
  variant_label text not null,
  sku text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('mpesa','stripe','cod')),
  provider_request_id text unique,
  merchant_request_id text,
  receipt_number text,
  status text not null check (status in ('pending','paid','failed','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.coupons(code),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  change integer not null check (change <> 0),
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(body) between 10 and 2000),
  is_verified_purchase boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, user_id)
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  source text not null default 'storefront',
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id text primary key,
  currency text not null default 'KES' check (currency = 'KES'),
  standard_delivery_fee numeric(12,2) not null default 450 check (standard_delivery_fee >= 0),
  express_delivery_fee numeric(12,2) not null default 900 check (express_delivery_fee >= 0),
  free_delivery_threshold numeric(12,2) not null default 15000 check (free_delivery_threshold >= 0),
  cash_on_delivery_enabled boolean not null default false,
  guest_checkout_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_catalog_idx on public.products(is_published, category_id, gender, created_at desc);
create index product_variants_product_idx on public.product_variants(product_id, is_active);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_created_idx on public.orders(order_status, created_at desc);
create index payments_order_idx on public.payments(order_id, created_at desc);
create index inventory_variant_created_idx on public.inventory_movements(variant_id, created_at desc);
create index reviews_product_approved_idx on public.reviews(product_id, is_approved, created_at desc);

insert into public.store_settings(id) values ('commerce');
insert into public.categories(id,name,slug,position) values
  ('fragrances','Fragrances','fragrances',1),
  ('beauty','Beauty','beauty',2),
  ('jewellery','Jewellery','jewellery',3),
  ('accessories','Accessories','accessories',4),
  ('gifts','Gifts','gifts',5);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();
create trigger newsletter_updated_at before update on public.newsletter_subscribers for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.place_order(
  p_customer jsonb,
  p_items jsonb,
  p_delivery_method text,
  p_payment_method text,
  p_idempotency_key text,
  p_coupon_code text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_image text;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_order public.orders%rowtype;
  v_user_id uuid := auth.uid();
  v_key_hash text;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_delivery numeric(12,2) := 0;
  v_quantity integer;
  v_redemption_count integer := 0;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then raise exception 'A valid idempotency key is required.'; end if;
  if p_delivery_method not in ('standard','express','pickup') then raise exception 'Invalid delivery method.'; end if;
  if p_payment_method not in ('mpesa','cod','stripe') then raise exception 'Invalid payment method.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'An order must contain between 1 and 30 items.'; end if;
  if coalesce(p_customer ->> 'name','') = '' or coalesce(p_customer ->> 'email','') = '' or coalesce(p_customer ->> 'phone','') = '' then raise exception 'Customer contact details are required.'; end if;

  v_key_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  select * into v_order from public.orders where idempotency_key_hash = v_key_hash;
  if found then
    return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status,'totalAmount',v_order.total_amount,'currency',v_order.currency);
  end if;

  if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct value ->> 'variantId') from jsonb_array_elements(p_items)) then raise exception 'Duplicate cart line.'; end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_line ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 10 then raise exception 'Invalid item quantity.'; end if;
    select p.* into v_product from public.products p where p.id = (v_line ->> 'productId')::uuid and p.is_published and p.archived_at is null for share;
    if not found then raise exception 'A product in your bag is no longer available.'; end if;
    select pv.* into v_variant from public.product_variants pv where pv.id = (v_line ->> 'variantId')::uuid and pv.product_id = v_product.id and pv.is_active for share;
    if not found or v_variant.stock_quantity < v_quantity then raise exception '%: requested quantity is unavailable.', v_product.name; end if;
    v_subtotal := v_subtotal + (v_variant.price * v_quantity);
  end loop;

  select * into v_settings from public.store_settings where id = 'commerce';
  if p_payment_method = 'cod' and not v_settings.cash_on_delivery_enabled then raise exception 'Cash on delivery is not currently available.'; end if;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon from public.coupons where code = upper(btrim(p_coupon_code)) for update;
    if not found or not v_coupon.is_active or (v_coupon.starts_at is not null and now() < v_coupon.starts_at) or (v_coupon.expires_at is not null and now() > v_coupon.expires_at) or v_subtotal < v_coupon.minimum_purchase or (v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit) then raise exception 'That offer code is not valid for this order.'; end if;
    if v_user_id is not null and v_coupon.per_customer_limit is not null then
      select count(*) into v_redemption_count from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_user_id;
      if v_redemption_count >= v_coupon.per_customer_limit then raise exception 'That offer code has already been used.'; end if;
    end if;
    if v_coupon.type = 'percentage' then
      v_discount := round(v_subtotal * v_coupon.value / 100);
      if v_coupon.maximum_discount is not null then v_discount := least(v_discount, v_coupon.maximum_discount); end if;
    else v_discount := least(v_subtotal, v_coupon.value);
    end if;
  end if;

  v_delivery := case when p_delivery_method = 'pickup' then 0 when v_subtotal - v_discount >= v_settings.free_delivery_threshold then 0 when p_delivery_method = 'express' then v_settings.express_delivery_fee else v_settings.standard_delivery_fee end;

  insert into public.orders(order_number,user_id,guest_email,customer,shipping_address,subtotal,discount_amount,delivery_fee,total_amount,coupon_code,delivery_method,payment_method,payment_status,order_status,idempotency_key_hash)
  values (
    'AG-' || to_char(clock_timestamp(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    v_user_id,lower(p_customer ->> 'email'),p_customer,
    jsonb_build_object('address',p_customer ->> 'address','county',p_customer ->> 'county','town',p_customer ->> 'town','instructions',coalesce(p_customer ->> 'instructions','')),
    v_subtotal,v_discount,v_delivery,v_subtotal-v_discount+v_delivery,
    case when v_coupon.code is null then null else v_coupon.code end,
    p_delivery_method,p_payment_method,case when p_payment_method='cod' then 'uncollected' else 'pending' end,'received',v_key_hash
  ) returning * into v_order;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_line ->> 'quantity')::integer;
    select p.* into v_product from public.products p where p.id = (v_line ->> 'productId')::uuid;
    select pv.* into v_variant from public.product_variants pv where pv.id = (v_line ->> 'variantId')::uuid;
    select pi.url into v_image from public.product_images pi where pi.product_id = v_product.id order by pi.position limit 1;
    insert into public.order_items(order_id,product_id,variant_id,product_name,slug,image_url,variant_label,sku,unit_price,quantity)
    values(v_order.id,v_product.id,v_variant.id,v_product.name,v_product.slug,v_image,v_variant.label,v_variant.sku,v_variant.price,v_quantity);
  end loop;

  if v_coupon.code is not null and v_discount > 0 then
    update public.coupons set used_count=used_count+1 where code=v_coupon.code;
    insert into public.coupon_redemptions(coupon_code,order_id,user_id,discount_amount) values(v_coupon.code,v_order.id,v_user_id,v_discount);
  end if;
  return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status,'totalAmount',v_order.total_amount,'currency',v_order.currency);
end;
$$;

create or replace function public.mark_order_paid(p_order_id uuid, p_payment_reference text, p_provider_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item record;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.payment_status='paid' then return jsonb_build_object('orderId',v_order.id,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status); end if;
  for v_item in select * from public.order_items where order_id=p_order_id loop
    update public.product_variants set stock_quantity=stock_quantity-v_item.quantity where id=v_item.variant_id and stock_quantity>=v_item.quantity;
    if not found then raise exception 'Inventory changed before payment confirmation. Manual review required.'; end if;
    insert into public.inventory_movements(variant_id,order_id,change,reason) values(v_item.variant_id,p_order_id,-v_item.quantity,'order_paid');
  end loop;
  update public.orders set payment_status='paid',order_status='processing',payment_reference=p_payment_reference,provider_payload=provider_payload||coalesce(p_provider_payload,'{}'::jsonb) where id=p_order_id returning * into v_order;
  update public.payments set status='paid',receipt_number=coalesce(p_payment_reference,receipt_number),provider_payload=provider_payload||coalesce(p_provider_payload,'{}'::jsonb) where order_id=p_order_id and status<>'paid';
  return jsonb_build_object('orderId',v_order.id,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status);
end;
$$;

create or replace function public.adjust_inventory(p_variant_id uuid,p_change integer,p_reason text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_stock integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_change=0 or char_length(btrim(p_reason))<3 then raise exception 'A non-zero change and reason are required.'; end if;
  update public.product_variants set stock_quantity=stock_quantity+p_change where id=p_variant_id and stock_quantity+p_change>=0 returning stock_quantity into v_stock;
  if not found then raise exception 'Variant not found or stock would become negative.'; end if;
  insert into public.inventory_movements(variant_id,change,reason,actor_id) values(p_variant_id,p_change,p_reason,auth.uid());
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'inventory.adjust','product_variant',p_variant_id::text,jsonb_build_object('change',p_change,'reason',p_reason));
  return v_stock;
end;
$$;

create or replace function public.subscribe_newsletter(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_email is null or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'A valid email address is required.'; end if;
  insert into public.newsletter_subscribers(email,status,consented_at,unsubscribed_at) values(lower(btrim(p_email)),'subscribed',now(),null)
  on conflict(email) do update set status='subscribed',consented_at=now(),unsubscribed_at=null;
end;
$$;

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.reviews enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.store_settings enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated using ((select auth.uid())=id or public.is_admin());
create policy profiles_own_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy profiles_own_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy addresses_own_all on public.addresses for all to authenticated using ((select auth.uid())=user_id or public.is_admin()) with check ((select auth.uid())=user_id or public.is_admin());
create policy categories_public_read on public.categories for select to anon,authenticated using (is_active or public.is_admin());
create policy categories_admin_all on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select to anon,authenticated using ((is_published and archived_at is null) or public.is_admin());
create policy products_admin_all on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_public_read on public.product_variants for select to anon,authenticated using ((is_active and exists(select 1 from public.products p where p.id=product_id and p.is_published and p.archived_at is null)) or public.is_admin());
create policy variants_admin_all on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy images_public_read on public.product_images for select to anon,authenticated using (exists(select 1 from public.products p where p.id=product_id and p.is_published and p.archived_at is null) or public.is_admin());
create policy images_admin_all on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy carts_own_all on public.carts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy cart_items_own_all on public.cart_items for all to authenticated using (exists(select 1 from public.carts c where c.id=cart_id and c.user_id=(select auth.uid()))) with check (exists(select 1 from public.carts c where c.id=cart_id and c.user_id=(select auth.uid())));
create policy wishlists_own_all on public.wishlists for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy coupons_admin_all on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_own_read on public.orders for select to authenticated using ((select auth.uid())=user_id or public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_own_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_admin())));
create policy payments_own_read on public.payments for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_admin())));
create policy payments_admin_all on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy redemptions_own_read on public.coupon_redemptions for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
create policy inventory_admin_read on public.inventory_movements for select to authenticated using (public.is_admin());
create policy reviews_public_read on public.reviews for select to anon,authenticated using (is_approved or user_id=(select auth.uid()) or public.is_admin());
create policy reviews_own_insert on public.reviews for insert to authenticated with check (user_id=(select auth.uid()) and not is_approved);
create policy reviews_own_update on public.reviews for update to authenticated using (user_id=(select auth.uid()) or public.is_admin()) with check ((user_id=(select auth.uid()) and not is_approved) or public.is_admin());
create policy reviews_own_delete on public.reviews for delete to authenticated using (user_id=(select auth.uid()) or public.is_admin());
create policy newsletter_admin_read on public.newsletter_subscribers for select to authenticated using (public.is_admin());
create policy newsletter_admin_update on public.newsletter_subscribers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_public_read on public.store_settings for select to anon,authenticated using (true);
create policy settings_admin_update on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());

grant usage on schema public to anon,authenticated;
grant select on public.categories,public.products,public.product_variants,public.product_images,public.store_settings,public.reviews to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.addresses,public.carts,public.cart_items,public.wishlists,public.reviews to authenticated;
grant select,insert,update,delete on public.categories,public.products,public.product_variants,public.product_images,public.coupons,public.orders,public.payments,public.newsletter_subscribers,public.store_settings to authenticated;
grant select on public.order_items,public.coupon_redemptions,public.inventory_movements,public.admin_audit_log to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,text,text,text,text) to anon,authenticated;
grant execute on function public.subscribe_newsletter(text) to anon,authenticated;
grant execute on function public.adjust_inventory(uuid,integer,text) to authenticated;
grant execute on function public.mark_order_paid(uuid,text,jsonb) to service_role;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.set_updated_at() from public,anon,authenticated;
