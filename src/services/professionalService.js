// Importamos as instâncias JÁ INICIALIZADAS do firebase.js
import { db, auth, functions } from './firebase'; 
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc, 
  setDoc,
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
// Importamos utilitários de data para a lógica de bloqueio recorrente
import { addDays, addWeeks, addMonths, parseISO, formatISO } from 'date-fns';

const BARBERS_COLLECTION = 'barbers';

// ==========================================
// SERVIÇOS (Catálogo de Preços e Duração)
// ==========================================
export const addService = async (serviceData) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const servicesRef = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'services');
  const docRef = await addDoc(servicesRef, { ...serviceData, createdAt: new Date().toISOString() });
  return { id: docRef.id, ...serviceData };
};

export const getServices = async () => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const servicesRef = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'services');
  const q = query(servicesRef, orderBy("name", "asc")); 
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateService = async (serviceId, serviceData) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const serviceRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'services', serviceId);
  await updateDoc(serviceRef, { 
    ...serviceData, 
    updatedAt: new Date().toISOString() 
  });
};

export const deleteService = async (serviceId) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  await deleteDoc(doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'services', serviceId));
};

// ==========================================
// AGENDAMENTOS E BLOQUEIOS
// ==========================================
export const addAppointment = async (appointmentData) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const ref = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments');
  const docRef = await addDoc(ref, { 
    ...appointmentData, 
    createdAt: new Date().toISOString() 
  });
  return { id: docRef.id, ...appointmentData };
};

/**
 * BLOQUEAR AGENDA (Com suporte a recorrência)
 */
export const addBlockedTime = async (blockData) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const { startTime, duration, notes, recurrence, occurrences } = blockData;
  const ref = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments');

  const promises = [];
  let currentStart = parseISO(startTime);
  const numOccurrences = parseInt(occurrences) || 1;

  for (let i = 0; i < numOccurrences; i++) {
    const blockEntry = {
      type: "block",
      status: "blocked",
      clientName: "🚫 SCHEDULE BLOCKED",
      serviceName: "Personal Time / Break",
      startTime: formatISO(currentStart),
      duration: parseInt(duration),
      notes: notes || "",
      createdAt: new Date().toISOString()
    };

    promises.push(addDoc(ref, blockEntry));

    if (recurrence === 'daily') currentStart = addDays(currentStart, 1);
    else if (recurrence === 'weekly') currentStart = addWeeks(currentStart, 1);
    else if (recurrence === 'monthly') currentStart = addMonths(currentStart, 1);
    else break;
  }

  return await Promise.all(promises);
};

export const getAppointments = async () => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const ref = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments');
  const q = query(ref, orderBy("startTime", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateAppointmentTime = async (appointmentId, newStartTime) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const docRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments', appointmentId);
  await updateDoc(docRef, { startTime: newStartTime });
};

export const updateAppointmentFull = async (appointmentId, data) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const docRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments', appointmentId);
  await updateDoc(docRef, data);
};

export const deleteAppointment = async (appointmentId) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  await deleteDoc(doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'appointments', appointmentId));
};

// ==========================================
// CLIENTES (CRM - Gestão de Relacionamento)
// ==========================================
export const getCustomers = async () => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const customersRef = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'customers');
  const q = query(customersRef, orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateCustomer = async (customerId, data) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const customerRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'customers', customerId);
  await updateDoc(customerRef, { ...data, updatedAt: new Date().toISOString() });
};

export const deleteCustomer = async (customerId) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  await deleteDoc(doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'customers', customerId));
};

// ==========================================
// MENSAGENS (Live Chat - Real-time)
// ==========================================
export const listenToChats = (callback) => {
  if (!auth.currentUser) return;
  const chatsRef = collection(db, BARBERS_COLLECTION, auth.currentUser.uid, 'chats');
  const q = query(chatsRef, orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    callback(chats);
  });
};

export const listenToSingleChat = (chatId, callback) => {
  if (!auth.currentUser) return;
  const chatRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid, 'chats', chatId);
  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) callback(doc.data());
  });
};

// ==========================================
// PERFIL DO PROFISSIONAL E SISTEMA
// ==========================================
export const getProfessionalProfile = async () => {
  if (!auth.currentUser) return null;
  const docRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const updateProfessionalProfile = async (profileData) => {
  if (!auth.currentUser) throw new Error("User not logged in");
  const docRef = doc(db, BARBERS_COLLECTION, auth.currentUser.uid);
  await setDoc(docRef, profileData, { merge: true });
};

// ==========================================
// FATURAMENTO E PORTAL STRIPE (BILLING)
// ==========================================

/**
 * Gera uma sessão para o Stripe Customer Portal.
 * Permite gerenciar métodos de pagamento e assinaturas.
 */
export const createStripePortalSession = async () => {
  if (!auth.currentUser) throw new Error("Login required");
  try {
    const portalFn = httpsCallable(functions, 'createStripePortalSession');
    const result = await portalFn({});
    return result.data; // Retorna { url: '...' }
  } catch (error) {
    console.error("Stripe Portal Error:", error);
    throw error;
  }
};

// ==========================================
// ATIVAÇÃO DO CONCIERGE (PRO PLAN)
// ==========================================
export const provisionConciergeNumber = async () => {
  if (!auth.currentUser) throw new Error("Login required");
  try {
    await auth.currentUser.getIdToken(true);
    const provisionNumberFn = httpsCallable(functions, 'provisionNumber');
    const result = await provisionNumberFn({});
    return result.data;
  } catch (error) {
    console.error("Schedy Activation Error:", error);
    throw error;
  }
};