import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { ProfileDetails } from '../components/profile/ProfileDetails'; 
import { useAuth } from '../contexts/AuthContext'; 
import { getProfessionalProfile, updateProfessionalProfile } from '../services/professionalService'; 
import { getSalespersonProfile } from '../services/salesService';
import { updateSalesperson, requestAccountClosure } from '../services/adminService'; 

// CONSTANTES DE CONFIGURAÇÃO DE PAÍS
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
  
  // Estados de Horário de Funcionamento
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [breakTime, setBreakTime] = useState('12:00-13:00');
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5]); // Padrão: Seg-Sex (0=Dom, 6=Sab)

  const [aiPreference, setAiPreference] = useState('none');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      let data = null;

      try {
        data = await getProfessionalProfile();
      } catch (err) {
        console.warn("Not a professional profile:", err);
        data = null;
      }
      
      if (data) {
        setRole(data.role === 'admin' ? 'admin' : 'professional');
      } else {
        try {
          data = await getSalespersonProfile(user.uid);
          if (data) setRole('sales');
        } catch (err) {
          console.error("Error fetching sales profile:", err);
        }
      }

      if (data) {
        setBarberShopName(data.barberShopName || data.name || '');
        
        if (data.phone && data.phone.length > 10 && data.numberType === 'international_concierge') {
           setConciergeNumber(data.phone);
           setWhatsapp(''); 
        } else {
           setWhatsapp(data.phone || '');
        }

        setAddress(data.address || '');
        setEmail(data.email || '');
        setCountry(data.country || 'US');
        setTimezone(data.timezone || 'America/New_York'); 
        setSlug(data.slug || '');
        
        if (data.settings?.businessHours) {
          setOpenTime(data.settings.businessHours.open || '08:00');
          setCloseTime(data.settings.businessHours.close || '18:00');
          setBreakTime(data.settings.businessHours.break || '12:00-13:00');
          
          // Carrega os dias de trabalho se existirem, senão mantém o padrão (Seg-Sex)
          if (Array.isArray(data.settings.businessHours.days)) {
            setWorkDays(data.settings.businessHours.days);
          }
        }
        setAiPreference(data.settings?.aiPreference || 'none');
      }
    } catch (error) {
      console.error("Critical error in loadProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (e) => setCountry(e.target.value);
  
  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    setWhatsapp(value); 
  };

  const handleSlugChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setSlug(value);
  };

  // Função para alternar dias da semana (0-6)
  const toggleDay = (dayIndex) => {
    setWorkDays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(d => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const config = COUNTRY_CONFIG[country];
    try {
      if (role === 'professional' || role === 'admin') {
        await updateProfessionalProfile({
          barberShopName, 
          phone: whatsapp, 
          address, country,
          currency: config.currency, timezone: timezone, ddi: config.ddi, slug: slug,
          settings: { 
            aiPreference, 
            businessHours: { 
              open: openTime, 
              close: closeTime, 
              break: breakTime,
              days: workDays // Salva os dias selecionados
            } 
          }
        });
      } else {
        await updateSalesperson(user.uid, {
          name: barberShopName, phone: whatsapp, country, timezone: timezone, ddi: config.ddi
        });
      }
      alert("Profile updated successfully!");
    } catch (error) { alert("Error saving profile"); }
    finally { setSaving(false); }
  };

  const handleCloseAccount = async () => {
    const confirmText = role === 'professional' 
      ? "WARNING: This will request the closure of your business account. Your AI Concierge line will be deactivated. Continue?"
      : "WARNING: This will request the closure of your partner account. You will stop receiving commissions. Continue?";

    if (!confirm(confirmText)) return;
    setClosing(true);
    try {
      await requestAccountClosure(user.uid, role); 
      alert("Closure request sent. Our team will process it and contact you shortly.");
    } catch (error) { alert("Error requesting closure. Please contact support@schedy.ai"); } 
    finally { setClosing(false); }
  };

  const getPageTitle = () => {
    if (role === 'admin') return 'Administrator Profile';
    if (role === 'sales') return 'Partner Profile';
    return 'Professional Profile';
  };

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">
          {getPageTitle()}
        </h1>
        <p className="text-barber-gray font-medium italic">Manage your account settings and preferences</p>
      </header>

      {loading ? (
        <p className="text-barber-gray animate-pulse font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
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
          
          // Props de Horário
          openTime={openTime} setOpenTime={setOpenTime}
          closeTime={closeTime} setCloseTime={setCloseTime}
          breakTime={breakTime} setBreakTime={setBreakTime}
          workDays={workDays} toggleDay={toggleDay} // Novas Props
          
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