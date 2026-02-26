const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");

// MAPA DE IDIOMAS (Sincronizado com o Frontend)
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
 * Lógica de Roteamento Multi-Tenant (Switchboard)
 * --- MANTIDO INTEGRALMENTE ---
 */
async function identifyTenant(messageBody, fromNumber, db) {
  const mappingRef = db.collection("customer_mappings").doc(fromNumber);
  const mappingDoc = await mappingRef.get();
  
  const idMatch = messageBody.match(/ID:\s*([a-zA-Z0-9-_]+)/i);
  let activeMapping = mappingDoc.exists ? mappingDoc.data() : { tenants: {}, clientName: null };

  // --- CENÁRIO 1: ENTRADA POR LINK/QR CODE (ID EXPLÍCITO) ---
  if (idMatch) {
    const providedId = idMatch[1];
    const slugQuery = await db.collection("barbers").where("slug", "==", providedId).get();
    const barberId = !slugQuery.empty ? slugQuery.docs[0].id : providedId;

    const barberDoc = await db.collection("barbers").doc(barberId).get();
    if (!barberDoc.exists) return { error: "Professional not found." };

    const bData = barberDoc.data();

    if (!activeMapping.tenants) activeMapping.tenants = {};
    activeMapping.tenants[barberId] = {
      name: bData.barberShopName || "Professional",
      lastInteraction: new Date().toISOString()
    };
    activeMapping.lastActiveBarberId = barberId;

    await mappingRef.set(activeMapping, { merge: true });

    return { 
      barberId, 
      clientName: activeMapping.clientName, 
      isInitialMessage: true, 
      mappingRef,
      barberData: bData 
    };
  }

  // --- CENÁRIO 2: CLIENTE SEM HISTÓRICO ---
  const tenantIds = Object.keys(activeMapping.tenants || {});
  if (tenantIds.length === 0) {
    return { needsLink: true };
  }

  // --- CENÁRIO 3: APENAS UM PROFISSIONAL NO HISTÓRICO ---
  if (tenantIds.length === 1) {
    const barberId = tenantIds[0];
    const barberDoc = await db.collection("barbers").doc(barberId).get();
    return { 
      barberId, 
      clientName: activeMapping.clientName, 
      isInitialMessage: false, 
      mappingRef,
      barberData: barberDoc.data()
    };
  }

  // --- CENÁRIO 4: MÚLTIPLOS PROFISSIONAIS (SWITCHBOARD) ---
  const lastActiveId = activeMapping.lastActiveBarberId;
  const lastTime = new Date(activeMapping.tenants[lastActiveId]?.lastInteraction || 0);
  const diffMinutes = (new Date() - lastTime) / (1000 * 60);

  if (diffMinutes < 30) {
    const barberDoc = await db.collection("barbers").doc(lastActiveId).get();
    return { 
      barberId: lastActiveId, 
      clientName: activeMapping.clientName, 
      isInitialMessage: false, 
      mappingRef,
      barberData: barberDoc.data()
    };
  }

  const choice = parseInt(messageBody.trim());
  if (!isNaN(choice) && choice > 0 && choice <= tenantIds.length) {
    const selectedId = tenantIds[choice - 1];
    await mappingRef.update({ lastActiveBarberId: selectedId });
    const barberDoc = await db.collection("barbers").doc(selectedId).get();
    return { 
      barberId: selectedId, 
      clientName: activeMapping.clientName, 
      isInitialMessage: false, 
      mappingRef,
      barberData: barberDoc.data()
    };
  }

  return { 
    needsChoice: true, 
    tenantList: tenantIds.map(id => ({ id, name: activeMapping.tenants[id].name })) 
  };
}

/**
 * Controlador Principal do Webhook
 * ATUALIZADO: Determina o idioma com base no país do profissional.
 */
exports.handleIncomingMessage = async (req, res) => {
  const messageBody = req.body.Body || "";
  const fromNumber = req.body.From;
  const db = admin.firestore();
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);

    // 1. Cliente novo sem link
    if (result.needsLink) {
      // Fallback message in English (Universal)
      twiml.message("Welcome to Schedy! 🤖\nPlease use the booking link provided by your professional to start.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 2. Menu de Escolha (Switchboard)
    if (result.needsChoice) {
      const menuText = result.tenantList
        .map((t, i) => `${i + 1}) ${t.name}`)
        .join("\n");
      
      twiml.message(`Hello! I see you have appointments with multiple professionals. 🤖\n\nWho would you like to talk to?\n\n${menuText}\n\nReply with the number.`);
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 3. Erro de identificação
    if (result.error || !result.barberId) {
      twiml.message("Professional not found. Please check the link.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 4. Verificação de Plano PRO
    if (result.barberData.plan !== 'pro') {
      twiml.message("Schedy: This professional's AI assistant is currently inactive.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const globalAIConfig = aiConfigSnap.exists 
      ? aiConfigSnap.data() 
      : { systemPrompt: "", additionalContext: "" };

    // 5. Atualiza timestamp
    await result.mappingRef.set({
      tenants: { [result.barberId]: { lastInteraction: new Date().toISOString() } },
      lastActiveBarberId: result.barberId
    }, { merge: true });

    // --- LÓGICA DE IDIOMA DA IA (NOVO) ---
    // Pega o país do cadastro do barbeiro (ex: 'BR', 'US') e converte para idioma extenso
    const barberCountry = result.barberData.country || 'US';
    const targetLanguage = LANGUAGE_MAP[barberCountry] || 'English (US)';

    // 6. Delegação para o aiService
    // Passamos o 'targetLanguage' para o serviço usar no prompt
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
      targetLanguage // <--- NOVA VARIÁVEL ENVIADA
    });

    twiml.message(responseText);
    res.status(200).type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    twiml.message("System busy. Please try again.");
    res.status(200).type("text/xml").send(twiml.toString());
  }
}; 