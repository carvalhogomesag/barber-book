import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProfessionalProfile } from '../services/professionalService';
import { getSalespersonProfile } from '../services/salesService';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 1. Realiza o login no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. REDIRECIONAMENTO INTELIGENTE
      
      // A. Verifica na coleção de Profissionais/Admins
      const professionalProfile = await getProfessionalProfile();
      
      if (professionalProfile) {
        // SE FOR ADMIN, VAI PARA O PAINEL DE GESTÃO
        if (professionalProfile.role === 'admin') {
          navigate('/admin');
        } else {
          // SE FOR BARBEIRO, VAI PARA A AGENDA
          navigate('/dashboard');
        }
        return;
      }

      // B. Verifica na coleção de Vendedores
      const salesProfile = await getSalespersonProfile(user.uid);
      if (salesProfile) {
        navigate('/sales-console');
        return;
      }

      // Fallback de segurança
      navigate('/dashboard'); 

    } catch (err) {
      console.error(err);
      setError("Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  // Função para recuperar senha (Preservada)
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    
    setResetLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError("Error sending reset email. Verify if the email is correct.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-barber-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-barber-black p-8 rounded-2xl border border-zinc-800 shadow-2xl">
        
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 bg-barber-gold rounded-full flex items-center justify-center text-barber-black shadow-lg shadow-barber-gold/20">
            <Scissors size={32} />
          </div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">Schedy Login</h1>
          <p className="text-barber-gray text-sm font-medium">Access your AI-powered dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input 
            label="E-mail" 
            type="email"
            placeholder="your@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <div className="space-y-1">
            <Input 
              label="Password" 
              type="password" 
              placeholder="******" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
                <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-[10px] font-black text-barber-gold uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
                >
                    {resetLoading ? "Sending..." : "Forgot Password?"}
                </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center bg-red-500/10 p-3 rounded border border-red-500/20 font-bold">
                {error}
            </div>
          )}

          {message && (
            <div className="text-green-500 text-xs text-center bg-green-500/10 p-3 rounded border border-green-500/20 font-bold">
                {message}
            </div>
          )}

          <Button type="submit" loading={loading} className="h-14 font-black uppercase italic tracking-tighter">
            Sign In
          </Button>
        </form>

        <div className="mt-8 text-center space-y-4 border-t border-zinc-800 pt-6">
          <p className="text-xs text-barber-gray font-bold uppercase tracking-widest">
            New to Schedy AI?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate('/register')} className="h-10 text-[10px] font-black uppercase">
                Professional
            </Button>
            <Button variant="outline" onClick={() => navigate('/join-sales')} className="h-10 text-[10px] font-black uppercase border-zinc-700 text-zinc-500">
                Partner
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}