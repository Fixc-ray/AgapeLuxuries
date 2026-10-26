import admin from 'firebase-admin';
let app=null;
export function firebaseAdmin(){if(app)return app;const{FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;if(!FIREBASE_PROJECT_ID)return null;const credential=FIREBASE_CLIENT_EMAIL&&FIREBASE_PRIVATE_KEY?admin.credential.cert({projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}):admin.credential.applicationDefault();app=admin.initializeApp({credential,projectId:FIREBASE_PROJECT_ID});return app}
export function db(){const instance=firebaseAdmin();return instance?admin.firestore(instance):null}
export{admin};
