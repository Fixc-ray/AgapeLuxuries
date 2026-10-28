import products from '../data/products.json' with { type:'json' };
import { supabasePublic } from '../config/supabase.js';

export function mapProduct(row) {
  const variants = (row.product_variants || []).map(variant => ({
    id:variant.id,
    externalId:variant.external_id,
    label:variant.label,
    sku:variant.sku,
    price:Number(variant.price),
    stock:Number(variant.stock_quantity),
    attributes:variant.attributes || {}
  }));
  const images = (row.product_images || []).sort((a,b)=>a.position-b.position).map(image=>image.url);
  return {
    id:row.id, slug:row.slug, name:row.name, brand:row.brand, description:row.description,
    category:row.category_id, subcategory:row.subcategory_id, gender:row.gender,
    price:Number(row.price), salePrice:row.sale_price == null ? null : Number(row.sale_price), currency:row.currency,
    image:images[0] || '', images, variants, stock:variants.reduce((sum,variant)=>sum+variant.stock,0),
    attributes:row.attributes || {}, fragranceNotes:row.fragrance_notes,
    rating:Number(row.rating), reviewCount:Number(row.review_count), isPublished:row.is_published,
    isFeatured:row.is_featured, isBestSeller:row.is_best_seller, isNewArrival:row.is_new_arrival
  };
}

const selection = '*,product_variants(*),product_images(*)';

export async function listProducts(query = {}, client = supabasePublic(), { includeDrafts=false } = {}) {
  if (!client) return structuredClone(products).filter(product => (!query.category || product.category===query.category) && (!query.gender || product.gender===query.gender) && (!query.q || JSON.stringify(product).toLowerCase().includes(String(query.q).toLowerCase())));
  let request = client.from('products').select(selection).is('archived_at',null).order('created_at',{ascending:false}).limit(Math.min(Number(query.limit)||50,100));
  if (!includeDrafts) request = request.eq('is_published',true);
  if (query.category) request = request.eq('category_id',String(query.category));
  if (query.gender) request = request.eq('gender',String(query.gender));
  const { data, error } = await request;
  if (error) throw error;
  const mapped = data.map(mapProduct);
  const search = String(query.q || '').trim().toLowerCase();
  return search ? mapped.filter(product => `${product.name} ${product.brand} ${product.description}`.toLowerCase().includes(search)) : mapped;
}

export async function getProduct(slug, client = supabasePublic(), options = {}) {
  if (!client) return products.find(product=>product.slug===slug);
  let request = client.from('products').select(selection).eq('slug',slug).is('archived_at',null);
  if (!options.includeDrafts) request=request.eq('is_published',true);
  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data) : null;
}
