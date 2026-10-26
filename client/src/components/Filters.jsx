import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

export default function Filters({filters,setFilters,count}) {
  const [open,setOpen]=useState(false);
  const content=<><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[.2em]">Refine</p><button className="lg:hidden" onClick={()=>setOpen(false)}><X/></button></div>{[['Gender',['all','men','women','unisex']],['Category',['all','fragrances','beauty','jewellery','accessories','gifts']]].map(([title,items])=><fieldset key={title} className="mt-8 border-t border-black/10 pt-6"><legend className="font-serif text-xl">{title}</legend><div className="mt-4 space-y-3">{items.map(item=><label key={item} className="flex cursor-pointer items-center gap-3 text-sm capitalize"><input type="radio" name={title} checked={filters[title.toLowerCase()]===item} onChange={()=>setFilters(f=>({...f,[title.toLowerCase()]:item}))}/>{item}</label>)}</div></fieldset>)}</>;
  return <><button onClick={()=>setOpen(true)} className="mb-5 flex items-center gap-2 border border-black/20 px-4 py-3 text-xs uppercase tracking-widest lg:hidden"><SlidersHorizontal size={16}/>Filter · {count}</button><aside className="hidden lg:block">{content}</aside>{open&&<div className="fixed inset-0 z-50 overflow-y-auto bg-ivory p-7 lg:hidden">{content}<button onClick={()=>setOpen(false)} className="btn-dark mt-10 w-full">View {count} products</button></div>}</>;
}
