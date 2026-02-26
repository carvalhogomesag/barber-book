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
 * Auxiliar: Verifica sobreposição de horários (Precisão Cirúrgica)
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
      // FORÇA LEITURA DIRETA DO FIRESTORE (SEM CACHE)
      const snap = await db.collection("barbers").doc(barberId).collection("appointments").get();
      if (snap.empty) return "VERDICT: The agenda is currently EMPTY. All slots are available.";
      
      const appointments = snap.docs.map(doc => ({
          client: doc.data().clientName,
          service: doc.data().serviceName,
          time: doc.data().startTime,
          duration: doc.data().duration
      }));
      return `VERDICT: These are the ONLY appointments in the system: ${JSON.stringify(appointments)}. If an appointment is not in this list, it does not exist.`;
    },

    create_appointment: async (args) => {
      const requestedStart = args.startTime;
      const requestedDuration = parseInt(args.duration);
      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      
      if (new Date(requestedStart) < nowLocal) return "ERROR: CANNOT_BOOK_PAST_DATE";

      try {
        return await db.runTransaction(async (transaction) => {
          const appointmentsRef = db.collection("barbers").doc(barberId).collection("appointments");
          const snapshot = await transaction.get(appointmentsRef);
          
          let conflictFound = false;
          snapshot.forEach(doc => {
            const existing = doc.data();
            if (isOverlapping(requestedStart, requestedDuration, existing.startTime, existing.duration)) {
              conflictFound = true;
            }
          });

          if (conflictFound) return "ERROR: SLOT_JUST_OCCUPIED. Apologize to the client and offer another time.";

          const newDocRef = appointmentsRef.doc();
          transaction.set(newDocRef, { 
            ...args,
            source: 'ai_concierge',
            createdAt: new Date().toISOString(), 
            status: 'scheduled' 
          });

          return "SUCCESS: Appointment confirmed in the database.";
        });
      } catch (e) { return "ERROR: System sync failed."; }
    },

    update_appointment: async (args) => {
      const requestedStart = args.newStartTime;
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      try {
        return await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref);
          const userDocs = await transaction.get(ref.where("clientName", "==", args.oldClientName));
          if (userDocs.empty) return "ERROR: Appointment not found in database.";
          
          const targetDoc = userDocs.docs.sort((a, b) => b.data().startTime.localeCompare(a.data().startTime))[0];
          
          let conflictFound = false;
          snapshot.forEach(doc => {
            if (doc.id !== targetDoc.id && isOverlapping(requestedStart, targetDoc.data().duration, doc.data().startTime, doc.data().duration)) conflictFound = true;
          });

          if (conflictFound) return "ERROR: NEW_SLOT_OCCUPIED.";
          transaction.update(targetDoc.ref, { startTime: requestedStart, updatedAt: new Date().toISOString() });
          return "SUCCESS: Rescheduled.";
        });
      } catch (e) { return "ERROR: Fail."; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientName", "==", args.clientName).get();
      if (snapshot.empty) return "ERROR: Not found.";
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return "SUCCESS: Removed from database.";
    }
  };
};

const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves CRM data.", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Fetches current busy slots. USE THIS EVERY TIME the user asks about their status." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" }, notes: { type: "string" } }, required: ["clientName", "serviceName", "startTime", "price", "duration"] } },
  { name: "update_appointment", description: "Reschedules booking.", parameters: { type: "object", properties: { oldClientName: { type: "string" }, newStartTime: { type: "string" } }, required: ["oldClientName", "newStartTime"] } },
  { name: "delete_appointment", description: "Cancels booking.", parameters: { type: "object", properties: { clientName: { type: "string" } }, required: ["clientName"] } }
];

/**
 * LÓGICA PRINCIPAL
 */
exports.processMessageWithAI = async ({ 
    barberId, barberData, clientName, messageBody, fromNumber, 
    isInitialMessage, db, mappingRef, globalAIConfig, targetLanguage,
    barberTimezone, serverTimeISO 
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace(/\[PHONE CALL\]:|\[PHONE CALL CONTEXT\]:/g, "").trim();

        // 1. HITL: INTERVENÇÃO HUMANA
        const lowerMsg = userMessage.toLowerCase();
        if (HUMAN_HANDOFF_KEYWORDS.some(k => lowerMsg.includes(k))) {
            const pausedMsg = targetLanguage.includes("Portuguese") ? "Vou pedir para o profissional assumir agora. Só um instante! [PAUSE_AI]" : "I'll have the professional take over right now. [PAUSE_AI]";
            return pausedMsg;
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null;

        // --- 2. GROUNDING REAL-TIME (FONTE DA VERDADE DIRETA DO FIRESTORE) ---
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const services = servicesSnap.docs.map(doc => doc.data());
        const technicalServicesContext = services.map(s => `- SERVICE_NAME: "${s.name}" | PRICE: ${s.price} | DURATION: ${s.duration} min`).join('\n');

        // Busca agenda de hoje em diante para injetar no prompt (Evita alucinação de slots)
        const appointmentsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("startTime", ">=", new Date().toISOString().split('T')[0])
            .get();
        const currentAgenda = appointmentsSnap.docs.map(doc => `- [BUSY] ${doc.data().startTime} (${doc.data().duration} min)`).join('\n');

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);
        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const openDaysText = workDays.map(d => dayNames[d]).join(", ");

        // --- 3. MASTER PROMPT (CHECKLIST E VERIFICAÇÃO DE DISPONIBILIDADE) ---
        const MASTER_PROMPT = `
You are Schedy AI, the Task-Oriented Concierge for "${barberData.barberShopName}".
Your mission: Identify Client -> Choose Service -> Verify Availability -> Finalize.

--- REAL-TIME SOURCE OF TRUTH (TRUST THIS OVER HISTORY) ---
- Current Shop Time: ${scheduler.currentTimeLocal} | Date: ${scheduler.hojeLocalISO}
- Services:
${technicalServicesContext}
- CURRENT OCCUPIED SLOTS (DO NOT OFFER THESE):
${currentAgenda || "Agenda is completely empty."}

--- CRITICAL DATA INTEGRITY RULES ---
1. DO NOT TRUST the conversation history for appointment status. If the professional deletes an appointment in the dashboard, it is GONE.
2. If the user asks "Is it confirmed?", "Is it cancelled?" or "What time is my cut?", you MUST call 'get_realtime_agenda' to confirm.
3. If 'get_realtime_agenda' doesn't show the user's name, their appointment was DELETED/CANCELLED by the barber. Inform them politely.

--- CHECKLIST ---
1. Name (Current: ${clientName || "UNKNOWN"}).
2. Service (Use EXACT Service Name).
3. Time (Offer free slots between ${barberData.settings?.businessHours?.open} and ${barberData.settings?.businessHours?.close}).

FINALIZATION TAG:
When Nome, Service, Date, and Time are clear, append:
[FINALIZAR_AGENDAMENTO: {"servico": "EXACT_NAME", "data": "YYYY-MM-DD", "hora": "HH:MM"}]
`;

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: MASTER_PROMPT + (globalAIConfig?.additionalContext || ""),
            tools: [{ functionDeclarations: toolsDeclaration }] 
        });

        let history = chatDoc.exists ? chatDoc.data().history : [];
        const chat = model.startChat({ history: history.slice(-6) }); // Memória curta para foco na verdade atual
        const finalInput = isInitialMessage ? `Greeting: Client scanned QR code for ${barberData.barberShopName}.` : userMessage;

        let result = await chat.sendMessage(finalInput); 
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // 4. CHAIN OF THOUGHT (Processamento de Ferramentas com Try/Catch de Conflito)
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
                    responses.push({ functionResponse: { name: call.name, response: { content: "ERROR: System lag. Try again." } } });
                }
            }
            result = await chat.sendMessage(responses);
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
        console.error("AI ERROR:", error);
        return "Internal sync issue. Please try again. [PAUSE_AI]";
    }
};