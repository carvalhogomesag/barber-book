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
 * LÓGICA PRINCIPAL (REFINADA COM RACIOCÍNIO DE CONFLITO)
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

        // --- 2. GROUNDING (FONTE ÚNICA DE VERDADE) ---
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const techServices = servicesSnap.docs.map(doc => `- SERVICE: "${doc.data().name}" | PRICE: ${doc.data().price} | DURATION: ${doc.data().duration}`).join('\n');

        const appointmentsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("startTime", ">=", new Date().toISOString().split('T')[0])
            .where("status", "==", "CONFIRMED").get();
        const busySlots = appointmentsSnap.docs.map(doc => `[OCUPADO] ${doc.data().startTime}`).join('\n');

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        // --- 3. MASTER PROMPT (REGRAS DE INTEGRIDADE E SMART INTERPRETATION) ---
        const MASTER_PROMPT = `
You are Schedy AI for "${barberData.barberShopName}". 
Goal: Task-oriented booking concierge.

--- SMART INTERPRETATION ---
- Numbers: "1030" is 10:30, "17" is 17:00. 
- Relative time: "Morning", "Afternoon" refers to business hours: ${barberData.settings?.businessHours?.open} to ${barberData.settings?.businessHours?.close}.

--- SINGLE SOURCE OF TRUTH (MANDATORY) ---
- Current State for Client: ${validatedBookingState.exists ? "HAS_BOOKING" : "NO_BOOKING"}
- Agenda Status:
${busySlots || "Agenda is completely empty."}

--- CRITICAL REASONING RULES ---
1. IF USER PICKS AN [OCUPADO] TIME: You MUST explicitly apologize and state that the time was JUST taken. Do not jump to the next time without explaining.
2. TRUTH OVER HISTORY: Even if you said 10:30 was free 1 minute ago, if it is now [OCUPADO], tell the user it is gone.
3. Use only these services:
${techServices}

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
                    responses.push({ functionResponse: { name: call.name, response: { content: "SYSTEM_SYNC_ERROR" } } });
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
        console.error("CRITICAL AI ERROR:", error);
        return "Tive um pequeno problema técnico ao consultar minha agenda. Por favor, tente novamente em alguns segundos. 🤖";
    }
};