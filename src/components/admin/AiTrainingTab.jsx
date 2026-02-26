import React from 'react';
import { Bot, Lock, Code, FileText } from 'lucide-react';

// Este texto é apenas visual. Como o treinamento agora é via código,
// você pode colar aqui o que está no seu aiService.js para referência rápida.
const MASTER_PROMPT_PREVIEW = `You are Schedy AI, the Expert Concierge.
--- CORE LOGIC (Defined in Code) ---
1. Identity & CRM:
   - Ask for Client Name if unknown.
   - Save details to Firestore.

2. Time & Agenda:
   - Check Real-time Availability (get_realtime_agenda).
   - Validate Business Hours & Work Days.
   - Prevent past bookings.

3. Tools & Execution:
   - create_appointment
   - update_appointment
   - delete_appointment

(This logic is hardcoded in functions/src/services/aiService.js)`;

export function AiTrainingTab({ aiConfig }) {
  return (
    <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-barber-gold/10 p-3 rounded-2xl text-barber-gold border border-barber-gold/20">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-xl font-black text-barber-white uppercase italic tracking-tighter">AI Intelligence Viewer</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">System Instructions (Read Only)</p>
          </div>
        </div>
        
        {/* Botão de Salvar REMOVIDO pois o controle agora é via Código */}
        <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Code size={14} /> Managed via Codebase
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LADO ESQUERDO: MASTER LOGIC */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] italic">
            <Lock size={14} /> Master System Logic
          </label>
          <div className="relative group">
            <textarea
                value={MASTER_PROMPT_PREVIEW}
                readOnly
                className="w-full bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 focus:outline-none min-h-[400px] font-mono leading-relaxed resize-none cursor-default"
            />
          </div>
        </div>

        {/* LADO DIREITO: DATABASE CONTEXT (Exibindo o que está no banco apenas para conferência) */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-barber-gold uppercase tracking-[0.2em] italic">
            <FileText size={14} /> Current Database Context (Legacy)
          </label>
          <div className="relative">
            <textarea
                value={aiConfig?.additionalContext || "No additional context loaded from database."}
                readOnly
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none min-h-[400px] font-medium leading-relaxed shadow-inner font-mono resize-none cursor-not-allowed opacity-80"
            />
            <div className="absolute top-4 right-4 text-[10px] bg-zinc-900 text-zinc-500 px-2 py-1 rounded border border-zinc-800 uppercase font-black tracking-widest pointer-events-none">
                Read Only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}