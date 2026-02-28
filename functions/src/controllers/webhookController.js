const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");
const { bookingService } = require("../services/bookingService");
const { circuitBreaker } = require("../utils/circuitBreaker");
const { conversationGovernor } = require("../services/conversationGovernor");

// Inicialização do cliente Twilio para chamadas de saída e SMS
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const CONCIERGE_NUMBER = process.env.TWILIO_PHONE_NUMBER; 

const LANGUAGE_MAP = {
  'US': 'English (US)', 'GB': 'English (UK)', 'BR': 'Portuguese (Brazil)',
  'PT': 'Portuguese (Portugal)', 'ES': 'Spanish', 'FR': 'French', 'IT': 'Italian'
};

/**
 * EXECUÇÃO DE AGENDAMENTO DETERMINÍSTICO COM IDEMPOTÊNCIA (Princípio 8)
 * Garante que mensagens duplicadas não gerem agendamentos duplicados.
 */
async function executeAutoBooking(db, barberId, fromNumber, bookingData, clientName) {
  try {
    const { servico, data, hora } = bookingData;
    const startTime = `${data}T${hora}:00`;

    // 1. CHECAGEM DE IDEMPOTÊNCIA: Verifica se já existe agendamento ativo para este slot/cliente
    const existingQuery = await db.collection("barbers").doc(barberId).collection("appointments")
      .where("clientPhone", "==", fromNumber)
      .where("startTime", "==", startTime)
      .where("status", "!=", "CANCELLED")
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log(`[IDEMPOTENCY] Agendamento ignorado: Já existe registro para ${fromNumber} em ${startTime}`);
      return true; 
    }

    // 2. BUSCA DADOS REAIS DO SERVIÇO (Fonte de Verdade)
    const serviceSnap = await db.collection("barbers").doc(barberId)
      .collection("services").where("name", "==", servico).limit(1).get();
    
    if (serviceSnap.empty) throw new Error("Serviço técnico não localizado no banco.");
    const serviceInfo = serviceSnap.docs[0].data();

    // 3. GRAVAÇÃO DETERMINÍSTICA
    const appointmentRef = db.collection("barbers").doc(barberId).collection("appointments").doc();
    await appointmentRef.set({
      clientName: clientName || "Cliente WhatsApp",
      clientPhone: fromNumber,
      serviceName: servico,
      startTime: startTime,
      price: serviceInfo.price,
      duration: serviceInfo.duration,
      status: 'CONFIRMED',
      source: 'ai_concierge_deterministic',
      createdAt: new Date().toISOString()
    });

    // 4. ATUALIZA CRM DO CLIENTE
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
 * LÓGICA DE ROTEAMENTO MULTI-TENANT (Switchboard)
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
    const bData = barberDoc.data();

    if (!activeMapping.tenants) activeMapping.tenants = {};
    activeMapping.tenants[barberId] = {
      name: bData.barberShopName || bData.name || "Professional",
      lastInteraction: new Date().toISOString(),
      interactionCount: 0,
      status: 'active'
    };
    activeMapping.lastActiveBarberId = barberId;
    await mappingRef.set(activeMapping, { merge: true });
    return { barberId, clientName: activeMapping.clientName, isInitialMessage: true, mappingRef, barberData: bData };
  }

  const tenantIds = Object.keys(activeMapping.tenants || {});
  if (tenantIds.length === 0) return { needsLink: true };

  const lastId = activeMapping.lastActiveBarberId;
  if (!lastId) return { needsLink: true };

  const barberDoc = await db.collection("barbers").doc(lastId).get();
  
  return { barberId: lastId, clientName: activeMapping.clientName, mappingRef, barberData: barberDoc.data() };
}

/**
 * CONTROLADOR PRINCIPAL (Webhook Entry Point)
 */
exports.handleIncomingMessage = async (req, res) => {
  const db = admin.firestore();
  const twiml = new twilio.twiml.MessagingResponse();
  const fromNumber = req.body.From;
  const messageBody = req.body.Body || "";
  const isCall = req.body.CallSid || (!req.body.Body && req.body.From);

  // Contexto para logs e Circuit Breaker
  let currentContext = { barberId: null, clientPhone: fromNumber, flow: isCall ? "VOICE" : "TEXT" };

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);
    currentContext.barberId = result.barberId;

    if (result.needsLink) {
      twiml.message("Bem-vindo ao Schedy! 🤖 Use o link oficial da sua barbearia para começar.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // --- 1. INVARIANTE: READ-BEFORE-RESPOND ---
    const validatedState = await bookingService.checkBookingStatus(result.barberId, fromNumber, result.clientName);

    // --- 2. CONVERSATION GOVERNOR (Avalia o novo limite de 10 interações) ---
    const mappingDoc = await result.mappingRef.get();
    const mappingData = mappingDoc.data();
    const interactionCount = mappingData?.tenants?.[result.barberId]?.interactionCount || 0;
    const isPaused = mappingData?.tenants?.[result.barberId]?.status === 'paused';

    // Bloqueia resposta da IA se o status for pausado (HITL)
    if (isPaused && !isCall) {
        console.log(`[HITL] Silenciando IA para ${fromNumber} (Status: Pausado)`);
        return res.status(200).send("AI_PAUSED_SILENT");
    }

    // O Governor decide se deve escalar baseado no limite de interações
    const governorResult = await conversationGovernor.evaluateEscalation(
      result.barberId, fromNumber, interactionCount, validatedState.state
    );

    if (governorResult.shouldEscalate) {
      twiml.message(governorResult.fallbackMessage);
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // --- 3. LÓGICA DE VOZ (CALL BACK) ---
    if (isCall && result.barberId) {
       const lang = result.barberData.country === 'BR' ? 'pt' : 'en';
       const callbackMsg = lang === 'pt' 
            ? `Notei sua chamada! 🤖 Vou te ligar de volta em instantes para resolvermos sua agenda!`
            : `I noticed your call! 🤖 I'll call you back in a moment to handle your booking!`;

       await twilioClient.messages.create({ body: callbackMsg, from: `whatsapp:${CONCIERGE_NUMBER}`, to: fromNumber });
       await twilioClient.calls.create({
            url: `https://${process.env.PROJECT_ID}.web.app/voice-logic?barberId=${result.barberId}&to=${fromNumber}`,
            to: fromNumber.replace('whatsapp:', ''), 
            from: CONCIERGE_NUMBER
       });
       return res.status(200).send("Voice callback initiated.");
    }

    // --- 4. LLM ISOLATION ---
    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    let responseText = await processMessageWithAI({
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

    // --- 5. ATUALIZAÇÃO DO GOVERNOR (Incremento do contador) ---
    await result.mappingRef.set({
      tenants: {
        [result.barberId]: { 
          interactionCount: interactionCount + 1,
          lastInteraction: new Date().toISOString()
        }
      }
    }, { merge: true });

    // --- 6. TRANSACTIONAL TAG PARSER ---
    // Escalonamento Humano via Tag Manual da IA
    if (responseText.includes("[PAUSE_AI]")) {
      await result.mappingRef.set({ tenants: { [result.barberId]: { status: 'paused' } } }, { merge: true });
      const chatRef = db.collection("barbers").doc(result.barberId).collection("chats").doc(fromNumber);
      await chatRef.set({ status: 'paused', needsAttention: true }, { merge: true });
      responseText = responseText.replace("[PAUSE_AI]", "").trim();
    }

    // Gravação automática via Tag de Finalização
    const tagMatch = responseText.match(/\[FINALIZAR_AGENDAMENTO:\s*({.*?})\]/s);
    if (tagMatch) {
      try {
        const bookingData = JSON.parse(tagMatch[1]);
        const success = await executeAutoBooking(db, result.barberId, fromNumber, bookingData, result.clientName);
        if (success) {
          responseText = responseText.replace(/\[FINALIZAR_AGENDAMENTO:.*?\]/gs, "").trim();
          // Reset interaction count ao finalizar transação com sucesso
          await result.mappingRef.set({ tenants: { [result.barberId]: { interactionCount: 0 } } }, { merge: true });
        }
      } catch (e) { console.error("[TAG_PARSER_ERROR]", e); }
    }

    twiml.message(responseText);
    res.status(200).type("text/xml").send(twiml.toString());

  } catch (error) {
    // --- 7. CIRCUIT BREAKER ---
    await circuitBreaker.trigger(error, currentContext);
    const fallbackMsg = "Estou com dificuldade para acessar a agenda agora. Vou solicitar que o profissional te responda manualmente em instantes! 🤖";
    twiml.message(fallbackMsg);
    res.status(200).type("text/xml").send(twiml.toString());
  }
};