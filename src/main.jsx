import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';

// Importação necessária para o PWA (Vite Plugin PWA)
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker para habilitar instalação e cache
// immediate: true faz com que o app se atualize assim que houver uma nova versão
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos o App inteiro com o AuthProvider */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);