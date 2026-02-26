import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Check, Zap, Globe, ShieldCheck } from 'lucide-react';
import { getProfessionalProfile } from '../services/professionalService'; 
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Global Stripe Checkout Link with 30-day trial
const STRIPE_CHECKOUT_LINK = "https://buy.stripe.com/eVq3cp6Ly1NL9Mg1qRfnO03";

export function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [country, setCountry] = useState('US');
  const [userPlan, setUserPlan] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfessionalProfile();
        if (profile) {
          if (profile.country) setCountry(profile.country);
          if (profile.plan) setUserPlan(profile.plan);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSubscribe = () => {
    if (userPlan === 'pro') {
      navigate('/setup-pro');
      return;
    }

    if (!user || !user.uid) {
        alert("Session Error: Please log in again.");
        return;
    }
    
    // Attach barber ID for automatic activation via Webhook
    const checkoutUrl = `${STRIPE_CHECKOUT_LINK}?client_reference_id=${user.uid}`;
    window.location.href = checkoutUrl;
  };

  const config = {
    US: { currency: '$', totalPlan: '29' },
    BR: { currency: 'R$', totalPlan: '97' },
    PT: { currency: '€', totalPlan: '19' }
  }[country] || { currency: '$', totalPlan: '29' };

  const plans = [
    {
      id: 'free',
      name: "Starter",
      price: `${config.currency}0`,
      description: "Basic management for solo professionals.",
      features: [
        "Manual Digital Calendar",
        "Unlimited Services",
        "Basic Business Profile",
        "Manual Appointment Entries"
      ],
      buttonText: userPlan === 'free' ? "Current Level" : "Basic Version",
      variant: userPlan === 'free' ? "ghost" : "ghost",
      action: () => {}
    },
    {
      id: 'pro',
      name: "AI Concierge",
      price: `${config.currency}${config.totalPlan}`,
      period: "/mo",
      description: "Complete automation with 30-day trial.",
      features: [
        "24/7 AI Receptionist (WhatsApp)",
        "Dedicated US (+1) Phone Number",
        "First 30 days FREE (Trial)",
        "Real-time Automated Booking",
        "Instant Global Activation"
      ],
      buttonText: userPlan === 'pro' ? "Go to Setup" : "Start 30-Day Free Trial",
      variant: "primary",
      highlight: true,
      action: handleSubscribe
    }
  ];

  return (
    <AppLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-black text-barber-white tracking-tighter uppercase italic text-left">
          Choose Your <span className="text-barber-gold">Level</span>
        </h1>
        <p className="text-barber-gray mt-2 font-bold uppercase tracking-widest text-xs italic opacity-80 text-left">
          Scale your business with the power of US-based AI automation.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-barber-gold border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`
                relative bg-barber-black p-8 rounded-3xl border transition-all duration-300 flex flex-col
                ${plan.highlight 
                  ? 'border-barber-gold shadow-[0_0_40px_rgba(197,160,89,0.15)] scale-105 z-10' 
                  : 'border-zinc-800 opacity-90 hover:opacity-100'
                }
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-barber-gold text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Ready for Global Authority
                </div>
              )}

              <div className="mb-8 text-left">
                <h2 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-barber-white tracking-tighter">{plan.price}</span>
                  <span className="text-barber-gray font-bold text-sm uppercase">{plan.period}</span>
                </div>
                <p className="text-sm text-barber-gray mt-3 font-medium leading-relaxed italic">{plan.description}</p>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-barber-white/90 font-bold uppercase tracking-tight italic text-left">
                    <Check size={18} className="text-barber-gold shrink-0 mt-0.5" /> 
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.variant} 
                onClick={plan.action}
                disabled={plan.id === 'free' && userPlan === 'free'}
                className={`h-14 text-lg font-black uppercase tracking-tighter italic ${plan.highlight ? 'shadow-xl shadow-barber-red/20' : ''}`}
              >
                {plan.buttonText}
              </Button>

              {plan.highlight && (
                <div className="mt-6 flex items-center justify-center gap-4 text-zinc-600">
                   <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                      <Globe size={12} /> US Virtual DID
                   </div>
                   <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                      <ShieldCheck size={12} /> Secure Stripe
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-16 p-8 bg-zinc-900/30 border border-zinc-800 rounded-2xl text-center max-w-3xl mx-auto">
        <h3 className="text-white font-bold mb-2 uppercase tracking-tighter italic">Why the International Concierge?</h3>
        <p className="text-zinc-500 text-sm leading-relaxed font-medium italic">
          By utilizing our <span className="text-barber-gold font-bold italic">US Virtual DID System</span>, we bypass local bureaucratic hurdles. 
          Your international (+1) line is activated instantly, allowing your AI to serve clients and handle WhatsApp bookings with global stability and premium authority.
        </p>
      </div>
    </AppLayout>
  );
}