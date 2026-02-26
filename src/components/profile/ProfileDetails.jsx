import React from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  User, 
  Building, 
  Globe, 
  Clock, 
  Link as LinkIcon, 
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Lock,
  CalendarDays
} from 'lucide-react';

const TIMEZONE_OPTIONS = {
  US: [
    { value: 'America/New_York', label: 'Eastern Time (NY, Miami)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago, Texas)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver, Phoenix)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (LA, Vegas)' }
  ],
  BR: [
    { value: 'America/Sao_Paulo', label: 'Brasília / SP / RJ / Sul / Nordeste' },
    { value: 'America/Manaus', label: 'Amazonas (AMT)' },
    { value: 'America/Cuiaba', label: 'Mato Grosso' },
    { value: 'America/Fortaleza', label: 'Norte / Nordeste' }
  ],
  PT: [
    { value: 'Europe/Lisbon', label: 'Portugal Continental / Madeira' },
    { value: 'Atlantic/Azores', label: 'Açores' }
  ],
  ES: [{ value: 'Europe/Madrid', label: 'España (Madrid)' }],
  FR: [{ value: 'Europe/Paris', label: 'France (Paris)' }],
  IT: [{ value: 'Europe/Rome', label: 'Italia (Roma)' }],
  GB: [{ value: 'Europe/London', label: 'United Kingdom (London)' }]
};

const COUNTRY_CONFIG = {
  US: { name: 'United States', ddi: '1', currency: '$', flag: '🇺🇸' },
  BR: { name: 'Brazil', ddi: '55', currency: 'R$', flag: '🇧🇷' },
  PT: { name: 'Portugal', ddi: '351', currency: '€', flag: '🇵🇹' },
  ES: { name: 'España', ddi: '34', currency: '€', flag: '🇪🇸' },
  FR: { name: 'France', ddi: '33', currency: '€', flag: '🇫🇷' },
  IT: { name: 'Italia', ddi: '39', currency: '€', flag: '🇮🇹' },
  GB: { name: 'United Kingdom', ddi: '44', currency: '£', flag: '🇬🇧' }
};

// Dias da semana para o seletor (começando do Domingo = 0)
const DAYS_OF_WEEK = [
  { label: 'S', value: 0, title: 'Sunday' },
  { label: 'M', value: 1, title: 'Monday' },
  { label: 'T', value: 2, title: 'Tuesday' },
  { label: 'W', value: 3, title: 'Wednesday' },
  { label: 'T', value: 4, title: 'Thursday' },
  { label: 'F', value: 5, title: 'Friday' },
  { label: 'S', value: 6, title: 'Saturday' },
];

export function ProfileDetails({
  role,
  email,
  barberShopName, setBarberShopName,
  whatsapp, handlePhoneChange,
  conciergeNumber,
  address, setAddress,
  country, handleCountryChange,
  timezone, setTimezone,
  slug, handleSlugChange,
  openTime, setOpenTime,
  closeTime, setCloseTime,
  breakTime, setBreakTime,
  workDays = [], toggleDay, 
  saving,
  handleSave,
  closing,
  globalProfileStatus,
  handleCloseAccount
}) {

  const getInitials = (name) => name ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AI';

  return (
    <div className="space-y-12">
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: STATUS E ID */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-zinc-900 shadow-xl text-3xl font-black text-barber-black ${role === 'admin' ? 'bg-barber-red' : 'bg-barber-gold'}`}>
              {getInitials(barberShopName)}
            </div>
            <h2 className="text-lg font-black text-barber-white uppercase italic tracking-tighter">{barberShopName || "Your Name"}</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{email}</p>
            
            {role === 'professional' && (
              <div className="mt-6 w-full p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-left">
                <label className="text-[10px] font-black text-barber-gold uppercase flex items-center gap-1 mb-2 italic"><LinkIcon size={12}/> Friendly ID (Slug)</label>
                <input value={slug} onChange={handleSlugChange} placeholder="ex: my-shop" className="bg-transparent border-b border-zinc-700 w-full text-sm text-white focus:border-barber-gold outline-none pb-1 font-medium" />
              </div>
            )}

            {role === 'admin' && (
              <div className="mt-6 inline-flex items-center gap-2 bg-barber-red/10 text-barber-red px-4 py-2 rounded-full border border-barber-red/20">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">System Owner</span>
              </div>
            )}
          </div>

          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-xl">
            <h3 className="text-xs font-black text-barber-white mb-6 flex items-center gap-2 uppercase tracking-widest italic"><Globe size={16} className="text-barber-gold"/> Region & Timezone</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2">Location</label>
                <select value={country} onChange={handleCountryChange} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-barber-gold outline-none font-bold">
                  {Object.keys(COUNTRY_CONFIG).map((key) => (<option key={key} value={key}>{COUNTRY_CONFIG[key].flag} {COUNTRY_CONFIG[key].name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2">Local Timezone</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-barber-gold outline-none font-bold">
                  {TIMEZONE_OPTIONS[country]?.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHES */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-xl space-y-8">
            <h3 className="text-lg font-black text-barber-white flex items-center gap-2 border-b border-zinc-800 pb-4 uppercase italic tracking-tighter">
              {role === 'professional' ? <Building size={20} className="text-barber-gold"/> : <User size={20} className="text-barber-gold"/>}
              {role === 'professional' ? 'Business Details' : 'Personal Details'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label={role === 'professional' ? "BUSINESS NAME" : "FULL NAME"} value={barberShopName} onChange={e => setBarberShopName(e.target.value)} />
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 block">PERSONAL PHONE</label>
                <div className="flex gap-2">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-400 flex items-center font-black">+{COUNTRY_CONFIG[country].ddi}</div>
                  <Input value={whatsapp} onChange={handlePhoneChange} placeholder="Phone number" />
                </div>
              </div>
            </div>
            {role === 'professional' && (<Input label="FULL ADDRESS" value={address} onChange={e => setAddress(e.target.value)} />)}
          </div>

          {role === 'professional' && (
            <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-xl space-y-8">
              <h3 className="text-lg font-black text-barber-white flex items-center gap-2 border-b border-zinc-800 pb-4 uppercase italic tracking-tighter"><Clock size={20} className="text-barber-gold"/> Operating Hours</h3>
              
              {/* SELETOR DE DIAS DA SEMANA - CORRIGIDO (Removido 'block') */}
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CalendarDays size={14} className="text-barber-gold"/> Work Days
                </label>
                <div className="flex flex-wrap gap-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const isActive = workDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        title={day.title}
                        className={`
                          w-10 h-10 rounded-full font-black text-xs transition-all duration-200 border
                          ${isActive 
                            ? 'bg-barber-gold text-barber-black border-barber-gold shadow-[0_0_10px_rgba(197,160,89,0.4)] scale-110' 
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                          }
                        `}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-zinc-800/50">
                <Input label="OPENS AT" type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
                <Input label="CLOSES AT" type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
                <Input label="BREAK (EX: 12:00-13:00)" value={breakTime} onChange={e => setBreakTime(e.target.value)} placeholder="12:00-13:00" />
              </div>
            </div>
          )}

          {role === 'admin' && (
            <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex items-start gap-4">
              <Lock className="text-barber-red shrink-0" size={24} />
              <div>
                <h4 className="text-white font-bold uppercase tracking-wide text-sm mb-1">Admin Security</h4>
                <p className="text-zinc-500 text-xs italic">
                  You are logged in as the System Owner. Changes made here affect your global administrative profile.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" loading={saving} className="w-full md:w-auto px-16 h-16 text-lg font-black uppercase italic tracking-tighter shadow-2xl shadow-barber-red/20">Save Profile Changes</Button>
          </div>
        </div>
      </form>

      {/* DANGER ZONE */}
      {role !== 'admin' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-[2.5rem] p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-start gap-6">
              <div className="bg-red-500/10 p-4 rounded-2xl text-red-500 border border-red-500/20 shadow-lg">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Danger Zone</h3>
                <p className="text-zinc-500 text-sm font-medium italic max-w-md leading-relaxed">
                  Requesting account closure will suspend your access and stop all AI services. 
                  This action is <span className="text-red-500 font-bold uppercase">permanent</span> once processed.
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleCloseAccount}
              disabled={closing || globalProfileStatus === 'closure_requested'}
              className={`flex items-center gap-2 px-8 h-14 rounded-2xl font-black uppercase italic tracking-tighter transition-all border-2 ${
                globalProfileStatus === 'closure_requested'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-transparent border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-xl shadow-red-500/10'
              }`}
            >
              {globalProfileStatus === 'closure_requested' ? (
                <>Request Sent <Clock size={18} /></>
              ) : (
                <>{closing ? 'Processing...' : 'Close My Account'} <Trash2 size={18} /></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}