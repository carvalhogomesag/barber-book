import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Trash2, Clock, DollarSign, Pencil } from 'lucide-react'; 
import { 
    addService, 
    getServices, 
    deleteService, 
    updateService, 
    getProfessionalProfile 
} from '../services/professionalService'; 

export function Services() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('$'); // Moeda padrão
  
  // Estados do Formulário
  const [editingService, setEditingService] = useState(null); 
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      // 1. BUSCA O PERFIL PARA DEFINIR A MOEDA DINÂMICA
      const profile = await getProfessionalProfile();
      if (profile) {
        // Se o perfil já tiver a moeda salva (como configuramos no Registro/Profile), usamos ela.
        // Caso contrário, mantemos o fallback baseado no país para contas antigas.
        if (profile.currency) {
          setCurrency(profile.currency);
        } else {
          let fallbackCurrency = '$'; 
          if (profile.country === 'BR') fallbackCurrency = 'R$';
          if (profile.country === 'PT') fallbackCurrency = '€';
          setCurrency(fallbackCurrency);
        }
      }

      // 2. BUSCA A LISTA DE SERVIÇOS
      const data = await getServices();
      setServices(data);
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal para CRIAR (Preservado)
  const handleNewService = () => {
    setEditingService(null);
    setName('');
    setPrice('');
    setDuration('30');
    setIsModalOpen(true);
  };

  // Abre o modal para EDITAR (Preservado)
  const handleEditService = (service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration.toString());
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const serviceData = {
        name,
        price: parseFloat(price),
        duration: parseInt(duration)
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
    if (confirm("Are you sure you want to delete this service?")) {
      await deleteService(id);
      loadServices();
    }
  };

  return (
    <AppLayout>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-barber-white">My Services</h1>
          <p className="text-barber-gray text-sm">Manage your catalog and pricing</p>
        </div>
        <Button className="w-auto gap-2" onClick={handleNewService}>
          <Plus size={20} /> New Service
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-barber-gray animate-pulse">Loading services...</p>
        ) : services.length === 0 ? (
          <div className="col-span-3 text-center py-10 text-barber-gray border border-dashed border-zinc-800 rounded-xl">
            No services registered yet.
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="bg-barber-black border border-zinc-800 p-5 rounded-2xl flex justify-between items-center group hover:border-barber-gold transition-all shadow-lg">
              <div>
                <h3 className="font-bold text-barber-white text-lg">{service.name}</h3>
                <div className="flex gap-4 mt-2 text-sm text-barber-gray">
                  {/* EXIBIÇÃO DA MOEDA DINÂMICA */}
                  <span className="flex items-center gap-1 font-medium text-barber-gold">
                    <DollarSign size={14}/> {currency}{service.price}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14}/> {service.duration} min
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleEditService(service)}
                  className="text-zinc-500 hover:text-barber-gold transition-colors p-2 rounded-lg hover:bg-barber-gold/10"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(service.id)}
                  className="text-zinc-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
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
        title={editingService ? "Edit Service" : "New Service"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input 
            label="Service Name" 
            placeholder="Ex: Haircut" 
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          
          <div className="flex gap-4">
            {/* LABEL DA MOEDA DINÂMICA NO INPUT */}
            <Input 
              label={`Price (${currency})`} 
              type="number" 
              step="0.01" 
              placeholder="30.00" 
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
            />
            <div className="w-full">
              <label className="text-sm text-barber-gray font-medium mb-1 block">Duration</label>
              <select 
                className="w-full bg-barber-black border border-zinc-800 rounded-lg p-3 text-barber-white focus:border-barber-gold outline-none transition-all"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1h 30min</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          <Button type="submit" loading={saving} className="mt-4 h-14 font-bold uppercase tracking-widest">
            {editingService ? "Update Service" : "Create Service"}
          </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}