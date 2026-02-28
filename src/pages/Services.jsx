import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Trash2, Clock, DollarSign, Pencil, Check } from 'lucide-react'; 
import { 
    addService, 
    getServices, 
    deleteService, 
    updateService, 
    getProfessionalProfile 
} from '../services/professionalService'; 

// Paleta definida no tailwind.config.js
const SERVICE_COLORS = [
  { id: 'emerald', bg: 'bg-service-emerald', label: 'Verde' },
  { id: 'amber',   bg: 'bg-service-amber',   label: 'Amarelo' },
  { id: 'indigo',  bg: 'bg-service-indigo',  label: 'Roxo' },
  { id: 'rose',    bg: 'bg-service-rose',    label: 'Rosa' },
  { id: 'violet',  bg: 'bg-service-violet',  label: 'Violeta' },
  { id: 'sky',     bg: 'bg-service-sky',     label: 'Azul' },
  { id: 'orange',  bg: 'bg-service-orange',  label: 'Laranja' },
];

export function Services() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('$');
  
  // Estados do Formulário
  const [editingService, setEditingService] = useState(null); 
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [color, setColor] = useState('emerald'); // Cor padrão
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const profile = await getProfessionalProfile();
      if (profile?.currency) setCurrency(profile.currency);
      
      const data = await getServices();
      setServices(data);
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewService = () => {
    setEditingService(null);
    setName('');
    setPrice('');
    setDuration('30');
    setColor('emerald');
    setIsModalOpen(true);
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration.toString());
    setColor(service.color || 'emerald');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const serviceData = {
        name,
        price: parseFloat(price),
        duration: parseInt(duration),
        color // Salvamos a cor escolhida
      };

      if (editingService) {
        await updateService(editingService.id, serviceData);
      } else {
        await addService(serviceData);
      }
      
      setIsModalOpen(false);
      loadServices(); 
    } catch (error) {
      alert("Error saving service");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Deseja realmente excluir este serviço?")) {
      await deleteService(id);
      loadServices();
    }
  };

  return (
    <AppLayout>
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black text-schedy-black tracking-tighter uppercase italic">Meus Serviços</h1>
          <p className="text-schedy-gray text-xs font-bold uppercase tracking-widest">Catálogo e Precificação</p>
        </div>
        <Button className="w-auto gap-2 h-12 px-6 shadow-vivid" onClick={handleNewService}>
          <Plus size={20} /> Novo Serviço
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-schedy-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : services.length === 0 ? (
          <div className="col-span-3 text-center py-20 bg-white border-2 border-dashed border-schedy-border rounded-[32px]">
            <p className="text-schedy-gray font-bold uppercase tracking-widest text-sm">Nenhum serviço cadastrado.</p>
          </div>
        ) : (
          services.map((service) => (
            <div 
              key={service.id} 
              className="bg-white border border-schedy-border p-6 rounded-[32px] flex justify-between items-center group hover:shadow-premium transition-all relative overflow-hidden"
            >
              {/* Barra de cor lateral - O toque UAU */}
              <div className={`absolute left-0 top-0 bottom-0 w-2 bg-service-${service.color || 'emerald'}`} />

              <div className="pl-2">
                <h3 className="font-black text-schedy-black text-xl tracking-tight uppercase italic">{service.name}</h3>
                <div className="flex gap-4 mt-3 text-xs font-black uppercase tracking-widest">
                  <span className={`text-service-${service.color || 'emerald'} flex items-center gap-1`}>
                    {currency}{service.price}
                  </span>
                  <span className="text-schedy-gray flex items-center gap-1">
                    <Clock size={14}/> {service.duration} MIN
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEditService(service)}
                  className="p-3 bg-schedy-canvas text-schedy-black rounded-2xl hover:bg-schedy-black hover:text-white transition-all"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(service.id)}
                  className="p-3 bg-red-50 text-schedy-danger rounded-2xl hover:bg-schedy-danger hover:text-white transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingService ? "Editar Serviço" : "Novo Serviço"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <Input 
            label="Nome do Serviço" 
            placeholder="Ex: Corte Degradê" 
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          
          <div className="flex gap-4">
            <Input 
              label={`Preço (${currency})`} 
              type="number" 
              step="0.01" 
              placeholder="30.00" 
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
            />
            <div className="w-full">
              <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest mb-2 block">Duração</label>
              <select 
                className="w-full bg-schedy-canvas border border-schedy-border rounded-xl p-3 text-sm font-bold focus:border-schedy-black outline-none appearance-none"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              >
                {[15, 30, 45, 60, 90, 120].map(m => (
                    <option key={m} value={m}>{m === 60 ? '1 HORA' : m > 60 ? '1H 30MIN' : `${m} MIN`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SELETOR DE CORES VIVAS */}
          <div>
            <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest mb-3 block">Identificador Visual (Cor do Card)</label>
            <div className="grid grid-cols-7 gap-3">
              {SERVICE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`
                    h-10 rounded-xl transition-all flex items-center justify-center
                    ${c.bg} 
                    ${color === c.id ? 'ring-4 ring-schedy-black scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}
                  `}
                >
                  {color === c.id && <Check size={20} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" loading={saving} className="mt-4 h-16 text-lg font-black uppercase italic tracking-tighter shadow-vivid">
            {editingService ? "Atualizar Catálogo" : "Salvar Serviço"}
          </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}