import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { SupportChat } from './SupportChat';

export function AppLayout({ children }) {
  // Conforme solicitado: Sidebar recolhida por padrão
  const[isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    // Fundo cinza ultraclaro, estilo Avec
    <div className="flex h-screen w-full bg-[#f4f5f7] text-gray-800 font-sans overflow-hidden">
      
      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 
          SIDEBAR (ESTRUTURA FÍSICA)
          No desktop (lg), ela NÃO é fixed. Ela está no fluxo Flex, o que garante 
          que o calendário comece exatamente onde ela termina.
      */}
      <aside 
        className={`
          bg-white border-r border-gray-200 z-50 flex-shrink-0 transition-all duration-300
          ${isMobileOpen ? 'fixed inset-y-0 left-0 h-full w-[260px]' : 'hidden lg:block h-full'}
          ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'}
        `}
      >
        <Sidebar 
          isCollapsed={isCollapsed} 
          toggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
      </aside>
      
      {/* 
          ÁREA PRINCIPAL (CALENDÁRIO)
          Ocupa flex-1 (todo o resto da tela). Sem margens flutuantes.
      */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header Mobile */}
        <div className="lg:hidden h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center font-bold italic text-xs">
              S
            </div>
            <span className="font-bold text-lg tracking-tight text-indigo-600">SCHEDY</span>
          </div>
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-gray-600">
            <Menu size={24} />
          </button>
        </div>

        {/* CONTAINER DO DASHBOARD - Paddings mínimos para aproveitamento máximo */}
        <div className="flex-1 overflow-hidden p-2 md:p-3">
          {children}
        </div>
      </main>

      <SupportChat />
    </div>
  );
}