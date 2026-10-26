import 'dotenv/config';
import { firebaseAdmin } from '../src/config/firebase.js';
const email=process.env.ADMIN_EMAIL;if(!email)throw new Error('Set ADMIN_EMAIL in the environment before running this command.');
const auth=firebaseAdmin()?.auth();if(!auth)throw new Error('Firebase Admin credentials are not configured.');
const user=await auth.getUserByEmail(email);await auth.setCustomUserClaims(user.uid,{...(user.customClaims||{}),admin:true});console.log(`Administrator claim applied to ${email}. Ask the user to sign out and in again.`);
