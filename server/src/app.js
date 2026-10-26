import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import storeRoutes from './routes/store.js';
import adminRoutes from './routes/admin.js';

const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(','),credentials:true}));
app.use(express.json({limit:'200kb'}));
app.use('/api/orders',rateLimit({windowMs:60_000,limit:12,standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/api/health',(req,res)=>res.json({ok:true,mode:process.env.FIREBASE_PROJECT_ID?'firebase':'demo'}));
app.use('/api',storeRoutes);app.use('/api/admin',adminRoutes);
app.use((err,req,res,next)=>{if(err instanceof ZodError)return res.status(400).json({message:'Please correct the highlighted information.',issues:err.issues});console.error(err);res.status(err.message?.includes('unavailable')?409:500).json({message:process.env.NODE_ENV==='production'?'We could not complete that request.':err.message||'Server error.'})});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../client/dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(root));app.get('*all',(req,res)=>res.sendFile(path.join(root,'index.html')))}
const port=Number(process.env.PORT)||5000;
if(process.env.NODE_ENV!=='test')app.listen(port,()=>console.log(`Agape API listening on http://localhost:${port}`));
export default app;
