// Pengyu: the page is the week planner. Without scripts the page says what it needs; with them,
// js/pengyu/app.js builds everything inside #py-app.

import { initPengyu } from './pengyu/app.js';

initPengyu();

// Offline: after the first visit, sw.js keeps the app's own files on this device (never any of your
// data), so Pengyu opens and works with no connection.
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* the app still works online */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
