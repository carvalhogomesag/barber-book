import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAXgcYUT1D-bK-AFjMgA_Q6ceBFmc0AtDQ",
  authDomain: "barber-book-d4a5a.firebaseapp.com",
  projectId: "barber-book-d4a5a",
  storageBucket: "barber-book-d4a5a.firebasestorage.app",
  messagingSenderId: "18598107835",
  appId: "1:18598107835:web:30d12d855328a880afa79e"
};

// 1. Inicializa o App
const app = initializeApp(firebaseConfig);

// 2. Exporta o app e os serviços
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export { app }; // <--- ESSA LINHA É CRUCIAL