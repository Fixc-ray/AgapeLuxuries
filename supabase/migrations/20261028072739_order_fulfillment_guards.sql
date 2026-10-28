create function public.enforce_order_fulfillment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.delivery_method='pickup' then
    new.shipping_address=jsonb_build_object(
      'type','pickup',
      'pickupLocation','Agape Luxuries Nairobi collection point',
      'instructions',coalesce(new.customer->>'instructions','')
    );
  else
    if coalesce(btrim(new.shipping_address->>'address'),'')='' or coalesce(btrim(new.shipping_address->>'county'),'')='' or coalesce(btrim(new.shipping_address->>'town'),'')='' then
      raise exception 'A delivery address, county and town are required for delivery orders.';
    end if;
    new.shipping_address=jsonb_build_object(
      'type','delivery',
      'address',new.shipping_address->>'address',
      'county',new.shipping_address->>'county',
      'town',new.shipping_address->>'town',
      'instructions',coalesce(new.shipping_address->>'instructions','')
    );
  end if;
  return new;
end;
$$;

update public.orders
set shipping_address=case
  when delivery_method='pickup' then jsonb_build_object('type','pickup','pickupLocation','Agape Luxuries Nairobi collection point','instructions',coalesce(shipping_address->>'instructions',''))
  else shipping_address || jsonb_build_object('type','delivery')
end;

create trigger orders_enforce_fulfillment
before insert or update of delivery_method,shipping_address on public.orders
for each row execute function public.enforce_order_fulfillment();

alter table public.orders add constraint orders_fulfillment_details_check check (
  (delivery_method='pickup' and shipping_address->>'type'='pickup' and coalesce(btrim(shipping_address->>'pickupLocation'),'')<>'')
  or
  (delivery_method<>'pickup' and shipping_address->>'type'='delivery' and coalesce(btrim(shipping_address->>'address'),'')<>'' and coalesce(btrim(shipping_address->>'county'),'')<>'' and coalesce(btrim(shipping_address->>'town'),'')<>'')
);

revoke execute on function public.enforce_order_fulfillment() from public,anon,authenticated;
