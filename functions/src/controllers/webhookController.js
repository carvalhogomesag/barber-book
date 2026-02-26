const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");

// Inicialização do cliente Twilio para chamadas de saída
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const CONCIERGE_NUMBER = process.env.TWILIO_PHONE_NUMBER; // Seu número +1

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
 * Lógica de Roteamento Multi-Tenant
 */
async function identifyTenant(messageBody, fromNumber, db) {
  const mappingRef = db.collection("customer_mappings").doc(fromNumber);
  const mappingDoc = await mappingRef.get();
  
  // Se for uma chamada, o messageBody virá vazio. 
  // Nesses casos, tentamos identificar o profissional pelo histórico de mapeamento.
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
  
  // DETECÇÃO DE CHAMADA (WhatsApp ou Voz Direta)
  // Se existir CallSid ou se não houver Body, mas houver From, tratamos como tentativa de voz
  const isCall = req.body.CallSid || (!req.body.Body && req.body.From);

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);

    if (isCall) {
      console.log(`[VOICE EVENT] Tentativa de chamada detectada de: ${fromNumber}`);
      
      // Se identificamos o barbeiro, enviamos a mensagem de retorno
      if (result.barberId && result.barberData) {
        const barberName = result.barberData.barberShopName || "the professional";
        const lang = result.barberData.country === 'BR' ? 'pt' : 'en';

        const msg = lang === 'pt' 
            ? `Olá! Notei sua chamada para ${barberName}. 🤖 Vou te ligar de volta em 10 segundos para agendarmos seu horário!`
            : `Hello! I noticed your call for ${barberName}. 🤖 I'll call you back in 10 seconds to handle your booking!`;

        // Envia WhatsApp de resposta imediata
        await twilioClient.messages.create({
            body: msg,
            from: `whatsapp:${CONCIERGE_NUMBER}`,
            to: fromNumber
        });

        // DISPARA A LIGAÇÃO DE RETORNO (Outbound)
        // A URL aponta para uma função que gera o TwiML da conversa
        await twilioClient.calls.create({
            url: `https://${process.env.PROJECT_ID}.web.app/voice-logic?barberId=${result.barberId}&to=${fromNumber}`,
            to: fromNumber.replace('whatsapp:', ''), // Remove o prefixo se for chamada PSTN
            from: CONCIERGE_NUMBER
        });
      }
      return res.status(200).send("Call intent handled.");
    }

    // --- SEGUE O FLUXO NORMAL DE TEXTO ---
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

    // Processamento normal com IA (Gemini)
    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const globalAIConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { additionalContext: "" };

    const responseText = await processMessageWithAI({
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