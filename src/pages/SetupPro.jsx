import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { 
  Globe, 
  Loader2, 
  CheckCircle, 
  Copy, 
  Check, 
  Download,
  ShieldCheck,
  Zap,
  MapPin,
  Lock
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { provisionConciergeNumber, getProfessionalProfile } from '../services/professionalService'; 

// Opções de Area Codes dos EUA
const US_AREA_CODES = [
  { code: '305', city: 'Miami, FL' },
  { code: '212', city: 'New York, NY' },
  { code: '407', city: 'Orlando, FL' },
  { code: '702', city: 'Las Vegas, NV' },
  { code: 'random', city: 'Instant Allocation' },
];

// Dicionário de Mensagens Localizadas
const COUNTRY_MESSAGES = {
  US: { 
    text: "Hello! I'd like to schedule an appointment with {NAME}. Please send this message to start.", 
    lang: "en" 
  },
  GB: { 
    text: "Hello! I'd like to schedule an appointment with {NAME}. Please send this message to start.", 
    lang: "en" 
  },
  BR: { 
    text: "Olá! Gostaria de agendar um horário com {NAME}. Por favor, envie esta mensagem para iniciar.", 
    lang: "pt-BR" 
  },
  PT: { 
    text: "Olá! Gostaria de marcar um serviço com {NAME}. Por favor, envie esta mensagem para iniciar.", 
    lang: "pt-PT" 
  },
  ES: { 
    text: "¡Hola! Quisiera reservar una cita con {NAME}. Por favor, envíe este mensaje para comenzar.", 
    lang: "es" 
  },
  FR: { 
    text: "Bonjour ! Je voudrais prendre rendez-vous avec {NAME}. Veuillez envoyer ce message pour commencer.", 
    lang: "fr" 
  },
  IT: { 
    text: "Ciao! Vorrei prenotare un appuntamento con {NAME}. Per favore invia questo messaggio per iniziare.", 
    lang: "it" 
  }
};

const CONCIERGE_NUMBER = "+14454563363"; 

export function SetupPro() {
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activationLoading, setActivationLoading] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [isActivated, setIsActivated] = useState(false); 
  const [copied, setCopied] = useState(false); 
  const [selectedAreaCode, setSelectedAreaCode] = useState('random');

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfessionalProfile();
        if (data && data.plan === 'pro') {
          setProfile(data);
          setTenantId(data.id); 
          
          if (data.phone && data.numberCountry === 'US') {
             setIsActivated(true);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setPageLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleActivate = async () => {
    setActivationLoading(true);
    try {
      await provisionConciergeNumber({ areaCode: selectedAreaCode }); 
      setIsActivated(true);
    } catch (error) {
      alert("Error activating Concierge. Please contact support.");
    } finally {
      setActivationLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (pageLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center mt-40 gap-4">
          <Loader2 className="animate-spin text-barber-gold" size={48} />
          <p className="text-barber-gray animate-pulse font-medium tracking-tight">Finalizing your pro dashboard...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile || profile.plan !== 'pro') {
     return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center bg-red-500/10 border border-red-500/50 p-8 rounded-2xl">
          <ShieldCheck className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-white font-bold text-xl mb-2">Pro Feature Only</h2>
          <p className="text-zinc-400 text-sm mb-6">Upgrade your account to activate your AI Concierge and get your dedicated US number.</p>
          <Button onClick={() => window.location.href = '/pricing'}>View Pro Plans</Button>
        </div>
      </AppLayout>
     );
  }

  // --- LÓGICA DE INTERNACIONALIZAÇÃO ---
  const identifier = profile.slug || tenantId;
  const businessName = profile.barberShopName || "the professional";
  
  // Seleciona a configuração baseada no país do perfil, ou usa US como fallback
  const localeConfig = COUNTRY_MESSAGES[profile.country] || COUNTRY_MESSAGES.US;
  
  // Monta a mensagem substituindo o nome
  const localizedText = localeConfig.text.replace('{NAME}', businessName);
  
  // Adiciona o ID no final (obrigatório para o sistema funcionar)
  const initialMessage = `${localizedText} (ID: ${identifier})`;
  
  const whatsappLink = `https://wa.me/${CONCIERGE_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(initialMessage)}`;

  // VIEW: SETUP / ACTIVATION
  if (!isActivated) {
    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto mt-10">
                <div className="bg-barber-black border border-zinc-800 p-8 md:p-12 rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="bg-barber-gold/10 p-4 rounded-2xl text-barber-gold border border-barber-gold/20">
                          <Zap size={32} className="fill-current" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-black text-barber-white tracking-tighter uppercase italic text-left">Your 30-Day Trial is Active!</h1>
                        <p className="text-barber-gray text-sm text-left">Let's connect your AI Concierge to a phone number.</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 mb-8 text-left">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-barber-gold" /> Choose your preferred Area Code
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {US_AREA_CODES.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => setSelectedAreaCode(item.code)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              selectedAreaCode === item.code 
                              ? 'bg-barber-gold border-barber-gold text-black' 
                              : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'
                            }`}
                          >
                            <p className="text-lg font-black">{item.code === 'random' ? 'Any' : item.code}</p>
                            <p className="text-[10px] font-bold uppercase opacity-80 leading-none mt-1">{item.city}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-10 text-left">
                      <div className="flex items-start gap-4 p-4 bg-barber-gold/5 rounded-xl border border-barber-gold/10">
                        <CheckCircle size={20} className="text-barber-gold shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-bold text-white italic uppercase tracking-tighter">Ready to work 24/7</p>
                          <p className="text-xs text-zinc-500 leading-relaxed">Your AI assistant will use this number to talk to clients and fill your schedule while you're busy with your clippers.</p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleActivate} loading={activationLoading} className="w-full h-16 text-xl shadow-xl shadow-barber-gold/10 font-black italic uppercase tracking-tighter">
                        {activationLoading ? "Setting up your line..." : `Activate My Assistant Now`}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
  }

  // VIEW: LIVE / ACTIVATED
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto mt-6">
        <div className="bg-barber-black border-2 border-barber-gold p-10 rounded-3xl shadow-2xl text-center relative overflow-hidden">
          
          <div className="absolute top-0 right-0 bg-barber-gold text-black px-6 py-1 font-black text-[10px] uppercase tracking-widest rounded-bl-xl italic">
            30-Day Trial Active
          </div>

          <CheckCircle size={64} className="text-green-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black text-barber-white mb-2 uppercase italic tracking-tighter">You're on Autopilot</h1>
          <p className="text-barber-gray mb-10 max-w-md mx-auto font-medium">
            Your AI Concierge is now live and taking bookings. <br/>
            <span className="text-white font-bold">Share your link below to get started.</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            
            <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 flex flex-col items-center shadow-inner">
                <div className="bg-white p-4 rounded-2xl mb-6 shadow-2xl">
                    <QRCodeCanvas 
                        id="qr-concierge"
                        value={whatsappLink} 
                        size={200}
                        level={"H"}
                    />
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">Clients scan this to book</p>
                <button 
                    type="button"
                    onClick={() => {
                        const canvas = document.getElementById('qr-concierge');
                        const url = canvas.toDataURL("image/png");
                        const link = document.createElement('a');
                        link.download = `my-booking-qr.png`;
                        link.href = url;
                        link.click();
                    }}
                    className="flex items-center gap-2 text-zinc-400 text-xs hover:text-white transition-colors font-bold uppercase tracking-tighter"
                >
                    <Download size={14} /> Download Image
                </button>
            </div>

            <div className="flex flex-col gap-6 text-left">
                <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800">
                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest italic">Your Professional AI Line</label>
                    <span className="text-2xl font-mono font-bold text-barber-gold tracking-tighter">{CONCIERGE_NUMBER}</span>
                </div>

                <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800">
                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest italic">Your Booking Link</label>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="bg-black/50 text-[10px] text-zinc-400 w-full p-3 rounded-lg truncate font-mono border border-zinc-800/50">
                            {whatsappLink}
                        </div>
                        <button 
                            type="button"
                            onClick={() => copyToClipboard(whatsappLink)}
                            className="p-3 bg-barber-gold text-black rounded-lg hover:bg-yellow-600 transition-all shrink-0 active:scale-95"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                </div>

                <div className="p-5 border-l-4 border-barber-gold bg-zinc-900/50 rounded-r-2xl">
                    <div className="flex items-center gap-2 mb-2 text-left">
                      <Lock size={12} className="text-zinc-500" />
                      <h4 className="text-zinc-400 text-[10px] font-black uppercase tracking-widest italic">Privacy Guaranteed</h4>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-medium text-left">
                        Schedy AI only monitors booking requests sent to your dedicated line. <span className="text-zinc-300">Your personal WhatsApp conversations stay private.</span>
                    </p>
                </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row gap-4">
            <Button onClick={() => window.location.href = '/dashboard'} className="flex-1 h-14 uppercase font-black italic tracking-tighter shadow-lg">
              View My Schedule
            </Button>
            <Button onClick={() => window.location.href = '/profile'} variant="outline" className="flex-1 h-14 uppercase font-black italic tracking-tighter border-zinc-800 text-zinc-400 hover:text-white">
              Edit Business Info
            </Button>
          </div>
        </div>
      </div>
      
      <p className="text-center text-zinc-700 text-[9px] mt-8 uppercase font-bold tracking-[0.3em] italic">
          International Concierge Powered by Schedy AI
      </p>
    </AppLayout>
  );
}

export default SetupPro;