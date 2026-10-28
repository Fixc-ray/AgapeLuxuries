import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductGrid } from '../components/ProductCard';
import { useShop } from '../context/ShopContext';
import { supabase, supabaseEnabled } from '../services/supabase';
import { api } from '../services/api';
import { money } from '../data/demoProducts';
import ClientProfile from './ClientProfile';

export default function AccountPage({mode}) {
  const {products,wishlist,user,authLoading}=useShop();
  const [message,setMessage]=useState(''); const [error,setError]=useState('');
  if(mode==='wishlist')return <section className="mx-auto min-h-[65vh] max-w-[1480px] px-6 py-16 lg:px-10"><p className="eyebrow">Saved for later</p><h1 className="mb-12 mt-3 font-serif text-6xl">Your wishlist.</h1><ProductGrid products={products.filter(p=>wishlist.includes(p.id))}/></section>;
  if(mode==='account')return <ClientProfile user={user} loading={authLoading}/>;
  const submit=async e=>{
    e.preventDefault();setError('');setMessage('');const data=new FormData(e.currentTarget);const email=data.get('email'),password=data.get('password');
    if(!supabaseEnabled){setError('Supabase Authentication is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to client/.env.');return}
    try{
      if(mode==='register'){
        const {error:authError}=await supabase.auth.signUp({email,password,options:{data:{full_name:data.get('name')}}});if(authError)throw authError;
        setMessage('Account created. Please check your email to verify it.');
      }else if(mode==='forgot'){
        const {error:authError}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/account`});if(authError)throw authError;
        setMessage('Password reset email sent.');
      }else{
        const {error:authError}=await supabase.auth.signInWithPassword({email,password});if(authError)throw authError;setMessage('Signed in successfully.');
      }
    }catch(err){setError(err.message)}
  };
  const title=mode==='register'?'Create an account':mode==='forgot'?'Reset your password':'Welcome back';
  return <section className="mx-auto grid min-h-[70vh] max-w-[1200px] lg:grid-cols-2"><div className="hidden bg-[url('/images/hero-luxury.png')] bg-cover bg-center lg:block"/><div className="px-6 py-16 lg:p-20"><p className="eyebrow">Private client access</p><h1 className="mt-4 font-serif text-5xl">{title}</h1><form onSubmit={submit} className="mt-9 space-y-5">{mode==='register'&&<label><span className="field-label">Full name</span><input name="name" required minLength="2" className="field"/></label>}<label><span className="field-label">Email address</span><input name="email" required type="email" className="field"/></label>{mode!=='forgot'&&<label><span className="field-label">Password</span><input name="password" required minLength="8" type="password" className="field"/></label>}<button className="btn-dark w-full">{title}</button></form>{message&&<p className="mt-5 bg-green-50 p-4 text-sm text-green-900">{message}</p>}{error&&<p className="mt-5 bg-red-50 p-4 text-sm text-red-900">{error}</p>}<div className="mt-6 flex justify-between text-xs text-black/55">{mode==='login'&&<><Link to="/register">Create account</Link><Link to="/forgot-password">Forgot password?</Link></>}{mode!=='login'&&<Link to="/login">Return to sign in</Link>}</div></div></section>;
}

function AccountHome({user,loading}){
  const[orders,setOrders]=useState([]);const[error,setError]=useState('');
  useEffect(()=>{if(user)api.myOrders().then(result=>setOrders(result.orders)).catch(err=>setError(err.message))},[user]);
  if(loading)return <section className="min-h-[65vh] p-16 text-center">Loading your account…</section>;
  if(!user)return <section className="mx-auto min-h-[65vh] max-w-3xl px-6 py-24 text-center"><h1 className="font-serif text-5xl">Your private client space.</h1><p className="mt-4 text-sm text-black/55">Sign in to view orders and saved details.</p><Link to="/login" className="btn-dark mt-8">Sign in</Link></section>;
  return <section className="mx-auto min-h-[65vh] max-w-5xl px-6 py-16"><p className="eyebrow">Client account</p><h1 className="mt-3 font-serif text-6xl">Welcome back.</h1><p className="mt-2 text-sm text-black/55">{user.email}</p><button onClick={()=>supabase.auth.signOut()} className="mt-5 text-xs underline">Sign out</button><div className="mt-10 grid gap-5 lg:grid-cols-3"><div className="border border-black/10 bg-white p-7 lg:col-span-2"><h2 className="font-serif text-3xl">Orders</h2>{error&&<p className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 space-y-3">{orders.map(order=><div key={order.id} className="grid gap-2 border-b border-black/10 py-4 text-sm sm:grid-cols-4"><b>{order.orderNumber}</b><span className="capitalize">{order.orderStatus}</span><span className="capitalize">{order.paymentStatus}</span><span className="sm:text-right">{money(order.totalAmount)}</span></div>)}{!orders.length&&!error&&<p className="text-sm text-black/50">No orders yet.</p>}</div></div><div className="border border-black/10 bg-white p-7"><h2 className="font-serif text-3xl">Profile</h2><p className="mt-3 text-sm text-black/55">Authentication, profile, addresses, carts and wishlists are secured by Supabase RLS.</p></div></div></section>;
}
