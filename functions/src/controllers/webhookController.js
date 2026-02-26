const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");

// Inicialização do cliente Twilio para chamadas de saída
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const CONCIERGE_NUMBER = process.env.TWILIO_PHONE_NUMBER; 

const LANGUAGE_MAP = {
  'US': 'English (US)',
  'GB': 'English (UK)',
  'BR': 'Portuguese (Brazil)',
  'PT': 'Portuguese (Portugal)',
  'ES': 'Spanish',
  'FR': 'French',
  'IT': 'Italian'
};

/**
 * Função Auxiliar: Executa a gravação determinística no Firestore
 * após a IA emitir a tag de fechamento.
 */
async function executeAutoBooking(db, barberId, fromNumber, bookingData, clientName) {
  try {
    const { servico, data, hora } = bookingData;
    const startTime = `${data}T${hora}:00`;

    const serviceSnap = await db.collection("barbers").doc(barberId)
      .collection("services").where("name", "==", servico).limit(1).get();
    
    if (serviceSnap.empty) throw new Error("Serviço não encontrado no banco.");
    
    const serviceInfo = serviceSnap.docs[0].data();

    const appointmentRef = db.collection("barbers").doc(barberId).collection("appointments").doc();
    await appointmentRef.set({
      clientName: clientName || "Cliente WhatsApp",
      serviceName: servico,
      startTime: startTime,
      price: serviceInfo.price,
      duration: serviceInfo.duration,
      status: 'scheduled',
      source: 'ai_concierge_auto',
      createdAt: new Date().toISOString()
    });

    const customerRef = db.collection("barbers").doc(barberId).collection("customers").doc(fromNumber);
    await customerRef.set({
      name: clientName,
      lastService: servico,
      lastAppointment: startTime,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("Erro na gravação automática:", error);
    return false;
  }
}

/**
 * Lógica de Roteamento Multi-Tenant
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
      lastInteraction: new Date().toISOString()
    };
    activeMapping.lastActiveBarberId = barberId;
    await mappingRef.set(activeMapping, { merge: true });
    return { barberId, clientName: activeMapping.clientName, isInitialMessage: true, mappingRef, barberData: bData };
  }

  const tenantIds = Object.keys(activeMapping.tenants || {});
  if (tenantIds.length === 0) return { needsLink: true };

  if (tenantIds.length === 1) {
    const barberId = tenantIds[0];
    const barberDoc = await db.collection("barbers").doc(barberId).get();
    return { barberId, clientName: activeMapping.clientName, isInitialMessage: false, mappingRef, barberData: barberDoc.data() };
  }

  const lastActiveId = activeMapping.lastActiveBarberId;
  if (lastActiveId) {
    const barberDoc = await db.collection("barbers").doc(lastActiveId).get();
    return { barberId: lastActiveId, clientName: activeMapping.clientName, isInitialMessage: false, mappingRef, barberData: barberDoc.data() };
  }

  return { needsChoice: true, tenantList: tenantIds.map(id => ({ id, name: activeMapping.tenants[id].name })) };
}

/**
 * Controlador Principal
 */
exports.handleIncomingMessage = async (req, res) => {
  const db = admin.firestore();
  const twiml = new twilio.twiml.MessagingResponse();
  const fromNumber = req.body.From;
  const messageBody = req.body.Body || "";
  
  const isCall = req.body.CallSid || (!req.body.Body && req.body.From);

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);

    // --- TRAVA DE SEGURANÇA 1: VERIFICAÇÃO DE PAUSA (HITL) ---
    // Buscamos o estado da conversa para este cliente e barbeiro
    const mappingDoc = await result.mappingRef.get();
    const mappingData = mappingDoc.data();
    const isAiPaused = mappingData?.tenants?.[result.barberId]?.status === 'paused';

    if (isAiPaused && !isCall) {
      console.log(`[HITL] IA pausada para o cliente ${fromNumber}. Aguardando humano.`);
      // Retornamos 200 OK vazio. A IA não responde, permitindo o transbordo manual.
      return res.status(200).send("AI_PAUSED");
    }

    if (isCall) {
      if (result.barberId && result.barberData) {
        const barberName = result.barberData.barberShopName || "the professional";
        const lang = result.barberData.country === 'BR' ? 'pt' : 'en';
        const msg = lang === 'pt' 
            ? `Olá! Notei sua chamada para ${barberName}. 🤖 Vou te ligar de volta em instantes para agendarmos seu horário!`
            : `Hello! I noticed your call for ${barberName}. 🤖 I'll call you back in a moment to handle your booking!`;

        await twilioClient.messages.create({ body: msg, from: `whatsapp:${CONCIERGE_NUMBER}`, to: fromNumber });
        await twilioClient.calls.create({
            url: `https://${process.env.PROJECT_ID}.web.app/voice-logic?barberId=${result.barberId}&to=${fromNumber}`,
            to: fromNumber.replace('whatsapp:', ''), 
            from: CONCIERGE_NUMBER
        });
      }
      return res.status(200).send("Call intent handled.");
    }

    if (result.needsLink) {
      twiml.message("Welcome! 🤖\nPlease use the booking link from your professional to start.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    if (result.needsChoice) {
      twiml.message("Hello! 🤖\nWho would you like to book with today?\n" + result.tenantList.map((t, i) => `${i + 1}) ${t.name}`).join("\n"));
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    if (result.barberData.plan !== 'pro') {
      twiml.message("Schedy: This assistant is currently offline.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const globalAIConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { additionalContext: "" };

    // EXECUÇÃO DA IA
    let responseText = await processMessageWithAI({
      barberId: result.barberId,
      barberData: result.barberData,
      clientName: result.clientName,
      messageBody,
      fromNumber,
      isInitialMessage: result.isInitialMessage,
      db,
      mappingRef: result.mappingRef,
      globalAIConfig,
      targetLanguage: LANGUAGE_MAP[result.barberData.country || 'US'],
      barberTimezone: result.barberData.timezone || 'UTC',
      serverTimeISO: new Date().toISOString()
    });

    // --- TRAVA DE SEGURANÇA 2: INTERCEPTAÇÃO DA TAG [PAUSE_AI] ---
    if (responseText.includes("[PAUSE_AI]")) {
      console.log(`[PAUSE_TRIGGER] Transbordo solicitado para ${fromNumber}`);
      
      // 1. Atualiza o status no mapeamento para bloquear futuras respostas da IA
      await result.mappingRef.set({
        tenants: {
          [result.barberId]: { status: 'paused', pausedAt: new Date().toISOString() }
        }
      }, { merge: true });

      // 2. Marca o chat do barbeiro com um alerta visual
      const chatRef = db.collection("barbers").doc(result.barberId).collection("chats").doc(fromNumber);
      await chatRef.set({ status: 'paused', needsAttention: true }, { merge: true });

      // 3. Remove a tag da mensagem enviada ao cliente
      responseText = responseText.replace("[PAUSE_AI]", "").trim();
    }

    // --- PARSER DE TAG DE FINALIZAÇÃO ---
    const tagMatch = responseText.match(/\[FINALIZAR_AGENDAMENTO:\s*({.*?})\]/s);
    if (tagMatch) {
      try {
        const bookingData = JSON.parse(tagMatch[1]);
        const success = await executeAutoBooking(db, result.barberId, fromNumber, bookingData, result.clientName);
        if (success) {
          responseText = responseText.replace(/\[FINALIZAR_AGENDAMENTO:.*?\]/gs, "").trim();
        }
      } catch (e) { console.error("Erro parser agendamento:", e); }
    }

    twiml.message(responseText);
    res.status(200).type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    if (!isCall) {
        twiml.message("Sorry, I'm a bit busy. Try again in a second! 🤖");
        res.status(200).type("text/xml").send(twiml.toString());
    } else {
        res.status(500).send("Error");
    }
  }
};