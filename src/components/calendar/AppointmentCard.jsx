import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Lock, Phone } from 'lucide-react'; 
import { 
  getPositionFromTime, 
  getHeightFromDuration, 
  getNewStartTime,    
  formatTimeDisplay,
  PIXELS_PER_HOUR
} from '../../utils/timeGrid';

// SOLUÇÃO DO BUG DAS CORES: Mapeamento estático.
// O Tailwind obriga que a classe inteira esteja escrita no código para não apagá-la.
const COLOR_THEMES = {
  emerald: 'bg-[#10B981] border-[#059669] text-white',
  amber:   'bg-[#F59E0B] border-[#D97706] text-white',
  indigo:  'bg-[#6366F1] border-[#4F46E5] text-white',
  rose:    'bg-[#F43F5E] border-[#E11D48] text-white',
  violet:  'bg-[#8B5CF6] border-[#7C3AED] text-white',
  sky:     'bg-[#0EA5E9] border-[#0284C7] text-white',
  orange:  'bg-[#F97316] border-[#EA580C] text-white',
  default: 'bg-gray-800 border-gray-900 text-white'
};

export function AppointmentCard({ appointment, onClick }) {
  
  const top = getPositionFromTime(appointment.startTime, PIXELS_PER_HOUR);
  const height = getHeightFromDuration(appointment.duration, PIXELS_PER_HOUR);
  
  const isCompleted = appointment.status === 'completed';
  const isBlocked = appointment.type === 'block'; 
  
  // Pega o tema da cor. Se não existir, usa o default (escuro)
  const themeClass = COLOR_THEMES[appointment.color] || COLOR_THEMES.emerald;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
    disabled: isCompleted 
  });

  let displayTime = formatTimeDisplay(appointment.startTime);
  if (isDragging && transform) {
    const projectedTimeISO = getNewStartTime(appointment.startTime, transform.y, PIXELS_PER_HOUR);
    displayTime = formatTimeDisplay(projectedTimeISO);
  }

  // Define quão denso é o conteúdo dependendo da altura do card
  const isTiny = height < 40;  // 15min
  const isSmall = height < 60; // 30min

  // Estilo "Bloco Avec": Sem margens laterais perdidas, encaixe perfeito na grade
  const style = {
    top: `${top}px`,
    height: `${height}px`, // Altura exata, sem gap
    zIndex: isDragging ? 100 : 10, 
    transform: CSS.Translate.toString(transform),
    position: 'absolute',
    left: '1px',  // Borda fina
    right: '1px', // Borda fina
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
    >
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => onClick(e)}
        className={`
          w-full h-full rounded-sm border-l-4 transition-all duration-150 overflow-hidden relative cursor-pointer
          ${isDragging 
            ? 'shadow-2xl scale-[1.02] z-[100] cursor-grabbing brightness-110'
            : isCompleted
              ? 'bg-gray-200 border-gray-400 text-gray-500 cursor-default'
              : isBlocked
                ? 'bg-gray-100 border-gray-400 border-dashed border-2 text-gray-500'
                : `${themeClass} hover:brightness-110 shadow-sm border-b`
          }
        `}
      >
        {/* Layout Compacto: Paddings mínimos para aproveitamento máximo */}
        <div className="px-2 py-1 flex flex-col h-full pointer-events-none leading-tight">
          
          {isTiny ? (
            // Formato Ultra-Compacto (15min): Hora e Nome na mesma linha
            <div className="flex items-center gap-1 min-w-0">
               <span className="text-[10px] font-bold shrink-0">{displayTime}</span>
               <span className="text-[10px] font-medium truncate">
                 {isBlocked ? <Lock size={10} className="inline mr-1" /> : ''}
                 {appointment.clientName}
               </span>
            </div>
          ) : (
            // Formato Padrão (+30min): Hora, Nome, Serviço empilhados
            <>
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold bg-black/10 px-1 rounded-sm">
                  {displayTime}
                </span>
                {appointment.notes && (
                   <span className="text-[10px] font-black bg-white/20 px-1 rounded-sm">!</span>
                )}
              </div>

              <div className="mt-0.5 min-w-0 flex-1">
                <h4 className="font-bold text-xs truncate">
                  {isBlocked && <Lock size={10} className="inline mr-1" />}
                  {appointment.clientName}
                </h4>
                
                {/* Oculta serviço se for muito curto, mas mostra se houver espaço */}
                {!isSmall && (
                  <p className="text-[10px] opacity-90 truncate mt-0.5">
                    {appointment.serviceName}
                  </p>
                )}
              </div>

              {/* Só mostra telefone se for agendamento longo (ex: 1h) */}
              {!isSmall && !isBlocked && appointment.clientPhone && (
                <div className="flex items-center gap-1 mt-auto text-[9px] opacity-80">
                  <Phone size={8} />
                  <span className="tabular-nums">{appointment.clientPhone}</span>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}