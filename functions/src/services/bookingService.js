const admin = require("firebase-admin");

/**
 * functions/src/services/bookingService.js
 * Máquina de Estados e Serviço de Consulta Determinística (Read-Before-Respond)
 */

const BOOKING_STATES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SCHEDULED: 'scheduled', // Status nativo do Dashboard (Drag & Drop)
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

/**
 * REGRAS DE TRANSIÇÃO (Business Continuity)
 */
const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING]: [BOOKING_STATES.CONFIRMED, BOOKING_STATES.SCHEDULED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.CONFIRMED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.SCHEDULED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.CANCELLED]: [], 
  [BOOKING_STATES.COMPLETED]: []  
};

const bookingService = {
  
  /**
   * CONSULTA DE ESTADO ATUAL (A Verdade do Banco de Dados)
   * Esta função é o "Cérebro de Memória" que cura a amnésia da IA.
   */
  async checkBookingStatus(barberId, clientPhone, clientName = null) {
    if (!barberId || !clientPhone) {
      return { exists: false, state: null };
    }

    try {
      const db = admin.firestore();
      const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
      
      // Status considerados "Ativos" para fins de conversação atual
      const activeStatusList = [
        BOOKING_STATES.CONFIRMED, 
        BOOKING_STATES.SCHEDULED, 
        BOOKING_STATES.PENDING
      ];

      // Filtramos apenas agendamentos de HOJE para o futuro para evitar confusão com histórico antigo
      const todayISO = new Date().toISOString().split('T')[0];

      // 1. TENTATIVA A: Busca por Telefone (Chave Primária do WhatsApp)
      let snapshot = await appointmentsRef
        .where("clientPhone", "==", clientPhone)
        .where("status", "in", activeStatusList)
        .where("startTime", ">=", todayISO)
        .orderBy("startTime", "asc") // O mais próximo primeiro
        .limit(1)
        .get();

      // 2. TENTATIVA B: Fallback por Nome (Para agendamentos manuais via Dashboard)
      if (snapshot.empty && clientName && clientName !== "UNKNOWN") {
        snapshot = await appointmentsRef
          .where("clientName", "==", clientName)
          .where("status", "in", activeStatusList)
          .where("startTime", ">=", todayISO)
          .orderBy("startTime", "asc")
          .limit(1)
          .get();
      }

      if (snapshot.empty) {
        return { exists: false, state: 'NO_ACTIVE_BOOKING', data: null };
      }

      const bookingDoc = snapshot.docs[0];
      const data = bookingDoc.data();

      // Retorno formatado para injeção direta no Prompt do Gemini
      return {
        exists: true,
        bookingId: bookingDoc.id,
        state: data.status,
        data: {
          service: data.serviceName,
          time: data.startTime, // Ex: 2026-02-28T14:00:00
          price: data.price,
          clientName: data.clientName
        }
      };
    } catch (error) {
      console.error("[CRITICAL] BookingService Database Error:", error);
      // Em caso de erro, retornamos estado neutro para não travar o bot
      return { exists: false, state: 'ERROR', data: null };
    }
  },

  /**
   * VALIDAÇÃO DE FLUXO (Evita que a IA tente "cancelar um cancelado")
   */
  validateTransition(currentState, nextState) {
    const allowed = VALID_TRANSITIONS[currentState] || [];
    return allowed.includes(nextState);
  }
};

module.exports = { bookingService, BOOKING_STATES };