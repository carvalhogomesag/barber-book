/**
 * functions/src/services/aiService.js
 * Orquestrador Principal do LLM (Clean Architecture)
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../config"); 
const { getSchedulerContext } = require("../../utils"); 
const { setupTools, toolsDeclaration } = require("./aiTools");
const { buildMasterPrompt } = require("./aiPromptBuilder");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const HUMAN_HANDOFF_KEYWORDS =[
  "falar com humano", "atendente", "falar com pessoa", "humano", "erro", 
  "não estou conseguindo", "burro", "estúpido", "idiota", "human", 
  "speak to person", "agent", "operator", "stupid", "error", "help me"
];

const sendMessageWithRetry = async (chat, message, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
        try { return await chat.sendMessage(message); } 
        catch (error) {
            if ((error.message.includes("503") || error.message.includes("500") || error.message.includes("overloaded")) && i < retries) {
                await new Promise(res => setTimeout(res, 1000 * (i + 1)));
                continue;
            }
            throw error;
        }
    }
};

exports.processMessageWithAI = async ({ 
    barberId, barberData, clientName, messageBody, fromNumber, 
    isInitialMessage, db, mappingRef, globalAIConfig, targetLanguage,
    barberTimezone
}) => {
    try {
        const chatRef = db.collection("barbers").doc(barberId).collection("chats").doc(fromNumber);
        const isVoiceMode = messageBody.includes("[PHONE CALL]");
        const userMessage = messageBody.replace(/\[PHONE CALL\]:|\[PHONE CALL CONTEXT\]:/g, "").trim();

        // 1. HITL (Human in the Loop)
        if (HUMAN_HANDOFF_KEYWORDS.some(k => userMessage.toLowerCase().includes(k))) {
            return isVoiceMode 
              ? "Entendido. Vou transferir para o profissional. [PAUSE_AI]" 
              : "Entendido. Vou pedir para o profissional assumir agora. Só um instante! [PAUSE_AI]";
        }

        const chatDoc = await chatRef.get();
        if (chatDoc.exists && chatDoc.data().status === 'paused') return null;

        // 2. GROUNDING (Coleta de Dados e INJEÇÃO DE ESTADO REAL)
        const servicesSnap = await db.collection("barbers").doc(barberId).collection("services").get();
        const techServices = servicesSnap.docs.map(doc => `- SERVICE: "${doc.data().name}" | PRICE: ${doc.data().price} | DURATION: ${doc.data().duration} min`).join('\n');

        // BUSCA O STATUS REAL DO CLIENTE (Cura da Amnésia)
        const userAptsSnap = await db.collection("barbers").doc(barberId).collection("appointments")
            .where("clientPhone", "==", fromNumber)
            .where("status", "in",["CONFIRMED", "scheduled", "PENDING"]).get();
        
        const userCurrentAppointments = userAptsSnap.docs.map(doc => ({
            id: doc.id,
            service: doc.data().serviceName,
            time: doc.data().startTime,
            status: doc.data().status
        }));

        const timezone = barberTimezone || barberData.timezone || "America/New_York";
        const scheduler = getSchedulerContext(timezone);
        const tools = setupTools(db, barberId, timezone, mappingRef, fromNumber);

        // 3. CONSTRUÇÃO DO PROMPT
        const finalPrompt = buildMasterPrompt({
            barberData, clientName, scheduler, techServices, 
            userCurrentAppointments, // INJEÇÃO DA VERDADE
            targetLanguage, isVoiceMode, globalAIConfig
        });

        // 4. INICIALIZAÇÃO DO MODELO
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: finalPrompt,
            tools:[{ functionDeclarations: toolsDeclaration }] 
        });

        // HISTÓRICO APENAS TEXTUAL (A Injeção de estado acima resolve a falta de metadados das funções)
        let history = (await chatRef.get()).data()?.history ||[];
        const chat = model.startChat({ history: history.slice(-6) }); 
        const finalInput = isInitialMessage ? `Greeting: Scanned QR for ${barberData.barberShopName}.` : userMessage;

        // 5. EXECUÇÃO DO LOOP DE PENSAMENTO E FUNCTION CALLS
        let result = await sendMessageWithRetry(chat, finalInput); 
        let responseText = result.response.text();
        let calls = result.response.functionCalls();

        while (calls && calls.length > 0) {
            const responses =[];
            for (const call of calls) {
                try {
                    const toolResult = await tools[call.name](call.args);
                    responses.push({ functionResponse: { name: call.name, response: { content: toolResult } } });
                } catch (e) {
                    responses.push({ functionResponse: { name: call.name, response: { content: "SYSTEM_ERROR" } } });
                }
            }
            result = await sendMessageWithRetry(chat, responses);
            responseText = result.response.text();
            calls = result.response.functionCalls();
        }

        // 6. SANITIZAÇÃO E PERSISTÊNCIA
        if (isVoiceMode) responseText = responseText.replace(/\*/g, '').replace(/#/g, '').trim();

        await chatRef.set({ 
            history:[
              ...history, 
              { role: "user", parts: [{ text: userMessage }] }, 
              { role: "model", parts: [{ text: responseText }] }
            ].slice(-10),
            lastMessage: userMessage, 
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return responseText;

    } catch (error) {
        console.error("CRITICAL AI ERROR:", error);
        return "Estou com dificuldade em acessar a agenda agora. Pode repetir o seu pedido? 🤖";
    }
};