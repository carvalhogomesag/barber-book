const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../config"); 
const { getSchedulerContext } = require("../../utils"); 

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- HITL: PALAVRAS-CHAVE PARA INTERVENÇÃO HUMANA ---
const HUMAN_HANDOFF_KEYWORDS = [
  "falar com humano", "atendente", "falar com pessoa", "humano", "erro", 
  "não estou conseguindo", "burro", "estúpido", "idiota", "human", 
  "speak to person", "agent", "operator", "stupid", "error", "help me"
];

/**
 * Auxiliar: Verifica sobreposição de horários
 */
const isOverlapping = (startA, durationA, startB, durationB) => {
  const aBegin = new Date(startA).getTime();
  const aEnd = aBegin + (durationA * 60000);
  const bBegin = new Date(startB).getTime();
  const bEnd = bBegin + (durationB * 60000);
  return (aBegin < bEnd && aEnd > bBegin);
};

/**
 * FÁBRICA DE FERRAMENTAS (Tools Factory)
 * MANTIDO: Lógica transacional determinística.
 */
const setupTools = (db, barberId, timezone, mappingRef, fromNumber) => {
  return {
    save_client_identity: async (args) => {
      await mappingRef.update({ clientName: args.name });
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ name: args.name, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
      return `SUCCESS: Client name saved as ${args.name}.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ ...args, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
      return "SUCCESS: CRM updated.";
    },
    
    get_realtime_agenda: async () => {
      const snap = await db.collection("barbers").doc(barberId).collection("appointments").get();
      if (snap.empty) return "VERDICT: Database is EMPTY.";
      const appointments = snap.docs.map(doc => ({ client: doc.data().clientName, service: doc.data().serviceName, time: doc.data().startTime, duration: doc.data().duration }));
      return `VERDICT: Current actual bookings: ${JSON.stringify(appointments)}`;
    },

    create_appointment: async (args) => {
      const requestedStart = args.startTime;
      const requestedDuration = parseInt(args.duration);
      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      if (new Date(requestedStart) < nowLocal) return "ERROR: PAST_DATE";

      try {
        return await db.runTransaction(async (transaction) => {
          const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
          const snapshot = await transaction.get(appointmentsRef);
          let conflictFound = false;
          snapshot.forEach(doc => {
            const existing = doc.data();
            if (existing.status !== 'CANCELLED' && isOverlapping(requestedStart, requestedDuration, existing.startTime, existing.duration)) {
              conflictFound = true;
            }
          });
          if (conflictFound) return "ERROR: SLOT_OCCUPIED.";
          
          const newDocRef = appointmentsRef.doc();
          transaction.set(newDocRef, { ...args, source: 'ai_enterprise', createdAt: new Date().toISOString(), status: 'CONFIRMED' });
          return "SUCCESS: APPOINTMENT_CREATED";
        });
      } catch (e) { return "ERROR: SYNC_FAIL"; }
    },

    update_appointment: async (args) => {
      const requestedStart = args.newStartTime;
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      try {
        return await db.runTransaction(async (transaction) => {
          const userDocs = await transaction.get(ref.where("clientPhone", "==", fromNumber).where("status", "==", "CONFIRMED"));
          if (userDocs.empty) return "ERROR: NOT_FOUND";
          const targetDoc = userDocs.docs[0];
          transaction.update(targetDoc.ref, { startTime: requestedStart, updatedAt: new Date().toISOString() });
          return "SUCCESS: RESCHEDULED";
        });
      } catch (e) { return "ERROR: FAIL"; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientPhone", "==", fromNumber).where("status", "==", "CONFIRMED").limit(1).get();
      if (snapshot.empty) return "ERROR: NOT_FOUND";
      await snapshot.docs[0].ref.update({ status: "CANCELLED", updatedAt: new Date().toISOString() });
      return "SUCCESS: CANCELLED";
    }
  };
};

const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves CRM data.", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Mandatory check for busy slots." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" } }, required: ["clientName", "serviceName", "startTime", "duration"] } },
  { name: "update_appointment", description: "Changes booking time.", parameters: { type: "object", properties: { newStartTime: { type: "string" } }, required: ["newStartTime"] } },
  { name: "delete_appointment", description: "Cancels booking." }
];

/**
 * FUNÇÃO AUXILIAR DE RETENTATIVA (Exponential Backoff Lite)
 * Resolve erros 503 e sobrecarga da API do Google.
 */
const sendMessageWithRetry = async (chat, message, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await chat.sendMessage(message);
        } catch (error) {
            const isTransient = error.message.includes("503") || 
                                error.message.includes("500") || 
                                error.message.includes("overloaded") ||
                                error.message.includes("Service Unavailable");
            
            if (isTransient && i < retries) {
                const delay = 1000 * (i + 1); // 1s, depois 2s
                console.warn(`[AI_RETRY] Gemini indisponível (Tentativa ${i + 1}). Aguardando ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw error; // Erro fatal ou esgotou tentativas
        }
    }
};

/**
 * LÓGICA PRINCIPAL (LLM ISOLATION + RESILIÊNCIA)
 */
exports.processMessageWithAI = async ({ 
    barberId, barberData, clientName, messageBody, fromNumber, 
    isInitialMessage, db, mappingRef, globalAIConfig, targetLanguage,
    barberTimezone, serverTimeISO, validatedBookingState 
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace(/\[PHONE CALL\]:|\[PHONE CALL CONTEXT\]:/g, "").trim();

        // 1. HITL: INTERVENÇÃO HUMANA
        const lowerMsg = userMessage.toLowerCase();
        if (HUMAN_HANDOFF_KEYWORDS.some(k => lowerMsg.includes(k))) {
            return "Entendido. Vou pedir para o profissional assumir agora. Só um instante! [PAUSE_AI]";
        }

        // --- 2. GROUNDING & ISOLATION (FONTE ÚNICA DE VERDADE) ---
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const techServices = servicesSnap.docs.map(doc => `- SERVICE: "${doc.data().name}" | PRICE: ${doc.data().price} | DURATION: ${doc.data().duration}`).join('\n');

        const appointmentsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("startTime", ">=", new Date().toISOString().split('T')[0])
            .where("status", "==", "CONFIRMED").get();
        const busySlots = appointmentsSnap.docs.map(doc => `[BUSY] ${doc.data().startTime}`).join('\n');

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        // --- 3. MASTER PROMPT TRANSACIONAL ---
        const MASTER_PROMPT = `
You are Schedy AI, a DETERMINISTIC TRANSACTIONAL AGENT for "${barberData.barberShopName}".
Your role is to transform Validated State into Natural Language.

--- SINGLE SOURCE OF TRUTH (MANDATORY) ---
CURRENT SYSTEM STATE FOR THIS CLIENT:
- Appointment Exists: ${validatedBookingState.exists ? "YES" : "NO"}
- Current State: ${validatedBookingState.state || "NONE"}
- Details: ${validatedBookingState.exists ? JSON.stringify(validatedBookingState.data) : "N/A"}

BUSINESS DATA:
- Shop Time: ${scheduler.currentTimeLocal} | Date: ${scheduler.hojeLocalISO}
- Services Available:
${techServices}
- OCCUPIED SLOTS (DO NOT OFFER):
${busySlots || "None."}

--- ANTI-HALLUCINATION PROTOCOL ---
1. DO NOT trust conversation history for booking status. Use only "CURRENT SYSTEM STATE" above.
2. If CURRENT SYSTEM STATE says "Appointment Exists: NO", you MUST NOT claim the user has a booking.
3. If user asks to cancel but state is NONE, inform they have no active booking.
4. TRANSITIONS: Only suggest transitions valid for the Current State. (NONE -> CONFIRMED, CONFIRMED -> CANCELLED).

--- WORKFLOW ---
1. Identify Name (Current: ${clientName || "UNKNOWN"}).
2. Collect Service -> Collect Time -> Summary -> [FINALIZAR_AGENDAMENTO]
3. If user changes subject, respond briefly and pivot back to the checklist.

Language: ${targetLanguage}.
${isVoiceMode ? "- VOICE MODE: Very short phrases, no formatting." : ""}
`;

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: MASTER_PROMPT + (globalAIConfig?.additionalContext || ""),
            tools: [{ functionDeclarations: toolsDeclaration }] 
        });

        let history = (await chatRef.get()).data()?.history || [];
        const chat = model.startChat({ history: history.slice(-6) }); 
        const finalInput = isInitialMessage ? `Greeting: Client scanned QR for ${barberData.barberShopName}.` : userMessage;

        // EXECUÇÃO COM RESILIÊNCIA (RETRY)
        let result = await sendMessageWithRetry(chat, finalInput); 
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // 4. CHAIN OF THOUGHT (Execution Layer com Retry)
        let errorCount = 0;
        while (calls && calls.length > 0) {
            const responses = [];
            for (const call of calls) {
                try {
                    const toolResult = await tools[call.name](call.args);
                    if (toolResult.includes("ERROR")) errorCount++;
                    responses.push({ functionResponse: { name: call.name, response: { content: toolResult } } });
                } catch (e) {
                    errorCount++;
                    responses.push({ functionResponse: { name: call.name, response: { content: "SYSTEM_ERROR" } } });
                }
            }
            // Executa resposta da ferramenta com Retry
            result = await sendMessageWithRetry(chat, responses);
            responseText = result.response.text();
            calls = result.response.functionCalls();
        }

        if (errorCount >= 2) responseText += " [PAUSE_AI]";
        if (isVoiceMode) responseText = responseText.replace(/\*/g, '').replace(/#/g, '').trim();

        // 5. PERSISTÊNCIA
        await chatRef.set({ 
            history: [...history, { role: "user", parts: [{ text: userMessage }] }, { role: "model", parts: [{ text: responseText }] }].slice(-20),
            lastMessage: userMessage, 
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return responseText;

    } catch (error) {
        console.error("CRITICAL AI ERROR:", error);
        // Fallback resiliente em caso de falha persistente do Google
        return "Tive um pequeno problema técnico ao consultar minha agenda. Por favor, tente novamente em alguns segundos. 🤖";
    }
};