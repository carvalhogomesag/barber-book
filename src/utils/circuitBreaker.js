const admin = require("firebase-admin");

/**
 * UTILS: CIRCUIT BREAKER & STRUCTURAL LOGGING
 */
const circuitBreaker = {

  /**
   * Registra uma falha crítica e dispara o transbordo para humano.
   * Conforme Princípio 6 e 7 da especificação.
   */
  async trigger(error, context) {
    const db = admin.firestore();
    const { barberId, clientPhone, flow } = context;
    const timestamp = new Date().toISOString();

    // 1. Log Estruturado para Monitoramento (GCP Logs)
    console.error(`[CIRCUIT_BREAKER_TRIGGERED]`, {
      barberId,
      clientPhone,
      flow,
      errorCode: error.code || "UNKNOWN_ERROR",
      message: error.message,
      timestamp
    });

    try {
      // 2. Registro de Auditoria no Firestore
      await db.collection("system_logs").add({
        type: "CIRCUIT_BREAKER",
        severity: "CRITICAL",
        barberId,
        clientPhone,
        flow,
        error: {
          code: error.code || "N/A",
          message: error.message
        },
        createdAt: timestamp
      });

      // 3. Notificação para Intervenção Humana (Princípio 7)
      // Isso criará o alerta visual no Dashboard do profissional
      if (barberId) {
        await db.collection("barbers").doc(barberId).collection("alerts").add({
          type: "HUMAN_INTERVENTION_REQUIRED",
          reason: "CIRCUIT_BREAKER_FAILURE",
          clientPhone,
          description: "O sistema detectou uma instabilidade técnica e pausou a IA para este cliente.",
          createdAt: timestamp,
          resolved: false
        });

        // 4. Pausa estrutural da IA no mapeamento do cliente
        const mappingRef = db.collection("customer_mappings").doc(clientPhone);
        await mappingRef.set({
          tenants: {
            [barberId]: {
              status: 'paused',
              pausedReason: 'system_failure',
              lastInteraction: timestamp
            }
          }
        }, { merge: true });
      }

      return true;
    } catch (loggingError) {
      // Se até o log falhar, o console.error acima ainda garantirá o rastro técnico
      console.error("[CIRCUIT_BREAKER] Double fault during logging:", loggingError);
      return false;
    }
  }
};

module.exports = { circuitBreaker };