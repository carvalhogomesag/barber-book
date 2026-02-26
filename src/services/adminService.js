import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  addDoc
} from 'firebase/firestore';

const BARBERS_COLLECTION = 'barbers'; 
const SUBSCRIPTIONS_COLLECTION = 'subscriptions'; 
const SALESPEOPLE_COLLECTION = 'salespeople'; 
const PAYOUTS_COLLECTION = 'payouts'; 

// ==========================================
// GESTÃO DE PROFISSIONAIS (TENANTS)
// ==========================================

/**
 * Buscar todos os profissionais cadastrados no sistema
 */
export const getAllTenants = async () => {
  const q = query(collection(db, BARBERS_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Atualizar dados de um profissional
 */
export const adminUpdateTenant = async (tenantId, data) => {
  const docRef = doc(db, BARBERS_COLLECTION, tenantId);
  await updateDoc(docRef, data);
};

/**
 * Alternar Status do Profissional (Ativo/Inativo) - NOVO
 * Esta função bloqueia o acesso sem apagar os dados.
 */
export const adminToggleTenantStatus = async (tenantId, currentStatus) => {
  const docRef = doc(db, BARBERS_COLLECTION, tenantId);
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await updateDoc(docRef, { 
    status: newStatus,
    statusUpdatedAt: new Date().toISOString()
  });
};

/**
 * Deletar um profissional do sistema (Exclusão Física)
 */
export const adminDeleteTenant = async (tenantId) => {
  await deleteDoc(doc(db, BARBERS_COLLECTION, tenantId));
};

// ==========================================
// GESTÃO COMERCIAL (VENDEDORES / AFILIADOS)
// ==========================================

/**
 * Cria um novo colaborador comercial.
 */
export const createSalesperson = async (data) => {
  const newSalesRef = doc(collection(db, SALESPEOPLE_COLLECTION));
  
  const salespersonData = {
    ...data,
    role: 'sales',
    commissionRate: 0.20,
    totalEarnings: 0,   
    currentBalance: 0,  
    activeClients: 0,
    createdAt: new Date().toISOString(),
    status: 'active' // Status inicial padrão
  };

  await setDoc(newSalesRef, salespersonData);
  return { id: newSalesRef.id, ...salespersonData };
};

/**
 * Busca todos os vendedores para o painel do Admin.
 */
export const getAllSalespeople = async () => {
  const q = query(collection(db, SALESPEOPLE_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Busca todos os clientes (barbeiros) vinculados a um vendedor específico.
 */
export const getClientsBySalesperson = async (salespersonCode) => {
  const q = query(
    collection(db, BARBERS_COLLECTION), 
    where("referredBy", "==", salespersonCode)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * ATUALIZA DADOS DO VENDEDOR
 */
export const updateSalesperson = async (salesId, data) => {
  const docRef = doc(db, SALESPEOPLE_COLLECTION, salesId);
  await updateDoc(docRef, data);
};

/**
 * Alternar Status do Vendedor (Ativo/Inativo) - NOVO
 * Permite suspender um parceiro comercial imediatamente.
 */
export const adminToggleSalespersonStatus = async (salesId, currentStatus) => {
  const docRef = doc(db, SALESPEOPLE_COLLECTION, salesId);
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await updateDoc(docRef, { 
    status: newStatus,
    statusUpdatedAt: new Date().toISOString()
  });
};

/**
 * DELETAR VENDEDOR (Exclusão Física)
 */
export const adminDeleteSalesperson = async (salesId) => {
  const docRef = doc(db, SALESPEOPLE_COLLECTION, salesId);
  await deleteDoc(docRef);
};

// ==========================================
// AUTO-GESTÃO DE CONTA (USUÁRIO FINAL) - NOVO
// ==========================================

/**
 * Solicitar Encerramento de Conta
 * Usado pelo próprio Barbeiro ou Vendedor na página de Perfil.
 */
export const requestAccountClosure = async (userId, role) => {
  const collectionName = role === 'sales' ? SALESPEOPLE_COLLECTION : BARBERS_COLLECTION;
  const docRef = doc(db, collectionName, userId);
  
  await updateDoc(docRef, {
    status: 'closure_requested',
    closureRequestedAt: new Date().toISOString()
  });
};

// ==========================================
// GESTÃO DE SAQUES (PAYOUTS)
// ==========================================

export const getAllPayoutRequests = async () => {
  const q = query(collection(db, PAYOUTS_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const adminApprovePayout = async (payoutId, salespersonId, amount) => {
  const payoutRef = doc(db, PAYOUTS_COLLECTION, payoutId);
  await updateDoc(payoutRef, {
    status: 'paid',
    paidAt: new Date().toISOString()
  });
};

// ==========================================
// BUSINESS INTELLIGENCE (ASSINATURAS)
// ==========================================

export const getAllSubscriptions = async () => {
  const q = query(collection(db, SUBSCRIPTIONS_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};