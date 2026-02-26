import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; // Adicionei getDoc
import { auth, db } from '../services/firebase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Limpa qualquer ouvinte anterior ao trocar de usuário
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (currentUser) {
        try {
            // 1. Verifica se é um Barbeiro
            const barberRef = doc(db, 'barbers', currentUser.uid);
            const barberDoc = await getDoc(barberRef);

            if (barberDoc.exists()) {
                // Conecta o monitoramento em tempo real
                unsubscribeSnapshot = onSnapshot(barberRef, (docSnap) => {
                    const data = docSnap.data();
                    if (data?.status === 'inactive') {
                        signOut(auth);
                        alert("Your account is inactive.");
                    } else {
                        setProfile({ id: docSnap.id, ...data });
                    }
                    setLoading(false);
                });
                return; // Encerra aqui, pois já achou
            }

            // 2. Verifica se é um Vendedor
            const salesRef = doc(db, 'salespeople', currentUser.uid);
            const salesDoc = await getDoc(salesRef);

            if (salesDoc.exists()) {
                // Conecta o monitoramento em tempo real
                unsubscribeSnapshot = onSnapshot(salesRef, (docSnap) => {
                    const data = docSnap.data();
                    if (data?.status === 'inactive') {
                        signOut(auth);
                        alert("Partner account suspended.");
                    } else {
                        setProfile({ id: docSnap.id, ...data });
                    }
                    setLoading(false);
                });
                return; // Encerra aqui
            }

            // 3. Se chegou aqui, não existe perfil (Conta Fantasma)
            console.warn("Security: No profile found for user. Signing out.");
            await signOut(auth);
            setProfile(null);
            setLoading(false);

        } catch (error) {
            console.error("Auth Error:", error);
            setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-barber-dark flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-barber-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-barber-gray text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
          Securing Session...
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);