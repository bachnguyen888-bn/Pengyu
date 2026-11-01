// Runs in <head> before the page paints: marks that scripts run (so the app shows instead of the
// no-script note) and, on the first visit of a browser session, shows the PENGYU splash straight away.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try { if (sessionStorage.getItem('pengyu.splash') !== '1') root.classList.add('is-splash'); } catch (e) { /* storage blocked: no splash */ }
})();
