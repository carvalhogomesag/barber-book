import React, { useState } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button'; 
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Zap, 
  Users, 
  Bot, 
  Sparkles
} from 'lucide-react';

export function Support() {
  const [searchTerm, setSearchTerm] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  const faqData = [
    {
      category: "General",
      icon: <Sparkles className="text-barber-gold" size={18} />,
      questions: [
        {
          q: "What is Schedy AI?",
          a: "Schedy AI is an intelligent concierge system that automates scheduling for service professionals via WhatsApp. It uses advanced AI to talk to your clients, check your real-time availability, and book appointments without you touching your phone."
        },
        {
          q: "Is my data and my clients' data secure?",
          a: "Yes. We use industry-standard encryption and Firebase's secure infrastructure. We are GDPR/LGPD compliant. We never sell data, and your personal WhatsApp conversations remain private."
        }
      ]
    },
    {
      category: "For Professionals",
      icon: <Zap className="text-barber-red" size={18} />,
      questions: [
        {
          q: "Why do I get a US (+1) number?",
          a: "To ensure instant activation and global stability. Local numbers (BR/PT) often require weeks of bureaucratic documentation. Our US Virtual DID system allows you to start receiving bookings 5 minutes after subscribing."
        },
        {
          q: "How does the 30-day free trial work?",
          a: "You get full access to the AI Concierge for 30 days. No charges are made during this period. You can cancel anytime through your Billing dashboard."
        }
      ]
    },
    {
      category: "For Sales Partners",
      icon: <Users className="text-blue-400" size={18} />,
      questions: [
        {
          q: "How much commission do I earn?",
          a: "Partners earn a 20% recurring commission on every active Pro subscription they refer. If your client pays $29/mo, you earn $5.80 every single month."
        },
        {
          q: "How do I get paid?",
          a: "Once you reach the minimum balance of $10.00, you can request a withdrawal via your Sales Console. We process payments via PayPal, Wise, or Bank Transfer."
        }
      ]
    }
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // FUNÇÃO PARA ABRIR O CHAT DA IA
  const handleOpenAiChat = () => {
    window.dispatchEvent(new Event('open-schedy-chat'));
  };

  return (
    <AppLayout>
      <header className="mb-12 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-black text-barber-white uppercase italic tracking-tighter mb-4">
          How can we <span className="text-barber-gold">help?</span>
        </h1>
        <p className="text-barber-gray font-medium italic mb-8">
          Search our knowledge base or chat with our AI assistant below.
        </p>
        
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-barber-gold transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search for 'payouts', 'whatsapp', 'trial'..."
            className="w-full bg-barber-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-barber-gold transition-all shadow-xl"
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {faqData.map((section, sIdx) => (
          <div key={sIdx} className="space-y-4">
            <div className="flex items-center gap-2 px-2 mb-6">
              {section.icon}
              <h2 className="font-black text-white uppercase tracking-widest text-xs italic">{section.category}</h2>
            </div>
            
            {section.questions
              .filter(item => item.q.toLowerCase().includes(searchTerm) || item.a.toLowerCase().includes(searchTerm))
              .map((item, qIdx) => {
                const globalIdx = `${sIdx}-${qIdx}`;
                const isOpen = openIndex === globalIdx;
                return (
                  <div 
                    key={qIdx} 
                    className={`bg-barber-black border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isOpen ? 'border-barber-gold shadow-lg shadow-barber-gold/5' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <button 
                      onClick={() => toggleFaq(globalIdx)}
                      className="w-full p-5 text-left flex justify-between items-center gap-4"
                    >
                      <span className="text-sm font-bold text-zinc-200 leading-tight">{item.q}</span>
                      {isOpen ? <ChevronUp size={16} className="text-barber-gold" /> : <ChevronDown size={16} className="text-zinc-600" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium italic">
                          {item.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      <div className="mt-20 p-8 bg-zinc-900/50 border border-zinc-800 rounded-[2rem] text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 bg-barber-gold rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-barber-gold/20">
          <Bot size={24} className="text-black" />
        </div>
        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Still have questions?</h3>
        <p className="text-zinc-500 text-sm mb-6 font-medium italic">Our AI Support Agent is trained on every detail of the Schedy ecosystem.</p>
        
        {/* BOTÃO ATUALIZADO PARA DISPARAR O EVENTO DO CHAT */}
        <Button 
          className="w-auto px-8 h-12 gap-2"
          onClick={handleOpenAiChat}
        >
          <MessageSquare size={18} /> Chat with Schedy Support
        </Button>
      </div>
    </AppLayout>
  );
}