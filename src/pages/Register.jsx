import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Globe, Tag, Briefcase, X, ShieldCheck } from 'lucide-react';

const SUPPORTED_COUNTRIES = {
  US: { name: 'United States', ddi: '1', currency: '$', timezone: 'America/New_York', flag: '🇺🇸' },
  BR: { name: 'Brasil', ddi: '55', currency: 'R$', timezone: 'America/Sao_Paulo', flag: '🇧🇷' },
  PT: { name: 'Portugal', ddi: '351', currency: '€', timezone: 'Europe/Lisbon', flag: '🇵🇹' },
  ES: { name: 'España', ddi: '34', currency: '€', timezone: 'Europe/Madrid', flag: '🇪🇸' },
  FR: { name: 'France', ddi: '33', currency: '€', timezone: 'Europe/Paris', flag: '🇫🇷' },
  IT: { name: 'Italia', ddi: '39', currency: '€', timezone: 'Europe/Rome', flag: '🇮🇹' },
  GB: { name: 'United Kingdom', ddi: '44', currency: '£', timezone: 'Europe/London', flag: '🇬🇧' },
};

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('US');
  const [referralCode, setReferralCode] = useState(''); 
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSalesMode = searchParams.get('role') === 'sales';

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, [searchParams]);

  const generateReferralCode = (userName) => {
    const prefix = userName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'SAL');
    const random = Math.floor(100 + Math.random() * 900);
    return `${prefix}${random}`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      setError("You must accept the Terms of Service to continue.");
      return;
    }

    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();
    const nowISO = new Date().toISOString();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const selectedCountryData = SUPPORTED_COUNTRIES[country];

      if (isSalesMode) {
        // LÓGICA DE VENDEDOR
        const salesQuery = query(collection(db, "salespeople"), where("email", "==", cleanEmail));
        const querySnapshot = await getDocs(salesQuery);
        
        let finalSalesData = {
          name: name,
          email: cleanEmail,
          country: country,
          ddi: selectedCountryData.ddi,
          referralCode: generateReferralCode(name),
          role: "sales",
          commissionRate: 0.20,
          totalEarnings: 0,
          currentBalance: 0,
          activeClients: 0,
          status: 'active',
          createdAt: nowISO,
        };

        if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          await deleteDoc(doc(db, "salespeople", existingDoc.id));
        }

        await setDoc(doc(db, "salespeople", user.uid), finalSalesData);
        navigate('/sales-console');

      } else {
        // LÓGICA DE BARBEIRO (PROFISSIONAL)
        // Injetamos configurações padrão para evitar que a IA "alucine" antes do primeiro Setup
        await setDoc(doc(db, "barbers", user.uid), {
          name: name,
          barberShopName: name, 
          email: cleanEmail,
          plan: "free",
          role: "professional",
          country: country,
          currency: selectedCountryData.currency,
          timezone: selectedCountryData.timezone,
          ddi: selectedCountryData.ddi,
          referredBy: referralCode.trim().toUpperCase() || null,
          status: 'active',
          createdAt: nowISO,
          acceptedTermsAt: nowISO,
          // DEFAULT SETTINGS: Crucial para a integridade da IA (utils.js)
          settings: {
            businessHours: {
              open: "09:00",
              close: "18:00",
              days: [1, 2, 3, 4, 5], // Seg a Sex por padrão
              break: "12:00-13:00"
            },
            aiPreference: 'professional'
          }
        });

        // Redireciona para o Perfil para o usuário revisar Timezone e Moeda
        navigate('/profile'); 
      }

    } catch (err) {
      console.error("Registration Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak (min. 6 characters).");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-barber-dark flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-barber-black p-8 rounded-3xl border border-zinc-800 shadow-2xl relative">
        
        <button 
          onClick={() => navigate('/login')}
          className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors p-2 hover:bg-zinc-900 rounded-xl"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center gap-2 mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
            isSalesMode ? 'bg-barber-gold/10 text-barber-gold border-barber-gold/20' : 'bg-barber-red/10 text-barber-red border-barber-red/20'
          }`}>
            {isSalesMode ? <Briefcase size={32} /> : <UserPlus size={32} />}
          </div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">
            {isSalesMode ? 'Partner Activation' : 'Get Started'}
          </h1>
          <p className="text-barber-gray text-xs text-center font-bold uppercase tracking-widest opacity-70">
            {isSalesMode ? 'Access your sales console' : 'Join the International AI Concierge'}
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-barber-gray font-black uppercase tracking-widest flex items-center gap-2">
              <Globe size={12} className="text-barber-gold" /> Service Location
            </label>
            <select 
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-barber-white focus:border-barber-gold outline-none transition-all appearance-none cursor-pointer font-bold"
            >
              {Object.keys(SUPPORTED_COUNTRIES).map((key) => (
                <option key={key} value={key}>
                  {SUPPORTED_COUNTRIES[key].flag} {SUPPORTED_COUNTRIES[key].name}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label={isSalesMode ? "Full Name" : "Business Name"} 
            placeholder={isSalesMode ? "Your name" : "Ex: Barber Authority"} 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input 
            label="Professional E-mail" 
            type="email"
            placeholder="your@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <Input 
            label="Secure Password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {!isSalesMode && (
            <div className="relative">
              <Input 
                label="Referral Code (Optional)" 
                placeholder="Ex: MIAMI20" 
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
              <Tag size={16} className="absolute right-3 top-10 text-zinc-700" />
            </div>
          )}

          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 mb-2">
            <div className="flex items-start gap-3">
                <input 
                type="checkbox" 
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-barber-gold focus:ring-barber-gold transition-all cursor-pointer"
                />
                <label htmlFor="terms" className="text-[10px] text-barber-gray leading-tight cursor-pointer select-none font-medium">
                I accept the <Link to="/terms" className="text-barber-gold hover:underline font-bold">Terms of Service</Link> 
                {!isSalesMode && " and understand my AI Concierge will use a dedicated US (+1) number for global authority."}
                </label>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-[10px] text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 font-black uppercase tracking-widest">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} variant="primary" className="mt-2 h-14 uppercase font-black tracking-tighter italic text-lg">
            {isSalesMode ? 'Activate Account' : 'Create Free Account'}
          </Button>
        </form>

        <div className="mt-6 text-center border-t border-zinc-800 pt-6">
          <p className="text-xs text-barber-gray font-bold uppercase tracking-widest">
            Already a member? <Link to="/login" className="text-barber-gold hover:underline font-black">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}