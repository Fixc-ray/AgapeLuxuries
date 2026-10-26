import test from 'node:test';
import assert from 'node:assert/strict';
import products from '../src/data/products.json' with { type:'json' };
import { calculateQuote } from '../src/services/commerce.js';

test('uses server catalogue price and ignores client price',()=>{const quote=calculateQuote([{productId:'p1',variantId:'50ml',quantity:2,unitPrice:1}],products);assert.equal(quote.subtotal,19600);assert.equal(quote.deliveryFee,0);assert.equal(quote.totalAmount,19600)});
test('adds location-method delivery below threshold',()=>{const quote=calculateQuote([{productId:'p4',variantId:'clear',quantity:1}],products,'express');assert.equal(quote.subtotal,3000);assert.equal(quote.deliveryFee,900);assert.equal(quote.totalAmount,3900)});
test('rejects stock overage',()=>assert.throws(()=>calculateQuote([{productId:'p5',variantId:'gold',quantity:99}],products),/quantity is unavailable/));
test('applies capped percentage discounts before delivery threshold',()=>{const quote=calculateQuote([{productId:'p1',variantId:'100ml',quantity:1}],products,'standard',{type:'percentage',value:20,maxDiscount:2000});assert.equal(quote.discountAmount,2000);assert.equal(quote.deliveryFee,450);assert.equal(quote.totalAmount,13250)});
