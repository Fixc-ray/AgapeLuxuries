import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
const router=Router();router.use(requireAdmin);
router.get('/overview',async(req,res)=>{const firestore=db();if(!firestore)return res.json({mode:'demo',revenue:0,orders:0,pendingOrders:0});const snap=await firestore.collection('orders').orderBy('createdAt','desc').limit(500).get();const orders=snap.docs.map(d=>d.data());res.json({revenue:orders.filter(o=>o.paymentStatus==='paid').reduce((n,o)=>n+o.totalAmount,0),orders:orders.length,pendingOrders:orders.filter(o=>o.orderStatus==='received').length,averageOrderValue:orders.length?Math.round(orders.reduce((n,o)=>n+o.totalAmount,0)/orders.length):0,recentOrders:orders.slice(0,10)})});
router.patch('/orders/:id/status',async(req,res)=>{const allowed=['received','processing','packed','shipped','delivered','cancelled'];if(!allowed.includes(req.body.orderStatus))return res.status(400).json({message:'Invalid order status.'});const firestore=db();if(!firestore)return res.status(503).json({message:'Firestore is required for administrative writes.'});await firestore.collection('orders').doc(req.params.id).update({orderStatus:req.body.orderStatus,updatedAt:new Date()});res.json({ok:true})});
export default router;
