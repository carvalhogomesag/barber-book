import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  addDoc,
  query, 
  where, 
  orderBy,
  increment 
} from 'firebase/firestore';

const SALESPEOPLE_COLLECTION = 'salespeople';
const BARBERS_COLLECTION = 'barbers';
const PAYOUTS_COLLECTION = 'payouts';

/**
 * BUSCA O PERFIL DO VENDEDOR
 */
export const getSalespersonProfile = async (uid) => {
  try {
    const docRef = doc(db, SALESPEOPLE_COLLECTION, uid);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching sales profile:", error);
    throw error;
  }
};

/**
 * CRM DO VENDEDOR: BUSCA TODOS OS CLIENTES VINCULADOS
 */
export const getMyReferralClients = async (referralCode) => {
  try {
    if (!referralCode) return [];

    const q = query(
      collection(db, BARBERS_COLLECTION),
      where("referredBy", "==", referralCode),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching referral clients:", error);
    return [];
  }
};

/**
 * PROCESSA DADOS PARA O BI ANALYTICS (NOVO)
 * Organiza o crescimento por mês e a distribuição por país.
 */
export const getSalesAnalytics = (clients) => {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // 1. Inicializa os últimos 6 meses com valor zero
  const growthData = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
    growthData[label] = 0;
  }

  // 2. Distribuição por País
  const countryData = {};

  clients.forEach(client => {
    if (!client.createdAt) return;
    
    const date = new Date(client.createdAt);
    const label = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
    
    // Contabiliza no gráfico de crescimento se estiver no intervalo de 6 meses
    if (growthData[label] !== undefined) {
      growthData[label]++;
    }

    // Contabiliza no ranking de países
    const country = client.country || 'Unknown';
    countryData[country] = (countryData[country] || 0) + 1;
  });

  return {
    growth: Object.entries(growthData).map(([name, value]) => ({ name, value })),
    countries: Object.entries(countryData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value) // Ordena do país com mais clientes para o menos
  };
};

/**
 * SOLICITAR SAQUE (WITHDRAWAL)
 */
export const requestWithdrawal = async (uid, amount, paymentInfo) => {
  try {
    const salesRef = doc(db, SALESPEOPLE_COLLECTION, uid);
    const salesSnap = await getDoc(salesRef);
    const currentBalance = salesSnap.data().currentBalance || 0;

    if (amount > currentBalance) {
      throw new Error("Insufficient balance for this withdrawal.");
    }

    if (amount < 10) {
      throw new Error("Minimum withdrawal amount is $10.00");
    }

    await addDoc(collection(db, PAYOUTS_COLLECTION), {
      salespersonId: uid,
      salespersonName: salesSnap.data().name,
      amount: amount,
      paymentInfo: paymentInfo,
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    await updateDoc(salesRef, {
      currentBalance: increment(-amount)
    });

    return { success: true };
  } catch (error) {
    console.error("Withdrawal Error:", error);
    throw error;
  }
};

/**
 * BUSCA HISTÓRICO DE SAQUES DO VENDEDOR
 */
export const getMyPayoutHistory = async (uid) => {
  try {
    const q = query(
      collection(db, PAYOUTS_COLLECTION),
      where("salespersonId", "==", uid),
      orderBy("requestedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching payout history:", error);
    return [];
  }
};

/**
 * CALCULA ESTATÍSTICAS DE COMISSÃO
 */
export const calculateSalesStats = (clients) => {
  const stats = {
    total: clients.length,
    trialing: 0,
    activePro: 0,
    potentialMonthly: 0,
    currentMonthly: 0
  };

  clients.forEach(client => {
    // Preços baseados na estratégia internacional definida no contexto
    const price = client.country === 'BR' ? 97 : 29;
    
    if (client.plan === 'pro') {
      if (client.subscriptionStatus === 'trialing') {
        stats.trialing++;
      } else {
        stats.activePro++;
        stats.currentMonthly += (price * 0.20);
      }
      stats.potentialMonthly += (price * 0.20);
    }
  });

  return stats;
};