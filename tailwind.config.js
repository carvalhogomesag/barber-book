/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        schedy: {
          // Fundo principal ultra-limpo para contraste máximo
          canvas: '#F4F7F9', 
          white: '#FFFFFF',
          // Tipografia pesada e legível (High-Contrast)
          black: '#0A0A0B',
          gray: '#64748B',
          // Cor de destaque (Primary Action)
          accent: '#000000', 
          danger: '#EF4444',
          border: '#E2E8F0',
        },
        // Paleta Vivid para Categorias de Serviço (WOW Factor)
        service: {
          emerald: '#10B981', // Ex: Corte Tradicional
          amber: '#F59E0B',   // Ex: Barba
          indigo: '#6366F1',  // Ex: Combo/Química
          rose: '#F43F5E',    // Ex: Tratamento/Pele
          violet: '#8B5CF6',  // Ex: Coloração
          sky: '#0EA5E9',     // Ex: Infantil
          orange: '#F97316',  // Ex: Especial/Noivo
        }
      },
      // Configuração para a Sidebar Retrátil
      spacing: {
        'sidebar-wide': '240px',
        'sidebar-slim': '72px',
      },
      // Sombras premium para profundidade nos cards
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 10px -2px rgba(0, 0, 0, 0.03)',
        'vivid': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}