import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { SupportChat } from './SupportChat';

export function AppLayout({ children }) {
  // Estado Desktop: Começa fechada (apenas ícones) para foco total no conteúdo
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Estado Mobile: Controle do menu hambúrguer
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    // Fundo claro de alto contraste (schedy-canvas)
    <div className="flex h-screen bg-schedy-canvas text-schedy-black font-sans overflow-hidden">
      
      {/* Overlay Mobile (Backdrop Blur para foco) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-schedy-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 h-full bg-schedy-white border-r border-schedy-border shadow-premium
          transition-all duration-300 ease-in-out
          /* Comportamento Mobile vs Desktop */
          ${isMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0'}
          /* Largura Dinâmica no Desktop */
          lg:${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
        `}
      >
        <Sidebar 
          isCollapsed={isCollapsed} 
          toggleCollapse={toggleSidebar}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
      </aside>
      
      {/* Área Principal (Main) */}
      <main className="flex-1 flex flex-col min-w-0 h-screen relative transition-all duration-300">
        
        {/* Header Mobile (Apenas visível em telas pequenas) */}
        <div className="lg:hidden h-16 bg-schedy-white border-b border-schedy-border flex items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-schedy-black text-white rounded-lg flex items-center justify-center font-black italic text-xs">
              S
            </div>
            <span className="font-black text-lg tracking-tighter">SCHEDY</span>
          </div>
          <button 
            onClick={() => setIsMobileOpen(true)}
            className="p-2 hover:bg-schedy-canvas rounded-lg transition-colors text-schedy-black"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Container de Scroll do Conteúdo */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar">
          {/* 
             REMOVIDO: max-w-7xl
             MOTIVO: O Calendário de 7 dias precisa respirar e ocupar a tela toda.
             A responsividade agora é fluida (100% width).
          */}
          <div className="w-full h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>

      {/* Agente IA (Flutuante) */}
      <SupportChat />
    </div>
  );
}