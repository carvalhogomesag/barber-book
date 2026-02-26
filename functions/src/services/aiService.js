const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../config"); 
const { generateSystemInstruction } = require("../../prompts"); 
const { getSchedulerContext } = require("../../utils"); 
const { logAiInteraction } = require("./loggingService");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- LISTA DE PALAVRAS-CHAVE PARA INTERVENÇÃO HUMANA ---
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
 * Fábrica de Ferramentas (Tools Factory)
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
      return `SUCCESS: Client identity saved globally and in your local database.`;
    },

    update_customer_data: async (args) => {
      const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
      await customerRef.set({
        ...args,
        phone: fromNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return "SUCCESS: Customer profile updated with captured information.";
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
          
          return "SUCCESS: Appointment secured and client CRM updated.";
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

const toolsDeclaration = [
  { name: "save_client_identity", description: "Registers client name locally and globally.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "update_customer_data", description: "Saves client CRM data.", parameters: { type: "object", properties: { preferences: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" } } } },
  { name: "get_realtime_agenda", description: "Checks busy slots." },
  { name: "create_appointment", description: "Persists NEW booking.", parameters: { type: "object", properties: { clientName: { type: "string" }, serviceName: { type: "string" }, startTime: { type: "string" }, price: { type: "number" }, duration: { type: "number" }, notes: { type: "string" } }, required: ["clientName", "serviceName", "startTime", "price", "duration"] } },
  { name: "update_appointment", description: "Reschedules booking.", parameters: { type: "object", properties: { oldClientName: { type: "string" }, newStartTime: { type: "string" } }, required: ["oldClientName", "newStartTime"] } },
  { name: "delete_appointment", description: "Cancels booking.", parameters: { type: "object", properties: { clientName: { type: "string" } }, required: ["clientName"] } }
];

/**
 * Lógica Principal de Processamento com IA Dinâmica + HITL (Human-in-the-Loop)
 */
exports.processMessageWithAI = async ({ 
    barberId, 
    barberData, 
    clientName, 
    messageBody, 
    fromNumber, 
    isInitialMessage, 
    db, 
    mappingRef, 
    globalAIConfig, 
    targetLanguage 
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        
        // --- HITL: VERIFICAÇÃO DE GATILHOS DE PAUSA ---
        const lowerMsg = messageBody.toLowerCase();
        const shouldPause = HUMAN_HANDOFF_KEYWORDS.some(keyword => lowerMsg.includes(keyword));

        if (shouldPause) {
            const pausedMessage = targetLanguage.includes("Portuguese") 
                ? "Entendido. Vou pedir para o profissional assumir a conversa. Aguarde um momento."
                : "Understood. I'll ask the professional to take over. Please wait a moment.";

            // Pausa a automação no banco de dados
            await chatRef.set({ 
                status: 'paused', 
                needsAttention: true,
                pausedAt: new Date().toISOString(),
                lastMessage: messageBody,
                clientName: clientName || "Client"
            }, { merge: true });

            return pausedMessage;
        }

        // --- VERIFICA SE JÁ ESTÁ PAUSADO ---
        // Se o status já for 'paused', a IA não deve responder nada (silêncio total)
        // O webhookController deve tratar isso antes, mas verificamos aqui por segurança.
        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') {
             // Retorna string vazia ou null para indicar silêncio
             return null; 
        }

        // --- CONTINUAÇÃO NORMAL DA IA ---
        const timezone = barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const services = servicesSnap.docs.map((doc) => ({ name: doc.data().name, price: doc.data().price, duration: doc.data().duration }));
        const servicesMenu = services.map((s, i) => `${i + 1}) ${s.name} — ${barberData.currency || '$'}${s.price} (${s.duration} min)`).join('\n');

        const workDays = barberData.settings?.businessHours?.days || [1, 2, 3, 4, 5];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const openDaysText = workDays.map(d => dayNames[d]).join(", ");

        const MASTER_PROMPT = `
You are Schedy AI, the Expert Concierge for "${barberData.barberShopName}".
Your goal is to manage the schedule while building a rich database of clients for the professional.

--- LANGUAGE & TONE ---
- **PRIMARY LANGUAGE:** ${targetLanguage || "English (US)"}
- **Tone:** Professional, polite, and efficient.
- **Adaptability:** If the user speaks another language, switch immediately to match them.

--- OPERATING HOURS & RULES ---
- **Open Days:** ${openDaysText}.
- **Closed Days:** Do NOT book appointments on days NOT listed above.
- **Business Hours:** ${barberData.settings?.businessHours?.open || "09:00"} to ${barberData.settings?.businessHours?.close || "18:00"}.
- **Break Time:** ${barberData.settings?.businessHours?.break || "None"}.

--- 1. IDENTITY & CRM (CRITICAL) ---
- Current Contact Name: ${clientName || "UNKNOWN"}.
- If Name is "UNKNOWN", ask for it and call 'save_client_identity' immediately.
- For Third-Party/Kids: Ask for the beneficiary's name and the guardian's name.
- Proactive Data Mining: Listen for birthdays, style preferences, allergies, or habits. Call 'update_customer_data'.

--- 2. TIME & AGENDA ---
- Current Local Time: ${scheduler.currentTimeLocal}
- Today's Date: ${scheduler.hojeLocalISO}
- Date Menu Options:
${scheduler.dateMenuString}
- SECURITY: Prohibited from booking in the past. 
- CONFLICTS: ALWAYS call 'get_realtime_agenda' before suggesting slots.

--- 3. FINAL CONFIRMATION (MANDATORY) ---
- For ANY change, you MUST show a summary (Client, Service, Date, Time, Notes) and wait for confirmation "1" before executing tools.

--- SERVICES AVAILABLE ---
${servicesMenu}
        `;

        let finalInstruction = MASTER_PROMPT;
        if (globalAIConfig && globalAIConfig.additionalContext) {
            finalInstruction += `\n\n--- CUSTOM KNOWLEDGE BASE & ADDITIONAL TRAINING ---\n${globalAIConfig.additionalContext}`;
        }

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: finalInstruction,
            tools: [{ functionDeclarations: toolsDeclaration }]
        });

        let history = chatDoc.exists ? chatDoc.data().history : [];
        const cleanMessageBody = isInitialMessage 
            ? `Hello! scanned your QR code for ${barberData.barberShopName}. Introduce yourself.` 
            : messageBody;

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(cleanMessageBody); 
        
        let responseText = result.response.text();
        const calls = result.response.functionCalls();

        // --- HITL: CONTADOR DE ERROS DE FERRAMENTA ---
        let errorCount = 0;

        if (calls && calls.length > 0) {
            for (const call of calls) {
                const toolResult = await tools[call.name](call.args);
                
                // Verifica se a ferramenta retornou erro
                if (toolResult.includes("ERROR")) {
                    errorCount++;
                }

                const finalResult = await chat.sendMessage([{ 
                    functionResponse: { 
                        name: call.name, 
                        response: { content: toolResult } 
                    } 
                }]);
                responseText = finalResult.response.text();
            }
        }

        // --- PAUSA POR EXCESSO DE ERROS ---
        if (errorCount >= 2) {
            const errorPauseMsg = targetLanguage.includes("Portuguese")
                ? "Estou tendo dificuldades técnicas para acessar a agenda. Vou encaminhar para o atendimento humano."
                : "I'm having trouble accessing the schedule. I'll forward this to a human agent.";
            
            await chatRef.set({ 
                status: 'paused', 
                needsAttention: true,
                pausedReason: 'tool_errors',
                pausedAt: new Date().toISOString()
            }, { merge: true });

            // Substitui a resposta da IA pela mensagem de erro amigável
            responseText = errorPauseMsg;
        }

        // Persistência do Histórico
        await chatRef.set({ 
            history: [
                ...history, 
                { role: "user", parts: [{ text: messageBody }] }, 
                { role: "model", parts: [{ text: responseText }] }
            ],
            lastMessage: messageBody, 
            clientName: clientName || "New Client", 
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return responseText;

    } catch (error) { 
        console.error("AI SERVICE ERROR:", error);
        throw error; 
    }
};