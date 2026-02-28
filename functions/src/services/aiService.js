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
 */
const setupTools = (db, barberId, timezone, mappingRef, fromNumber) => {
  return {
    save_client_identity: async (args) => {
      await mappingRef.update({ clientName: args.name });
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ name: args.name, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
      return `SUCCESS: Identity saved as ${args.name}.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ ...args, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
      return "SUCCESS: CRM updated.";
    },
    
    get_realtime_agenda: async () => {
      // BUSCA TODOS OS STATUS ATIVOS (Dashboard + IA)
      const snap = await db.collection("barbers").doc(barberId).collection("appointments")
        .where("status", "in", ["CONFIRMED", "scheduled", "PENDING"])
        .get();
        
      if (snap.empty) return "VERDICT: Database is EMPTY.";
      const appointments = snap.docs.map(doc => ({ 
        client: doc.data().clientName, 
        service: doc.data().serviceName, 
        time: doc.data().startTime, 
        duration: doc.data().duration 
      }));
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
            // Verifica conflito contra qualquer agendamento não-cancelado
            if (existing.status !== 'CANCELLED' && isOverlapping(requestedStart, requestedDuration, existing.startTime, existing.duration)) {
              conflictFound = true;
            }
          });
          if (conflictFound) return "ERROR: SLOT_OCCUPIED.";
          
          const newDocRef = appointmentsRef.doc();
          // Gravamos como 'scheduled' para compatibilidade total com o Dashboard visual
          transaction.set(newDocRef, { ...args, source: 'ai_enterprise', createdAt: new Date().toISOString(), status: 'scheduled' });
          return "SUCCESS: APPOINTMENT_CREATED";
        });
      } catch (e) { return "ERROR: SYNC_FAIL"; }
    },

    update_appointment: async (args) => {
      const requestedStart = args.newStartTime;
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      try {
        return await db.runTransaction(async (transaction) => {
          // Busca agendamentos ativos para este cliente
          const userDocs = await transaction.get(
            ref.where("clientPhone", "==", fromNumber)
               .where("status", "in", ["CONFIRMED", "scheduled"])
          );
          if (userDocs.empty) return "ERROR: NOT_FOUND";
          const targetDoc = userDocs.docs[0];
          transaction.update(targetDoc.ref, { startTime: requestedStart, updatedAt: new Date().toISOString() });
          return "SUCCESS: RESCHEDULED";
        });
      } catch (e) { return "ERROR: FAIL"; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientPhone", "==", fromNumber).where("status", "in", ["CONFIRMED", "scheduled"]).limit(1).get();
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
 * FUNÇÃO AUXILIAR DE RETENTATIVA
 */
const sendMessageWithRetry = async (chat, message, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await chat.sendMessage(message);
        } catch (error) {
            const isTransient = error.message.includes("503") || error.message.includes("500") || error.message.includes("overloaded") || error.message.includes("Service Unavailable");
            if (isTransient && i < retries) {
                const delay = 1000 * (i + 1);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw error;
        }
    }
};

/**
 * LÓGICA PRINCIPAL (REFINADA: HARMONIZAÇÃO DASHBOARD + IA)
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

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null;

        // --- 2. GROUNDING (FONTE ÚNICA DE VERDADE) ---
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const techServices = servicesSnap.docs.map(doc => `- SERVICE: "${doc.data().name}" | PRICE: ${doc.data().price} | DURATION: ${doc.data().duration}`).join('\n');

        // BUSCA TODOS OS AGENDAMENTOS ATIVOS (Incluindo os do Dashboard 'scheduled')
        const activeStatusList = ["CONFIRMED", "scheduled", "PENDING"];
        const appointmentsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("startTime", ">=", new Date().toISOString().split('T')[0])
            .where("status", "in", activeStatusList).get();
        
        let busySlotsList = appointmentsSnap.docs.map(doc => `[OCUPADO] ${doc.data().startTime}`);

        // --- INJEÇÃO DO BREAK TIME COMO SLOT OCUPADO ---
        const breakTime = barberData.settings?.businessHours?.break; 
        if (breakTime && breakTime !== "None") {
            busySlotsList.push(`[OCUPADO/BREAK] Todos os dias entre ${breakTime.replace('-', ' e ')} (Pausa para almoço/descanso)`);
        }
        const busySlotsString = busySlotsList.join('\n');

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        // --- 3. MASTER PROMPT TRANSACIONAL ---
        const MASTER_PROMPT = `
You are Schedy AI, a DETERMINISTIC TRANSACTIONAL AGENT for "${barberData.barberShopName}".
Your role: Transform Validated State into Natural Language.

--- SINGLE SOURCE OF TRUTH (MANDATORY) ---
CURRENT SYSTEM STATE FOR THIS CLIENT:
- Appointment Exists in DB: ${validatedBookingState.exists ? "YES" : "NO"}
- Current State: ${validatedBookingState.state || "NONE"}
- Details: ${validatedBookingState.exists ? JSON.stringify(validatedBookingState.data) : "N/A"}

BUSINESS DATA:
- Shop Time: ${scheduler.currentTimeLocal} | Date: ${scheduler.hojeLocalISO}
- Open Hours: ${barberData.settings?.businessHours?.open} to ${barberData.settings?.businessHours?.close}
- BREAK TIME: ${breakTime || "None"}
- OCCUPIED SLOTS (DO NOT OFFER):
${busySlotsString || "None."}

--- ANTI-HALLUCINATION RULES ---
1. TRUTH OVER HISTORY: Even if you said a slot was free, if it is now [OCUPADO] or [BREAK], you MUST explicitly apologize and say it was just taken.
2. DO NOT trust conversation history for booking status. Use only "CURRENT SYSTEM STATE" above.
3. TRANSITIONS: NONE -> CONFIRMED, CONFIRMED -> CANCELLED.
4. INTELLIGENCE: "1030" is 10:30, "17" is 17:00.

--- WORKFLOW ---
1. Identify Name (Current: ${clientName || "UNKNOWN"}).
2. Collect Service -> Collect Time -> Summary -> [FINALIZAR_AGENDAMENTO]

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
        const finalInput = isInitialMessage ? `Greeting: Scanned QR for ${barberData.barberShopName}.` : userMessage;

        // EXECUÇÃO COM RESILIÊNCIA
        let result = await sendMessageWithRetry(chat, finalInput); 
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // 4. CHAIN OF THOUGHT (Execution Layer)
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
        console.error("LLM ISOLATION ERROR:", error);
        return "Estou com dificuldade em sincronizar a agenda. Vou pedir para o barbeiro confirmar manualmente. [PAUSE_AI]";
    }
};