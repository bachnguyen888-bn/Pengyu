// Runs in <head> before the page paints: marks that scripts run, then applies the saved theme,
// or the time of day in automatic mode (Deep Space from 7pm to 7am, Daylight otherwise).
(function () {
  var root = document.documentElement;
  var mode = 'auto';
  root.classList.add('js');
  try { mode = localStorage.getItem('pengu.theme') || 'auto'; } catch (e) { /* storage blocked */ }
  if (mode !== 'day' && mode !== 'night') mode = 'auto';
  var hour = new Date().getHours();
  root.setAttribute('data-theme', mode === 'auto' ? (hour >= 19 || hour < 7 ? 'night' : 'day') : mode);
  root.setAttribute('data-theme-mode', mode);
})();
