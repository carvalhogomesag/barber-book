import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { 
  CreditCard, 
  Calendar, 
  Zap, 
  ExternalLink, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import { getProfessionalProfile } from '../services/professionalService';
import { db, functions } from '../services/firebase'; // Importamos o functions aqui
import { httpsCallable } from 'firebase/functions'; // Importamos o chamador de funções
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';

export function Billing() {
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function loadBillingData() {
      try {
        const prof = await getProfessionalProfile();
        setProfile(prof);

        // 1. Tenta buscar detalhes na coleção de assinaturas
        if (prof?.stripeSubscriptionId) {
          const q = query(
            collection(db, 'subscriptions'), 
            where('stripeSubscriptionId', '==', prof.stripeSubscriptionId),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setSubscription(snap.docs[0].data());
          }
        }
        
        // 2. Se não achou na coleção, mas o perfil diz que é PRO, criamos um objeto temporário
        // para não quebrar a interface enquanto o webhook processa
        if (!subscription && prof?.plan === 'pro') {
            setSubscription({
                status: prof.subscriptionStatus || 'active',
                trialEnd: prof.trialExpiresAt ? { seconds: new Date(prof.trialExpiresAt).getTime() / 1000 } : null
            });
        }

      } catch (error) {
        console.error("Error loading billing details:", error);
      } finally {
        setLoading(false);
      }
    }
    loadBillingData();
  }, []);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      // CHAMADA DIRETA PARA A CLOUD FUNCTION QUE CRIAMOS NO PASSO ANTERIOR
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const result = await createPortalSession();
      
      if (result.data && result.data.url) {
        // Redireciona para o Stripe Portal
        window.location.href = result.data.url;
      } else {
        throw new Error("No URL returned from portal session.");
      }
    } catch (error) {
      console.error("Portal Error:", error);
      alert("Unable to open the billing portal. Please ensure you have an active subscription or try again in a few minutes.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 text-barber-gold animate-pulse font-black uppercase italic tracking-widest">
          Loading Billing Profile...
        </div>
      </AppLayout>
    );
  }

  // Cálculo de dias restantes de trial
  const trialEndDate = subscription?.trialEnd?.seconds 
    ? new Date(subscription.trialEnd.seconds * 1000) 
    : profile?.trialExpiresAt ? new Date(profile.trialExpiresAt) : null;

  const daysLeft = trialEndDate ? differenceInDays(trialEndDate, new Date()) : 0;

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-3">
          <CreditCard className="text-barber-gold" size={32} />
          Billing & Subscription
        </h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Manage your Schedy AI plan and invoices</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA PRINCIPAL: STATUS DA ASSINATURA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Badge de Status */}
            <div className={`absolute top-0 right-0 px-6 py-1 font-black text-[10px] uppercase tracking-widest rounded-bl-xl italic ${
              profile?.plan === 'pro' ? 'bg-barber-gold text-black' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {profile?.plan === 'pro' ? 'Subscription Active' : 'Free Plan'}
            </div>

            <h2 className="text-xl font-black text-barber-white uppercase italic mb-8">Plan Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Current Plan</p>
                <div className="flex items-center gap-3">
                  <div className="bg-barber-gold/10 p-2 rounded-lg text-barber-gold">
                    <Zap size={20} fill="currentColor" />
                  </div>
                  <p className="text-lg font-bold text-white uppercase italic">
                    {profile?.plan === 'pro' ? 'AI Concierge Pro' : 'Starter Free'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  {profile?.subscriptionStatus === 'trialing' ? 'Trial Ends On' : 'Next Billing Date'}
                </p>
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 p-2 rounded-lg text-zinc-400">
                    <Calendar size={20} />
                  </div>
                  <p className="text-lg font-bold text-white">
                    {trialEndDate ? format(trialEndDate, 'MMMM dd, yyyy') : '---'}
                  </p>
                </div>
              </div>
            </div>

            {/* Banner de Trial (se aplicável) */}
            {profile?.subscriptionStatus === 'trialing' && (
              <div className="mt-10 p-5 bg-barber-gold/5 border border-barber-gold/20 rounded-2xl flex items-center gap-4">
                <div className="bg-barber-gold text-black p-2.5 rounded-xl shadow-lg shadow-barber-gold/20">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase italic tracking-tight">
                    You have {daysLeft > 0 ? daysLeft : 0} days remaining in your trial
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                    Your first payment will be processed automatically after the trial ends.
                  </p>
                </div>
              </div>
            )}

            {/* Botão de Ação para o Stripe Portal */}
            <div className="mt-12 pt-8 border-t border-zinc-800">
              {profile?.plan === 'pro' ? (
                <Button 
                  onClick={handleManageSubscription} 
                  loading={portalLoading}
                  className="w-full md:w-auto px-10 h-14 uppercase font-black italic tracking-tighter"
                >
                  <ExternalLink size={18} className="mr-2" /> Manage Billing & Payment Methods
                </Button>
              ) : (
                <Button onClick={() => window.location.href = '/pricing'} className="w-full md:w-auto px-10 h-14 uppercase font-black italic tracking-tighter">
                  Upgrade to Pro
                </Button>
              )}
              <p className="text-[9px] text-zinc-600 font-bold uppercase mt-4 text-center md:text-left">
                Secure management via Stripe Customer Portal
              </p>
            </div>
          </div>

          {/* Reafirmação de Segurança */}
          <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-3xl flex items-start gap-4">
            <ShieldCheck className="text-barber-gold shrink-0" size={24} />
            <p className="text-xs text-zinc-500 leading-relaxed font-medium italic">
              All payments are handled by <span className="text-white font-bold">Stripe</span>. 
              Schedy AI does not store your credit card details. You can cancel your subscription at any time 
              to avoid future charges.
            </p>
          </div>
        </div>

        {/* COLUNA LATERAL: RESUMO FINANCEIRO */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] italic border-b border-zinc-800 pb-4">
              Subscription Summary
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 font-bold uppercase">Monthly Investment</span>
                <span className="text-xl font-black text-white">
                    {profile?.currency || '$'}{profile?.country === 'BR' ? '97.00' : '29.00'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 font-bold uppercase">AI Concierge</span>
                <span className="text-[9px] bg-green-500/10 text-green-500 px-2 py-1 rounded font-black uppercase tracking-widest">Unlimited</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                <span className="text-xs text-zinc-500 font-bold uppercase italic">Currency</span>
                <span className="text-xs font-bold text-zinc-300 uppercase">
                    {profile?.currency || '$'} ({profile?.country || 'US'})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}