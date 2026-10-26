import 'dotenv/config';
import products from '../src/data/products.json' with { type:'json' };
import { db, admin } from '../src/config/firebase.js';
const firestore=db();if(!firestore)throw new Error('FIREBASE_PROJECT_ID and server credentials are required.');
const batch=firestore.batch();for(const product of products){const ref=firestore.collection('products').doc(product.id);batch.set(ref,{...product,createdAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true})}await batch.commit();console.log(`Seeded ${products.length} products.`);
