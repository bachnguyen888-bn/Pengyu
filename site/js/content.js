// Everything the preview says about health lives here, so it can be reviewed in one place.
// Only claims already on the page appear, each with its published source. Study type and sample
// size come from each paper's abstract.

export const RECEIPTS = {
  knuckles: {
    kind: 'claim',
    title: 'Cracking your knuckles causes arthritis.',
    verdict: 'cap',
    line: 'Years of cracking showed no link to hand arthritis.',
    source: {
      n: 5,
      text: 'deWeber K, et al. Knuckle cracking and hand osteoarthritis. J Am Board Fam Med, 2011.',
      href: 'https://www.jabfm.org/content/24/2/169',
      host: 'jabfm.org',
    },
    type: 'Retrospective case-control study',
    sample: '215 respondents aged 50 to 89 (135 with hand osteoarthritis, 80 without)',
    takeaway: 'People who habitually cracked their knuckles were no more likely to have hand osteoarthritis.',
    keywords: ['knuckle', 'knuckles', 'cracking', 'crack my', 'arthritis', 'osteoarthritis'],
  },
  caffeine: {
    kind: 'lesson',
    title: 'Does late caffeine hurt your sleep?',
    bullets: [
      'In one study, a big dose of caffeine six hours before bed still cut sleep by more than an hour.',
      'That backs a common tip: no big caffeine within six hours of bedtime.',
    ],
    source: {
      n: 4,
      text: 'Drake C, et al. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. J Clin Sleep Med, 2013.',
      href: 'https://pubmed.ncbi.nlm.nih.gov/24235903/',
      host: 'pubmed.ncbi.nlm.nih.gov',
    },
    type: 'Double-blind, placebo-controlled crossover study',
    sample: '12 healthy normal sleepers',
    takeaway: 'That backs a common tip: no big caffeine within six hours of bedtime.',
    keywords: ['caffeine', 'coffee', 'espresso', 'sleep', 'insomnia', 'bedtime'],
  },
};

export const ACTIVITIES = ['Gym', 'Walk', 'Run', 'Sports', 'Yoga', 'Dance', 'Home workout', 'Bike', 'Swim'];
export const MINUTES = ['10 min', '20 min', '30 min', '45 min', '60+ min'];
export const TOPICS = ['Sleep', 'Food', 'Fitness', 'Myths on my feed', 'Drinks and hydration'];

// Example friends for the league and the Sleep Sprint marker. The page labels them as examples.
export const FRIENDS = [
  { name: 'Maya', days: 6, rest: 1, games: 5, glide: 14 },
  { name: 'Jordan', days: 5, rest: 2, games: 3, glide: 9 },
  { name: 'Sam', days: 4, rest: 0, games: 4, glide: 5 },
];

export const TIERS = [
  { id: 'green', name: 'Green', min: 0, mult: 1, moveMult: 1 },
  { id: 'gold', name: 'Gold', min: 150, mult: 1.5, moveMult: 1.5 },
  { id: 'reserve', name: 'Reserve', min: 400, mult: 1.5, moveMult: 2 },
];

export const REWARDS = [
  {
    cost: 60, title: 'Streak Freeze or Seed Pack', icon: '❄',
    options: [
      { id: 'freeze', label: 'Streak Freeze', desc: 'One more freeze for a day you miss.' },
      { id: 'seeds', label: 'Seed Pack', desc: 'Three more Sanctuary seeds.' },
    ],
  },
  {
    cost: 150, title: 'Pengu Outfit or Habitat Upgrade', icon: '🎀',
    options: [
      { id: 'outfit', label: 'Pengu Outfit', desc: 'A gold star pin for Pengu’s scarf.' },
      { id: 'habitat', label: 'Habitat Upgrade', desc: 'Opens two more garden plots.' },
    ],
  },
  {
    cost: 400, title: 'Reserve Wellness Pass', icon: '✦',
    options: [
      { id: 'pass', label: 'Reserve Wellness Pass', desc: 'A preview badge for now. What the pass will include isn’t decided yet.' },
    ],
  },
];

export const SPECIES = {
  chamomile: { name: 'Chamomile', mutant: 'golden', mutantName: 'Golden Chamomile' },
  mint: { name: 'Mint', mutant: 'mint', mutantName: 'Bioluminescent Mint' },
  lotus: { name: 'Lotus', mutant: 'frost', mutantName: 'Frost Lotus' },
};
export const PLOT_SPECIES = ['chamomile', 'mint', 'lotus', 'chamomile', 'lotus'];
// Plot positions on the station art, in percent of the frame (empty craters and open ground).
export const PLOT_SPOTS = [
  { x: 38.2, y: 56.5 },
  { x: 65.4, y: 75 },
  { x: 82.8, y: 55 },
  { x: 21.5, y: 49 },
  { x: 52.5, y: 76 },
];
