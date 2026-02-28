import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { SupportChat } from './SupportChat';

export function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-schedy-canvas text-schedy-black font-sans overflow-hidden">
      
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-schedy-black/20 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside 
        className={`
          bg-white border-r border-schedy-border z-50 flex-shrink-0 transition-all duration-300
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
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        <div className="lg:hidden h-14 bg-white border-b border-schedy-border flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-schedy-black text-white rounded flex items-center justify-center font-black italic text-xs">
              S
            </div>
            <span className="font-black text-lg tracking-tighter text-schedy-black">SCHEDY</span>
          </div>
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-schedy-black">
            <Menu size={24} />
          </button>
        </div>

        {/* 
            O SEGREDO ESTÁ AQUI: flex-1 flex flex-col
            Isso permite que o Dashboard assuma 100% do espaço restante e trave o calendário
        */}
        <div className="flex-1 flex flex-col overflow-y-auto p-2 md:p-4 custom-scrollbar">
          {children}
        </div>
      </main>

      <div className="relative z-[100]">
        <SupportChat />
      </div>
    </div>
  );
}