// Keeping Pengu safe. Everything lives in this browser only, so a backup file is the way to carry
// Pengu to another browser or into the Home Screen app. Also: asking the browser to keep Pengyu's
// storage, and spotting iPhone Safari for the one-time Home Screen tip.

import * as S from './state.js';
import { download } from './ui.js';

// Only ever called from a tap. Firefox asks the player; Safari and Chrome decide quietly.
export function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch { /* not offered in this browser */ }
}

// Save a backup: pengyu-backup-YYYY-MM-DD.json, which is also the data export.
export function saveBackup() {
  askPersist();
  S.markBackupSaved();
  download(`pengyu-backup-${S.today()}.json`, S.exportData(), 'application/json');
}

// iPhone or iPad Safari, in a normal tab rather than the Home Screen app.
export function inSafariTab() {
  const ua = navigator.userAgent || '';
  const ios = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo)\//.test(ua);
  const installed = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && safari && !installed;
}

// The tip shows once, after a logged workout, and only where it helps.
export const tipWanted = () => !S.state.tipSeen && Object.keys(S.state.log).length > 0 && inSafariTab();
