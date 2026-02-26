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
  Lock,
  ExternalLink
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { provisionConciergeNumber, getProfessionalProfile } from '../services/professionalService'; 

// Opções de Area Codes dos EUA (Foco em cidades de prestígio)
const US_AREA_CODES = [
  { code: '305', city: 'Miami, FL' },
  { code: '212', city: 'New York, NY' },
  { code: '407', city: 'Orlando, FL' },
  { code: '702', city: 'Las Vegas, NV' },
  { code: '832', city: 'Houston, TX' },
  { code: 'random', city: 'Instant Allocation' },
];

// Dicionário de Mensagens Localizadas (Ajustado para clareza do ID)
const COUNTRY_MESSAGES = {
  US: { text: "Hello! I'd like to schedule an appointment with {NAME}.", lang: "en" },
  GB: { text: "Hello! I'd like to schedule an appointment with {NAME}.", lang: "en" },
  BR: { text: "Olá! Gostaria de agendar um horário com {NAME}.", lang: "pt-BR" },
  PT: { text: "Olá! Gostaria de marcar um serviço com {NAME}.", lang: "pt-PT" },
  ES: { text: "¡Hola! Quisiera reservar una cita con {NAME}.", lang: "es" },
  FR: { text: "Bonjour ! Je voudrais prendre rendez-vous avec {NAME}.", lang: "fr" },
  IT: { text: "Ciao! Vorrei prenotare un appuntamento con {NAME}.", lang: "it" }
};

// Número global do Concierge (Deve bater com o do backend)
const CONCIERGE_NUMBER = "+14454563363"; 

export function SetupPro() {
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activationLoading, setActivationLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(false); 
  const [copied, setCopied] = useState(false); 
  const [selectedAreaCode, setSelectedAreaCode] = useState('random');

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfessionalProfile();
        if (data && data.plan === 'pro') {
          setProfile(data);
          // Se já tem telefone e o país é US, já está ativado
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
      // Chama a cloud function que atualiza o perfil para US Concierge
      await provisionConciergeNumber({ areaCode: selectedAreaCode }); 
      setIsActivated(true);
    } catch (error) {
      console.error(error);
      alert("Error activating Concierge. Our team has been notified.");
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
          <p className="text-barber-gray animate-pulse font-bold uppercase tracking-widest text-xs">Syncing with US Infrastructure...</p>
        </div>
      </AppLayout>
    );
  }

  // Proteção: Apenas usuários PRO acessam esta página
  if (!profile || profile.plan !== 'pro') {
     return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center bg-zinc-900 border border-zinc-800 p-10 rounded-3xl shadow-2xl">
          <Zap className="text-barber-gold mx-auto mb-4" size={48} />
          <h2 className="text-white font-black text-2xl mb-2 uppercase italic tracking-tighter">AI Concierge Required</h2>
          <p className="text-zinc-500 text-sm mb-8 italic">You need an active Pro Plan to provision your International US (+1) Number.</p>
          <Button onClick={() => window.location.href = '/pricing'} className="w-full">Upgrade Now</Button>
        </div>
      </AppLayout>
     );
  }

  // --- LÓGICA DE GERAÇÃO DO LINK ---
  const identifier = profile.slug || profile.id;
  const businessName = profile.barberShopName || profile.name;
  const localeConfig = COUNTRY_MESSAGES[profile.country] || COUNTRY_MESSAGES.US;
  
  // A mensagem contém o ID técnico para a IA saber qual agenda ler
  const localizedText = localeConfig.text.replace('{NAME}', businessName);
  const initialMessage = `${localizedText} (Ref: ${identifier})`;
  
  const whatsappLink = `https://wa.me/${CONCIERGE_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(initialMessage)}`;

  // VIEW 1: ESTADO INICIAL (ATIVAÇÃO)
  if (!isActivated) {
    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-barber-black border border-zinc-800 p-8 md:p-12 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Globe size={120} />
                    </div>

                    <div className="flex flex-col gap-2 mb-10">
                      <h1 className="text-4xl font-black text-barber-white tracking-tighter uppercase italic">
                        Activate <span className="text-barber-gold">Global</span> Authority
                      </h1>
                      <p className="text-zinc-500 font-medium italic">Your AI Concierge will be provisioned with an instant US (+1) virtual line.</p>
                    </div>

                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 mb-8">
                      <label className="text-[10px] font-black text-barber-gold uppercase tracking-[0.2em] mb-4 block italic">
                        Select International Area Code
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {US_AREA_CODES.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => setSelectedAreaCode(item.code)}
                            className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                              selectedAreaCode === item.code 
                              ? 'bg-barber-gold border-barber-gold text-black shadow-lg shadow-barber-gold/20' 
                              : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'
                            }`}
                          >
                            <p className="text-xl font-black italic">{item.code === 'random' ? 'ANY' : item.code}</p>
                            <p className="text-[10px] font-bold uppercase opacity-80 truncate">{item.city}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                        <div className="flex items-start gap-3 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
                            <Zap size={18} className="text-barber-gold shrink-0" />
                            <p className="text-[11px] text-zinc-400 leading-tight">Instant activation. No documents required for US lines.</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800">
                            <ShieldCheck size={18} className="text-barber-gold shrink-0" />
                            <p className="text-[11px] text-zinc-400 leading-tight">Enterprise-grade stability for 24/7 automated booking.</p>
                        </div>
                    </div>

                    <Button 
                        onClick={handleActivate} 
                        loading={activationLoading} 
                        className="w-full h-16 text-xl font-black italic uppercase tracking-tighter shadow-xl shadow-barber-gold/5"
                    >
                        {activationLoading ? "Provisioning US Line..." : "Activate International Concierge"}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
  }

  // VIEW 2: ESTADO ATIVADO (QR CODE E LINKS)
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto mt-6 animate-in zoom-in-95 duration-500">
        <div className="bg-barber-black border-2 border-barber-gold p-8 md:p-12 rounded-[40px] shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-6 right-8 flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-1.5 rounded-full border border-green-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest italic">Live & Operational</span>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-barber-white uppercase italic tracking-tighter mb-2">Concierge <span className="text-barber-gold">Deployed</span></h1>
            <p className="text-zinc-500 font-medium italic">Your US-based AI is now handling your WhatsApp schedule.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* QR CODE SECTION */}
            <div className="flex flex-col items-center">
                <div className="bg-white p-6 rounded-[32px] shadow-2xl mb-6 relative group">
                    <QRCodeCanvas 
                        id="qr-concierge"
                        value={whatsappLink} 
                        size={220}
                        level={"H"}
                        includeMargin={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px]">
                         <Button variant="outline" className="w-auto h-10 text-[10px]" onClick={() => {
                            const canvas = document.getElementById('qr-concierge');
                            const url = canvas.toDataURL("image/png");
                            const link = document.createElement('a');
                            link.download = `schedy-qr-${identifier}.png`;
                            link.href = url;
                            link.click();
                         }}>
                            <Download size={14} className="mr-2" /> Download PNG
                         </Button>
                    </div>
                </div>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] italic">Scan to Book via AI</p>
            </div>

            {/* DETAILS SECTION */}
            <div className="space-y-6">
                <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800">
                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest italic">Dedicated International Line</label>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-black text-barber-gold tracking-tighter italic">{CONCIERGE_NUMBER}</span>
                        <div className="bg-barber-gold/10 px-2 py-0.5 rounded text-[8px] font-black text-barber-gold border border-barber-gold/20 uppercase">USA Virtual DID</div>
                    </div>
                </div>

                <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800">
                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest italic">Your Smart Booking Link</label>
                    <div className="flex items-center gap-3">
                        <div className="bg-black/50 text-[10px] text-zinc-400 w-full p-4 rounded-xl truncate font-mono border border-zinc-800/50 italic">
                            {whatsappLink}
                        </div>
                        <button 
                            type="button"
                            onClick={() => copyToClipboard(whatsappLink)}
                            className="p-4 bg-barber-gold text-black rounded-xl hover:scale-105 transition-all active:scale-95 shadow-lg shadow-barber-gold/10"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-barber-gold/5 border-l-4 border-barber-gold rounded-r-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock size={14} className="text-barber-gold" />
                      <h4 className="text-zinc-300 text-[10px] font-black uppercase tracking-widest italic">Security Note</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium italic">
                        This dedicated US line handles <strong>only</strong> booking requests via the Schedy protocol. Personal messages sent to this number are processed by the AI for appointment intent only.
                    </p>
                </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row gap-4">
            <Button onClick={() => window.location.href = '/dashboard'} className="flex-1 h-14 uppercase font-black italic tracking-tighter">
              Manage Calendar
            </Button>
            <Button 
                onClick={() => window.open(whatsappLink, '_blank')} 
                variant="outline" 
                className="flex-1 h-14 uppercase font-black italic tracking-tighter gap-2"
            >
              Test AI Chat <ExternalLink size={16} />
            </Button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-30">
            <div className="flex items-center gap-2">
                <ShieldCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
                <Globe size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Global DID System</span>
            </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default SetupPro;