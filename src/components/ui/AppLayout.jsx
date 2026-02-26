import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';
import { SupportChat } from './SupportChat'; // Importamos o novo chat

export function AppLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-barber-dark text-barber-white flex">
      {/* Overlay para fechar o menu ao clicar fora (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {/* Conteúdo Principal */}
      <main className="flex-1 w-full min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-barber-black/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-barber-gold rounded-lg flex items-center justify-center text-black font-black italic text-xs">SC</div>
            <span className="font-black uppercase tracking-tighter italic text-sm">Schedy</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-barber-gold hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Área do Conteúdo com Scroll Independente */}
        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* AGENTE DE IA GLOBAL (Aparece em todas as páginas) */}
      <SupportChat />
    </div>
  );
}