import { Heart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { money } from '../data/demoProducts';
import { useShop } from '../context/ShopContext';

export default function ProductCard({product}) {
  const {addToCart,toggleWishlist,wishlist}=useShop(); const saved=wishlist.includes(product.id);
  return <motion.article initial={{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.45}} className="group relative">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#eee8de]"><Link to={`/product/${product.slug}`}><img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"/></Link>{product.isNewArrival&&<span className="badge">New</span>}{product.salePrice&&<span className="badge bg-wine text-white">Edit price</span>}<button onClick={()=>toggleWishlist(product)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ivory/90" aria-label={saved?'Remove from wishlist':'Add to wishlist'}><Heart size={16} fill={saved?'currentColor':'none'}/></button><button onClick={()=>addToCart(product)} className="absolute bottom-3 left-3 right-3 flex translate-y-16 items-center justify-center gap-2 bg-ink px-4 py-3 text-xs uppercase tracking-widest text-white transition group-hover:translate-y-0 focus:translate-y-0">Quick add <Plus size={15}/></button></div>
    <Link to={`/product/${product.slug}`} className="block pt-4"><p className="text-[10px] uppercase tracking-[.18em] text-black/45">{product.brand}</p><h3 className="mt-1 font-serif text-xl">{product.name}</h3><div className="mt-2 flex gap-2 text-sm"><span>{money(product.salePrice||product.price)}</span>{product.salePrice&&<span className="text-black/35 line-through">{money(product.price)}</span>}</div></Link>
  </motion.article>;
}

export function ProductGrid({products}) {
  if(!products.length) return <div className="col-span-full border border-black/10 bg-white px-8 py-20 text-center"><p className="font-serif text-3xl">Nothing in this edit yet.</p><p className="mt-3 text-sm text-black/55">Try adjusting your filters or discover the full collection.</p></div>;
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-7">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>;
}
