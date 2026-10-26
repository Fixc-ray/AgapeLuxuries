import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, UserRound, X, Instagram, ArrowRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';

const links = [['Men','/men'],['Women','/women'],['Fragrances','/fragrances'],['Beauty','/beauty'],['Jewellery','/jewellery'],['Gifts','/gifts'],['New arrivals','/new-arrivals']];

export default function Layout() {
  const { cartCount, wishlist } = useShop();
  const [menu,setMenu]=useState(false); const [search,setSearch]=useState(false); const [term,setTerm]=useState('');
  const location=useLocation(); const navigate=useNavigate();
  useEffect(()=>{setMenu(false);setSearch(false);window.scrollTo(0,0)},[location.pathname]);
  const submit=e=>{e.preventDefault(); if(term.trim()) navigate(`/search?q=${encodeURIComponent(term.trim())}`)};
  return <div className="min-h-screen bg-ivory text-ink">
    <a href="#content" className="skip-link">Skip to content</a>
    <div className="bg-ink px-4 py-2 text-center text-[11px] uppercase tracking-[.22em] text-ivory">Complimentary Nairobi delivery on orders over KSh 15,000</div>
    <header className="sticky top-0 z-40 border-b border-black/10 bg-ivory/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-5 lg:px-10">
        <button onClick={()=>setMenu(true)} className="icon-btn lg:hidden" aria-label="Open menu"><Menu size={20}/></button>
        <Link to="/" className="logo" aria-label="Agape Luxuries home"><span>AGAPE</span><small>LUXURIES</small></Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">{links.map(([label,to])=><NavLink key={to} to={to} className={({isActive})=>`nav-link ${isActive?'active':''}`}>{label}</NavLink>)}</nav>
        <div className="flex items-center gap-1">
          <button onClick={()=>setSearch(v=>!v)} className="icon-btn" aria-label="Search"><Search size={19}/></button>
          <Link to="/account" className="icon-btn hidden sm:grid" aria-label="Account"><UserRound size={19}/></Link>
          <Link to="/wishlist" className="icon-btn relative hidden sm:grid" aria-label={`Wishlist with ${wishlist.length} items`}><Heart size={19}/>{wishlist.length>0&&<b className="count-dot">{wishlist.length}</b>}</Link>
          <Link to="/cart" className="icon-btn relative" aria-label={`Shopping bag with ${cartCount} items`}><ShoppingBag size={19}/>{cartCount>0&&<b className="count-dot">{cartCount}</b>}</Link>
        </div>
      </div>
      {search&&<form onSubmit={submit} className="border-t border-black/10 px-5 py-5"><div className="mx-auto flex max-w-3xl items-center gap-3 border-b border-black/30"><Search size={20}/><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search fragrance, beauty, jewellery…" className="w-full bg-transparent py-3 outline-none"/><button className="text-xs uppercase tracking-widest">Search</button></div></form>}
    </header>
    {menu&&<div className="fixed inset-0 z-50 bg-ivory p-6 lg:hidden"><div className="flex items-center justify-between"><Link to="/" className="logo"><span>AGAPE</span><small>LUXURIES</small></Link><button className="icon-btn" onClick={()=>setMenu(false)}><X/></button></div><nav className="mt-14 flex flex-col">{links.map(([label,to])=><Link key={to} to={to} className="border-b border-black/10 py-5 font-serif text-4xl">{label}</Link>)}</nav><div className="mt-8 flex gap-5 text-sm"><Link to="/account">My account</Link><Link to="/wishlist">Wishlist</Link></div></div>}
    <main id="content"><Outlet/></main>
    <footer className="bg-ink text-ivory">
      <div className="mx-auto grid max-w-[1480px] gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-4 lg:px-10">
        <div><div className="logo text-ivory"><span>AGAPE</span><small>LUXURIES</small></div><p className="mt-6 max-w-xs text-sm leading-7 text-white/60">Objects of beauty, chosen with intention. Fragrance, adornment and gifts delivered across Kenya.</p></div>
        <div><h3 className="footer-title">Discover</h3><div className="footer-links"><Link to="/new-arrivals">New arrivals</Link><Link to="/best-sellers">Best sellers</Link><Link to="/gifts">The gift edit</Link><Link to="/fragrances">Fragrance wardrobe</Link></div></div>
        <div><h3 className="footer-title">Client care</h3><div className="footer-links"><Link to="/delivery">Delivery & returns</Link><Link to="/contact">Contact us</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></div>
        <div><h3 className="footer-title">Visit & connect</h3><p className="text-sm leading-7 text-white/60">Nairobi, Kenya<br/>+254 700 000 000<br/>hello@agapeluxuries.co.ke</p><a className="mt-5 inline-flex items-center gap-2 text-sm" href="https://instagram.com" rel="noreferrer"><Instagram size={17}/>Instagram</a></div>
      </div><div className="border-t border-white/10 px-6 py-5 text-center text-[11px] tracking-widest text-white/40">© 2026 AGAPE LUXURIES · KENYA</div>
    </footer>
  </div>;
}

export function Newsletter() {
  const [email,setEmail]=useState(''); const [done,setDone]=useState(false);
  const submit=e=>{e.preventDefault();if(email){setDone(true);setEmail('')}};
  return <section className="bg-sand px-6 py-20 text-center"><p className="eyebrow">Private list</p><h2 className="section-title mx-auto max-w-2xl">A more considered inbox.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-black/60">New edits, private offers and thoughtful gifting inspiration — sent sparingly.</p>{done?<p className="mt-7 text-sm">Welcome to the private list.</p>:<form onSubmit={submit} className="mx-auto mt-8 flex max-w-lg border-b border-black/40"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-transparent py-4 outline-none" placeholder="Email address"/><button aria-label="Subscribe"><ArrowRight/></button></form>}</section>
}
