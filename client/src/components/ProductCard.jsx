import { Heart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { money } from '../data/demoProducts';
import { useShop } from '../context/ShopContext';

export default function ProductCard({product}) {
  const {addToCart,toggleWishlist,wishlist}=useShop(); const saved=wishlist.includes(product.id);
  return <motion.article initial={{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.45}} className="group relative rounded-sm bg-white p-2 shadow-[0_16px_50px_rgba(24,23,19,.055)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(24,23,19,.1)] sm:p-3">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#eee8de]"><Link to={`/product/${product.slug}`}><img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"/></Link>{product.isNewArrival&&<span className="badge">New</span>}{product.salePrice&&<span className="badge bg-wine text-white">Edit price</span>}<button type="button" onClick={()=>toggleWishlist(product)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ivory/90 shadow-sm transition hover:bg-white" aria-label={saved?'Remove from wishlist':'Add to wishlist'}><Heart size={16} fill={saved?'currentColor':'none'}/></button><button type="button" onClick={()=>addToCart(product)} className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 bg-ink px-3 py-3 text-[10px] uppercase tracking-widest text-white transition sm:translate-y-16 sm:text-xs sm:group-hover:translate-y-0 sm:focus:translate-y-0">Quick add <Plus size={15}/></button></div>
    <Link to={`/product/${product.slug}`} className="block pt-4"><p className="text-[10px] uppercase tracking-[.18em] text-black/45">{product.brand}</p><h3 className="mt-1 font-serif text-xl">{product.name}</h3><div className="mt-2 flex gap-2 text-sm"><span>{money(product.salePrice||product.price)}</span>{product.salePrice&&<span className="text-black/35 line-through">{money(product.price)}</span>}</div></Link>
  </motion.article>;
}

export function ProductGrid({products}) {
  if(!products.length) return <div className="col-span-full border border-black/10 bg-white px-8 py-20 text-center"><p className="font-serif text-3xl">Nothing in this edit yet.</p><p className="mt-3 text-sm text-black/55">Try adjusting your filters or discover the full collection.</p></div>;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-7">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>;
}
