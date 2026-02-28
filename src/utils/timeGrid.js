import { setHours, startOfDay, addMinutes, roundToNearestMinutes } from 'date-fns';

/**
 * CONFIGURAÇÕES DE VISIBILIDADE (UX FOCUS)
 * Definimos o foco comercial: das 07:00 às 22:00.
 */
export const START_HOUR = 7; 
export const END_HOUR = 22;  

/**
 * PIXELS_PER_HOUR
 * Ajustado para 100px para dar uma sensação de amplitude e luxo no "Light Mode".
 */
export const PIXELS_PER_HOUR = 100; 

/**
 * Calcula a posição (TOP) de um horário específico no grid.
 * O cálculo é relativo à START_HOUR (07:00).
 */
export const getPositionFromTime = (dateString, customPixelsPerHour = PIXELS_PER_HOUR) => {
  const date = new Date(dateString);
  
  // Criamos a âncora de início do grid (Ex: Hoje às 07:00)
  const anchorDate = setHours(startOfDay(date), START_HOUR);
  
  // Diferença em horas decimais
  const diffInHours = (date.getTime() - anchorDate.getTime()) / (1000 * 60 * 60);
  
  // Se o horário for antes das 07:00, retornamos 0 para não quebrar o layout
  return Math.max(0, diffInHours * customPixelsPerHour);
};

/**
 * Calcula a altura do card baseada na duração do serviço.
 * Um serviço de 60min terá exatamente customPixelsPerHour de altura.
 */
export const getHeightFromDuration = (durationInMinutes, customPixelsPerHour = PIXELS_PER_HOUR) => {
  return (durationInMinutes / 60) * customPixelsPerHour;
};

/**
 * Gera a lista de horas (07:00 a 22:00) para o eixo lateral.
 */
export const hoursArray = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);

/**
 * LÓGICA DE DRAG & DROP (SNAP)
 * Converte o movimento de pixels de volta para um horário ISO.
 */
export const getNewStartTime = (originalStartTime, pixelsMoved, customPixelsPerHour = PIXELS_PER_HOUR) => {
  const originalDate = new Date(originalStartTime);
  
  // Converte pixels em minutos totais movidos
  const minutesMoved = (pixelsMoved / customPixelsPerHour) * 60;
  
  // Calcula nova data bruta
  let newDate = addMinutes(originalDate, minutesMoved);
  
  // UX SNAP: Imã de 15 minutos para facilitar o encaixe perfeito na agenda
  newDate = roundToNearestMinutes(newDate, { nearestTo: 15 });
  
  // Bloqueio de limite superior (Não deixar arrastar para antes das 07:00)
  const minLimit = setHours(startOfDay(newDate), START_HOUR);
  if (newDate < minLimit) return minLimit.toISOString();

  return newDate.toISOString();
};

/**
 * Formata a exibição de hora no padrão 24h elegante (High Contrast)
 */
export const formatTimeDisplay = (isoString) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * TOTAL_GRID_HEIGHT
 * Útil para definir a altura total do container de scroll do calendário.
 */
export const TOTAL_GRID_HEIGHT = (END_HOUR - START_HOUR + 1) * PIXELS_PER_HOUR;