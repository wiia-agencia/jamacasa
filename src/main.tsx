import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { vigilarVersion } from './version';

if (__VISTA__) document.documentElement.classList.add('vista');

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// lo nuevo que se sube llega aunque la app lleve días abierta en segundo plano
if (!__VISTA__) vigilarVersion();

if (!__VISTA__ && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
