import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  MessageSquare, 
  User, 
  Search, 
  Phone, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { listenToChats } from '../services/professionalService';

export function Messages() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);

  // 1. ESCUTA ATIVA: Monitora a lista de conversas em tempo real
  useEffect(() => {
    const unsubscribe = listenToChats((data) => {
      setChats(data);
      setLoading(false);
      
      // Atualiza o chat selecionado em tempo real sem perder o foco
      if (selectedChat) {
        const updatedSelected = data.find(c => c.id === selectedChat.id);
        if (updatedSelected) {
            // Só atualiza se houver nova mensagem para evitar re-render desnecessário
            if (updatedSelected.history.length !== selectedChat.history.length) {
                setSelectedChat(updatedSelected);
            }
        }
      }
    });

    return () => unsubscribe && unsubscribe();
  }, [selectedChat]); // Dependência necessária para manter o sync

  // 2. SCROLL INTELIGENTE: Só desce se o chat mudar ou novas mensagens chegarem
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChat?.history?.length, selectedChat?.id]);

  const filteredChats = chats.filter(c => 
    c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.includes(searchTerm)
  );

  return (
    <AppLayout>
      {/* CONTAINER PRINCIPAL COM ALTURA FIXA E TRAVADA */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] bg-barber-black rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        
        {/* COLUNA ESQUERDA: LISTA DE CLIENTES */}
        <div className={`w-full md:w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-4">
              <MessageSquare className="text-barber-gold" size={20} />
              Live Chats
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text" 
                placeholder="Search messages..." 
                className="w-full bg-barber-black border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-barber-gold transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-barber-gold" /></div>
            ) : filteredChats.length === 0 ? (
              <p className="text-center text-zinc-600 text-xs mt-10 font-medium italic">No active conversations found.</p>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-4 flex items-start gap-3 border-b border-zinc-800/50 transition-all hover:bg-barber-gold/5 text-left ${selectedChat?.id === chat.id ? 'bg-barber-gold/10 border-r-4 border-r-barber-gold' : ''}`}
                >
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex-shrink-0 flex items-center justify-center border border-zinc-700 text-barber-gold font-bold text-sm">
                    {chat.clientName?.charAt(0).toUpperCase() || <User size={16}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`text-sm font-bold truncate ${selectedChat?.id === chat.id ? 'text-barber-gold' : 'text-white'}`}>
                        {chat.clientName || chat.id.replace('whatsapp:', '')}
                      </h4>
                      <span className="text-[9px] text-zinc-500 whitespace-nowrap ml-2">
                        {chat.updatedAt ? formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: false }) : 'Now'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate font-medium">
                        {chat.history && chat.history.length > 0 
                            ? chat.history[chat.history.length - 1].parts[0].text 
                            : 'Start of conversation'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: CONVERSA ATIVA */}
        <div className={`flex-1 flex flex-col bg-zinc-950 relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat ? (
            <>
              {/* Header do Chat */}
              <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shadow-md z-10">
                <div className="flex items-center gap-3">
                   {/* Botão Voltar (Mobile) */}
                   <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 text-zinc-400 hover:text-white">
                     ←
                   </button>
                   
                   <div className="w-10 h-10 bg-barber-gold/10 rounded-full flex items-center justify-center text-barber-gold border border-barber-gold/20 font-black">
                      {selectedChat.clientName?.charAt(0).toUpperCase() || <User size={20} />}
                   </div>
                   <div>
                      <h3 className="text-sm font-black text-white uppercase italic tracking-wide">{selectedChat.clientName || 'Unknown Client'}</h3>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Phone size={10} /> {selectedChat.id.replace('whatsapp:', '')}
                      </p>
                   </div>
                </div>
                <a 
                  href={`https://wa.me/${selectedChat.id.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-green-600/10 text-green-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all"
                >
                  Open WhatsApp <ExternalLink size={12} />
                </a>
              </div>

              {/* Área de Mensagens (Scroll Independente) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                {selectedChat.history?.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-lg text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'bg-barber-gold text-black rounded-tr-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                    }`}>
                      {msg.parts[0]?.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-4" /> {/* Espaço extra no final */}
              </div>

              {/* Footer Informativo */}
              <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-center">
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  AI Concierge Active • Monitoring Conversation
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-800 mb-6 border-4 border-zinc-800">
                <MessageSquare size={48} />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Select a Conversation</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-xs">
                Choose a client from the list to view the real-time AI negotiation history.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}