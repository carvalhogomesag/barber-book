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
      return `SUCCESS: Client name saved as ${args.name}.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ ...args, phone: fromNumber, updatedAt: new Date().toISOString() }, { merge: true });
      return "SUCCESS: CRM updated.";
    },
    
    get_realtime_agenda: async () => {
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
      return `VERDICT: Current actual bookings in system: ${JSON.stringify(appointments)}`;
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
 * LÓGICA PRINCIPAL (REFINADA: PROTOCOLO 4 PILARES + GROUNDING DE FOLGAS)
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
        if (HUMAN_HANDOFF_KEYWORDS.some(k => userMessage.toLowerCase().includes(k))) {
            return "Entendido. Vou pedir para o profissional assumir agora. Só um instante! [PAUSE_AI]";
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null;

        // --- 2. GROUNDING (SERVIÇOS + AGENDA + FOLGAS) ---
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const techServices = servicesSnap.docs.map(doc => `- SERVICE: "${doc.data().name}" | PRICE: ${doc.data().price} | DURATION: ${doc.data().duration} min`).join('\n');

        const activeStatusList = ["CONFIRMED", "scheduled", "PENDING"];
        const appointmentsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("startTime", ">=", new Date().toISOString().split('T')[0])
            .where("status", "in", activeStatusList).get();
        
        let busySlotsList = appointmentsSnap.docs.map(doc => `[OCUPADO] ${doc.data().startTime}`);
        const breakTime = barberData.settings?.businessHours?.break; 
        if (breakTime && breakTime !== "None") {
            busySlotsList.push(`[OCUPADO/PAUSA] Todos os dias entre ${breakTime.replace('-', ' e ')}`);
        }
        const busySlotsString = busySlotsList.join('\n');

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);
        
        // Validação Rígida de Dias de Trabalho (Off-Day Shield)
        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const validatedDateMenu = scheduler.dateMenu.map(d => {
            const isOpen = workDays.includes(d.dayOfWeek);
            return `${d.option}) ${d.label} (${d.iso}) - Status: ${isOpen ? '[ABERTO]' : '[FECHADO/FOLGA - NÃO AGENDAR]'}`;
        }).join('\n');

        // --- 3. MASTER PROMPT TRANSACIONAL (PROTOCOLO 4 PILARES) ---
        const MASTER_PROMPT = `
You are Schedy AI, the deterministic concierge for "${barberData.barberShopName}".
Your mission is to fulfill a 4-pillar booking form before confirming any action.

--- THE 4 MANDATORY PILLARS ---
1. CLIENT NAME: ${clientName || "Unknown"} (Ask if unknown).
2. SERVICE TYPE: Strictly from the list below.
3. DATE: Strictly from the [ABERTO] dates below.
4. TIME: Strictly free slots during business hours.

--- BUSINESS CALENDAR (SINGLE SOURCE OF TRUTH) ---
Current Local Time: ${scheduler.currentTimeLocal} | Today: ${scheduler.hojeLocalISO}

Available Dates (Only suggest [ABERTO] days):
${validatedDateMenu}

Business Hours: ${barberData.settings?.businessHours?.open} to ${barberData.settings?.businessHours?.close}
Occupied/Blocked Slots (DO NOT OFFER):
${busySlotsString || "None."}

--- SERVICES ---
${techServices}

--- DATA INTEGRITY PROTOCOL ---
1. DAY OFF RULE: If a user asks for a [FECHADO/FOLGA] date, you MUST politely state the shop is closed and suggest the next [ABERTO] day.
2. TRUTH OVER HISTORY: Use only "CURRENT SYSTEM STATE" for booking status.
3. CONFIRMATION: When all 4 pillars are clear, you MUST present a final summary and ask: "Can I confirm [SERVICE] for [NAME] on [DATE] at [TIME]?".
4. EXECUTION: Only call 'create_appointment' AFTER the user explicitly says "Yes" or "Confirm".

Language: ${targetLanguage}.
${isVoiceMode ? "- VOICE MODE: Very short phrases, natural spoken dates." : ""}
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
        return "Estou com dificuldade em sincronizar a agenda agora. Vou pedir para o barbeiro confirmar manualmente. [PAUSE_AI]";
    }
};