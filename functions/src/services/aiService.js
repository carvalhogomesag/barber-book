const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../config"); 
const { getSchedulerContext } = require("../../utils"); 

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- LISTA DE PALAVRAS-CHAVE PARA INTERVENÇÃO HUMANA (HITL) ---
const HUMAN_HANDOFF_KEYWORDS = [
  "falar com humano", "atendente", "falar com pessoa", "humano", "erro", 
  "não estou conseguindo", "burro", "estúpido", "idiota", "human", 
  "speak to person", "agent", "operator", "stupid", "error", "help me"
];

/**
 * Auxiliar: Verifica sobreposição de horários (Evita agendamento duplo)
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
 * Garante que a IA tenha acesso real ao banco de dados Firestore.
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
      return `SUCCESS: Identity saved as ${args.name}.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({
        ...args,
        phone: fromNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return "SUCCESS: CRM profile updated.";
    },
    
    get_realtime_agenda: async () => {
      const snap = await db.collection("barbers").doc(barberId).collection("appointments").get();
      const appointments = snap.docs.map(doc => ({
          client: doc.data().clientName,
          service: doc.data().serviceName,
          time: doc.data().startTime,
          duration: doc.data().duration
      }));
      return JSON.stringify(appointments);
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
          
          return "SUCCESS: Appointment confirmed in database.";
        });
      } catch (e) { return "ERROR: Transaction failed."; }
    },

    update_appointment: async (args) => {
      const requestedStart = args.newStartTime;
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      if (new Date(requestedStart) < nowLocal) return "ERROR: Past date.";

      try {
        return await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref);
          const userDocs = await transaction.get(ref.where("clientName", "==", args.oldClientName));
          if (userDocs.empty) return "ERROR: Not found.";
          
          const sorted = userDocs.docs.sort((a, b) => b.data().startTime.localeCompare(a.data().startTime));
          const targetDoc = sorted[0];
          
          let conflictFound = false;
          snapshot.forEach(doc => {
            if (doc.id !== targetDoc.id) {
              const existing = doc.data();
              if (isOverlapping(requestedStart, targetDoc.data().duration, existing.startTime, existing.duration)) conflictFound = true;
            }
          });

          if (conflictFound) return "ERROR: SLOT_OCCUPIED.";
          transaction.update(targetDoc.ref, { startTime: requestedStart });
          return "SUCCESS: Rescheduled.";
        });
      } catch (e) { return "ERROR: Update failed."; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientName", "==", args.clientName).get();
      if (snapshot.empty) return "ERROR: No appointment found.";
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return "SUCCESS: Appointment deleted.";
    }
  };
};

/**
 * DECLARAÇÃO DE TOOLS (Interface para o Gemini)
 */
const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves client CRM data (preferences, birthday).", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Checks available time slots." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" }, notes: { type: "string" } }, required: ["clientName", "serviceName", "startTime", "price", "duration"] } },
  { name: "update_appointment", description: "Reschedules an existing booking.", parameters: { type: "object", properties: { oldClientName: { type: "string" }, newStartTime: { type: "string" } }, required: ["oldClientName", "newStartTime"] } },
  { name: "delete_appointment", description: "Cancels a booking.", parameters: { type: "object", properties: { clientName: { type: "string" } }, required: ["clientName"] } }
];

/**
 * LÓGICA PRINCIPAL (ORQUESTRADOR DA IA)
 */
exports.processMessageWithAI = async ({ 
    barberId, barberData, clientName, messageBody, fromNumber, 
    isInitialMessage, db, mappingRef, globalAIConfig, targetLanguage,
    barberTimezone, serverTimeISO 
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        
        // 1. DETECÇÃO DE MODO (VOZ vs TEXTO)
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace(/\[PHONE CALL\]:|\[PHONE CALL CONTEXT\]:/g, "").trim();

        // 2. HITL: VERIFICAÇÃO DE GATILHOS DE PAUSA
        const lowerMsg = userMessage.toLowerCase();
        if (HUMAN_HANDOFF_KEYWORDS.some(keyword => lowerMsg.includes(keyword))) {
            await chatRef.set({ status: 'paused', needsAttention: true, pausedAt: new Date().toISOString(), lastMessage: userMessage }, { merge: true });
            return targetLanguage.includes("Portuguese") 
                ? "Entendido. Vou pedir para o profissional assumir a conversa agora. Aguarde um momento."
                : "Understood. I'll ask the professional to take over the conversation. Please wait a moment.";
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null; 

        // 3. PREPARAÇÃO DE DADOS (VERDADE DE DADOS)
        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const services = servicesSnap.docs.map((doc) => ({ 
            name: doc.data().name, 
            price: doc.data().price, 
            duration: doc.data().duration 
        }));

        // LISTA TÉCNICA: O segredo para não perder informações no Dashboard
        const technicalServicesContext = services.map(s => 
            `- SERVICE_NAME: "${s.name}" | PRICE: ${s.price} | DURATION: ${s.duration} min`
        ).join('\n');

        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const openDaysText = workDays.map(d => dayNames[d]).join(", ");

        // 4. AJUSTE DE PROMPT PARA VOZ vs TEXTO
        let voiceInstructions = "";
        if (isVoiceMode) {
          voiceInstructions = `
          --- MODO VOZ ATIVADO (AUDIO-ONLY) ---
          - Você está falando ao telefone. Seja extremamente curto (máx 15 palavras).
          - Proibido usar emojis, asteriscos (*) ou listas.
          - Use linguagem falada natural. Em vez de "2024-10-05", diga "cinco de outubro".
          `;
        }

        const MASTER_PROMPT = `
You are Schedy AI, the Expert Concierge for "${barberData.barberShopName}".
Language: ${targetLanguage || "English (US)"}.

--- CRITICAL DATA INTEGRITY RULES ---
1. Use the "SERVICE_NAME" from the list below EXACTLY as it is written when calling the 'create_appointment' tool.
2. You can translate the service for the client (e.g., "Corte" instead of "Haircut"), but the TOOL call MUST use the original "SERVICE_NAME".
3. ALWAYS include the correct "DURATION" and "PRICE" from the technical list below in your tool calls.

--- SERVICES BACKOFFICE DATA ---
${technicalServicesContext}

--- OPERATING RULES ---
- Open Days: ${openDaysText}.
- Hours: ${barberData.settings?.businessHours?.open || "09:00"} to ${barberData.settings?.businessHours?.close || "18:00"}.
- Identity: Client is "${clientName || "UNKNOWN"}". If UNKNOWN, you MUST ask and call 'save_client_identity'.
- Confirmation: Before 'create_appointment', summarize: Service, Date, Time, and Price. Wait for confirmation.

--- TIME CONTEXT ---
- Shop Local Time: ${scheduler.currentTimeLocal}. Today: ${scheduler.hojeLocalISO}.
- Use 'get_realtime_agenda' before offering slots.

${voiceInstructions}
        `;

        // 5. EXECUÇÃO DO MODELO
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: MASTER_PROMPT + (globalAIConfig?.additionalContext || ""),
            tools: [{ functionDeclarations: toolsDeclaration }]
        });

        let history = chatDoc.exists ? chatDoc.data().history : [];
        const cleanInput = isInitialMessage 
            ? `Greeting: Client scanned QR code for ${barberData.barberShopName}.` 
            : userMessage;

        const chat = model.startChat({ history });
        let result = await chat.sendMessage(cleanInput); 
        
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // 6. CHAIN OF THOUGHT (Processamento de Ferramentas)
        let errorCount = 0;
        while (calls && calls.length > 0) {
            const responses = [];
            for (const call of calls) {
                const toolResult = await tools[call.name](call.args);
                if (toolResult.includes("ERROR")) errorCount++;

                responses.push({ 
                    functionResponse: { 
                        name: call.name, 
                        response: { content: toolResult } 
                    } 
                });
            }
            result = await chat.sendMessage(responses);
            responseText = result.response.text();
            calls = result.response.functionCalls();
        }

        // 7. PAUSA POR ERRO TÉCNICO
        if (errorCount >= 2) {
            await chatRef.update({ status: 'paused', needsAttention: true, pausedReason: 'tool_errors' });
            return targetLanguage.includes("Portuguese") ? "Estou com dificuldade em acessar a agenda agora. Vou passar para o profissional." : "Agenda sync issue. Handing over to human.";
        }

        // 8. LIMPEZA PARA VOZ (Sintetizador de Voz amigável)
        if (isVoiceMode) {
          responseText = responseText.replace(/\*/g, '').replace(/#/g, '').trim();
        }

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
        return "Internal sync error. Please try again."; 
    }
};