const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");
const { bookingService } = require("../services/bookingService");
const { circuitBreaker } = require("../utils/circuitBreaker");
const { conversationGovernor } = require("../services/conversationGovernor");

// Inicialização do cliente Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const CONCIERGE_NUMBER = process.env.TWILIO_PHONE_NUMBER; 

const LANGUAGE_MAP = {
  'US': 'English (US)', 'GB': 'English (UK)', 'BR': 'Portuguese (Brazil)',
  'PT': 'Portuguese (Portugal)', 'ES': 'Spanish', 'FR': 'French', 'IT': 'Italian'
};

/**
 * EXECUÇÃO DE AGENDAMENTO DETERMINÍSTICO COM IDEMPOTÊNCIA
 * Usado como fallback caso a IA utilize tags de texto em vez de Function Calling.
 */
async function executeAutoBooking(db, barberId, fromNumber, bookingData, clientName) {
  try {
    const { servico, data, hora } = bookingData;
    const startTime = `${data}T${hora}:00`;

    // 1. CHECAGEM DE IDEMPOTÊNCIA (Evita duplicidade)
    const existingQuery = await db.collection("barbers").doc(barberId).collection("appointments")
      .where("clientPhone", "==", fromNumber)
      .where("startTime", "==", startTime)
      .where("status", "in", ["CONFIRMED", "scheduled"])
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log(`[IDEMPOTENCY] Agendamento já existente para ${fromNumber}`);
      return true; 
    }

    // 2. BUSCA DADOS DO SERVIÇO (Source of Truth)
    const serviceSnap = await db.collection("barbers").doc(barberId)
      .collection("services").where("name", "==", servico).limit(1).get();
    
    if (serviceSnap.empty) throw new Error("Service technical name not found.");
    const serviceInfo = serviceSnap.docs[0].data();

    // 3. GRAVAÇÃO (Status 'scheduled' para aparecer no Dashboard visual)
    const appointmentRef = db.collection("barbers").doc(barberId).collection("appointments").doc();
    await appointmentRef.set({
      clientName: clientName || "Cliente WhatsApp",
      clientPhone: fromNumber,
      serviceName: servico,
      startTime: startTime,
      price: serviceInfo.price,
      duration: serviceInfo.duration,
      status: 'scheduled',
      source: 'ai_concierge_deterministic',
      createdAt: new Date().toISOString()
    });

    // 4. ATUALIZA CRM
    const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
    await customerRef.set({
      name: clientName,
      lastService: servico,
      lastAppointment: startTime,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("[AUTO-BOOKING FAIL]", error);
    return false;
  }
}

/**
 * LÓGICA DE ROTEAMENTO MULTI-TENANT
 * Vincula o número de telefone ao barbeiro específico via Slug ou ID.
 */
async function identifyTenant(messageBody, fromNumber, db) {
  const mappingRef = db.collection("customer_mappings").doc(fromNumber);
  const mappingDoc = await mappingRef.get();
  const idMatch = messageBody ? messageBody.match(/(?:ID:|Ref:)\s*([a-zA-Z0-9-_]+)/i) : null;
  let activeMapping = mappingDoc.exists ? mappingDoc.data() : { tenants: {}, clientName: null };

  if (idMatch) {
    const providedId = idMatch[1];
    const slugQuery = await db.collection("barbers").where("slug", "==", providedId).get();
    const barberId = !slugQuery.empty ? slugQuery.docs[0].id : providedId;
    const barberDoc = await db.collection("barbers").doc(barberId).get();
    if (!barberDoc.exists) return { error: "Not found" };

    if (!activeMapping.tenants) activeMapping.tenants = {};
    activeMapping.tenants[barberId] = {
      name: barberDoc.data().barberShopName || "Professional",
      lastInteraction: new Date().toISOString(),
      interactionCount: 0,
      status: 'active'
    };
    activeMapping.lastActiveBarberId = barberId;
    await mappingRef.set(activeMapping, { merge: true });
    return { 
        barberId, 
        clientName: activeMapping.clientName, 
        isInitialMessage: true, 
        mappingRef, 
        barberData: barberDoc.data() 
    };
  }

  const lastId = activeMapping.lastActiveBarberId;
  if (!lastId) return { needsLink: true };
  const barberDoc = await db.collection("barbers").doc(lastId).get();
  return { 
      barberId: lastId, 
      clientName: activeMapping.clientName, 
      mappingRef, 
      barberData: barberDoc.data() 
  };
}

/**
 * CONTROLADOR PRINCIPAL
 */
exports.handleIncomingMessage = async (req, res) => {
  const db = admin.firestore();
  const twiml = new twilio.twiml.MessagingResponse();
  const fromNumber = req.body.From;
  const messageBody = req.body.Body || "";
  const isCall = req.body.CallSid || (!req.body.Body && req.body.From);

  let currentContext = { barberId: null, clientPhone: fromNumber, flow: isCall ? "VOICE" : "TEXT" };

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);
    currentContext.barberId = result.barberId;

    // 1. Resposta para novos clientes sem link/slug
    if (result.needsLink) {
      twiml.message("Bem-vindo ao Schedy! 🤖 Use o link oficial da sua barbearia para começar.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 2. INVARIANTE: READ-BEFORE-RESPOND (Consulta Firestore antes de processar)
    const validatedState = await bookingService.checkBookingStatus(result.barberId, fromNumber, result.clientName);

    // 3. CONVERSATION GOVERNOR (Avaliação do limite de 10 interações)
    const mappingDoc = await result.mappingRef.get();
    const mappingData = mappingDoc.data();
    const tenantContext = mappingData?.tenants?.[result.barberId] || {};
    const interactionCount = tenantContext.interactionCount || 0;
    const isPaused = tenantContext.status === 'paused';

    if (isPaused && !isCall) return res.status(200).send("AI_PAUSED");

    const governorResult = await conversationGovernor.evaluateEscalation(result.barberId, fromNumber, interactionCount, validatedState.state);
    if (governorResult.shouldEscalate) {
      twiml.message(governorResult.fallbackMessage);
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 4. LÓGICA DE VOZ (Twilio Voice Integration)
    if (isCall && result.barberId) {
       await twilioClient.calls.create({
            url: `https://${process.env.PROJECT_ID}.web.app/voice-logic?barberId=${result.barberId}&to=${fromNumber}`,
            to: fromNumber.replace('whatsapp:', ''), from: CONCIERGE_NUMBER
       });
       return res.status(200).send("Call handled");
    }

    // 5. PROCESSAMENTO VIA IA (Gemini Orquestrador)
    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const aiResponse = await processMessageWithAI({
      barberId: result.barberId,
      barberData: result.barberData,
      clientName: result.clientName,
      messageBody,
      fromNumber,
      isInitialMessage: result.isInitialMessage,
      db,
      mappingRef: result.mappingRef,
      globalAIConfig: aiConfigSnap.exists ? aiConfigSnap.data() : {},
      targetLanguage: LANGUAGE_MAP[result.barberData.country || 'US'],
      barberTimezone: result.barberData.timezone || 'UTC',
      serverTimeISO: new Date().toISOString(),
      validatedBookingState: validatedState 
    });

    let { responseText, toolExecuted } = aiResponse;

    // --- FILTRO DE HIGIENIZAÇÃO ATÔMICA ---
    const shouldPause = responseText.includes("[PAUSE_AI]");
    const bookingMatch = responseText.match(/\[FINALIZAR_AGENDAMENTO:\s*({.*?})\]/s);

    responseText = responseText
        .replace(/\[PAUSE_AI\]/g, "")
        .replace(/\[FINALIZAR_AGENDAMENTO:.*?\]/gs, "")
        .trim();

    // --- PROCESSAMENTO DE ESTADO E RESET DO GOVERNOR ---
    let nextInteractionCount = interactionCount + 1;

    // Se o cliente pausar a IA (HITL)
    if (shouldPause) {
      await result.mappingRef.set({ tenants: { [result.barberId]: { status: 'paused' } } }, { merge: true });
      const chatRef = db.collection("barbers").doc(result.barberId).collection("chats").doc(fromNumber);
      await chatRef.set({ status: 'paused', needsAttention: true }, { merge: true });
    }

    // Se houve sucesso em uma ferramenta (Function Calling) OU via Tag Legacy
    if (toolExecuted === true || bookingMatch) {
      let resetReason = toolExecuted ? "FunctionTool" : "RegexTag";
      
      if (bookingMatch && !toolExecuted) {
        try {
          const bookingData = JSON.parse(bookingMatch[1]);
          await executeAutoBooking(db, result.barberId, fromNumber, bookingData, result.clientName);
        } catch (e) { console.error("Parse error na tag legacy", e); }
      }
      
      // RESET DO GOVERNOR: Ação produtiva detectada, contador volta a zero.
      nextInteractionCount = 0;
      console.log(`[GOVERNOR] Reset count para 0 (${resetReason}) para ${fromNumber}`);
    }

    // Grava o novo estado no Firestore (incremento ou reset)
    await result.mappingRef.set({
      tenants: { 
        [result.barberId]: { 
          interactionCount: nextInteractionCount, 
          lastInteraction: new Date().toISOString() 
        } 
      }
    }, { merge: true });

    twiml.message(responseText);
    res.status(200).type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error("[WEBHOOK ERROR]", error);
    await circuitBreaker.trigger(error, currentContext);
    twiml.message("Estou com dificuldade em acessar a agenda agora. Vou pedir para o profissional te responder manualmente! 🤖");
    res.status(200).type("text/xml").send(twiml.toString());
  }
};