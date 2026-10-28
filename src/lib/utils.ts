const SWAHILI_DICT: Record<string, string> = {
  hello: 'habari', hi: 'mambo', hey: 'heh', 'how are you': 'habari yako',
  'good morning': 'habari za asubuhi', 'good evening': 'habari za jioni',
  'thank you': 'asante', thanks: 'asante', please: 'tafadhali',
  yes: 'ndio', no: 'hapana', good: 'nzuri', bad: 'mbaya',
  friend: 'rafiki', family: 'familia', love: 'upendo', money: 'pesa',
  today: 'leo', tomorrow: 'kesho', yesterday: 'jana', now: 'sasa',
  later: 'baadaye', water: 'maji', food: 'chakula', goodnight: 'lala salama',
  welcome: 'karibu', goodbye: 'kwaheri', see: 'kuona', come: 'kuja',
  go: 'kwenda', eat: 'kula', sleep: 'kulala', work: 'kazi',
  home: 'nyumbani', school: 'shule', child: 'mtoto', man: 'mwanamme',
  woman: 'mwanamke', king: 'mfalme', gold: 'dhahabu', chat: 'soga',
  message: 'ujumbe', send: 'tuma', read: 'soma', write: 'andika',
  goodnight2: 'lala salama', sorry: 'samahani', help: 'msaada',
  where: 'wapi', when: 'lini', who: 'nani', what: 'nini', why: 'kwa nini',
  how: 'vipi', much: 'sana', little: 'kidogo', big: 'kubwa', small: 'ndogo',
  one: 'moja', two: 'mbili', three: 'tatu', four: 'nne', five: 'tano',
};

const toSwahili = (text: string): string =>
  text
    .split(/(\s+)/)
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const clean = w.toLowerCase().replace(/[^\w']/g, '');
      const sw = SWAHILI_DICT[clean];
      return sw ? preserveCase(w, sw) : w;
    })
    .join('');

const toEnglish = (text: string): string => {
  const rev: Record<string, string> = {};
  Object.entries(SWAHILI_DICT).forEach(([en, sw]) => {
    if (!rev[sw]) rev[sw] = en;
  });
  return text
    .split(/(\s+)/)
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const clean = w.toLowerCase().replace(/[^\w']/g, '');
      const en = rev[clean];
      return en ? preserveCase(w, en) : w;
    })
    .join('');
};

const preserveCase = (orig: string, repl: string): string => {
  if (orig === orig.toUpperCase()) return repl.toUpperCase();
  if (orig[0] === orig[0]?.toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
};

export const detectLang = (text: string): 'sw' | 'en' => {
  const words = text.toLowerCase().split(/\s+/);
  const swHits = words.filter((w) => Object.values(SWAHILI_DICT).includes(w.replace(/[^\w']/g, ''))).length;
  const enHits = words.filter((w) => SWAHILI_DICT[w.replace(/[^\w']/g, '')]).length;
  return swHits > enHits ? 'sw' : 'en';
};

export const translate = (text: string, from: 'sw' | 'en'): string =>
  from === 'en' ? toSwahili(text) : toEnglish(text);

export const timeAgo = (iso: string): string => {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
};

export const formatChatTime = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const localTimeForCountry = (countryCode: string): string => {
  const tzMap: Record<string, string> = {
    KE: 'Africa/Nairobi', UG: 'Africa/Kampala', TZ: 'Africa/Dar_es_Salaam',
    NG: 'Africa/Lagos', GH: 'Africa/Accra', ZA: 'Africa/Johannesburg',
    RW: 'Africa/Kigali', US: 'America/New_York', GB: 'Europe/London',
    AE: 'Asia/Dubai', CA: 'America/Toronto', IN: 'Asia/Kolkata',
    AU: 'Australia/Sydney', DE: 'Europe/Berlin', FR: 'Europe/Paris',
  };
  const tz = tzMap[countryCode] ?? 'UTC';
  try {
    return new Date().toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return new Date().toLocaleTimeString();
  }
};

export const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'G';

export const avatarColor = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 35%, 28%)`;
};
