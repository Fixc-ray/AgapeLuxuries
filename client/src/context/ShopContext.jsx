import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { demoProducts } from '../data/demoProducts';
import { api } from '../services/api';

const ShopContext = createContext(null);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

export function ShopProvider({ children }) {
  const [products, setProducts] = useState(demoProducts);
  const [cart, setCart] = useState(() => read('agape_cart', []));
  const [wishlist, setWishlist] = useState(() => read('agape_wishlist', []));
  const [toast, setToast] = useState('');

  useEffect(() => {
    let active = true;
    api.products().then(({products: remote}) => {
      if (!active || !Array.isArray(remote) || !remote.length) return;
      setProducts(remote.map(product => ({
        ...(demoProducts.find(seed => seed.id === product.id) || {}),
        ...product,
        images: product.images?.length ? product.images : [product.image]
      })));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => localStorage.setItem('agape_cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('agape_wishlist', JSON.stringify(wishlist)), [wishlist]);
  useEffect(() => { if (!toast) return; const t=setTimeout(()=>setToast(''),2600); return()=>clearTimeout(t); },[toast]);

  const addToCart = (product, variant = product.variants[0], quantity = 1) => {
    const key = `${product.id}:${variant.id}`;
    setCart(items => items.some(i=>i.key===key)
      ? items.map(i=>i.key===key ? {...i,quantity:Math.min(i.quantity+quantity,variant.stock)} : i)
      : [...items,{key,productId:product.id,slug:product.slug,name:product.name,image:product.image,variantId:variant.id,variantLabel:variant.label,sku:variant.sku,unitPrice:variant.price,quantity,stock:variant.stock}]);
    setToast(`${product.name} added to your bag`);
  };
  const updateQuantity = (key, quantity) => setCart(items => items.map(i=>i.key===key?{...i,quantity:Math.max(1,Math.min(quantity,i.stock))}:i));
  const removeFromCart = key => setCart(items => items.filter(i=>i.key!==key));
  const toggleWishlist = product => setWishlist(items => items.includes(product.id)?items.filter(id=>id!==product.id):[...items,product.id]);
  const cartCount = cart.reduce((n,i)=>n+i.quantity,0);
  const subtotal = cart.reduce((n,i)=>n+i.unitPrice*i.quantity,0);
  const value = useMemo(()=>({products,setProducts,cart,setCart,wishlist,addToCart,updateQuantity,removeFromCart,toggleWishlist,cartCount,subtotal,setToast}),[products,cart,wishlist,cartCount,subtotal]);
  return <ShopContext.Provider value={value}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
