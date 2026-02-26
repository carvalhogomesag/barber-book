const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURAÇÃO: ARQUIVOS ESSENCIAIS DO PROJETO ---
// Aqui listamos apenas os arquivos que contêm a lógica do negócio.
const filesToInclude = [
  // Backend (Cloud Functions & IA) - O CÉREBRO
  'functions/index.js',
  'functions/package.json',

  // Configurações e Serviços
  'src/services/firebase.js',
  'src/services/barberService.js',
  'src/services/adminService.js',
  'src/contexts/AuthContext.jsx',
  'src/utils/timeGrid.js',

  // Rotas e Estrutura Principal
  'src/App.jsx',
  'src/main.jsx',
  'src/index.css',
  'tailwind.config.js',

  // Páginas (Frontend)
  'src/pages/Login.jsx',
  'src/pages/Register.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Services.jsx',
  'src/pages/Profile.jsx',
  'src/pages/Pricing.jsx',
  'src/pages/SetupPro.jsx', // Página nova de configuração
  'src/pages/Admin.jsx',
  'src/pages/Terms.jsx',

  // Componentes Visuais
  'src/components/ui/Sidebar.jsx',
  'src/components/ui/AppLayout.jsx',
  'src/components/ui/Modal.jsx',
  'src/components/ui/Button.jsx',
  'src/components/ui/Input.jsx',
  'src/components/calendar/DayView.jsx',
  'src/components/calendar/AppointmentCard.jsx',
];

// --- 2. INSTRUÇÃO DE SISTEMA (CONTEXTO PARA A PRÓXIMA IA) ---
const systemInstruction = `
*** SYSTEM INSTRUCTION PARA CONTINUIDADE DO PROJETO BARBER BOOK ***

CONTEXTO DO PROJETO:
Você está recebendo o código fonte de um SaaS de gestão para barbearias (Barber Book).
O sistema é um WebApp (React/Vite) integrado com Firebase (Auth, Firestore, Functions).

FUNCIONALIDADES JÁ IMPLEMENTADAS:
1. Multi-tenant: Barbeiros criam contas e têm dados isolados.
2. Agenda Visual: Drag & Drop, visualização diária.
3. IA no WhatsApp: Um robô (Gemini via Cloud Functions + Twilio) que atende clientes, lê a agenda e cria agendamentos reais.
4. Pagamentos: Integração com Stripe (Webhooks) para ativar plano PRO.
5. Internacionalização: Suporte a Brasil (R$) e Portugal (€).

MUDANÇA DE ESTRATÉGIA (PIVOT) - SUA MISSÃO AGORA:
Decidimos simplificar a oferta de números de telefone.
- ANTES: Tentávamos comprar números locais (BR/PT) via Twilio.
- AGORA: Vamos oferecer APENAS números dos Estados Unidos (+1) como um serviço de "Concierge Internacional".
- MOTIVO: Evitar burocracia de documentos (Regulatory Bundles) e ativar o número instantaneamente.

SUAS PRÓXIMAS TAREFAS:
1. Analisar o arquivo 'functions/index.js' e alterar a função 'provisionNumber' para buscar apenas números 'US' (Estados Unidos), ignorando DDDs brasileiros.
2. Analisar 'src/pages/SetupPro.jsx' e remover a solicitação de DDD brasileiro. O usuário deve apenas escolher um "Código de Área Internacional" (ex: 305 Miami, 212 NY) ou gerar um aleatório dos EUA.

SEGUE ABAIXO O CÓDIGO FONTE ATUAL DO PROJETO:
`;

// --- 3. LÓGICA DE GERAÇÃO DO ARQUIVO ---
const outputFileName = 'CONTEXTO_PROJETO.txt';

function generateContext() {
  let content = systemInstruction + '\n\n';
  content += '================================================================\n';
  content += 'INÍCIO DOS ARQUIVOS DO PROJETO\n';
  content += '================================================================\n\n';

  console.log('🔄 Gerando arquivo de contexto...');

  filesToInclude.forEach((filePath) => {
    try {
      const fullPath = path.join(__dirname, filePath);
      
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        content += `\n\n--- ARQUIVO: ${filePath} ---\n`;
        content += '```javascript\n'; // Adiciona markdown para facilitar leitura da IA
        content += fileContent;
        content += '\n```\n';
        console.log(`✅ Incluído: ${filePath}`);
      } else {
        console.warn(`⚠️  Arquivo não encontrado (pulado): ${filePath}`);
        content += `\n\n--- ARQUIVO: ${filePath} (NÃO ENCONTRADO) ---\n`;
      }
    } catch (error) {
      console.error(`❌ Erro ao ler ${filePath}:`, error.message);
    }
  });

  fs.writeFileSync(outputFileName, content, 'utf8');
  console.log(`\n🎉 SUCESSO! Arquivo '${outputFileName}' gerado.`);
  console.log(`📂 Envie este arquivo para o próximo chat da IA.`);
}

generateContext();