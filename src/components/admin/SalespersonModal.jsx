import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Tag, RefreshCw } from 'lucide-react';
import { createSalesperson, updateSalesperson } from '../../services/adminService';

const SUPPORTED_COUNTRIES = {
  US: { name: 'United States', ddi: '1', flag: '🇺🇸' },
  BR: { name: 'Brasil', ddi: '55', flag: '🇧🇷' },
  PT: { name: 'Portugal', ddi: '351', flag: '🇵🇹' },
  ES: { name: 'España', ddi: '34', flag: '🇪🇸' },
  FR: { name: 'France', ddi: '33', flag: '🇫🇷' },
  GB: { name: 'United Kingdom', ddi: '44', flag: '🇬🇧' },
};

export function SalespersonModal({ isOpen, onClose, editingSalesperson, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    country: 'US', 
    referralCode: '' 
  });

  // Preenche o formulário quando abre para edição ou limpa para criação
  useEffect(() => {
    if (isOpen) {
      if (editingSalesperson) {
        setFormData({
          name: editingSalesperson.name || '',
          email: editingSalesperson.email || '',
          phone: editingSalesperson.phone || '',
          country: editingSalesperson.country || 'US',
          referralCode: editingSalesperson.referralCode || ''
        });
      } else {
        setFormData({ name: '', email: '', phone: '', country: 'US', referralCode: '' });
      }
    }
  }, [isOpen, editingSalesperson]);

  // Gera código automático (Ex: RIC452)
  const handleNameChange = (val) => {
    // Só gera se for criação (não edição)
    if (!editingSalesperson) {
      const prefix = val.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'SAL');
      const random = Math.floor(100 + Math.random() * 900);
      const suggestedCode = val.length >= 3 ? `${prefix}${random}` : '';
      setFormData({ ...formData, name: val, referralCode: suggestedCode });
    } else {
      setFormData({ ...formData, name: val });
    }
  };

  // Máscara de telefone inteligente
  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    const country = formData.country;

    if (country === 'BR') {
      value = value.slice(0, 11).replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
    } else if (country === 'US') {
      value = value.slice(0, 10).replace(/^(\d{3})(\d)/g, '($1) $2').replace(/(\d{3})(\d)/, '$1-$2');
    } else if (country === 'GB') {
      value = value.slice(0, 11).replace(/(\d{4})(\d{6})/, '$1 $2');
    } else {
      value = value.slice(0, 9).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    setFormData({ ...formData, phone: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanCode = formData.referralCode.toUpperCase().replace(/\s+/g, '');
      const finalData = { ...formData, referralCode: cleanCode };

      if (editingSalesperson) {
        await updateSalesperson(editingSalesperson.id, finalData);
        alert("Salesperson updated successfully!");
      } else {
        await createSalesperson(finalData);
        alert("Salesperson registered successfully!");
      }
      
      onSuccess(); // Avisa o pai para recarregar a lista
      onClose();   // Fecha o modal
    } catch (error) {
      alert("Error saving salesperson. Check logs.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingSalesperson ? "Edit Sales Partner" : "New Salesperson"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input 
          label="Full Name" 
          placeholder="Ex: Ricardo Silva" 
          value={formData.name} 
          onChange={e => handleNameChange(e.target.value)} 
          required 
        />
        
        <Input 
          label="Email Address" 
          type="email" 
          value={formData.email} 
          onChange={e => setFormData({...formData, email: e.target.value})} 
          required 
        />
        
        <div className="flex flex-col gap-1">
          <label className="text-sm text-barber-gray font-medium">Country</label>
          <select 
            value={formData.country} 
            onChange={(e) => setFormData({...formData, country: e.target.value, phone: ''})} 
            className="bg-barber-black border border-zinc-800 rounded p-3 text-barber-white outline-none focus:border-barber-gold transition-all"
          >
            {Object.keys(SUPPORTED_COUNTRIES).map(key => (
              <option key={key} value={key}>
                {SUPPORTED_COUNTRIES[key].flag} {SUPPORTED_COUNTRIES[key].name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-barber-gray font-medium mb-1 block">Phone Number</label>
          <div className="flex gap-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-zinc-500 flex items-center font-bold min-w-[60px] justify-center">
                  +{SUPPORTED_COUNTRIES[formData.country].ddi}
              </div>
              <Input 
                  placeholder="Phone number" 
                  value={formData.phone} 
                  onChange={handlePhoneChange} 
                  required 
              />
          </div>
        </div>
        
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-barber-gold uppercase tracking-widest flex items-center gap-1">
                  <Tag size={12} /> Referral Code
              </label>
              {!editingSalesperson && (
                <button 
                  type="button" 
                  onClick={() => handleNameChange(formData.name)} 
                  className="text-[8px] text-zinc-500 hover:text-white uppercase font-bold flex items-center gap-1 transition-colors"
                >
                    <RefreshCw size={8} /> Regenerate
                </button>
              )}
          </div>
          <input 
              className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-lg font-mono font-bold text-white focus:border-barber-gold outline-none"
              value={formData.referralCode} 
              onChange={e => setFormData({...formData, referralCode: e.target.value.toUpperCase()})} 
              required 
              disabled={!!editingSalesperson} 
          />
          <p className="text-[9px] text-zinc-600 font-bold uppercase italic">
            {editingSalesperson 
              ? "Referral code cannot be changed after creation." 
              : "This code is unique for this partner."}
          </p>
        </div>

        <Button type="submit" loading={loading} className="h-14 font-black uppercase italic tracking-tighter">
          {editingSalesperson ? "Update Partner Data" : "Register Sales Partner"}
        </Button>
      </form>
    </Modal>
  );
}