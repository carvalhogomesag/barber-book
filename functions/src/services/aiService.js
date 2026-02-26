const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../config"); 
const { getSchedulerContext } = require("../../utils"); 

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- HITL: LISTA DE PALAVRAS-CHAVE PARA INTERVENÇÃO HUMANA ---
const HUMAN_HANDOFF_KEYWORDS = [
  "falar com humano", "atendente", "falar com pessoa", "humano", "erro", 
  "não estou conseguindo", "burro", "estúpido", "idiota", "human", 
  "speak to person", "agent", "operator", "stupid", "error", "help me"
];

/**
 * Auxiliar: Verifica sobreposição de horários (Data Integrity)
 */
const isOverlapping = (startA, durationA, startB, durationB) => {
  const aBegin = new Date(startA).getTime();
  const aEnd = aBegin + (durationA * 60000);
  const bBegin = new Date(startB).getTime();
  const bEnd = bBegin + (durationB * 60000);
  return (aBegin < bEnd && aEnd > bBegin);
};

/**
 * Fábrica de Ferramentas (Tools Factory)
 * MANTIDO: Todas as funcionalidades de escrita e leitura de banco.
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
      return `SUCCESS: Client identity saved. Client name is ${args.name}.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({
        ...args,
        phone: fromNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return "SUCCESS: Customer profile updated in CRM.";
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
          
          return "SUCCESS: Appointment secured.";
        });
      } catch (e) { return "ERROR: Sync failed."; }
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
      } catch (e) { return "ERROR: Fail."; }
    },

    delete_appointment: async (args) => {
      const ref = db.collection("barbers").doc(barberId).collection("appointments");
      const snapshot = await ref.where("clientName", "==", args.clientName).get();
      if (snapshot.empty) return "ERROR: Not found.";
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return "SUCCESS: Removed.";
    }
  };
};

// Declaração das Ferramentas para a IA
const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves client CRM data like birthday or notes.", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Checks busy slots." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" }, notes: { type: "string" } }, required: ["clientName", "serviceName", "startTime", "price", "duration"] } },
  { name: "update_appointment", description: "Reschedules booking.", parameters: { type: "object", properties: { oldClientName: { type: "string" }, newStartTime: { type: "string" } }, required: ["oldClientName", "newStartTime"] } },
  { name: "delete_appointment", description: "Cancels booking.", parameters: { type: "object", properties: { clientName: { type: "string" } }, required: ["clientName"] } }
];

/**
 * Lógica Principal
 */
exports.processMessageWithAI = async ({ 
    barberId, barberData, clientName, messageBody, fromNumber, 
    isInitialMessage, db, mappingRef, globalAIConfig, targetLanguage,
    barberTimezone, serverTimeISO 
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        
        // --- DETECÇÃO DE MODO VOZ ---
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace("[PHONE CALL]:", "").trim();

        // --- HITL: VERIFICAÇÃO DE GATILHOS DE PAUSA ---
        const lowerMsg = userMessage.toLowerCase();
        const shouldPause = HUMAN_HANDOFF_KEYWORDS.some(keyword => lowerMsg.includes(keyword));

        if (shouldPause) {
            const pausedMessage = targetLanguage.includes("Portuguese") 
                ? "Entendido. Vou pedir para o profissional assumir a conversa. Aguarde um momento."
                : "Understood. I'll ask the professional to take over. Please wait a moment.";

            await chatRef.set({ 
                status: 'paused', 
                needsAttention: true,
                pausedAt: new Date().toISOString(),
                lastMessage: userMessage,
                clientName: clientName || "Client"
            }, { merge: true });

            return pausedMessage;
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null; 

        // --- PREPARAÇÃO DE CONTEXTO ---
        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const services = servicesSnap.docs.map((doc) => ({ name: doc.data().name, price: doc.data().price, duration: doc.data().duration }));
        const servicesMenu = services.map((s, i) => `- ${s.name}: ${barberData.currency || '$'}${s.price} (${s.duration} min)`).join('\n');

        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const openDaysText = workDays.map(d => dayNames[d]).join(", ");

        // --- AJUSTE DE PROMPT PARA VOZ ---
        let voiceInstructions = "";
        if (isVoiceMode) {
          voiceInstructions = `
          --- MODO TELEFONE ATIVADO ---
          1. FALE CURTO: Suas frases devem ter no máximo 15 palavras.
          2. SEM FORMATAÇÃO: Nunca use asteriscos, negritos, emojis ou listas.
          3. NATURALIDADE: Em vez de ler datas como "2024-10-05", diga "cinco de outubro".
          4. AUDIO-ONLY: Lembre-se que o cliente está ouvindo, não lendo.
          `;
        }

        const MASTER_PROMPT = `
You are Schedy AI Concierge for "${barberData.barberShopName}".
Language: ${targetLanguage || "English (US)"}.

--- OPERATING HOURS ---
- Open Days: ${openDaysText}.
- Business Hours: ${barberData.settings?.businessHours?.open || "09:00"} to ${barberData.settings?.businessHours?.close || "18:00"}.

--- CRM & IDENTITY ---
- Client Name: ${clientName || "UNKNOWN"}. If UNKNOWN, ask for it and call 'save_client_identity'.

--- TIME ---
- Local Time: ${scheduler.currentTimeLocal}. Today: ${scheduler.hojeLocalISO}.
- Agenda: Call 'get_realtime_agenda' before suggesting slots.

--- SERVICES ---
${servicesMenu}

${voiceInstructions}
        `;

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: MASTER_PROMPT + (globalAIConfig?.additionalContext || ""),
            tools: [{ functionDeclarations: toolsDeclaration }]
        });

        let history = chatDoc.exists ? chatDoc.data().history : [];
        const cleanInput = isInitialMessage 
            ? `Hello! scanned QR code for ${barberData.barberShopName}.` 
            : userMessage;

        const chat = model.startChat({ history });
        let result = await chat.sendMessage(cleanInput); 
        
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        // Loop de Ferramentas (Chain of Thought)
        let errorCount = 0;
        while (calls && calls.length > 0) {
            for (const call of calls) {
                const toolResult = await tools[call.name](call.args);
                if (toolResult.includes("ERROR")) errorCount++;

                const finalResult = await chat.sendMessage([{ 
                    functionResponse: { name: call.name, response: { content: toolResult } } 
                }]);
                responseText = finalResult.response.text();
                calls = finalResult.response.functionCalls();
            }
        }

        // --- PAUSA POR ERROS TÉCNICOS ---
        if (errorCount >= 2) {
            await chatRef.update({ status: 'paused', needsAttention: true, pausedReason: 'tool_errors' });
            return targetLanguage.includes("Portuguese") ? "Estou com instabilidade na agenda. Vou passar para o atendimento humano." : "I'm having agenda issues. Switching to human agent.";
        }

        // --- LIMPEZA DE TEXTO PARA TTS (SINTETIZADOR DE VOZ) ---
        if (isVoiceMode) {
          responseText = responseText.replace(/\*/g, '').replace(/#/g, '').trim();
        }

        // Persistência
        await chatRef.set({ 
            history: [...history, { role: "user", parts: [{ text: userMessage }] }, { role: "model", parts: [{ text: responseText }] }].slice(-20),
            lastMessage: userMessage, 
            clientName: clientName || "New Client", 
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return responseText;

    } catch (error) { 
        console.error("AI SERVICE ERROR:", error);
        return "System sync issue. Please try again."; 
    }
};