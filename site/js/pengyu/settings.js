// Privacy and the existing data controls, without adding any saved settings.
import { h, appFooter } from './ui.js';

export function renderSettings(root, { onData } = {}) {
  root.append(
    h('h1', { class: 'py-view-title' }, 'Settings'),
    h('section', { class: 'py-data', 'aria-labelledby': 'py-privacy-title' },
      h('h2', { class: 'py-section-title', id: 'py-privacy-title' }, 'Privacy & your data'),
      h('p', { class: 'small muted' }, 'Your plans and progress are saved in this browser. No account or cloud sync.'),
      h('p', { class: 'py-data-privacy' }, h('a', { href: 'privacy.html' }, 'Privacy')),
      h('p', { class: 'small muted' }, 'To export a JSON backup or reset your progress, open History → Your data.'),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: onData }, 'Open History'))),
    appFooter());
}
