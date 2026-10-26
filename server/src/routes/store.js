import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { listProducts, getProduct } from '../services/catalog.js';
import { calculateQuote, orderNumber } from '../services/commerce.js';
import { initiateStk } from '../services/mpesa.js';
import { db, admin } from '../config/firebase.js';
import products from '../data/products.json' with { type:'json' };
import { optionalAuth } from '../middleware/auth.js';

const router=Router(); const demoOrders=new Map(); const idempotency=new Map();
const item=z.object({productId:z.string(),variantId:z.string(),quantity:z.number().int().positive()});
const customer=z.object({name:z.string().min(2),email:z.string().email(),phone:z.string().regex(/^(?:\+254|0)[17]\d{8}$/),address:z.string().min(5),county:z.string().min(2),town:z.string().min(2),instructions:z.string().optional(),paymentMethod:z.enum(['mpesa','cod']).optional(),deliveryMethod:z.enum(['standard','express','pickup']).optional()});

router.get('/products',async(req,res,next)=>{try{res.json({products:await listProducts(req.query)})}catch(e){next(e)}});
router.get('/products/:slug',async(req,res,next)=>{try{const product=await getProduct(req.params.slug);if(!product)return res.status(404).json({message:'Product not found.'});res.json({product})}catch(e){next(e)}});
router.post('/checkout/quote',(req,res,next)=>{try{const parsed=z.object({items:z.array(item),deliveryMethod:z.enum(['standard','express','pickup']).default('standard')}).parse(req.body);res.json(calculateQuote(parsed.items,products,parsed.deliveryMethod))}catch(e){next(e)}});

router.post('/orders', optionalAuth, async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key || key.length < 8) return res.status(400).json({ message:'A valid Idempotency-Key header is required.' });
    if (idempotency.has(key)) return res.json(idempotency.get(key));

    const parsed = z.object({
      customer,
      items:z.array(item).min(1),
      deliveryMethod:z.enum(['standard','express','pickup']),
      paymentMethod:z.enum(['mpesa','cod'])
    }).parse(req.body);
    const quote = calculateQuote(parsed.items, products, parsed.deliveryMethod);
    const number = orderNumber();
    const order = {
      orderNumber:number,
      userId:req.user?.uid || null,
      guestEmail:parsed.customer.email,
      customer:parsed.customer,
      shippingAddress:{ address:parsed.customer.address, county:parsed.customer.county, town:parsed.customer.town, instructions:parsed.customer.instructions || '' },
      ...quote,
      paymentMethod:parsed.paymentMethod,
      paymentStatus:parsed.paymentMethod === 'cod' ? 'uncollected' : 'pending',
      orderStatus:'received',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    const firestore = db();
    let orderId;

    if (firestore) {
      const keyHash = crypto.createHash('sha256').update(key).digest('hex');
      const orderRef = firestore.collection('orders').doc(keyHash.slice(0,40));
      let existing = null;
      await firestore.runTransaction(async tx => {
        const existingSnap = await tx.get(orderRef);
        if (existingSnap.exists) { existing = existingSnap.data(); return; }

        const refs = quote.items.map(line => firestore.collection('products').doc(line.productId));
        const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
        snapshots.forEach((snap, position) => {
          const line = quote.items[position];
          if (!snap.exists) throw new Error(`${line.name} is no longer available.`);
          const data = snap.data();
          const index = data.variants.findIndex(variant => variant.id === line.variantId);
          if (index < 0 || data.variants[index].stock < line.quantity) throw new Error(`${line.name} no longer has enough stock.`);
          const variants = [...data.variants];
          variants[index] = { ...variants[index], stock:variants[index].stock-line.quantity };
          tx.update(refs[position], { variants, stockQuantity:admin.firestore.FieldValue.increment(-line.quantity), updatedAt:admin.firestore.FieldValue.serverTimestamp() });
        });
        tx.set(orderRef, { ...order, createdAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp(), idempotencyKeyHash:keyHash });
      });
      orderId = orderRef.id;
      if (existing) {
        const result = { orderId, orderNumber:existing.orderNumber, paymentStatus:existing.paymentStatus, orderStatus:existing.orderStatus, totalAmount:existing.totalAmount, currency:existing.currency, payment:{status:existing.paymentStatus} };
        idempotency.set(key,result);
        return res.json(result);
      }
    } else {
      orderId = crypto.randomUUID();
      demoOrders.set(orderId,{id:orderId,...order});
    }

    let payment = { status:order.paymentStatus };
    if (parsed.paymentMethod === 'mpesa') payment = await initiateStk({ phone:parsed.customer.phone, amount:quote.totalAmount, orderNumber:number });
    if (firestore && payment.checkoutRequestId) {
      const paymentRef = firestore.collection('payments').doc();
      await paymentRef.set({ orderId, userId:req.user?.uid || null, orderNumber:number, checkoutRequestId:payment.checkoutRequestId, merchantRequestId:payment.merchantRequestId, status:'pending', amount:quote.totalAmount, currency:'KES', createdAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp() });
      await firestore.collection('orders').doc(orderId).update({ paymentReference:payment.checkoutRequestId, updatedAt:admin.firestore.FieldValue.serverTimestamp() });
    }
    const result = { orderId, orderNumber:number, paymentStatus:payment.status === 'pending' ? 'pending' : order.paymentStatus, orderStatus:order.orderStatus, totalAmount:quote.totalAmount, currency:'KES', payment };
    idempotency.set(key,result);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.get('/payments/:orderId/status',optionalAuth,async(req,res,next)=>{try{const firestore=db();let order;if(firestore){const snap=await firestore.collection('orders').doc(req.params.orderId).get();if(snap.exists)order={id:snap.id,...snap.data()}}else order=demoOrders.get(req.params.orderId);if(!order)return res.status(404).json({message:'Order not found.'});if(order.userId&&order.userId!==req.user?.uid)return res.status(403).json({message:'You cannot access this order.'});res.json({orderId:order.id,paymentStatus:order.paymentStatus,orderStatus:order.orderStatus})}catch(e){next(e)}});

router.post('/payments/mpesa/callback', async (req,res,next) => {
  try {
    const configuredSecret = process.env.MPESA_CALLBACK_SECRET;
    if (process.env.NODE_ENV === 'production' && (!configuredSecret || req.get('X-Callback-Secret') !== configuredSecret)) return res.status(401).json({message:'Invalid callback credentials.'});
    const callback = req.body?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID || typeof callback.ResultCode !== 'number') return res.status(400).json({message:'Malformed callback.'});
    const metadata = Object.fromEntries((callback.CallbackMetadata?.Item || []).map(item => [item.Name,item.Value]));
    const firestore = db();
    if (firestore) {
      const payments = await firestore.collection('payments').where('checkoutRequestId','==',callback.CheckoutRequestID).limit(1).get();
      if (!payments.empty) {
        const paymentRef = payments.docs[0].ref;
        const paymentData = payments.docs[0].data();
        const orderRef = firestore.collection('orders').doc(paymentData.orderId);
        const amountMatches = callback.ResultCode !== 0 || Number(metadata.Amount) === Number(paymentData.amount);
        const nextStatus = callback.ResultCode === 0 && amountMatches ? 'paid' : 'failed';
        await firestore.runTransaction(async tx => {
          const latest = await tx.get(paymentRef);
          if (!latest.exists || latest.data().status === 'paid') return;
          tx.update(paymentRef,{status:nextStatus,providerResultCode:callback.ResultCode,providerDescription:callback.ResultDesc,receiptNumber:metadata.MpesaReceiptNumber||null,phoneNumber:String(metadata.PhoneNumber||''),amountVerified:amountMatches,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
          tx.update(orderRef,{paymentStatus:nextStatus,paymentReference:metadata.MpesaReceiptNumber||callback.CheckoutRequestID,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
        });
      }
    }
    res.json({ResultCode:0,ResultDesc:'Accepted'});
  } catch (error) { next(error); }
});
router.post('/newsletter',(req,res,next)=>{try{const{email}=z.object({email:z.string().email()}).parse(req.body);res.status(201).json({message:'Subscription received.',email})}catch(e){next(e)}});
export default router;
