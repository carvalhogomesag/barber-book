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
 * Implementação da Verdade de Dados via Firestore
 */
const setupTools = (db, barberId, timezone, mappingRef, fromNumber) => {
  return {
    save_client_identity: async (args) => {
      await mappingRef.update({ clientName: args.name });
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({ 
        name: args.name, 
        phone: fromNumber, 
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      return `SUCCESS: Identity saved. Use the name ${args.name} for this client.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({
        ...args,
        phone: fromNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return "SUCCESS: CRM updated with preferences/data.";
    },
    
    get_realtime_agenda: async () => {
      const snap = await db.collection("barbers").doc(barberId).collection("appointments").get();
      if (snap.empty) return "VERDICT: The agenda is currently EMPTY. No appointments found.";
      
      const appointments = snap.docs.map(doc => ({
          client: doc.data().clientName,
          service: doc.data().serviceName,
          time: doc.data().startTime, // ISO-8601
          duration: doc.data().duration
      }));
      return `VERDICT: Current appointments in database: ${JSON.stringify(appointments)}. If a name is not here, it is NOT scheduled.`;
    },

    create_appointment: async (args) => {
      const requestedStart = args.startTime;
      const requestedDuration = parseInt(args.duration);
      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      
      if (new Date(requestedStart) < nowLocal) return "ERROR: Past dates forbidden.";

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

          if (conflictFound) return "ERROR: SLOT_OCCUPIED.";

          const newDocRef = appointmentsRef.doc();
          transaction.set(newDocRef, { 
            ...args,
            source: 'ai_concierge',
            createdAt: new Date().toISOString(), 
            status: 'scheduled' 
          });

          const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
          transaction.set(customerRef, {
            name: args.clientName,
            phone: fromNumber,
            lastService: args.serviceName,
            lastAppointment: requestedStart,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          return "SUCCESS: Appointment secured and database updated.";
        });
      } catch (e) { return "ERROR: Transaction failed."; }
    },

    update_appointment: async (args) => {
      const requestedStart = args.newStartTime;
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      try {
        return await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref);
          const userDocs = await transaction.get(ref.where("clientName", "==", args.oldClientName));
          
          if (userDocs.empty) return "ERROR: No appointment found in database to reschedule.";
          
          const targetDoc = userDocs.docs.sort((a, b) => b.data().startTime.localeCompare(a.data().startTime))[0];
          
          let conflictFound = false;
          snapshot.forEach(doc => {
            if (doc.id !== targetDoc.id) {
              const existing = doc.data();
              if (isOverlapping(requestedStart, targetDoc.data().duration, existing.startTime, existing.duration)) conflictFound = true;
            }
          });

          if (conflictFound) return "ERROR: SLOT_OCCUPIED.";
          transaction.update(targetDoc.ref, { startTime: requestedStart, updatedAt: new Date().toISOString() });
          return "SUCCESS: Rescheduled in database.";
        });
      } catch (e) { return "ERROR: Sync fail."; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientName", "==", args.clientName).get();
      if (snapshot.empty) return "ERROR: No appointment found in database for this client.";
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return "SUCCESS: Appointment removed from database.";
    }
  };
};

/**
 * DECLARAÇÃO DE FERRAMENTAS
 */
const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves client CRM data (preferences, notes).", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Checks the REAL database for busy slots and appointment status. USE THIS TO VERIFY IF AN APPOINTMENT EXISTS." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" }, notes: { type: "string" } }, required: ["clientName", "serviceName", "startTime", "price", "duration"] } },
  { name: "update_appointment", description: "Reschedules an existing booking.", parameters: { type: "object", properties: { oldClientName: { type: "string" }, newStartTime: { type: "string" } }, required: ["oldClientName", "newStartTime"] } },
  { name: "delete_appointment", description: "Cancels a booking.", parameters: { type: "object", properties: { clientName: { type: "string" } }, required: ["clientName"] } }
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
        
        // 1. CONTEXTO DE MODO (VOZ vs TEXTO)
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace(/\[PHONE CALL\]:|\[PHONE CALL CONTEXT\]:/g, "").trim();

        // 2. HITL: VERIFICAÇÃO DE GATILHOS DE PAUSA
        const lowerMsg = userMessage.toLowerCase();
        if (HUMAN_HANDOFF_KEYWORDS.some(keyword => lowerMsg.includes(keyword))) {
            await chatRef.set({ status: 'paused', needsAttention: true, pausedAt: new Date().toISOString(), lastMessage: userMessage }, { merge: true });
            return targetLanguage.includes("Portuguese") 
                ? "Entendido. Vou pedir para o profissional assumir a conversa. Aguarde um momento."
                : "Understood. I'll ask the professional to take over. Please wait a moment.";
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null; 

        // 3. PREPARAÇÃO DE DADOS (VERDADE DE DADOS)
        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const services = servicesSnap.docs.map((doc) => ({ name: doc.data().name, price: doc.data().price, duration: doc.data().duration }));
        const technicalServicesContext = services.map(s => `- SERVICE_NAME: "${s.name}" | PRICE: ${s.price} | DURATION: ${s.duration} min`).join('\n');

        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const openDaysText = workDays.map(d => dayNames[d]).join(", ");

        // 4. CONSTRUÇÃO DO PROMPT DINÂMICO
        let voiceInstructions = isVoiceMode ? `--- VOICE CALL MODE ---
- SPEAK SHORT: Max 15 words.
- NO FORMATTING: No asterisks, no emojis, no markdown.
- NATURAL SPEECH: Say dates like "October fifth" instead of "2024-10-05".` : "";

        const MASTER_PROMPT = `
You are Schedy AI, the Concierge for "${barberData.barberShopName}".
Language: ${targetLanguage || "English (US)"}.

--- DATA INTEGRITY RULE (CRITICAL) ---
1. DO NOT TRUST THE CONVERSATION HISTORY for appointment status. History is only for context.
2. If the user asks about the status of their booking, or if it was "cancelled" or "confirmed", you MUST call 'get_realtime_agenda' FIRST.
3. If 'get_realtime_agenda' does not show the appointment, it means it was manually deleted/cancelled by the professional in the Dashboard. In this case, inform the user it is NOT in the system.
4. Tool outputs override anything you or the user said previously.

--- TECHNICAL RULES ---
- Use EXACT "SERVICE_NAME" for tool calls.
- Confimation: Summarize (Service, Date, Time, Price) before calling 'create_appointment'.

--- BUSINESS INFO ---
- Services: ${technicalServicesContext}
- Hours: ${barberData.settings?.businessHours?.open} to ${barberData.settings?.businessHours?.close}.
- Open Days: ${openDaysText}.
- Shop Time: ${scheduler.currentTimeLocal}. Today: ${scheduler.hojeLocalISO}.

${voiceInstructions}
        `;

        // 5. EXECUÇÃO DO MODELO
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: MASTER_PROMPT + (globalAIConfig?.additionalContext || ""),
            tools: [{ functionDeclarations: toolsDeclaration }]
        });

        let history = chatDoc.exists ? chatDoc.data().history : [];
        const chat = model.startChat({ history });
        const finalInput = isInitialMessage ? `Greeting: Scanned QR code for ${barberData.barberShopName}.` : userMessage;

        let result = await chat.sendMessage(finalInput); 
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // 6. CHAIN OF THOUGHT (Processamento de Ferramentas)
        let errorCount = 0;
        while (calls && calls.length > 0) {
            const responses = [];
            for (const call of calls) {
                try {
                    const toolResult = await tools[call.name](call.args);
                    if (toolResult.includes("ERROR")) errorCount++;
                    responses.push({ functionResponse: { name: call.name, response: { content: toolResult } } });
                } catch (toolErr) {
                    errorCount++;
                    responses.push({ functionResponse: { name: call.name, response: { content: "ERROR: Internal tool failure." } } });
                }
            }
            result = await chat.sendMessage(responses);
            responseText = result.response.text();
            calls = result.response.functionCalls();
        }

        // 7. PAUSA POR INSTABILIDADE TÉCNICA
        if (errorCount >= 2) {
            await chatRef.update({ status: 'paused', needsAttention: true, pausedReason: 'tool_errors' });
            return targetLanguage.includes("Portuguese") 
              ? "Estou com dificuldade em sincronizar a agenda agora. Vou passar seu contato para o barbeiro." 
              : "I'm having trouble syncing the schedule. I'll forward your message to the professional.";
        }

        // 8. LIMPEZA PARA TTS
        if (isVoiceMode) responseText = responseText.replace(/\*/g, '').replace(/#/g, '').trim();

        // 9. PERSISTÊNCIA DO HISTÓRICO
        await chatRef.set({ 
            history: [...history, { role: "user", parts: [{ text: userMessage }] }, { role: "model", parts: [{ text: responseText }] }].slice(-20),
            lastMessage: userMessage, 
            clientName: clientName || "New Client", 
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return responseText;

    } catch (error) { 
        console.error("AI SERVICE ERROR:", error);
        return "Sync issue. Please try again in 10 seconds."; 
    }
};