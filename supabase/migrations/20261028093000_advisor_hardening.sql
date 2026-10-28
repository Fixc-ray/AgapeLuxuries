drop function public.place_order(jsonb,jsonb,text,text,text,text);

create function public.place_order(
  p_customer jsonb,
  p_items jsonb,
  p_delivery_method text,
  p_payment_method text,
  p_idempotency_key text,
  p_user_id uuid,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_image text;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_order public.orders%rowtype;
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
  if p_user_id is not null and not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid customer account.'; end if;

  v_key_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  select * into v_order from public.orders where idempotency_key_hash=v_key_hash;
  if found then
    return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status,'totalAmount',v_order.total_amount,'currency',v_order.currency);
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct value ->> 'variantId') from jsonb_array_elements(p_items)) then raise exception 'Duplicate cart line.'; end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_line ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 10 then raise exception 'Invalid item quantity.'; end if;
    select p.* into v_product from public.products p where p.id=(v_line->>'productId')::uuid and p.is_published and p.archived_at is null for share;
    if not found then raise exception 'A product in your bag is no longer available.'; end if;
    select pv.* into v_variant from public.product_variants pv where pv.id=(v_line->>'variantId')::uuid and pv.product_id=v_product.id and pv.is_active for share;
    if not found or v_variant.stock_quantity < v_quantity then raise exception '%: requested quantity is unavailable.',v_product.name; end if;
    v_subtotal := v_subtotal + v_variant.price*v_quantity;
  end loop;

  select * into v_settings from public.store_settings where id='commerce';
  if p_payment_method='cod' and not v_settings.cash_on_delivery_enabled then raise exception 'Cash on delivery is not currently available.'; end if;
  if p_coupon_code is not null and btrim(p_coupon_code)<>'' then
    select * into v_coupon from public.coupons where code=upper(btrim(p_coupon_code)) for update;
    if not found or not v_coupon.is_active or (v_coupon.starts_at is not null and now()<v_coupon.starts_at) or (v_coupon.expires_at is not null and now()>v_coupon.expires_at) or v_subtotal<v_coupon.minimum_purchase or (v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit) then raise exception 'That offer code is not valid for this order.'; end if;
    if p_user_id is not null and v_coupon.per_customer_limit is not null then
      select count(*) into v_redemption_count from public.coupon_redemptions where coupon_code=v_coupon.code and user_id=p_user_id;
      if v_redemption_count>=v_coupon.per_customer_limit then raise exception 'That offer code has already been used.'; end if;
    end if;
    if v_coupon.type='percentage' then
      v_discount:=round(v_subtotal*v_coupon.value/100);
      if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
    else v_discount:=least(v_subtotal,v_coupon.value);
    end if;
  end if;
  v_delivery:=case when p_delivery_method='pickup' then 0 when v_subtotal-v_discount>=v_settings.free_delivery_threshold then 0 when p_delivery_method='express' then v_settings.express_delivery_fee else v_settings.standard_delivery_fee end;

  insert into public.orders(order_number,user_id,guest_email,customer,shipping_address,subtotal,discount_amount,delivery_fee,total_amount,coupon_code,delivery_method,payment_method,payment_status,order_status,idempotency_key_hash)
  values('AG-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),p_user_id,lower(p_customer->>'email'),p_customer,
    jsonb_build_object('address',p_customer->>'address','county',p_customer->>'county','town',p_customer->>'town','instructions',coalesce(p_customer->>'instructions','')),
    v_subtotal,v_discount,v_delivery,v_subtotal-v_discount+v_delivery,case when v_coupon.code is null then null else v_coupon.code end,p_delivery_method,p_payment_method,case when p_payment_method='cod' then 'uncollected' else 'pending' end,'received',v_key_hash)
  returning * into v_order;

  for v_line in select value from jsonb_array_elements(p_items) loop
    v_quantity:=(v_line->>'quantity')::integer;
    select p.* into v_product from public.products p where p.id=(v_line->>'productId')::uuid;
    select pv.* into v_variant from public.product_variants pv where pv.id=(v_line->>'variantId')::uuid;
    select pi.url into v_image from public.product_images pi where pi.product_id=v_product.id order by pi.position limit 1;
    insert into public.order_items(order_id,product_id,variant_id,product_name,slug,image_url,variant_label,sku,unit_price,quantity)
    values(v_order.id,v_product.id,v_variant.id,v_product.name,v_product.slug,v_image,v_variant.label,v_variant.sku,v_variant.price,v_quantity);
  end loop;
  if v_coupon.code is not null and v_discount>0 then
    update public.coupons set used_count=used_count+1 where code=v_coupon.code;
    insert into public.coupon_redemptions(coupon_code,order_id,user_id,discount_amount) values(v_coupon.code,v_order.id,p_user_id,v_discount);
  end if;
  return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'paymentStatus',v_order.payment_status,'orderStatus',v_order.order_status,'totalAmount',v_order.total_amount,'currency',v_order.currency);
end;
$$;

revoke execute on function public.place_order(jsonb,jsonb,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,text,text,text,uuid,text) to service_role;
revoke execute on function public.subscribe_newsletter(text) from anon,authenticated;
grant execute on function public.subscribe_newsletter(text) to service_role;

alter function public.adjust_inventory(uuid,integer,text) security invoker;
create policy inventory_admin_insert on public.inventory_movements for insert to authenticated with check (public.is_admin());
create policy audit_admin_insert on public.admin_audit_log for insert to authenticated with check (public.is_admin());
grant insert on public.inventory_movements,public.admin_audit_log to authenticated;

drop policy categories_admin_all on public.categories;
create policy categories_admin_insert on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.categories for delete to authenticated using (public.is_admin());

drop policy products_admin_all on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

drop policy variants_admin_all on public.product_variants;
create policy variants_admin_insert on public.product_variants for insert to authenticated with check (public.is_admin());
create policy variants_admin_update on public.product_variants for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_admin_delete on public.product_variants for delete to authenticated using (public.is_admin());

drop policy images_admin_all on public.product_images;
create policy images_admin_insert on public.product_images for insert to authenticated with check (public.is_admin());
create policy images_admin_update on public.product_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy images_admin_delete on public.product_images for delete to authenticated using (public.is_admin());

drop policy payments_admin_all on public.payments;
create policy payments_admin_insert on public.payments for insert to authenticated with check (public.is_admin());
create policy payments_admin_update on public.payments for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_admin_delete on public.payments for delete to authenticated using (public.is_admin());

create index addresses_user_idx on public.addresses(user_id);
create index admin_audit_actor_idx on public.admin_audit_log(actor_id);
create index cart_items_variant_idx on public.cart_items(variant_id);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_code);
create index coupon_redemptions_user_idx on public.coupon_redemptions(user_id);
create index inventory_actor_idx on public.inventory_movements(actor_id);
create index inventory_order_idx on public.inventory_movements(order_id);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_variant_idx on public.order_items(variant_id);
create index orders_coupon_idx on public.orders(coupon_code);
create index orders_status_actor_idx on public.orders(status_updated_by);
create index products_category_idx on public.products(category_id);
create index reviews_order_idx on public.reviews(order_id);
create index reviews_user_idx on public.reviews(user_id);
create index wishlists_product_idx on public.wishlists(product_id);
