import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Loader2
} from 'lucide-react';

export function SupportChat({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'model', text: "Hello! I'm Schedy AI Support. How can I help you today?" }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener('open-schedy-chat', handleOpenChat);
    return () => window.removeEventListener('open-schedy-chat', handleOpenChat);
  }, []);

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    
    // Adiciona a mensagem do usuário na tela
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const supportChatFn = httpsCallable(functions, 'supportChat');
      
      /**
       * CORREÇÃO AQUI:
       * Filtramos o histórico para que a primeira mensagem enviada ao Gemini 
       * NUNCA seja a do robô (model). O Gemini exige que comece com 'user'.
       */
      const historyForAI = newMessages
        .filter((m, index) => !(index === 0 && m.role === 'model'))
        .map(m => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

      // Removemos a última mensagem do histórico porque ela vai no parâmetro 'message'
      const finalHistory = historyForAI.slice(0, -1);

      const result = await supportChatFn({ 
        message: userMessage,
        history: finalHistory 
      });

      setMessages(prev => [...prev, { role: 'model', text: result.data.text }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] md:w-[400px] h-[500px] bg-barber-black border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-barber-gold rounded-full flex items-center justify-center text-black">
                <Bot size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">Schedy Assistant</h4>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">Online</span>
                </div>
              </div>
            </div>
            <button onClick={() => { setIsOpen(false); if(onClose) onClose(); }} className="text-zinc-500 hover:text-white p-2">
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-950/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-barber-gold text-black rounded-tr-none shadow-lg' 
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-700">
                  <Loader2 size={16} className="animate-spin text-barber-gold" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-barber-gold transition-all"
            />
            <button type="submit" disabled={loading} className="bg-barber-gold text-black p-2 rounded-xl hover:bg-yellow-600 disabled:opacity-50">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="w-14 h-14 bg-barber-gold text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all border-2 border-barber-dark">
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}