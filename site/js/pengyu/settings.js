// Settings shares History's existing data controls and safeguards.
import { h, appFooter } from './ui.js';
import { renderData } from './history.js';

export function renderSettings(root, rerender, handlers = {}) {
  root.append(
    h('h1', { class: 'py-view-title' }, 'Settings'),
    h('section', { class: 'py-data', 'aria-labelledby': 'py-privacy-title' },
      h('h2', { class: 'py-section-title', id: 'py-privacy-title' }, 'Privacy & your data'),
      h('p', { class: 'small muted' }, 'Your plans and progress stay in this browser. No account, cloud sync, tracking or ads.'),
      h('p', { class: 'py-data-privacy' }, h('a', { href: 'privacy.html' }, 'How Pengyu handles your data'))));
  renderData(root, rerender, handlers);
  root.append(appFooter());
}
