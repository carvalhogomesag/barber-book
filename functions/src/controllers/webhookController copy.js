const admin = require("firebase-admin");
const twilio = require("twilio");
const { processMessageWithAI } = require("../services/aiService");

// MAPA DE IDIOMAS (Sincronizado com o Core da Schedy)
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
 * Responsável por identificar qual profissional o cliente deseja contactar.
 */
async function identifyTenant(messageBody, fromNumber, db) {
  // A IDENTIDADE É BASEADA NO NÚMERO DE TELEFONE (From)
  const mappingRef = db.collection("customer_mappings").doc(fromNumber);
  const mappingDoc = await mappingRef.get();
  
  // Regex aprimorada para capturar ID ou Ref (Slug) do link do Concierge
  const idMatch = messageBody.match(/(?:ID:|Ref:)\s*([a-zA-Z0-9-_]+)/i);
  let activeMapping = mappingDoc.exists ? mappingDoc.data() : { tenants: {}, clientName: null };

  // --- CENÁRIO 1: ENTRADA POR LINK/QR CODE (ID EXPLÍCITO) ---
  if (idMatch) {
    const providedId = idMatch[1];
    
    // Busca por Slug (URL Amigável) primeiro, depois por ID direto
    const slugQuery = await db.collection("barbers").where("slug", "==", providedId).get();
    const barberId = !slugQuery.empty ? slugQuery.docs[0].id : providedId;

    const barberDoc = await db.collection("barbers").doc(barberId).get();
    if (!barberDoc.exists) return { error: "Professional not found in Schedy database." };

    const bData = barberDoc.data();

    // Persistência: Atualiza o mapeamento deste cliente para este barbeiro
    if (!activeMapping.tenants) activeMapping.tenants = {};
    activeMapping.tenants[barberId] = {
      name: bData.barberShopName || bData.name || "Professional",
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

  // --- CENÁRIO 2: CLIENTE SEM HISTÓRICO NO NÚMERO CONCIERGE ---
  const tenantIds = Object.keys(activeMapping.tenants || {});
  if (tenantIds.length === 0) {
    return { needsLink: true };
  }

  // --- CENÁRIO 3: APENAS UM PROFISSIONAL VINCULADO ---
  if (tenantIds.length === 1) {
    const barberId = tenantIds[0];
    const barberDoc = await db.collection("barbers").doc(barberId).get();
    
    if (!barberDoc.exists) return { needsLink: true };

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
  const lastInteractionTime = activeMapping.tenants[lastActiveId]?.lastInteraction;
  const lastTime = lastInteractionTime ? new Date(lastInteractionTime) : new Date(0);
  const diffMinutes = (new Date() - lastTime) / (1000 * 60);

  // Se interagiu nos últimos 30 min, assume que continua com o mesmo
  if (diffMinutes < 30 && lastActiveId) {
    const barberDoc = await db.collection("barbers").doc(lastActiveId).get();
    if (barberDoc.exists) {
        return { 
          barberId: lastActiveId, 
          clientName: activeMapping.clientName, 
          isInitialMessage: false, 
          mappingRef,
          barberData: barberDoc.data()
        };
    }
  }

  // Lógica de escolha numérica (1, 2, 3...)
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
 * Controlador Principal do Webhook (Twilio Entry Point)
 */
exports.handleIncomingMessage = async (req, res) => {
  const messageBody = req.body.Body || "";
  const fromNumber = req.body.From;
  const db = admin.firestore();
  const twiml = new twilio.twiml.MessagingResponse();

  // ÂNCORA TÉCNICA DE DATA (ISO-8601)
  // Essencial para evitar que a IA se perca em fusos horários diferentes do servidor
  const serverTimeISO = new Date().toISOString();

  try {
    const result = await identifyTenant(messageBody, fromNumber, db);

    // 1. Cliente novo sem identificação de profissional
    if (result.needsLink) {
      twiml.message("Welcome to Schedy! 🤖\nPlease use the official booking link provided by your barber to start your appointment.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 2. Menu Switchboard para múltiplos profissionais
    if (result.needsChoice) {
      const menuText = result.tenantList
        .map((t, i) => `${i + 1}) ${t.name}`)
        .join("\n");
      
      twiml.message(`Hello! 🤖\nWho would you like to book with today?\n\n${menuText}\n\nReply with the number of your choice.`);
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 3. Validação de segurança
    if (result.error || !result.barberId) {
      twiml.message("Professional not found. Please verify the booking link.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 4. Verificação de Status do Plano
    if (result.barberData.plan !== 'pro') {
      twiml.message("Schedy: This professional's AI Concierge is currently offline. Please contact the shop directly.");
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    // 5. Configurações Globais da IA
    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const globalAIConfig = aiConfigSnap.exists 
      ? aiConfigSnap.data() 
      : { systemPrompt: "", additionalContext: "" };

    // 6. Persistência de Atividade
    // Garante que o sistema lembre do último profissional e atualize o timestamp de interação
    const updateData = {
        lastActiveBarberId: result.barberId,
        [`tenants.${result.barberId}.lastInteraction`]: admin.firestore.FieldValue.serverTimestamp()
    };
    await result.mappingRef.update(updateData);

    // 7. Determinação de Idioma e Fuso Horário
    const barberCountry = result.barberData.country || 'US';
    const targetLanguage = LANGUAGE_MAP[barberCountry] || 'English (US)';
    const barberTimezone = result.barberData.timezone || 'UTC';

    // 8. PROCESSAMENTO VIA AI SERVICE (A "Mente" do Concierge)
    const responseText = await processMessageWithAI({
      barberId: result.barberId,
      barberData: result.barberData, // Dados do Firestore (VERDADE DE DADOS)
      clientName: result.clientName, // Identidade Persistente
      messageBody,
      fromNumber,
      isInitialMessage: result.isInitialMessage,
      db,
      mappingRef: result.mappingRef,
      globalAIConfig,
      targetLanguage,
      barberTimezone,
      serverTimeISO // Âncora para aritmética de datas
    });

    twiml.message(responseText);
    res.status(200).type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error("CRITICAL WEBHOOK ERROR:", error);
    // Mensagem de fallback genérica e segura
    twiml.message("Our AI Concierge is taking a short breath. 🤖\nPlease try again in a few seconds.");
    res.status(200).type("text/xml").send(twiml.toString());
  }
};