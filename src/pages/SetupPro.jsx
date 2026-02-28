import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { 
  Globe, 
  Loader2, 
  Copy, 
  Check, 
  Download,
  Zap,
  MapPin,
  ExternalLink,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { provisionConciergeNumber, getProfessionalProfile } from '../services/professionalService'; 

const US_AREA_CODES = [
  { code: '305', city: 'Miami, FL' },
  { code: '212', city: 'New York, NY' },
  { code: '407', city: 'Orlando, FL' },
  { code: '702', city: 'Las Vegas, NV' },
  { code: '832', city: 'Houston, TX' },
  { code: 'random', city: 'Alocação Instantânea' },
];

const COUNTRY_MESSAGES = {
  US: { text: "Hello! I'd like to schedule an appointment with {NAME}.", lang: "en" },
  BR: { text: "Olá! Gostaria de agendar um horário com {NAME}.", lang: "pt-BR" },
  PT: { text: "Olá! Gostaria de marcar um serviço com {NAME}.", lang: "pt-PT" },
};

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
          if (data.numberActivatedAt && data.numberCountry === 'US') {
             setIsActivated(true);
          }
        }
      } catch (error) { console.error(error); } finally { setPageLoading(false); }
    }
    loadProfile();
  }, []);

  const handleActivate = async () => {
    setActivationLoading(true);
    try {
      await provisionConciergeNumber({ areaCode: selectedAreaCode }); 
      setIsActivated(true);
    } catch (error) { alert("Erro na ativação."); } finally { setActivationLoading(false); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (pageLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="animate-spin text-schedy-black" size={48} />
          <p className="text-schedy-gray font-black uppercase tracking-[0.3em] text-[10px]">Configurando Infraestrutura US...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile || profile.plan !== 'pro') {
     return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center bg-white border border-schedy-border p-12 rounded-[40px] shadow-premium">
          <Zap className="text-schedy-black mx-auto mb-6" size={48} />
          <h2 className="text-schedy-black font-black text-2xl mb-3 uppercase italic tracking-tighter">Plano Pro Necessário</h2>
          <p className="text-schedy-gray text-sm mb-8 font-medium leading-relaxed">Você precisa de um plano ativo para provisionar seu número internacional e ativar a IA.</p>
          <Button onClick={() => window.location.href = '/pricing'}>Ver Planos</Button>
        </div>
      </AppLayout>
     );
  }

  const identifier = profile.slug || profile.id;
  const businessName = profile.barberShopName || profile.name;
  const localeConfig = COUNTRY_MESSAGES[profile.country] || COUNTRY_MESSAGES.US;
  const localizedText = localeConfig.text.replace('{NAME}', businessName);
  const initialMessage = `${localizedText} (ID: ${identifier})`;
  const cleanConcierge = CONCIERGE_NUMBER.replace(/\D/g, '');
  const whatsappLink = `https://wa.me/${cleanConcierge}?text=${encodeURIComponent(initialMessage)}`;

  const PageHeader = (
    <header className="flex items-center justify-between mb-8 bg-white p-6 rounded-[24px] border border-schedy-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-schedy-black p-2.5 rounded-xl text-white">
            <Globe size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-schedy-black tracking-tighter uppercase italic leading-none">AI Concierge</h1>
            <p className="text-[10px] font-bold text-schedy-gray uppercase tracking-widest mt-1">Status da Operação Internacional</p>
          </div>
        </div>
        {isActivated && (
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase text-green-600 italic">Live & Active</span>
          </div>
        )}
    </header>
  );

  if (!isActivated) {
    return (
        <AppLayout>
            {PageHeader}
            <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-white border-2 border-schedy-border p-10 rounded-[48px] shadow-premium relative overflow-hidden text-center">
                    <div className="mb-10">
                      <h2 className="text-4xl font-black text-schedy-black tracking-tighter uppercase italic mb-4">
                        Ative sua Autoridade <span className="text-service-indigo">Global</span>
                      </h2>
                      <p className="text-schedy-gray font-medium max-w-lg mx-auto">
                        Seu Concierge será provisionado instantaneamente com uma linha virtual dos Estados Unidos (+1) para máxima estabilidade.
                      </p>
                    </div>

                    <div className="bg-schedy-canvas/50 p-8 rounded-[32px] border border-schedy-border mb-10 text-left">
                      <label className="text-[10px] font-black text-schedy-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <MapPin size={12} /> Selecione o Código de Área (EUA)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {US_AREA_CODES.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => setSelectedAreaCode(item.code)}
                            className={`p-5 rounded-2xl border-2 transition-all duration-300 text-left ${
                              selectedAreaCode === item.code 
                              ? 'bg-schedy-black border-schedy-black text-white shadow-vivid scale-105' 
                              : 'bg-white border-schedy-border text-schedy-gray hover:border-schedy-black hover:text-schedy-black'
                            }`}
                          >
                            <p className="text-2xl font-black italic">{item.code === 'random' ? 'ANY' : item.code}</p>
                            <p className="text-[9px] font-bold uppercase opacity-80">{item.city}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <Button 
                        onClick={handleActivate} 
                        loading={activationLoading} 
                        className="h-20 text-xl shadow-vivid"
                    >
                        {activationLoading ? "Provisionando Linha US..." : "Ativar Concierge Internacional"}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
  }

  return (
    <AppLayout>
      {PageHeader}
      <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-500">
        <div className="bg-white border-2 border-schedy-black p-10 md:p-16 rounded-[60px] shadow-premium relative overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <div className="flex flex-col items-center">
                <div className="bg-schedy-canvas p-10 rounded-[48px] shadow-inner mb-8 relative group border border-schedy-border/50">
                    <div className="bg-white p-6 rounded-[32px] shadow-premium">
                      <QRCodeCanvas 
                          id="qr-concierge"
                          value={whatsappLink} 
                          size={240}
                          level={"H"}
                      />
                    </div>
                    <div className="absolute -top-4 -right-4 bg-schedy-black text-white p-4 rounded-full shadow-vivid rotate-12">
                      <QrCode size={24} />
                    </div>
                </div>
                <Button variant="outline" className="w-auto h-12 px-8" onClick={() => {
                    const canvas = document.getElementById('qr-concierge');
                    const url = canvas.toDataURL("image/png");
                    const link = document.createElement('a');
                    link.download = `meu-concierge-ia.png`;
                    link.href = url;
                    link.click();
                }}>
                    <Download size={18} className="mr-2" /> Baixar Kit Digital (PNG)
                </Button>
            </div>

            <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-black text-schedy-black uppercase italic tracking-tighter mb-2">Concierge Ativo.</h2>
                  <p className="text-schedy-gray font-medium">Sua inteligência artificial já está operando na rede global do WhatsApp.</p>
                </div>

                <div className="bg-schedy-canvas p-6 rounded-[24px] border border-schedy-border/50">
                    {/* CORREÇÃO: Removido 'block' aqui */}
                    <label className="text-[10px] font-black text-schedy-gray uppercase mb-3 tracking-widest italic flex items-center gap-2">
                      <ShieldCheck size={14} /> Linha Internacional Dedicada
                    </label>
                    <span className="text-4xl font-black text-schedy-black tracking-tighter italic">{CONCIERGE_NUMBER}</span>
                </div>

                <div className="bg-schedy-canvas p-6 rounded-[24px] border border-schedy-border/50">
                    {/* CORREÇÃO: Removido 'block' aqui */}
                    <label className="text-[10px] font-black text-schedy-gray uppercase mb-3 tracking-widest italic flex items-center gap-2">
                      Your Smart Booking Link
                    </label>
                    <div className="flex items-center gap-3">
                        <div className="bg-white text-[10px] text-schedy-black w-full p-4 rounded-xl truncate font-mono border border-schedy-border shadow-sm italic">
                            {whatsappLink}
                        </div>
                        <button 
                            type="button"
                            onClick={() => copyToClipboard(whatsappLink)}
                            className="p-4 bg-schedy-black text-white rounded-2xl hover:scale-110 transition-all shadow-vivid shrink-0"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button onClick={() => window.location.href = '/dashboard'} className="flex-1 h-16 shadow-vivid">
                    Gerenciar Agenda
                  </Button>
                  <Button 
                      onClick={() => window.open(whatsappLink, '_blank')} 
                      variant="outline" 
                      className="flex-1 h-16 gap-2"
                  >
                    Testar Chat IA <ExternalLink size={18} />
                  </Button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default SetupPro;