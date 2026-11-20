import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LiveView } from './components/LiveView';
import './index.css';

// /?live = vista del teléfono (solo sigue el draft que lleva el PC)
const isLive = new URLSearchParams(location.search).has('live');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLive ? <LiveView /> : <App />}
  </React.StrictMode>
);
