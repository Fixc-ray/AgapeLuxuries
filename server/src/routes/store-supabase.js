import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { listProducts, getProduct } from '../services/catalog.js';
import { calculateQuote } from '../services/commerce.js';
import { initiateStk } from '../services/mpesa.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { requireSupabase, requireSupabaseAdmin, supabaseForToken } from '../config/supabase.js';

const router = Router();
const item = z.object({ productId:z.string().uuid(), variantId:z.string().uuid(), quantity:z.number().int().min(1).max(10) });
const customer = z.object({
  name:z.string().min(2).max(120), email:z.string().email(), phone:z.string().regex(/^(?:\+254|0)[17]\d{8}$/),
  address:z.string().max(300).optional().default(''), county:z.string().max(100).optional().default(''), town:z.string().max(100).optional().default(''),
  instructions:z.string().max(500).optional(), paymentMethod:z.enum(['mpesa','cod','stripe']).optional(),
  deliveryMethod:z.enum(['standard','express','pickup']).optional()
});
const orderInput = z.object({
  customer, items:z.array(item).min(1).max(30), deliveryMethod:z.enum(['standard','express','pickup']),
  paymentMethod:z.enum(['mpesa','cod','stripe']), couponCode:z.string().max(30).nullable().optional()
}).superRefine((value,ctx) => {
  if (value.deliveryMethod === 'pickup') return;
  if (value.customer.address.trim().length < 5) ctx.addIssue({ code:'custom', path:['customer','address'], message:'A complete delivery address is required.' });
  if (value.customer.county.trim().length < 2) ctx.addIssue({ code:'custom', path:['customer','county'], message:'A delivery county is required.' });
  if (value.customer.town.trim().length < 2) ctx.addIssue({ code:'custom', path:['customer','town'], message:'A delivery town or area is required.' });
});

const userClient = req => requireSupabase(supabaseForToken(req.accessToken));
const handle = result => {
  if (result.error) throw Object.assign(new Error(result.error.message), { status:result.error.code==='PGRST116'?404:400 });
  return result.data;
};

router.get('/products', async (req,res,next) => {
  try { res.json({ products:await listProducts(req.query) }); } catch (error) { next(error); }
});

router.get('/products/:slug', async (req,res,next) => {
  try {
    const product = await getProduct(req.params.slug);
    if (!product) return res.status(404).json({ message:'Product not found.' });
    res.json({ product });
  } catch (error) { next(error); }
});

router.post('/checkout/quote', async (req,res,next) => {
  try {
    const parsed = z.object({ items:z.array(item).min(1).max(30), deliveryMethod:z.enum(['standard','express','pickup']).default('standard') }).parse(req.body);
    const products = await listProducts({ limit:100 });
    res.json(calculateQuote(parsed.items,products,parsed.deliveryMethod));
  } catch (error) { next(error); }
});

router.post('/orders', optionalAuth, async (req,res,next) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key');
    const parsed = orderInput.parse(req.body);
    const admin = requireSupabaseAdmin();
    const order = handle(await admin.rpc('place_order', {
      p_customer:parsed.customer, p_items:parsed.items, p_delivery_method:parsed.deliveryMethod,
      p_payment_method:parsed.paymentMethod, p_idempotency_key:idempotencyKey, p_user_id:req.user?.id || null,
      p_coupon_code:parsed.couponCode || null
    }));

    let payment = { status:order.paymentStatus };
    if (parsed.paymentMethod === 'mpesa') {
      payment = await initiateStk({ phone:parsed.customer.phone, amount:Number(order.totalAmount), orderNumber:order.orderNumber });
      if (payment.checkoutRequestId) {
        handle(await admin.from('payments').insert({
          order_id:order.orderId, provider:'mpesa', provider_request_id:payment.checkoutRequestId,
          merchant_request_id:payment.merchantRequestId, status:'pending', amount:Number(order.totalAmount), currency:'KES'
        }));
        handle(await admin.from('orders').update({ payment_reference:payment.checkoutRequestId }).eq('id',order.orderId));
      }
    }
    res.status(201).json({ ...order, paymentStatus:payment.status==='pending'?'pending':order.paymentStatus, payment });
  } catch (error) { next(error); }
});

router.get('/orders/mine', requireAuth, async (req,res,next) => {
  try {
    const data = handle(await userClient(req).from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(100));
    res.json({ orders:data.map(mapOrder) });
  } catch (error) { next(error); }
});

router.get('/orders/:id', requireAuth, async (req,res,next) => {
  try {
    const order = handle(await userClient(req).from('orders').select('*,order_items(*),payments(*)').eq('id',req.params.id).maybeSingle());
    if (!order) return res.status(404).json({ message:'Order not found.' });
    res.json({ order:mapOrder(order) });
  } catch (error) { next(error); }
});

router.get('/payments/:orderId/status', requireAuth, async (req,res,next) => {
  try {
    const order = handle(await userClient(req).from('orders').select('id,payment_status,order_status').eq('id',req.params.orderId).maybeSingle());
    if (!order) return res.status(404).json({ message:'Order not found.' });
    res.json({ orderId:order.id, paymentStatus:order.payment_status, orderStatus:order.order_status });
  } catch (error) { next(error); }
});

router.post('/payments/mpesa/callback', async (req,res,next) => {
  try {
    const configuredSecret = process.env.MPESA_CALLBACK_SECRET;
    if (process.env.NODE_ENV==='production' && (!configuredSecret || req.query.token!==configuredSecret)) return res.status(401).json({ message:'Invalid callback credentials.' });
    const callback = req.body?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID || typeof callback.ResultCode!=='number') return res.status(400).json({ message:'Malformed callback.' });
    const metadata = Object.fromEntries((callback.CallbackMetadata?.Item || []).map(entry=>[entry.Name,entry.Value]));
    const admin = requireSupabaseAdmin();
    const payment = handle(await admin.from('payments').select('*').eq('provider_request_id',callback.CheckoutRequestID).maybeSingle());
    if (payment && payment.status!=='paid') {
      const amountMatches = callback.ResultCode!==0 || Number(metadata.Amount)===Number(payment.amount);
      const paid = callback.ResultCode===0 && amountMatches;
      handle(await admin.from('payments').update({
        status:paid?'paid':'failed', receipt_number:metadata.MpesaReceiptNumber || null,
        provider_payload:{ resultCode:callback.ResultCode, description:callback.ResultDesc, phone:String(metadata.PhoneNumber || ''), amountVerified:amountMatches }
      }).eq('id',payment.id));
      if (paid) handle(await admin.rpc('mark_order_paid', { p_order_id:payment.order_id, p_payment_reference:metadata.MpesaReceiptNumber, p_provider_payload:{ checkoutRequestId:callback.CheckoutRequestID } }));
      else handle(await admin.from('orders').update({ payment_status:'failed' }).eq('id',payment.order_id));
    }
    res.json({ ResultCode:0, ResultDesc:'Accepted' });
  } catch (error) { next(error); }
});

router.post('/newsletter', async (req,res,next) => {
  try {
    const { email } = z.object({ email:z.string().email() }).parse(req.body);
    handle(await requireSupabaseAdmin().rpc('subscribe_newsletter',{ p_email:email }));
    res.status(201).json({ message:'Subscription received.' });
  } catch (error) { next(error); }
});

router.post('/analytics/visit', async (req,res,next) => {
  try {
    const input=z.object({visitorId:z.string().uuid(),sessionId:z.string().uuid(),path:z.string().min(1).max(500),referrerHost:z.string().max(255).nullable().optional()}).parse(req.body);
    const salt=process.env.ANALYTICS_SALT || process.env.SUPABASE_SECRET_KEY;
    if(!salt)throw Object.assign(new Error('Analytics is not configured.'),{status:503});
    const hash=value=>crypto.createHmac('sha256',salt).update(value).digest('hex');
    handle(await requireSupabaseAdmin().rpc('record_site_visit',{
      p_visitor_hash:hash(input.visitorId),p_session_hash:hash(input.sessionId),p_path:input.path,p_referrer_host:input.referrerHost || null
    }));
    res.status(202).end();
  } catch(error){next(error)}
});

router.get('/account/profile', requireAuth, async (req,res,next) => {
  try { res.json({ profile:handle(await userClient(req).from('profiles').select('*').eq('id',req.user.id).single()) }); }
  catch (error) { next(error); }
});

router.patch('/account/profile', requireAuth, async (req,res,next) => {
  try {
    const input = z.object({ fullName:z.string().min(2).max(120).optional(), phone:z.string().max(30).nullable().optional(), avatarUrl:z.string().url().nullable().optional(), marketingConsent:z.boolean().optional() }).parse(req.body);
    const profile = handle(await userClient(req).from('profiles').update({ full_name:input.fullName, phone:input.phone, avatar_url:input.avatarUrl, marketing_consent:input.marketingConsent }).eq('id',req.user.id).select().single());
    res.json({ profile });
  } catch (error) { next(error); }
});

router.get('/account/addresses', requireAuth, async (req,res,next) => {
  try { res.json({ addresses:handle(await userClient(req).from('addresses').select('*').order('is_default',{ascending:false})) }); }
  catch (error) { next(error); }
});

router.post('/account/addresses', requireAuth, async (req,res,next) => {
  try {
    const input = addressSchema.parse(req.body);
    const address = handle(await userClient(req).from('addresses').insert({ ...snakeAddress(input), user_id:req.user.id }).select().single());
    res.status(201).json({ address });
  } catch (error) { next(error); }
});

router.put('/account/addresses/:id', requireAuth, async (req,res,next) => {
  try { res.json({ address:handle(await userClient(req).from('addresses').update(snakeAddress(addressSchema.parse(req.body))).eq('id',req.params.id).select().single()) }); }
  catch (error) { next(error); }
});

router.delete('/account/addresses/:id', requireAuth, async (req,res,next) => {
  try { handle(await userClient(req).from('addresses').delete().eq('id',req.params.id)); res.status(204).end(); }
  catch (error) { next(error); }
});

router.get('/account/cart', requireAuth, async (req,res,next) => {
  try {
    const cart = handle(await userClient(req).from('carts').select('id,cart_items(*,product_variants(*,products(*,product_images(*))))').eq('user_id',req.user.id).maybeSingle());
    res.json({ cart:cart || { cart_items:[] } });
  } catch (error) { next(error); }
});

router.put('/account/cart', requireAuth, async (req,res,next) => {
  try {
    const { items } = z.object({ items:z.array(z.object({ variantId:z.string().uuid(), quantity:z.number().int().min(1).max(10) })).max(50) }).parse(req.body);
    const client = userClient(req);
    const cart = handle(await client.from('carts').upsert({ user_id:req.user.id },{ onConflict:'user_id' }).select().single());
    handle(await client.from('cart_items').delete().eq('cart_id',cart.id));
    if (items.length) handle(await client.from('cart_items').insert(items.map(line=>({ cart_id:cart.id, variant_id:line.variantId, quantity:line.quantity }))));
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.get('/account/wishlist', requireAuth, async (req,res,next) => {
  try { res.json({ items:handle(await userClient(req).from('wishlists').select('product_id,products(*,product_variants(*),product_images(*))').order('created_at',{ascending:false})) }); }
  catch (error) { next(error); }
});

router.post('/account/wishlist/:productId', requireAuth, async (req,res,next) => {
  try { handle(await userClient(req).from('wishlists').upsert({ user_id:req.user.id, product_id:req.params.productId })); res.status(201).json({ ok:true }); }
  catch (error) { next(error); }
});

router.delete('/account/wishlist/:productId', requireAuth, async (req,res,next) => {
  try { handle(await userClient(req).from('wishlists').delete().eq('product_id',req.params.productId)); res.status(204).end(); }
  catch (error) { next(error); }
});

router.post('/products/:productId/reviews', requireAuth, async (req,res,next) => {
  try {
    const input = z.object({ rating:z.number().int().min(1).max(5), title:z.string().max(120).nullable().optional(), body:z.string().min(10).max(2000), orderId:z.string().uuid().nullable().optional() }).parse(req.body);
    const review = handle(await userClient(req).from('reviews').upsert({ product_id:req.params.productId, user_id:req.user.id, order_id:input.orderId, rating:input.rating, title:input.title, body:input.body, is_approved:false },{ onConflict:'product_id,user_id' }).select().single());
    res.status(201).json({ review });
  } catch (error) { next(error); }
});

const addressSchema = z.object({ label:z.string().min(1).max(50).default('Home'), recipientName:z.string().min(2).max(120), phone:z.string().min(7).max(30), address:z.string().min(5).max(300), county:z.string().min(2).max(100), town:z.string().min(2).max(100), instructions:z.string().max(500).nullable().optional(), isDefault:z.boolean().default(false) });
const snakeAddress = value => ({ label:value.label, recipient_name:value.recipientName, phone:value.phone, address:value.address, county:value.county, town:value.town, instructions:value.instructions, is_default:value.isDefault });
const mapOrder = order => ({
  id:order.id, orderNumber:order.order_number, customer:order.customer, shippingAddress:order.shipping_address,
  subtotal:Number(order.subtotal), discountAmount:Number(order.discount_amount), deliveryFee:Number(order.delivery_fee), totalAmount:Number(order.total_amount), currency:order.currency,
  paymentMethod:order.payment_method, paymentStatus:order.payment_status, orderStatus:order.order_status,
  trackingNumber:order.tracking_number, courier:order.courier, items:order.order_items || [], payments:order.payments || [], createdAt:order.created_at
});

export default router;
