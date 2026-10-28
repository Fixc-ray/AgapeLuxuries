import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import storeRoutes from './routes/store-supabase.js';
import adminRoutes from './routes/admin-supabase.js';
import { supabaseConfigured } from './config/supabase.js';

const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(','),credentials:true}));
app.use(express.json({limit:'200kb'}));
app.use('/api/orders',rateLimit({windowMs:60_000,limit:12,standardHeaders:'draft-8',legacyHeaders:false}));
app.use('/api/analytics/visit',rateLimit({windowMs:60_000,limit:60,standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/api/health',(req,res)=>res.json({ok:true,mode:supabaseConfigured?'supabase':'demo'}));
app.use('/api',storeRoutes);app.use('/api/admin',adminRoutes);
app.use((err,req,res,next)=>{if(err instanceof ZodError)return res.status(400).json({message:'Please correct the highlighted information.',issues:err.issues});console.error(err);const status=err.status||(/unavailable|stock|inventory/i.test(err.message||'')?409:500);res.status(status).json({message:process.env.NODE_ENV==='production'&&status>=500?'We could not complete that request.':err.message||'Server error.'})});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../client/dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(root));app.get('*all',(req,res)=>res.sendFile(path.join(root,'index.html')))}
const port=Number(process.env.PORT)||5000;
if(process.env.NODE_ENV!=='test')app.listen(port,()=>console.log(`Agape API listening on http://localhost:${port}`));
export default app;
