const admin = require("firebase-admin");

/**
 * MÁQUINA DE ESTADOS FORMAL
 */
const BOOKING_STATES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

/**
 * REGRAS DE TRANSIÇÃO DE ESTADO
 */
const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING]: [BOOKING_STATES.CONFIRMED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.CONFIRMED]: [BOOKING_STATES.CANCELLED, BOOKING_STATES.COMPLETED],
  [BOOKING_STATES.CANCELLED]: [], // Estado final
  [BOOKING_STATES.COMPLETED]: []  // Estado final
};

/**
 * ERROS CUSTOMIZADOS PARA FLUXO TRANSACIONAL
 */
class BookingServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "BookingServiceError";
  }
}

/**
 * SERVIÇO DETERMINÍSTICO DE AGENDAMENTOS
 */
const bookingService = {
  
  /**
   * INVARIANTE: Consulta obrigatória antes de qualquer resposta.
   * Busca o agendamento mais relevante (futuro ou último ativo).
   */
  async checkBookingStatus(barberId, clientPhone) {
    if (!barberId || !clientPhone) {
      throw new BookingServiceError("Missing identity parameters", "INVALID_INPUT");
    }

    try {
      const db = admin.firestore();
      const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
      
      // Query determinística: Filtrando por telefone e ordenando por data
      const snapshot = await appointmentsRef
        .where("clientPhone", "==", clientPhone)
        .orderBy("startTime", "desc")
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { exists: false, state: null, data: null };
      }

      const bookingDoc = snapshot.docs[0];
      const bookingData = bookingDoc.data();

      return {
        exists: true,
        bookingId: bookingDoc.id,
        state: bookingData.status, // Deve ser um dos BOOKING_STATES
        data: {
          service: bookingData.serviceName,
          time: bookingData.startTime,
          price: bookingData.price,
          duration: bookingData.duration
        }
      };
    } catch (error) {
      console.error("[BookingService] Database Access Error:", error);
      throw new BookingServiceError("Failed to access database", "DATABASE_ERROR");
    }
  },

  /**
   * VALIDAÇÃO RÍGIDA DE TRANSIÇÃO
   */
  validateStateTransition(currentState, nextState) {
    if (!BOOKING_STATES[nextState]) {
      throw new BookingServiceError(`Invalid target state: ${nextState}`, "INVALID_TARGET_STATE");
    }

    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(nextState)) {
      throw new BookingServiceError(
        `Transition forbidden: ${currentState} -> ${nextState}`,
        "FORBIDDEN_TRANSITION"
      );
    }
    return true;
  }
};

module.exports = { bookingService, BOOKING_STATES, BookingServiceError };