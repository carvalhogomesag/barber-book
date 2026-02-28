const admin = require("firebase-admin");

/**
 * functions/src/services/conversationGovernor.js
 * Monitor de Saúde e Escalação Determinística (Princípio 7)
 */
const conversationGovernor = {
  // Limite operacional para evitar loops de custo/alucinação
  MAX_INTERACTIONS: 10,

  /**
   * Avalia se a conversa deve sofrer transbordo para um humano.
   * Regra: Se interactionCount >= MAX_INTERACTIONS e o estado não for resolutivo.
   */
  async evaluateEscalation(barberId, clientPhone, interactionCount, currentBookingState) {
    const db = admin.firestore();
    const timestamp = new Date().toISOString();

    // Estados que indicam que a IA concluiu sua missão técnica
    const isResolved = ['CONFIRMED', 'scheduled', 'CANCELLED'].includes(currentBookingState);
    
    // Disparo do gatilho de segurança
    const isLimitExceeded = interactionCount >= this.MAX_INTERACTIONS;

    // Só escalamos se exceder o limite E não estiver em um estado de sucesso/conclusão
    if (isLimitExceeded && !isResolved) {
      console.warn(`[GOVERNOR] Limite de segurança atingido para ${clientPhone}. Iniciando Transbordo.`);

      const batch = db.batch();

      // 1. Registro em coleções globais de auditoria
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        type: "human_intervention_required",
        reason: "MAX_INTERACTIONS_EXCEEDED",
        barberId,
        clientPhone,
        interactionCount,
        createdAt: timestamp
      });

      // 2. Alerta imediato no Dashboard do Barbeiro
      const alertRef = db.collection("barbers").doc(barberId).collection("alerts").doc();
      batch.set(alertRef, {
        type: "ATTENTION_REQUIRED",
        reason: "IA_STUCK",
        clientPhone,
        description: `O cliente atingiu o limite de ${this.MAX_INTERACTIONS} interações. Assuma o atendimento manualmente.`,
        createdAt: timestamp,
        resolved: false
      });

      // 3. Travamento de segurança (Pause AI) no Mapeamento
      const mappingRef = db.collection("customer_mappings").doc(clientPhone);
      batch.set(mappingRef, {
        tenants: {
          [barberId]: {
            status: 'paused',
            pausedReason: 'governor_limit_exceeded',
            lastInteraction: timestamp
          }
        }
      }, { merge: true });

      await batch.commit();

      return { 
        shouldEscalate: true, 
        fallbackMessage: "Entendido. Para garantir que seu agendamento seja perfeito, vou passar a conversa para o profissional te ajudar agora! 🤖" 
      };
    }

    return { shouldEscalate: false };
  },

  /**
   * Reseta o contador de interações do cliente.
   * Chamado quando uma transação no Firestore (Agendar/Alterar/Cancelar) tem sucesso.
   */
  async resetGovernor(clientPhone, barberId) {
    const db = admin.firestore();
    const timestamp = new Date().toISOString();
    
    try {
      const mappingRef = db.collection("customer_mappings").doc(clientPhone);
      await mappingRef.set({
        tenants: {
          [barberId]: {
            interactionCount: 0,
            lastInteraction: timestamp,
            status: 'active' // Garante que a IA seja reativada se estiver agendando
          }
        }
      }, { merge: true });
      
      console.log(`[GOVERNOR RESET] Contador zerado com sucesso para ${clientPhone}.`);
      return true;
    } catch (error) {
      console.error("[GOVERNOR RESET ERROR]", error);
      return false;
    }
  }
};

module.exports = { conversationGovernor };