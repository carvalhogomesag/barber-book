const admin = require("firebase-admin");

/**
 * CONVERSATION GOVERNOR (Princípio 7)
 * Monitora a saúde da conversa e impede loops infinitos.
 */
const conversationGovernor = {
  // Aumentado de 6 para 10 conforme solicitação de teste de estresse
  MAX_INTERACTIONS: 10,

  /**
   * Avalia se a conversa deve ser transferida para um humano.
   * Regra: Se count >= limite E estado não for final (CONFIRMED/CANCELLED)
   */
  async evaluateEscalation(barberId, clientPhone, interactionCount, currentBookingState) {
    const db = admin.firestore();
    const timestamp = new Date().toISOString();

    // Verificamos se o estado atual é um estado "Resolvido" (Finalizado)
    const isResolved = currentBookingState === 'CONFIRMED' || currentBookingState === 'CANCELLED';
    
    // O gatilho dispara quando o contador atinge ou ultrapassa o limite
    const isLimitExceeded = interactionCount >= this.MAX_INTERACTIONS;

    if (isLimitExceeded && !isResolved) {
      console.warn(`[GOVERNOR] Escalonamento ativado para ${clientPhone}. Limite de ${this.MAX_INTERACTIONS} interações atingido.`);

      // 1. Criar registro global em notifications/ para auditoria administrativa
      await db.collection("notifications").add({
        type: "human_intervention_required",
        reason: "MAX_INTERACTIONS_EXCEEDED",
        barberId,
        clientPhone,
        lastBookingState: currentBookingState || "NONE",
        interactionCount,
        limitSet: this.MAX_INTERACTIONS,
        createdAt: timestamp
      });

      // 2. Criar Alerta na subcoleção do Barbeiro para notificação no Dashboard
      await db.collection("barbers").doc(barberId).collection("alerts").add({
        type: "ATTENTION_REQUIRED",
        reason: "IA_STUCK",
        clientPhone,
        description: `A IA atingiu o limite de ${this.MAX_INTERACTIONS} interações sem finalizar o agendamento. Transbordo manual ativado.`,
        createdAt: timestamp,
        resolved: false
      });

      // 3. Pausar a IA no mapeamento do cliente para silenciar o bot
      const mappingRef = db.collection("customer_mappings").doc(clientPhone);
      await mappingRef.set({
        tenants: {
          [barberId]: {
            status: 'paused',
            pausedReason: 'governor_limit_exceeded',
            lastInteraction: timestamp
          }
        }
      }, { merge: true });

      return { 
        shouldEscalate: true, 
        fallbackMessage: "Notei que ainda não finalizamos seu pedido. Para sua comodidade, vou passar a conversa para o profissional te ajudar agora! 🤖" 
      };
    }

    return { shouldEscalate: false };
  }
};

module.exports = { conversationGovernor };