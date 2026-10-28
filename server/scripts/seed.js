import 'dotenv/config';
import products from '../src/data/products.json' with { type:'json' };
import { requireSupabaseAdmin } from '../src/config/supabase.js';

const db=requireSupabaseAdmin();
for(const product of products){
  const {data:row,error}=await db.from('products').upsert({slug:product.slug,name:product.name,brand:product.brand,description:product.description||`${product.name} by ${product.brand}`,category_id:product.category,subcategory_id:product.subcategory,gender:product.gender,price:product.price,sale_price:product.salePrice,currency:'KES',rating:product.rating,review_count:product.reviewCount,is_published:product.isPublished,is_best_seller:product.isBestSeller,is_new_arrival:product.isNewArrival},{onConflict:'slug'}).select('id').single();
  if(error)throw error;
  await db.from('product_variants').delete().eq('product_id',row.id);
  const variants=product.variants.map(variant=>({product_id:row.id,external_id:variant.id,label:variant.label,sku:variant.sku,price:variant.price,stock_quantity:variant.stock}));
  const variantResult=await db.from('product_variants').insert(variants);if(variantResult.error)throw variantResult.error;
  await db.from('product_images').delete().eq('product_id',row.id);
  const imageResult=await db.from('product_images').insert({product_id:row.id,url:product.image,alt_text:product.name,position:0});if(imageResult.error)throw imageResult.error;
}
console.log(`Seeded ${products.length} products into Supabase.`);
