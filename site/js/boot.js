// Runs in <head> before the page paints: marks that scripts run, so the app shows instead of the
// no-script note. Pengyu has one light look, so there is no theme to pick.
document.documentElement.classList.add('js');
