// Pengu's window, as words: a tiny story for any visit, and the reason a rest day can still be a nice
// visit. Four authored scenes in a fixed order, the same for everyone, then Replay or Done. Nothing here is
// random, nothing is earned or saved, and nothing asks for a workout. Two touches come from what the player
// already chose: the tunnel is lit by their own headlamp once they unlocked it, and the last line names
// their real next stop (or what is true when there is none). Pengu in the window wears their gear
// (window.js draws that). Reads only: the save is passed in as `S` and never changed.

export const WINDOW_TITLE = 'Pengu’s window';

const dayName = (S, key) => S.parseKey(key).toLocaleDateString('en-US', { weekday: 'long' });

// The last scene's line: where the route goes next, in plain words, with no pressure.
function lastLine(S) {
  const lead = 'Out of the tunnel, the hills glow.';
  if (S.shownWeek() !== S.thisWeek()) return `${lead} Your route starts Monday.`;
  const goal = S.weekGoal();
  if (goal && goal.kind === 'hit') return `${lead} Your week is complete.`;
  const stop = S.nextStop();
  if (stop && stop.week === S.thisWeek()) return `${lead} Next stop: ${stop.day === S.today() ? 'today' : dayName(S, stop.day)}.`;
  return `${lead} A new route starts Monday.`;
}

export function windowStory(S) {
  return [
    { id: 'pines', line: 'Snow on the pines. Pengu presses a flipper to the glass.' },
    { id: 'lake', line: 'A frozen lake shines. Pengu counts the sparkles.' },
    { id: 'tunnel', line: S.owns('headlamp') ? 'Into the tunnel. Your headlamp lights the way.' : 'Into the tunnel. Lamps glow by: one, two, three.' },
    { id: 'hills', line: lastLine(S) },
  ];
}
