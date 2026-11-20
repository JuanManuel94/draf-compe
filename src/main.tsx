import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { STANDALONE } from './app/env';
import { LiveView } from './components/LiveView';
import './index.css';

// /?live = vista del teléfono (solo sigue el draft que lleva el PC; no existe en la versión publicada)
const isLive = !STANDALONE && new URLSearchParams(location.search).has('live');

// App instalable y sin conexión: guarda la app y los datos en el teléfono y se actualiza sola
// cuando hay una versión nueva publicada
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLive ? <LiveView /> : <App />}
  </React.StrictMode>
);
