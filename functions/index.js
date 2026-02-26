const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const twilio = require("twilio");

// 1. IMPORTAÇÕES DE CONFIGURAÇÃO
const { REGION, CONCIERGE_NUMBER } = require("./config");

// 2. CONFIGURAÇÃO DE APIS
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// 3. IMPORTAÇÃO DOS CONTROLADORES E SERVIÇOS
const { handleIncomingMessage } = require("./src/controllers/webhookController");
const { processMessageWithAI } = require("./src/services/aiService"); // Importação necessária para a voz usar a IA

admin.initializeApp();
setGlobalOptions({ region: REGION });

/**
 * [FUNCIONALIDADE: WHATSAPP WEBHOOK]
 * Gerencia mensagens de texto e detecções de chamadas via webhookController.
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
  return handleIncomingMessage(req, res);
});

/**
 * [FUNCIONALIDADE: LÓGICA DE VOZ - SAUDAÇÃO INICIAL]
 * Gera o TwiML para a chamada de retorno quando o cliente atende.
 */
exports.voiceLogic = onRequest(async (req, res) => {
  const { barberId, to } = req.query;
  const db = admin.firestore();
  const voiceResponse = new twilio.twiml.VoiceResponse();

  try {
    const barberDoc = await db.collection('barbers').doc(barberId).get();
    const barberData = barberDoc.data();
    const lang = barberData.country === 'BR' ? 'pt-BR' : 'en-US';
    const barberName = barberData.barberShopName || "the professional";

    // Mensagem Inicial da IA
    const greeting = lang === 'pt-BR' 
      ? `Olá! Aqui é a assistente inteligente da ${barberName}. Notei que você ligou agora pouco. Como posso te ajudar com seu agendamento?`
      : `Hello! This is the AI assistant for ${barberName}. I noticed you called a moment ago. How can I help you with your booking?`;

    voiceResponse.say({ voice: 'Polly.Vitoria', language: lang }, greeting);

    // Captura a resposta do cliente (Speech-to-Text)
    voiceResponse.gather({
      input: 'speech',
      action: `/voiceProcess?barberId=${barberId}`,
      language: lang,
      speechTimeout: 'auto'
    });

    res.type('text/xml').send(voiceResponse.toString());
  } catch (error) {
    console.error("Voice Logic Error:", error);
    res.status(500).send("Error");
  }
});

/**
 * [FUNCIONALIDADE: PROCESSAMENTO DE VOZ - CÉREBRO DA CHAMADA]
 * Recebe o que o cliente falou, processa via Gemini e responde por voz.
 */
exports.voiceProcess = onRequest(async (req, res) => {
  const { barberId } = req.query;
  const fromNumber = req.body.From; // Número do cliente
  const speechResult = req.body.SpeechResult; // Transcrição automática do Twilio
  
  const db = admin.firestore();
  const voiceResponse = new twilio.twiml.VoiceResponse();

  try {
    const barberDoc = await db.collection('barbers').doc(barberId).get();
    const barberData = barberDoc.data();
    const lang = barberData.country === 'BR' ? 'pt-BR' : 'en-US';
    const voiceId = lang === 'pt-BR' ? 'Polly.Vitoria' : 'Polly.Joanna';

    // Se o Twilio não conseguiu capturar nenhuma fala
    if (!speechResult) {
      const retryMsg = lang === 'pt-BR' ? "Desculpe, não consegui ouvir. Poderia repetir?" : "I'm sorry, I couldn't hear you. Could you repeat?";
      voiceResponse.say({ voice: voiceId, language: lang }, retryMsg);
      voiceResponse.gather({
        input: 'speech',
        action: `/voiceProcess?barberId=${barberId}`,
        language: lang,
        speechTimeout: 'auto'
      });
      return res.type('text/xml').send(voiceResponse.toString());
    }

    // Identidade do Cliente (CRM)
    const mappingRef = db.collection("customer_mappings").doc(fromNumber);
    const mappingDoc = await mappingRef.get();
    const clientName = mappingDoc.exists ? mappingDoc.data().clientName : null;

    // Configuração de IA
    const aiConfigSnap = await db.collection("settings").doc("ai_config").get();
    const globalAIConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { additionalContext: "" };

    // PROCESSAMENTO PELA MESMA IA DO WHATSAPP
    const aiResponse = await processMessageWithAI({
      barberId,
      barberData,
      clientName,
      messageBody: `[PHONE CALL]: ${speechResult}`, // Marcador de contexto de voz
      fromNumber,
      db,
      mappingRef,
      globalAIConfig,
      targetLanguage: lang === 'pt-BR' ? 'Portuguese (Brazil)' : 'English (US)',
      barberTimezone: barberData.timezone || 'UTC',
      serverTimeISO: new Date().toISOString()
    });

    // Resposta em Voz para o Cliente
    voiceResponse.say({ voice: voiceId, language: lang }, aiResponse);

    // Permite que o cliente continue falando (Loop de conversação)
    voiceResponse.gather({
      input: 'speech',
      action: `/voiceProcess?barberId=${barberId}`,
      language: lang,
      speechTimeout: 'auto'
    });

    res.type('text/xml').send(voiceResponse.toString());

  } catch (error) {
    console.error("Voice Process Critical Error:", error);
    const errorMsg = "I'm sorry, I'm having a technical problem. I will send you a message on WhatsApp to finish your booking.";
    voiceResponse.say(errorMsg);
    res.type('text/xml').send(voiceResponse.toString());
  }
});

/**
 * [FUNCIONALIDADE: WEBHOOK STRIPE]
 * Gerencia a ativação do plano PRO e o pagamento de comissões.
 */
exports.stripeWebhook = onRequest(async (req, res) => {
  const event = req.body;
  const db = admin.firestore();
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const barberId = session.client_reference_id;
    if (!barberId) return res.status(400).send('No ID');
    
    try {
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.collection('barbers').doc(barberId).update({ 
        plan: 'pro',
        proActivatedAt: now.toISOString(),
        trialExpiresAt: trialEndsAt.toISOString(),
        subscriptionStatus: 'trialing',
        stripeCustomerId: session.customer,
        customerEmail: session.customer_details?.email || null 
      });

      const barberDoc = await db.collection('barbers').doc(barberId).get();
      const barberData = barberDoc.data();

      if (barberData.referredBy) {
        const salesSnapshot = await db.collection('salespeople').where('referralCode', '==', barberData.referredBy).limit(1).get();
        if (!salesSnapshot.empty) {
          await salesSnapshot.docs[0].ref.update({ activeClients: admin.firestore.FieldValue.increment(1) });
        }
      }
      return res.status(200).send('Success');
    } catch (error) { return res.status(500).send('Error'); }
  } 
  
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const amountPaid = invoice.amount_paid / 100;

    try {
      const barberSnapshot = await db.collection('barbers').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!barberSnapshot.empty) {
        const barberData = barberSnapshot.docs[0].data();
        if (barberData.referredBy) {
          const salesSnapshot = await db.collection('salespeople').where('referralCode', '==', barberData.referredBy).limit(1).get();
          if (!salesSnapshot.empty) {
            const commission = amountPaid * 0.20;
            await salesSnapshot.docs[0].ref.update({ 
                totalEarnings: admin.firestore.FieldValue.increment(commission),
                currentBalance: admin.firestore.FieldValue.increment(commission) 
            });
            await db.collection('commissions_log').add({
              salespersonId: salesSnapshot.docs[0].id,
              barberName: barberData.name,
              amountPaid: amountPaid,
              commissionEarned: commission,
              date: new Date().toISOString()
            });
          }
        }
      }
      return res.status(200).send('Commission Processed');
    } catch (error) { return res.status(500).send('Error'); }
  }
  return res.status(200).send('Ignored');
});

/**
 * [FUNCIONALIDADE: CRON JOB TRIAL]
 * Verificação diária de trial e envio de alertas por e-mail.
 */
exports.checkTrialExpiration = onSchedule({
  schedule: "0 9 * * *",
  timeZone: "America/Sao_Paulo",
  memory: "256MiB"
}, async (event) => {
  const db = admin.firestore();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const snapshot = await db.collection('barbers')
    .where('trialExpiresAt', '>=', `${targetDateStr}T00:00:00`)
    .where('trialExpiresAt', '<=', `${targetDateStr}T23:59:59`)
    .where('subscriptionStatus', '==', 'trialing').get();

  if (snapshot.empty) return null;
  const emailPromises = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.customerEmail) {
      emailPromises.push(db.collection('mail').add({
        to: data.customerEmail,
        message: {
          subject: "Action Required: Your Schedy AI trial ends in 48 hours!",
          html: `<h2>Hello, ${data.name}!</h2><p>Your trial ends in 2 days.</p>`
        }
      }));
    }
  });
  return Promise.all(emailPromises);
});

/**
 * [FUNCIONALIDADE: PROVISIONAMENTO US (+1)]
 * Ativação instantânea do número internacional do Concierge.
 */
exports.provisionNumber = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const areaCode = request.data?.areaCode || 'random';
  
  try {
    const updatePayload = {
      phone: CONCIERGE_NUMBER.replace('+', ''),
      numberCountry: 'US',
      numberType: 'international_concierge',
      selectedAreaCode: areaCode,
      numberActivatedAt: new Date().toISOString(),
      status: 'active'
    };

    await admin.firestore().collection('barbers').doc(request.auth.uid).update(updatePayload);
    
    return { success: true, phoneNumber: CONCIERGE_NUMBER, country: 'US' };
  } catch (error) { 
    console.error("Erro no provisionamento US:", error);
    throw new HttpsError('internal', error.message); 
  }
});

/**
 * [FUNCIONALIDADE: BILLING PORTAL]
 * Gera link para o portal de faturamento Stripe.
 */
exports.createPortalSession = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  try {
    const userDoc = await admin.firestore().collection('barbers').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !userData.stripeCustomerId) throw new HttpsError('not-found', 'No Stripe ID');
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: 'https://barber-book-d4a5a.web.app/billing', 
    });
    return { url: session.url };
  } catch (error) { throw new HttpsError('internal', error.message); }
});

/**
 * [FUNCIONALIDADE: IA DE SUPORTE]
 * Agente Gemini para ajuda no Dashboard do profissional.
 */
exports.supportChat = onCall(async (request) => {
  const { message, history } = request.data;
  if (!message) throw new HttpsError('invalid-argument', 'Message is required');

  const selectedModel = process.env.GEMINI_MODEL;
  if (!selectedModel) throw new HttpsError('failed-precondition', 'AI Model missing.');

  try {
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      systemInstruction: `Você é o Schedy AI Support Agent. Você ajuda profissionais a configurar sua IA. Hoje é ${new Date().toISOString().split('T')[0]}.`
    });

    let cleanHistory = [];
    if (Array.isArray(history)) {
      cleanHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts[0].text }]
      }));
    }

    const chat = model.startChat({ history: cleanHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    
    return { text: response.text() };
  } catch (error) {
    console.error("Erro no Support Chat:", error);
    throw new HttpsError('internal', 'AI Assistant error');
  }
});