import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Globe, Tag, Briefcase, X } from 'lucide-react';

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

    // Limpeza do e-mail
    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Tenta criar o acesso no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const selectedCountryData = SUPPORTED_COUNTRIES[country];

      if (isSalesMode) {
        /**
         * LÓGICA DE VENDEDOR: ADOÇÃO DE PERFIL
         */
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
          createdAt: new Date().toISOString(),
        };

        if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          const existingData = existingDoc.data();
          
          finalSalesData = {
            ...finalSalesData,
            ...existingData,
            status: 'active'
          };

          await deleteDoc(doc(db, "salespeople", existingDoc.id));
        }

        await setDoc(doc(db, "salespeople", user.uid), finalSalesData);
        navigate('/sales-console'); // Vendedor vai para o Console de Vendas

      } else {
        /**
         * LÓGICA DE BARBEIRO (PROFISSIONAL)
         */
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
          createdAt: new Date().toISOString(),
          acceptedTermsAt: new Date().toISOString(), 
        });

        // ALTERAÇÃO AQUI: Redireciona para o Profile para completar cadastro
        navigate('/profile'); 
      }

    } catch (err) {
      console.error("Registration Error:", err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use. If you just deleted it, please wait 1 minute and try again in an Incognito Tab.");
      } else if (err.code === 'auth/weak-password') {
        setError("The password must be at least 6 characters long.");
      } else {
        setError("Error: " + err.message);
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
          title="Back to Login"
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
          <p className="text-barber-gray text-sm text-center font-medium">
            {isSalesMode ? 'Set your password to access your sales console.' : 'Join Schedy AI and never miss another appointment.'}
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1">
            <label className="text-sm text-barber-gray font-medium flex items-center gap-2">
              <Globe size={14} className="text-barber-gold" /> Select Your Country
            </label>
            <select 
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-barber-black border border-zinc-800 rounded-xl p-3 text-barber-white focus:border-barber-gold outline-none transition-colors appearance-none cursor-pointer"
            >
              {Object.keys(SUPPORTED_COUNTRIES).map((key) => (
                <option key={key} value={key} className="bg-barber-black text-white">
                  {SUPPORTED_COUNTRIES[key].flag} {SUPPORTED_COUNTRIES[key].name}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label={isSalesMode ? "Full Name" : "Business or Personal Name"} 
            placeholder={isSalesMode ? "Confirm your name" : "Ex: John's Barbershop"} 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input 
            label="E-mail" 
            type="email"
            placeholder="Use your best email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <Input 
            label="Create Password" 
            type="password" 
            placeholder="Minimum 6 characters" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {!isSalesMode && (
            <div className="relative">
              <Input 
                label="Referral Code (Optional)" 
                placeholder="Ex: JOAO20" 
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
              <Tag size={16} className="absolute right-3 top-10 text-zinc-700" />
            </div>
          )}

          <div className="flex items-start gap-3 mt-2 px-1">
            <input 
              type="checkbox" 
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-barber-gold focus:ring-barber-gold transition-all cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-barber-gray leading-tight cursor-pointer select-none">
              I accept the <Link to="/terms" className="text-barber-gold hover:underline font-medium">Terms of Service</Link>
              {isSalesMode ? ' and the Partner Commission Agreement.' : ' and recognize that my AI Concierge will operate via a US (+1) number.'}
            </label>
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center bg-red-500/10 p-3 rounded border border-red-500/20 font-bold">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} variant="primary" className="mt-2 h-14 uppercase font-black tracking-widest italic">
            {isSalesMode ? 'Activate Partner Account' : 'Create Free Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-barber-gray font-medium">
            Already have an account? <Link to="/login" className="text-barber-gold hover:underline font-bold">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}