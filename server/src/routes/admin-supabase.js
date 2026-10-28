import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { listProducts } from '../services/catalog.js';
import { requireSupabase, supabaseForToken } from '../config/supabase.js';

const router = Router();
router.use(requireAdmin);
const client = req => requireSupabase(supabaseForToken(req.accessToken));
const dataOrThrow = result => { if (result.error) throw result.error; return result.data; };

router.get('/overview', async (req,res,next) => {
  try {
    const db = client(req);
    const today=new Date().toISOString().slice(0,10);const since=new Date(Date.now()-13*86400000).toISOString().slice(0,10);
    const [orders,variants,profiles,allVisitors,todayVisitors,dailyRows,pageRows] = await Promise.all([
      db.from('orders').select('*').order('created_at',{ascending:false}).limit(500),
      db.from('product_variants').select('id,product_id,label,sku,stock_quantity,products(name)').lte('stock_quantity',5).order('stock_quantity'),
      db.from('profiles').select('id',{count:'exact',head:true}),
      db.from('analytics_visitors').select('visitor_hash',{count:'exact',head:true}),
      db.from('analytics_daily_visitors').select('visitor_hash',{count:'exact',head:true}).eq('visit_date',today),
      db.from('analytics_daily_visitors').select('visit_date,page_views,session_count').gte('visit_date',since).order('visit_date').limit(10000),
      db.from('analytics_page_visitors').select('path,page_views').gte('visit_date',since).limit(10000)
    ]);
    for(const result of [orders,variants,profiles,allVisitors,todayVisitors,dailyRows,pageRows])if(result.error)throw result.error;
    const rows=dataOrThrow(orders); const paid=rows.filter(order=>order.payment_status==='paid'); const revenue=paid.reduce((sum,order)=>sum+Number(order.total_amount),0);
    const trendByDay=new Map();for(const row of dailyRows.data){const current=trendByDay.get(row.visit_date)||{date:row.visit_date,visitors:0,pageViews:0,sessions:0};current.visitors+=1;current.pageViews+=row.page_views;current.sessions+=row.session_count;trendByDay.set(row.visit_date,current)}
    const visitorTrend=[];for(let offset=13;offset>=0;offset-=1){const date=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);visitorTrend.push(trendByDay.get(date)||{date,visitors:0,pageViews:0,sessions:0})}
    const pageMap=new Map();for(const row of pageRows.data)pageMap.set(row.path,(pageMap.get(row.path)||0)+row.page_views);
    const topPages=[...pageMap.entries()].map(([path,pageViews])=>({path,pageViews})).sort((a,b)=>b.pageViews-a.pageViews).slice(0,8);
    const todayMetrics=trendByDay.get(today)||{pageViews:0,sessions:0};
    res.json({
      revenue, orders:rows.length, pendingOrders:rows.filter(order=>['received','processing'].includes(order.order_status)).length,
      completed:rows.filter(order=>order.order_status==='delivered').length, customers:profiles.count || 0,
      averageOrderValue:paid.length?Math.round(revenue/paid.length):0, lowStock:dataOrThrow(variants), recentOrders:rows.slice(0,10),
      visitors:allVisitors.count||0,visitorsToday:todayVisitors.count||0,sessionsToday:todayMetrics.sessions,pageViewsToday:todayMetrics.pageViews,visitorTrend,topPages
    });
  } catch (error) { next(error); }
});

router.get('/products', async (req,res,next) => {
  try { res.json({ products:await listProducts({limit:100},client(req),{includeDrafts:true}) }); } catch (error) { next(error); }
});

router.patch('/products/:id', async (req,res,next) => {
  try {
    const input=z.object({ name:z.string().min(2).max(160).optional(), price:z.number().nonnegative().optional(), salePrice:z.number().nonnegative().nullable().optional(), isPublished:z.boolean().optional(), isFeatured:z.boolean().optional(), isBestSeller:z.boolean().optional(), isNewArrival:z.boolean().optional() }).parse(req.body);
    const changes={};
    if(input.name!==undefined)changes.name=input.name;if(input.price!==undefined)changes.price=input.price;if(input.salePrice!==undefined)changes.sale_price=input.salePrice;
    if(input.isPublished!==undefined)changes.is_published=input.isPublished;if(input.isFeatured!==undefined)changes.is_featured=input.isFeatured;
    if(input.isBestSeller!==undefined)changes.is_best_seller=input.isBestSeller;if(input.isNewArrival!==undefined)changes.is_new_arrival=input.isNewArrival;
    const product=dataOrThrow(await client(req).from('products').update(changes).eq('id',req.params.id).select().single());
    res.json({ product });
  } catch(error){next(error)}
});

router.delete('/products/:id', async (req,res,next) => {
  try { dataOrThrow(await client(req).from('products').update({is_published:false,archived_at:new Date().toISOString()}).eq('id',req.params.id)); res.status(204).end(); }
  catch(error){next(error)}
});

router.get('/orders', async (req,res,next) => {
  try {
    let query=client(req).from('orders').select('*,order_items(*),payments(*)').order('created_at',{ascending:false}).limit(250);
    if(req.query.status)query=query.eq('order_status',req.query.status);
    res.json({orders:dataOrThrow(await query)});
  } catch(error){next(error)}
});

router.patch('/orders/:id/status', async (req,res,next) => {
  try {
    const input=z.object({orderStatus:z.enum(['received','processing','packed','shipped','delivered','cancelled','returned']),trackingNumber:z.string().max(120).nullable().optional(),courier:z.string().max(120).nullable().optional()}).parse(req.body);
    const order=dataOrThrow(await client(req).from('orders').update({order_status:input.orderStatus,tracking_number:input.trackingNumber,courier:input.courier,status_updated_by:req.user.id}).eq('id',req.params.id).select().single());
    res.json({order});
  } catch(error){next(error)}
});

router.post('/inventory/:variantId/adjust', async (req,res,next) => {
  try {
    const input=z.object({change:z.number().int().min(-10000).max(10000).refine(value=>value!==0),reason:z.string().min(3).max(200)}).parse(req.body);
    const stock=dataOrThrow(await client(req).rpc('adjust_inventory',{p_variant_id:req.params.variantId,p_change:input.change,p_reason:input.reason}));
    res.json({stock});
  } catch(error){next(error)}
});

router.get('/coupons', async (req,res,next) => { try { res.json({coupons:dataOrThrow(await client(req).from('coupons').select('*').order('created_at',{ascending:false}))}); } catch(error){next(error)} });
router.post('/coupons', async (req,res,next) => {
  try {
    const input=z.object({code:z.string().regex(/^[A-Z0-9_-]{3,30}$/),type:z.enum(['percentage','fixed']),value:z.number().positive(),minimumPurchase:z.number().nonnegative().default(0),maximumDiscount:z.number().positive().nullable().optional(),usageLimit:z.number().int().positive().nullable().optional(),perCustomerLimit:z.number().int().positive().nullable().optional(),startsAt:z.string().datetime().nullable().optional(),expiresAt:z.string().datetime().nullable().optional(),isActive:z.boolean().default(true)}).parse({...req.body,code:req.body.code?.toUpperCase()});
    const coupon=dataOrThrow(await client(req).from('coupons').insert({code:input.code,type:input.type,value:input.value,minimum_purchase:input.minimumPurchase,maximum_discount:input.maximumDiscount,usage_limit:input.usageLimit,per_customer_limit:input.perCustomerLimit,starts_at:input.startsAt,expires_at:input.expiresAt,is_active:input.isActive}).select().single());
    res.status(201).json({coupon});
  } catch(error){next(error)}
});

router.get('/customers', async (req,res,next) => { try { res.json({customers:dataOrThrow(await client(req).from('profiles').select('*').order('created_at',{ascending:false}).limit(250))}); } catch(error){next(error)} });
router.get('/newsletter', async (req,res,next) => { try { res.json({subscribers:dataOrThrow(await client(req).from('newsletter_subscribers').select('*').order('created_at',{ascending:false}).limit(1000))}); } catch(error){next(error)} });

export default router;
