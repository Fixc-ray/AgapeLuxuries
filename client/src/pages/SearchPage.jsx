import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../components/ProductCard';
import { useShop } from '../context/ShopContext';
export default function SearchPage(){const[params,setParams]=useSearchParams();const q=params.get('q')||'';const{products}=useShop();const matches=useMemo(()=>products.filter(p=>JSON.stringify(p).toLowerCase().includes(q.toLowerCase())),[products,q]);return <section className="mx-auto min-h-[70vh] max-w-[1480px] px-6 py-16 lg:px-10"><p className="eyebrow">Search the collection</p><form className="mt-5 flex max-w-3xl items-center border-b border-black/30" onSubmit={e=>{e.preventDefault();setParams({q:e.currentTarget.q.value})}}><Search/><input name="q" defaultValue={q} className="w-full bg-transparent px-4 py-5 font-serif text-3xl outline-none" placeholder="What are you looking for?"/></form><p className="my-10 text-sm text-black/55">{q?`${matches.length} result${matches.length===1?'':'s'} for “${q}”`:'Begin typing to discover something beautiful.'}</p><ProductGrid products={q?matches:[]}/></section>}
