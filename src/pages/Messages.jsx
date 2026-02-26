import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  MessageSquare, 
  User, 
  Search, 
  Phone, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Headphones
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { listenToChats } from '../services/professionalService';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function Messages() {
  const { profile } = useAuth();
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
      
      // Sincroniza o chat selecionado se ele sofrer alterações no banco
      if (selectedChat) {
        const updatedSelected = data.find(c => c.id === selectedChat.id);
        if (updatedSelected && updatedSelected.history?.length !== selectedChat.history?.length) {
            setSelectedChat(updatedSelected);
        }
      }
    });

    return () => unsubscribe && unsubscribe();
  }, [selectedChat]);

  // 2. SCROLL INTELIGENTE: Desce ao final da conversa
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChat?.history?.length, selectedChat?.id]);

  // 3. FUNÇÃO PARA RETOMAR IA (HITL) - PRESERVADA
  const handleResumeAI = async (chatId) => {
    try {
      const chatRef = doc(db, 'barbers', profile.id, 'chats', chatId);
      await updateDoc(chatRef, { 
        status: 'active', 
        needsAttention: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error resuming AI:", error);
    }
  };

  // 4. FILTRAGEM - PRESERVADA
  const filteredChats = chats.filter(c => 
    (c.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.includes(searchTerm)
  );

  // 5. AUXILIAR DE VOZ COM PROTEÇÃO DE TIPO - MELHORADA
  const isVoiceMessage = (text) => {
    if (typeof text !== 'string') return false;
    return text.includes("[PHONE CALL]") || text.includes("[PHONE CALL CONTEXT]");
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] bg-barber-black rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl relative">
        
        {/* COLUNA ESQUERDA: LISTA DE CLIENTES */}
        <div className={`w-full md:w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-4">
              <MessageSquare className="text-barber-gold" size={20} />
              Conversations
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
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
              <p className="text-center text-zinc-600 text-[10px] mt-10 font-black uppercase tracking-widest italic">No chats found.</p>
            ) : (
              filteredChats.map((chat) => {
                // BLINDAGEM CONTRA UNDEFINED NA LISTA
                const lastMsgText = chat.history?.[chat.history.length - 1]?.parts?.[0]?.text || "";
                const isPaused = chat.status === 'paused';
                
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-zinc-800/50 transition-all hover:bg-zinc-800/80 text-left relative ${selectedChat?.id === chat.id ? 'bg-zinc-800 border-r-4 border-r-barber-gold' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border font-black text-xs ${isPaused ? 'bg-red-500/20 text-red-500 border-red-500/40' : 'bg-zinc-800 text-barber-gold border-zinc-700'}`}>
                      {chat.clientName?.charAt(0).toUpperCase() || <User size={16}/>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className={`text-sm font-black truncate uppercase italic ${isPaused ? 'text-red-400' : selectedChat?.id === chat.id ? 'text-barber-gold' : 'text-white'}`}>
                          {chat.clientName || chat.id.replace(/\D/g, '')}
                        </h4>
                        <span className="text-[8px] text-zinc-600 font-bold">
                          {chat.updatedAt ? formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: false }) : 'Now'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isVoiceMessage(lastMsgText) && <Phone size={10} className="text-barber-gold shrink-0" />}
                        <p className="text-[10px] text-zinc-500 truncate font-medium italic">
                            {lastMsgText.replace(/\[PHONE CALL CONTEXT\]:|\[PHONE CALL\]:/g, '') || 'Starting...'}
                        </p>
                      </div>
                    </div>
                    {isPaused && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: CONVERSA ATIVA */}
        <div className={`flex-1 flex flex-col bg-zinc-950 relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat ? (
            <>
              {/* Header do Chat - PRESERVADO */}
              <div className="p-4 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between shadow-lg z-20">
                <div className="flex items-center gap-3">
                   <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 text-zinc-400 hover:text-white">←</button>
                   <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black border-2 ${selectedChat.status === 'paused' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-barber-gold/30 text-barber-gold bg-barber-gold/5'}`}>
                            {selectedChat.clientName?.charAt(0).toUpperCase() || <User size={20} />}
                        </div>
                        {selectedChat.status === 'paused' && (
                            <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-zinc-900">
                                <Pause size={10} fill="currentColor" />
                            </div>
                        )}
                   </div>
                   <div>
                      <h3 className="text-sm font-black text-white uppercase italic tracking-wide flex items-center gap-2">
                        {selectedChat.clientName || 'Unregistered Client'}
                        {selectedChat.status === 'paused' && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded font-black tracking-tighter">AI PAUSED</span>}
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono font-bold">
                         {selectedChat.id.replace('whatsapp:', '')}
                      </p>
                   </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedChat.status === 'paused' && (
                        <button 
                            onClick={() => handleResumeAI(selectedChat.id)}
                            className="flex items-center gap-2 bg-barber-gold text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                        >
                            <Play size={12} fill="currentColor" /> Resume AI
                        </button>
                    )}
                    <a 
                      href={`https://wa.me/${selectedChat.id.replace(/\D/g, '')}`} 
                      target="_blank" rel="noreferrer"
                      className="hidden sm:flex items-center gap-2 bg-zinc-800 text-zinc-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all border border-zinc-700"
                    >
                      <ExternalLink size={12} /> WhatsApp
                    </a>
                </div>
              </div>

              {/* Alerta de Pausa - PRESERVADO */}
              {selectedChat.status === 'paused' && (
                  <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-2 text-red-400 animate-in slide-in-from-top duration-300">
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Intervention Required: AI Concierge is offline for this chat.</span>
                  </div>
              )}

              {/* Área de Mensagens - BLINDADA CONTRA ERRO DE REPLACE */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                {selectedChat.history?.map((msg, idx) => {
                  const rawText = msg.parts?.[0]?.text || ""; // Fallback para string vazia
                  const isVoice = isVoiceMessage(rawText);
                  const cleanText = rawText.replace(/\[PHONE CALL CONTEXT\]:|\[PHONE CALL\]:/g, '').trim();

                  return (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in duration-300`}>
                      <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[70%]">
                        <div className={`relative rounded-2xl p-4 shadow-xl text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user' 
                            ? 'bg-barber-gold text-black rounded-tr-none' 
                            : 'bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-800'
                        }`}>
                          {isVoice && (
                            <div className={`flex items-center gap-2 mb-2 text-[9px] font-black uppercase tracking-widest pb-2 border-b ${msg.role === 'user' ? 'border-black/10 text-black/60' : 'border-zinc-800 text-barber-gold'}`}>
                              <Headphones size={12} /> Voice Transcript
                            </div>
                          )}
                          {cleanText || "..."}
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-widest opacity-40 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.role === 'user' ? 'Client' : 'Assistant'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Footer de Status - PRESERVADO */}
              <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedChat.status === 'paused' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] italic">
                      {selectedChat.status === 'paused' ? 'Human Operator Required' : 'AI Monitoring Active'}
                    </span>
                  </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-800 mb-6 border border-zinc-800 shadow-inner rotate-3">
                <MessageSquare size={40} />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-1">Command Center</h3>
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] max-w-xs leading-loose">
                Monitor and intervene in global AI negotiations in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}