import 'dotenv/config';
import { requireSupabaseAdmin } from '../src/config/supabase.js';
const email=process.env.ADMIN_EMAIL;if(!email)throw new Error('Set ADMIN_EMAIL in the environment before running this command.');
const auth=requireSupabaseAdmin().auth.admin;
let user=null;
for(let page=1;page<=20&&!user;page+=1){const{data,error}=await auth.listUsers({page,perPage:100});if(error)throw error;user=data.users.find(candidate=>candidate.email?.toLowerCase()===email.toLowerCase());if(data.users.length<100)break;}
if(!user)throw new Error(`No Supabase user found for ${email}. Register the account first.`);
const{error}=await auth.updateUserById(user.id,{app_metadata:{...user.app_metadata,role:'admin'}});if(error)throw error;
console.log(`Administrator role applied to ${email}. Ask the user to sign out and in again.`);
