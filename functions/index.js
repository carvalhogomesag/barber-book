const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. IMPORTAÇÕES DE CONFIGURAÇÃO
const { REGION, CONCIERGE_NUMBER } = require("./config");

// 2. CONFIGURAÇÃO DE APIS (Lendo do .env)
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. IMPORTAÇÃO DOS CONTROLADORES
const { handleIncomingMessage } = require("./src/controllers/webhookController");

admin.initializeApp();
setGlobalOptions({ region: REGION });

/**
 * WEBHOOK DO WHATSAPP
 * Recebe mensagens e encaminha para o processador de mensagens.
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
  return handleIncomingMessage(req, res);
});

/**
 * WEBHOOK DO STRIPE
 * Gerencia a ativação do plano PRO e o pagamento de comissões para parceiros.
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
 * CRON JOB: VERIFICAÇÃO DE EXPIRAÇÃO DE TRIAL
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
 * PROVISIONAMENTO DE NÚMERO (PIVOT: US ONLY)
 * Alterado para forçar apenas o uso de números dos EUA (+1).
 */
exports.provisionNumber = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  
  // A estratégia agora é apenas 'US'. Ignoramos solicitações para outros países.
  const areaCode = request.data?.areaCode || 'random';
  
  try {
    const updatePayload = {
      phone: CONCIERGE_NUMBER.replace('+', ''),
      numberCountry: 'US', // Hardcoded: Estratégia de Concierge Internacional
      numberType: 'international_concierge',
      selectedAreaCode: areaCode,
      numberActivatedAt: new Date().toISOString(),
      status: 'active'
    };

    await admin.firestore().collection('barbers').doc(request.auth.uid).update(updatePayload);
    
    return { 
      success: true, 
      phoneNumber: CONCIERGE_NUMBER,
      country: 'US'
    };
  } catch (error) { 
    console.error("Erro no provisionamento US:", error);
    throw new HttpsError('internal', error.message); 
  }
});

/**
 * GERA LINK DO PORTAL DO CLIENTE STRIPE
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
 * AGENTE DE IA DE SUPORTE (PIVOT: REGRAS ANTI-ALUCINAÇÃO)
 * Atualizado com instruções de integridade de dados e âncoras técnicas.
 */
exports.supportChat = onCall(async (request) => {
  const { message, history } = request.data;
  
  if (!message) throw new HttpsError('invalid-argument', 'Message is required');

  const selectedModel = process.env.GEMINI_MODEL;
  if (!selectedModel) {
    throw new HttpsError('failed-precondition', 'AI Model configuration is missing on server.');
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      systemInstruction: `Você é o Schedy AI Support Agent. Você ajuda profissionais a configurar sua IA de agendamento.
      
      REGRAS DE INTEGRIDADE:
      1. ÂNCORAS DE DATA: Sempre utilize o formato ISO-8601 (YYYY-MM-DD) para processar datas. Hoje é ${new Date().toISOString().split('T')[0]}.
      2. VERDADE DE DADOS: Priorize informações técnicas sobre o sistema em vez do histórico da conversa.
      3. ESTRATÉGIA DE TELEFONE: Informe claramente que oferecemos APENAS números dos EUA (+1) para ativação imediata. Isso é o nosso diferencial "Concierge Internacional" para evitar burocracia local em BR ou PT.
      
      CONHECIMENTO DO PRODUTO:
      - Schedy automatiza agendamentos via WhatsApp 24/7.
      - Planos: $29/mês (US/Global) ou R$97/mês (Brasil).
      - Trial: 30 dias grátis para novos usuários Pro.
      - Atendimento: Português e Inglês.
      
      POSTURA: Profissional, premium e direto ao ponto. Nunca invente preços ou prazos.`
    });

    let cleanHistory = [];
    if (Array.isArray(history)) {
      cleanHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts[0].text }]
      }));

      while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
        cleanHistory.shift();
      }
    }

    const chat = model.startChat({ history: cleanHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    
    return { text: response.text() };

  } catch (error) {
    console.error("Erro no Support Chat:", error);
    throw new HttpsError('internal', 'AI Assistant error: ' + error.message);
  }
});