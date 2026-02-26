import React from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Shield, Lock, FileCheck, Scale, Zap } from 'lucide-react';

export function Terms() {
  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">Legal Documentation</h1>
        <p className="text-barber-gray font-medium">Transparency and security for your business</p>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl flex items-start gap-4">
            <Shield className="text-barber-gold shrink-0" size={24} />
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-tight">Data Protection (GDPR/LGPD)</h3>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">Your data and your clients' data are encrypted, isolated, and never sold to third parties.</p>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl flex items-start gap-4">
            <Lock className="text-barber-gold shrink-0" size={24} />
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-tight">Total Privacy</h3>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">AI Concierge only monitors booking-related messages. Personal chats remain private.</p>
            </div>
          </div>
        </div>

        {/* The Document Itself */}
        <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-8 py-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck size={18} className="text-barber-gold" />
              <span className="text-xs font-bold text-barber-gray uppercase tracking-[0.2em]">Service Agreement</span>
            </div>
            <span className="text-[10px] font-black text-barber-gold bg-barber-gold/10 px-3 py-1 rounded-full uppercase italic">v1.1 - 30-Day Trial Update</span>
          </div>
          
          <div className="p-8 text-barber-gray text-sm leading-relaxed space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar italic font-medium">
            
            <section>
              <h2 className="text-barber-white font-black text-lg mb-3 flex items-center gap-2 uppercase tracking-tighter">
                <Scale size={18} className="text-barber-gold" /> 1. Terms of Use
              </h2>
              <p>By using Schedy AI (operating as 'AI Concierge'), you agree to provide accurate information about your business. The system is an automated tool designed to assist professional barbers and stylists with scheduling and client communication via WhatsApp.</p>
            </section>

            <section>
              <h2 className="text-barber-white font-black text-lg mb-3 uppercase tracking-tighter italic">2. 30-Day Free Trial & Subscriptions</h2>
              <p>New subscribers to the <strong>Full Plan (AI Concierge)</strong> are entitled to a <strong>30-day free trial period</strong>. You may cancel your subscription at any time during this period through your dashboard or Stripe portal without being charged the monthly subscription fee.</p>
              
              <div className="bg-barber-red/5 border-l-4 border-barber-red p-4 my-4">
                <p className="text-barber-white font-bold italic text-xs">
                  "Note: The Setup/Activation Fee is non-refundable. This fee covers the immediate reservation of your dedicated US (+1) infrastructure and official WhatsApp API channel allocation, which are provided instantly upon registration."
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-barber-white font-black text-lg mb-3 uppercase tracking-tighter italic">3. Data Responsibility</h2>
              <p>Schedy AI acts as the Data <strong>Processor</strong>. The Professional (Tenant) is the Data <strong>Controller</strong>, responsible for ensuring that clients are aware that their scheduling intentions are processed via Artificial Intelligence for business efficiency.</p>
            </section>

            <section>
              <h2 className="text-barber-white font-black text-lg mb-3 uppercase tracking-tighter italic">4. AI Privacy Policy</h2>
              <p>We utilize the Google Gemini API to process and understand booking requests. Conversation data is strictly used for real-time scheduling and is NOT used for public AI model training, preserving your commercial secrets and client privacy.</p>
            </section>

            <div className="pt-10 border-t border-zinc-800 text-center space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest">Last Updated: February 11, 2026</p>
              <p className="text-[10px] font-black text-barber-gold uppercase tracking-widest italic flex items-center justify-center gap-2">
                <Zap size={10} fill="currentColor" /> Schedy AI Inc. • US International Division
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}