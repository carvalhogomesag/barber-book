import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { ProfileDetails } from '../components/profile/ProfileDetails'; 
import { useAuth } from '../contexts/AuthContext'; 
import { getProfessionalProfile, updateProfessionalProfile } from '../services/professionalService'; 
import { getSalespersonProfile } from '../services/salesService';
import { updateSalesperson, requestAccountClosure } from '../services/adminService'; 
import { Globe, ShieldCheck, Zap } from 'lucide-react';

// CONSTANTES DE CONFIGURAÇÃO DE PAÍS (Sincronizado com Backend & IA)
const COUNTRY_CONFIG = {
  US: { name: 'United States', ddi: '1', currency: '$', flag: '🇺🇸' },
  BR: { name: 'Brazil', ddi: '55', currency: 'R$', flag: '🇧🇷' },
  PT: { name: 'Portugal', ddi: '351', currency: '€', flag: '🇵🇹' },
  ES: { name: 'España', ddi: '34', currency: '€', flag: '🇪🇸' },
  FR: { name: 'France', ddi: '33', currency: '€', flag: '🇫🇷' },
  IT: { name: 'Italia', ddi: '39', currency: '€', flag: '🇮🇹' },
  GB: { name: 'United Kingdom', ddi: '44', currency: '£', flag: '🇬🇧' }
};

export function Profile() {
  const { user, profile: globalProfile } = useAuth(); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState('professional'); 

  // Estados do Perfil
  const [country, setCountry] = useState('US');
  const [timezone, setTimezone] = useState('America/New_York'); 
  const [barberShopName, setBarberShopName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [conciergeNumber, setConciergeNumber] = useState(''); 
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState(''); 
  const [slug, setSlug] = useState('');
  
  // Estados de Horário de Funcionamento (Fundamentais para a IA)
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [breakTime, setBreakTime] = useState('12:00-13:00');
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5]);

  const [aiPreference, setAiPreference] = useState('professional');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      let data = await getProfessionalProfile();
      
      if (data) {
        setRole(data.role === 'admin' ? 'admin' : 'professional');
      } else {
        data = await getSalespersonProfile(user.uid);
        if (data) setRole('sales');
      }

      if (data) {
        setBarberShopName(data.barberShopName || data.name || '');
        
        // Lógica de Identidade do Número: Se for Pro e tiver Concierge, exibimos separado
        if (data.phone && data.numberType === 'international_concierge') {
           setConciergeNumber(data.phone);
           // O campo 'whatsapp' aqui refere-se ao número PESSOAL para notificações de transbordo
           setWhatsapp(data.personalPhone || ''); 
        } else {
           setWhatsapp(data.phone || '');
        }

        setAddress(data.address || '');
        setEmail(data.email || '');
        setCountry(data.country || 'US');
        setTimezone(data.timezone || 'America/New_York'); 
        setSlug(data.slug || '');
        
        if (data.settings?.businessHours) {
          setOpenTime(data.settings.businessHours.open || '09:00');
          setCloseTime(data.settings.businessHours.close || '18:00');
          setBreakTime(data.settings.businessHours.break || '12:00-13:00');
          if (Array.isArray(data.settings.businessHours.days)) {
            setWorkDays(data.settings.businessHours.days);
          }
        }
        setAiPreference(data.settings?.aiPreference || 'professional');
      }
    } catch (error) {
      console.error("Critical error in loadProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (e) => setCountry(e.target.value);
  
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setWhatsapp(value); 
  };

  const handleSlugChange = (e) => {
    // Sanitização de Slug: Apenas letras, números e hífens.
    const value = e.target.value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSlug(value);
  };

  const toggleDay = (dayIndex) => {
    setWorkDays(prev => {
      const newDays = prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b);
      return newDays;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const config = COUNTRY_CONFIG[country];
    
    try {
      const payload = {
        barberShopName, 
        address, 
        country,
        currency: config.currency, 
        timezone, 
        ddi: config.ddi, 
        slug,
        updatedAt: new Date().toISOString()
      };

      if (role === 'professional' || role === 'admin') {
        // Para profissionais, salvamos o número pessoal separadamente do Concierge
        if (conciergeNumber) {
          payload.personalPhone = whatsapp; 
        } else {
          payload.phone = whatsapp;
        }

        payload.settings = { 
          aiPreference, 
          businessHours: { 
            open: openTime, 
            close: closeTime, 
            break: breakTime,
            days: workDays 
          } 
        };
        await updateProfessionalProfile(payload);
      } else {
        // Lógica de Vendedor
        await updateSalesperson(user.uid, {
          name: barberShopName, phone: whatsapp, country, timezone, ddi: config.ddi
        });
      }
      alert("Success: Profile and AI logic updated.");
    } catch (error) { 
      alert("Error saving: Check your internet connection."); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleCloseAccount = async () => {
    const confirmText = role === 'professional' 
      ? "CRITICAL: This will deactivate your International AI Concierge and your US number. Proceed?"
      : "WARNING: This will request account closure. Commissions will stop immediately. Proceed?";

    if (!confirm(confirmText)) return;
    setClosing(true);
    try {
      await requestAccountClosure(user.uid, role); 
      alert("Request received. Our team will contact you via email shortly.");
    } catch (error) { 
      alert("Error processing request. Contact support@schedy.ai"); 
    } finally { 
      setClosing(false); 
    }
  };

  const getPageTitle = () => {
    if (role === 'admin') return 'System Administrator';
    if (role === 'sales') return 'Partner Management';
    return 'Professional Console';
  };

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-2">
            <Zap className="text-barber-gold" size={24} />
            {getPageTitle()}
          </h1>
          <p className="text-barber-gray font-bold uppercase tracking-widest text-[10px] opacity-70 italic">
            Configuring global business rules for Schedy AI
          </p>
        </div>
        
        {globalProfile?.plan === 'pro' && (
          <div className="flex items-center gap-2 bg-barber-gold/10 px-4 py-2 rounded-xl border border-barber-gold/20">
            <ShieldCheck size={16} className="text-barber-gold" />
            <span className="text-[10px] font-black text-barber-gold uppercase tracking-widest italic">International DID Active</span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-barber-gold border-t-transparent rounded-full animate-spin"></div>
          <p className="text-barber-gray font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Syncing Cloud Profile...</p>
        </div>
      ) : (
        <ProfileDetails 
          role={role}
          email={email}
          barberShopName={barberShopName} setBarberShopName={setBarberShopName}
          whatsapp={whatsapp} handlePhoneChange={handlePhoneChange}
          conciergeNumber={conciergeNumber}
          address={address} setAddress={setAddress}
          country={country} handleCountryChange={handleCountryChange}
          timezone={timezone} setTimezone={setTimezone}
          slug={slug} handleSlugChange={handleSlugChange}
          openTime={openTime} setOpenTime={setOpenTime}
          closeTime={closeTime} setCloseTime={setCloseTime}
          breakTime={breakTime} setBreakTime={setBreakTime}
          workDays={workDays} toggleDay={toggleDay}
          saving={saving}
          handleSave={handleSave}
          closing={closing}
          globalProfileStatus={globalProfile?.status}
          handleCloseAccount={handleCloseAccount}
        />
      )}
    </AppLayout>
  );
}