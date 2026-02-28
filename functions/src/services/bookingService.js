const admin = require("firebase-admin");

/**
 * MÁQUINA DE ESTADOS FORMAL (Enterprise Spec)
 */
const BOOKING_STATES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

/**
 * REGRAS DE TRANSIÇÃO DE ESTADO (Princípio 3)
 */
const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING]: [BOOKING_STATES.CONFIRMED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.CONFIRMED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.CANCELLED]: [], 
  [BOOKING_STATES.COMPLETED]: []  
};

/**
 * SERVIÇO DETERMINÍSTICO DE AGENDAMENTOS
 */
const bookingService = {
  
  /**
   * INVARIANTE: Consulta Firestore antes de qualquer resposta da IA.
   * Lógica de busca híbrida (Telefone -> Nome) para evitar o erro do "Allan".
   */
  async checkBookingStatus(barberId, clientPhone, clientName = null) {
    if (!barberId || !clientPhone) {
      return { exists: false, state: null };
    }

    try {
      const db = admin.firestore();
      const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
      
      // 1. TENTATIVA A: Busca por Telefone (Prioridade Máxima)
      // Filtramos apenas os que NÃO estão cancelados para não confundir a IA
      let snapshot = await appointmentsRef
        .where("clientPhone", "==", clientPhone)
        .where("status", "in", [BOOKING_STATES.CONFIRMED, BOOKING_STATES.PENDING])
        .orderBy("startTime", "desc")
        .limit(1)
        .get();

      // 2. TENTATIVA B: Fallback por Nome (Resolve o caso de agendamentos manuais)
      if (snapshot.empty && clientName && clientName !== "UNKNOWN") {
        console.log(`[BookingService] Telefone não achou nada. Tentando Nome: ${clientName}`);
        snapshot = await appointmentsRef
          .where("clientName", "==", clientName)
          .where("status", "in", [BOOKING_STATES.CONFIRMED, BOOKING_STATES.PENDING])
          .orderBy("startTime", "desc")
          .limit(1)
          .get();
      }

      // Se ambas as buscas falharem
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
      throw error; // Lança para o Circuit Breaker no controller
    }
  },

  /**
   * VALIDAÇÃO DE MÁQUINA DE ESTADOS
   * Impede transições proibidas (ex: Reativar algo já cancelado)
   */
  validateTransition(currentState, nextState) {
    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(nextState)) {
      console.error(`[TRANSITION_ERROR] ${currentState} -> ${nextState} is forbidden.`);
      return false;
    }
    return true;
  }
};

module.exports = { bookingService, BOOKING_STATES };