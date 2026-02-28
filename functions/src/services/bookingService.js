const admin = require("firebase-admin");

/**
 * MÁQUINA DE ESTADOS FORMAL (Enterprise Spec)
 * Harmonizada para aceitar o status do Dashboard ('scheduled') e o Enterprise ('CONFIRMED')
 */
const BOOKING_STATES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SCHEDULED: 'scheduled', // Status nativo do Dashboard Visual
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

/**
 * REGRAS DE TRANSIÇÃO DE ESTADO (Princípio 3)
 */
const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING]: [BOOKING_STATES.CONFIRMED, BOOKING_STATES.SCHEDULED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.CONFIRMED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.SCHEDULED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.CANCELLED]: [], 
  [BOOKING_STATES.COMPLETED]: []  
};

/**
 * SERVIÇO DETERMINÍSTICO DE AGENDAMENTOS
 */
const bookingService = {
  
  /**
   * INVARIANTE: Consulta Firestore antes de qualquer resposta da IA.
   * Lógica de busca híbrida (Telefone -> Nome) e Harmonização de Status.
   */
  async checkBookingStatus(barberId, clientPhone, clientName = null) {
    if (!barberId || !clientPhone) {
      return { exists: false, state: null };
    }

    try {
      const db = admin.firestore();
      const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
      
      // Lista de status que o sistema considera como "Agendamento Ativo"
      const activeStatusList = [
        BOOKING_STATES.CONFIRMED, 
        BOOKING_STATES.SCHEDULED, 
        BOOKING_STATES.PENDING
      ];

      // 1. TENTATIVA A: Busca por Telefone (Prioridade)
      let snapshot = await appointmentsRef
        .where("clientPhone", "==", clientPhone)
        .where("status", "in", activeStatusList)
        .orderBy("startTime", "desc")
        .limit(1)
        .get();

      // 2. TENTATIVA B: Fallback por Nome (Garante que agendamentos manuais sejam vistos)
      if (snapshot.empty && clientName && clientName !== "UNKNOWN") {
        console.log(`[BookingService] Buscando por Nome: ${clientName}`);
        snapshot = await appointmentsRef
          .where("clientName", "==", clientName)
          .where("status", "in", activeStatusList)
          .orderBy("startTime", "desc")
          .limit(1)
          .get();
      }

      if (snapshot.empty) {
        return { exists: false, state: null, data: null };
      }

      const bookingDoc = snapshot.docs[0];
      const bookingData = bookingDoc.data();

      // Retorno estruturado para o Princípio de Isolamento do LLM
      return {
        exists: true,
        bookingId: bookingDoc.id,
        state: bookingData.status,
        data: {
          service: bookingData.serviceName,
          time: bookingData.startTime, // ISO-8601
          price: bookingData.price,
          clientName: bookingData.clientName
        }
      };
    } catch (error) {
      console.error("[CRITICAL] BookingService Database Error:", error);
      throw error; 
    }
  },

  /**
   * VALIDAÇÃO DE TRANSIÇÃO
   */
  validateTransition(currentState, nextState) {
    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(nextState)) {
      console.error(`[TRANSITION_ERROR] Transition ${currentState} -> ${nextState} is blocked by business rules.`);
      return false;
    }
    return true;
  }
};

module.exports = { bookingService, BOOKING_STATES };