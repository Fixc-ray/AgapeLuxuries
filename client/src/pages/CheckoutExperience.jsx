import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, Check, LockKeyhole, MapPin, Smartphone, Store, Truck, Zap } from 'lucide-react';
import { money } from '../data/demoProducts';
import { useShop } from '../context/ShopContext';
import { api } from '../services/api';

const schema=z.object({
  name:z.string().min(2,'Enter your full name'),email:z.string().email('Enter a valid email address'),
  phone:z.string().regex(/^(?:\+254|0)[17]\d{8}$/,'Enter a valid Kenyan phone number'),
  address:z.string().max(300).optional().default(''),county:z.string().max(100).optional().default(''),town:z.string().max(100).optional().default(''),
  instructions:z.string().max(500).optional(),deliveryMethod:z.enum(['standard','express','pickup']),paymentMethod:z.enum(['mpesa','cod'])
}).superRefine((value,ctx)=>{
  if(value.deliveryMethod==='pickup')return;
  if(value.address.trim().length<5)ctx.addIssue({code:'custom',path:['address'],message:'Enter a complete delivery address'});
  if(value.county.trim().length<2)ctx.addIssue({code:'custom',path:['county'],message:'Enter the delivery county'});
  if(value.town.trim().length<2)ctx.addIssue({code:'custom',path:['town'],message:'Enter the town or area'});
});

const deliveryOptions=[
  {value:'standard',icon:Truck,title:'Standard delivery',detail:'2–4 business days across Kenya'},
  {value:'express',icon:Zap,title:'Express Nairobi',detail:'Same or next business day'},
  {value:'pickup',icon:Store,title:'Collect in Nairobi',detail:'Pickup location confirmed with your order'}
];

export default function CheckoutExperience(){
  const{cart,subtotal,setCart}=useShop();const navigate=useNavigate();const[quote,setQuote]=useState({subtotal,discountAmount:0,deliveryFee:450,totalAmount:subtotal+450});const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  const{register,handleSubmit,watch,formState:{errors}}=useForm({resolver:zodResolver(schema),defaultValues:{name:'',email:'',phone:'',address:'',county:'',town:'',instructions:'',deliveryMethod:'standard',paymentMethod:'mpesa'}});
  const deliveryMethod=watch('deliveryMethod');
  useEffect(()=>{let active=true;if(!cart.length)return()=>{active=false};api.quote({items:cart,deliveryMethod}).then(result=>{if(active)setQuote(result)}).catch(()=>{});return()=>{active=false}},[cart,deliveryMethod]);
  if(!cart.length)return <section className="grid min-h-[65vh] place-items-center px-6 text-center"><div><p className="eyebrow text-gold">Your selection</p><h1 className="mt-4 font-serif text-5xl">Your bag is empty.</h1><Link to="/" className="btn-dark mt-8">Return to shop</Link></div></section>;
  const submit=async data=>{setBusy(true);setError('');try{const order=await api.order({customer:data,items:cart,deliveryMethod:data.deliveryMethod,paymentMethod:data.paymentMethod},crypto.randomUUID());setCart([]);navigate(`/order-success/${order.orderId}`,{state:order})}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <section className="checkout-shell"><div className="mx-auto max-w-[1260px] px-5 py-10 lg:px-10 lg:py-16"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow text-gold">Secure checkout</p><h1 className="mt-3 font-serif text-5xl md:text-6xl">Complete your order.</h1><p className="mt-3 max-w-xl text-sm leading-7 text-black/55">Choose delivery or collection, confirm your details, then approve payment securely.</p></div><div className="flex items-center gap-2 border border-black/10 bg-white px-4 py-3 text-xs text-black/55"><LockKeyhole size={15}/>Encrypted and server verified</div></div>
    <form onSubmit={handleSubmit(submit)} className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <CheckoutCard number="01" title="How should we get it to you?">
          <div className="grid gap-3 md:grid-cols-3">{deliveryOptions.map(({value,icon:Icon,title,detail})=><label className="choice-card" key={value}><input type="radio" value={value} {...register('deliveryMethod')}/><span className="choice-icon"><Icon size={19}/></span><span><b>{title}</b><small>{detail}</small></span><Check className="choice-check" size={15}/></label>)}</div>
        </CheckoutCard>
        <CheckoutCard number="02" title="Contact details">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" error={errors.name}><input {...register('name')} autoComplete="name" className="field"/></Field><Field label="Email address" error={errors.email}><input {...register('email')} type="email" autoComplete="email" className="field"/></Field><Field label="Kenyan phone number" error={errors.phone} wide><input {...register('phone')} autoComplete="tel" placeholder="0712 345 678" className="field"/></Field></div>
        </CheckoutCard>
        <CheckoutCard number="03" title={deliveryMethod==='pickup'?'Collection details':'Delivery address'}>
          {deliveryMethod==='pickup'?<div className="pickup-note"><Store size={22}/><div><b>Agape Luxuries Nairobi collection point</b><p>We’ll confirm the exact collection point and readiness time using your phone and email. No delivery address is required.</p></div></div>:<div className="grid gap-4 sm:grid-cols-2"><Field label="County" error={errors.county}><input {...register('county')} autoComplete="address-level1" className="field"/></Field><Field label="Town / area" error={errors.town}><input {...register('town')} autoComplete="address-level2" className="field"/></Field><Field label="Street, building or landmark" error={errors.address} wide><input {...register('address')} autoComplete="street-address" className="field"/></Field></div>}
          <div className="mt-4"><Field label={deliveryMethod==='pickup'?'Collection notes (optional)':'Delivery instructions (optional)'}><textarea {...register('instructions')} className="field min-h-24"/></Field></div>
        </CheckoutCard>
        <CheckoutCard number="04" title="Payment method">
          <div className="grid gap-3 sm:grid-cols-2"><PaymentChoice register={register} value="mpesa" icon={Smartphone} title="M-Pesa STK Push" detail="Approve on your phone"/><PaymentChoice register={register} value="cod" icon={Banknote} title="Cash on delivery" detail="Where store settings allow"/></div>
        </CheckoutCard>
        {error?<p className="border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>:null}
      </div>
      <aside className="order-summary lg:sticky lg:top-28"><p className="eyebrow text-gold">Order summary</p><h2 className="mt-2 font-serif text-3xl">Your selection</h2><div className="mt-6 max-h-80 space-y-5 overflow-auto pr-1">{cart.map(item=><div key={item.key} className="flex gap-4"><img src={item.image} alt="" className="h-20 w-16 bg-sand object-cover"/><div className="min-w-0 flex-1"><p className="truncate font-serif text-lg">{item.name}</p><p className="mt-1 text-xs text-black/45">{item.variantLabel} · Quantity {item.quantity}</p></div><span className="text-sm">{money(item.unitPrice*item.quantity)}</span></div>)}</div><div className="mt-7 space-y-3 border-t border-black/10 pt-6 text-sm"><PriceLine label="Subtotal" value={money(quote.subtotal)}/><PriceLine label={deliveryMethod==='pickup'?'Collection':'Delivery'} value={quote.deliveryFee?money(quote.deliveryFee):'KSh 0'}/>{quote.discountAmount>0?<PriceLine label="Savings" value={`−${money(quote.discountAmount)}`}/>:null}<div className="flex items-end justify-between border-t border-black/10 pt-5"><span className="font-medium">Total</span><strong className="font-serif text-3xl font-normal">{money(quote.totalAmount)}</strong></div></div><button disabled={busy} className="btn-dark mt-7 w-full disabled:cursor-wait disabled:opacity-50">{busy?'Securing your order…':'Place order securely'}</button><p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-black/45"><MapPin className="mt-0.5 shrink-0" size={13}/>{deliveryMethod==='pickup'?'This order will include the confirmed Nairobi pickup location.':'This order cannot be placed without a complete delivery address.'}</p>
      </aside>
    </form></div></section>;
}

function CheckoutCard({number,title,children}){return <fieldset className="checkout-card"><legend className="sr-only">{title}</legend><div className="mb-6 flex items-center gap-4"><span className="step-number">{number}</span><h2 className="font-serif text-2xl sm:text-3xl">{title}</h2></div>{children}</fieldset>}
function Field({label,error,wide=false,children}){return <label className={wide?'sm:col-span-2':''}><span className="field-label">{label}</span>{children}{error?<small className="mt-1 block text-red-700">{error.message}</small>:null}</label>}
function PaymentChoice({register,value,icon:Icon,title,detail}){return <label className="choice-card"><input type="radio" value={value} {...register('paymentMethod')}/><span className="choice-icon"><Icon size={19}/></span><span><b>{title}</b><small>{detail}</small></span><Check className="choice-check" size={15}/></label>}
function PriceLine({label,value}){return <div className="flex justify-between"><span className="text-black/55">{label}</span><span>{value}</span></div>}
