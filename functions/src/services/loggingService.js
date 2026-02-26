const admin = require("firebase-admin");

/**
 * Serviço de Observabilidade (Logging)
 * Registra detalhes técnicos da interação para auditoria e melhoria do prompt.
 */
exports.logAiInteraction = async ({
  barberId,
  clientPhone,
  inputMessage,
  aiResponse,
  toolsUsed,
  latencyMs,
  status = "success",
  error = null
}) => {
  try {
    const db = admin.firestore();
    
    // Cria um log estruturado na coleção 'ai_logs' (separado do histórico do chat)
    await db.collection("ai_logs").add({
      barberId,
      clientPhone,
      input: inputMessage,
      output: aiResponse,
      tools: toolsUsed || [], // Quais ferramentas a IA acionou (ex: get_agenda)
      latency: latencyMs,     // Tempo de resposta em milissegundos
      status,                 // 'success' ou 'error'
      error: error ? error.toString() : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ver: "v2_agent"         // Versão do agente (útil para saber se o refactor funcionou)
    });

    console.log(`[AI LOG] Interaction recorded for ${clientPhone} (${latencyMs}ms)`);
  } catch (err) {
    // Se o log falhar, não podemos parar o fluxo principal, apenas avisamos no console.
    console.error("[AI LOG ERROR] Failed to save log:", err);
  }
};