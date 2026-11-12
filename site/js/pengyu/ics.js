// The real reminder channel: a calendar file with one event and one alarm per planned day.
// Times are "floating" local times, so a 3:30 PM plan rings at 3:30 PM wherever the phone is.

import { planFor, shownWeek, parseKey, now } from './state.js';
import { download } from './ui.js';

const EVENT_MINUTES = 60;
const ALARM_MINUTES = 15;

const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

// Lines longer than 75 octets continue on the next line after a space (RFC 5545).
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let chunk = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(chunk); chunk = ''; size = 0; }
    chunk += ch;
    size += n;
  }
  out.push(chunk);
  return out.join('\r\n ');
}

export function sentence(plan, day) {
  const name = parseKey(day).toLocaleDateString('en-US', { weekday: 'long' });
  return `${name}, ${plan.window}, ${plan.place}`;
}

// The week's plan, or one that is not saved yet (the plan flow's summary offers the file first).
export function buildIcs(monday = shownWeek(), plan = planFor(monday)) {
  if (!plan) return '';
  const stamp = utc(now());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pengyu//Week planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  plan.days.forEach((day, slot) => {
    const [h, m] = plan.time.split(':').map(Number);
    const start = parseKey(day);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + EVENT_MINUTES * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:pengu-${monday}-${slot}@bachnguyenclearhealth.com`,
      `SEQUENCE:${(plan.moves || []).length}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local(start)}`,
      `DTEND:${local(end)}`,
      `SUMMARY:${escape(`Workout with Pengu ${plan.place}`)}`,
      `DESCRIPTION:${escape(`My plan: ${sentence(plan, day)}. Any workout, any length, counts. Log it in Pengyu with one tap.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(`Workout with Pengu ${plan.place}`)}`,
      `TRIGGER:-PT${ALARM_MINUTES}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(monday = shownWeek(), plan = planFor(monday)) {
  download(`pengu-week-${monday}.ics`, buildIcs(monday, plan), 'text/calendar;charset=utf-8');
}
