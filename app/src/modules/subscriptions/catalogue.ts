/**
 * catalogue.ts - quick-add services, India first.
 *
 * Picking one pre-fills everything but the price: name, brand colour,
 * category, usual cycle and the page where you manage or cancel it. The price
 * is left for you because prices change and differ by plan; a stale one
 * pre-filled is a wrong number you might not notice.
 *
 * Written for this app from general knowledge of each service, not copied
 * from any tracker's list, and kept private: colours are approximate brand
 * colours for a monogram tile, never logos.
 *
 * LINKS. Each is the service's own account / subscription page as best known
 * when this was written. Ones marked `// URL unsure` are from memory and may
 * have moved; the link is editable on every subscription, and a dead one only
 * costs a search. Where a service is usually billed through Google Play the
 * Play subscriptions page is used, since that is where it is cancelled.
 *
 * ORDER MATTERS: Indian services come first (the catalogue's tests pin it), so
 * an empty search opens on what you are most likely to have.
 */
import type { Cycle } from './types';

export type CatalogueGroup =
  | 'Video'
  | 'Music & audio'
  | 'Mobile'
  | 'TV'
  | 'Broadband'
  | 'Cloud & storage'
  | 'AI'
  | 'Software'
  | 'News & reading'
  | 'Memberships'
  | 'Fitness'
  | 'Learning'
  | 'Gaming'
  | 'Insurance';

export type Service = {
  key: string;
  name: string;
  /** Other names people search by: old brands, short forms. */
  aliases?: string[];
  group: CatalogueGroup;
  /** An expense category key from core/categories. */
  category: string;
  /** '#RRGGBB', uppercase. */
  color: string;
  /** The usual cycle; the editor lets you change it. */
  cycle: Cycle;
  /** Only when it is usually billed in something other than rupees. */
  currency?: string;
  manageUrl: string;
  /** An Indian service, or the Indian edition of one. */
  india: boolean;
};

const MONTH: Cycle = { unit: 'month', count: 1 };
const YEAR: Cycle = { unit: 'year', count: 1 };
const DAYS_28: Cycle = { unit: 'day', count: 28 };
const QUARTER: Cycle = { unit: 'month', count: 3 };

const PLAY = 'https://play.google.com/store/account/subscriptions';
const APPLE = 'https://apps.apple.com/account/subscriptions';

export const CATALOGUE: Service[] = [
  /* INDIA ------------------------------------------------------------------ */

  // Video
  { key: 'jiohotstar', name: 'JioHotstar', aliases: ['hotstar', 'disney+ hotstar', 'disney', 'jiocinema', 'jio cinema'], group: 'Video', category: 'fun', color: '#1C3FAA', cycle: MONTH, manageUrl: 'https://www.hotstar.com/in/mypage', india: true }, // URL unsure
  { key: 'amazon_prime', name: 'Amazon Prime', aliases: ['prime video', 'amazon prime video'], group: 'Video', category: 'shopping', color: '#00A8E1', cycle: YEAR, manageUrl: 'https://www.amazon.in/gp/primecentral', india: true },
  { key: 'sonyliv', name: 'Sony LIV', aliases: ['sonyliv', 'sony'], group: 'Video', category: 'fun', color: '#1A1A1A', cycle: MONTH, manageUrl: 'https://www.sonyliv.com/myaccount', india: true }, // URL unsure
  { key: 'zee5', name: 'ZEE5', aliases: ['zee'], group: 'Video', category: 'fun', color: '#8230C6', cycle: YEAR, manageUrl: 'https://www.zee5.com/myaccount/subscription', india: true }, // URL unsure
  { key: 'sun_nxt', name: 'Sun NXT', group: 'Video', category: 'fun', color: '#E8590C', cycle: MONTH, manageUrl: 'https://www.sunnxt.com', india: true }, // URL unsure
  { key: 'aha', name: 'aha', group: 'Video', category: 'fun', color: '#E8501F', cycle: YEAR, manageUrl: 'https://www.aha.video', india: true }, // URL unsure
  { key: 'etv_win', name: 'ETV Win', group: 'Video', category: 'fun', color: '#C8102E', cycle: YEAR, manageUrl: 'https://www.etvwin.com', india: true }, // URL unsure
  { key: 'hoichoi', name: 'hoichoi', group: 'Video', category: 'fun', color: '#D7182A', cycle: YEAR, manageUrl: 'https://www.hoichoi.tv', india: true }, // URL unsure
  { key: 'lionsgate_play', name: 'Lionsgate Play', group: 'Video', category: 'fun', color: '#1F1F1F', cycle: MONTH, manageUrl: 'https://www.lionsgateplay.com', india: true }, // URL unsure
  { key: 'discovery_plus', name: 'discovery+', aliases: ['discovery plus'], group: 'Video', category: 'fun', color: '#2175D9', cycle: YEAR, manageUrl: 'https://www.discoveryplus.in', india: true }, // URL unsure

  // Music & audio
  { key: 'jiosaavn', name: 'JioSaavn Pro', aliases: ['saavn'], group: 'Music & audio', category: 'fun', color: '#1E9C8E', cycle: MONTH, manageUrl: 'https://www.jiosaavn.com/pro', india: true }, // URL unsure
  { key: 'gaana', name: 'Gaana Plus', group: 'Music & audio', category: 'fun', color: '#E72C30', cycle: MONTH, manageUrl: 'https://gaana.com/gaanaplus', india: true }, // URL unsure
  { key: 'wynk', name: 'Wynk Music', group: 'Music & audio', category: 'fun', color: '#D7141A', cycle: MONTH, manageUrl: 'https://wynk.in/music', india: true }, // URL unsure
  { key: 'kuku_fm', name: 'Kuku FM', aliases: ['kukufm'], group: 'Music & audio', category: 'fun', color: '#D63A2F', cycle: MONTH, manageUrl: PLAY, india: true },
  { key: 'pocket_fm', name: 'Pocket FM', aliases: ['pocketfm'], group: 'Music & audio', category: 'fun', color: '#D9262B', cycle: MONTH, manageUrl: PLAY, india: true },

  // Mobile
  { key: 'jio_prepaid', name: 'Jio prepaid', aliases: ['reliance jio', 'jio recharge'], group: 'Mobile', category: 'bills', color: '#0A2885', cycle: DAYS_28, manageUrl: 'https://www.jio.com/selfcare/', india: true }, // URL unsure
  { key: 'jio_postpaid', name: 'Jio postpaid', aliases: ['jio plus'], group: 'Mobile', category: 'bills', color: '#0A2885', cycle: MONTH, manageUrl: 'https://www.jio.com/selfcare/', india: true }, // URL unsure
  { key: 'airtel_prepaid', name: 'Airtel prepaid', aliases: ['airtel recharge'], group: 'Mobile', category: 'bills', color: '#E40000', cycle: DAYS_28, manageUrl: 'https://www.airtel.in/prepaid-recharge', india: true }, // URL unsure
  { key: 'airtel_postpaid', name: 'Airtel postpaid', aliases: ['airtel black'], group: 'Mobile', category: 'bills', color: '#E40000', cycle: MONTH, manageUrl: 'https://www.airtel.in/postpaid-bill-pay', india: true }, // URL unsure
  { key: 'vi_prepaid', name: 'Vi prepaid', aliases: ['vodafone', 'idea', 'vodafone idea'], group: 'Mobile', category: 'bills', color: '#E2231A', cycle: DAYS_28, manageUrl: 'https://www.myvi.in/prepaid/online-mobile-recharge', india: true }, // URL unsure
  { key: 'vi_postpaid', name: 'Vi postpaid', aliases: ['vodafone', 'idea', 'vodafone idea'], group: 'Mobile', category: 'bills', color: '#E2231A', cycle: MONTH, manageUrl: 'https://www.myvi.in/postpaid/online-bill-payment', india: true }, // URL unsure
  { key: 'bsnl', name: 'BSNL', aliases: ['bsnl prepaid', 'bharat sanchar'], group: 'Mobile', category: 'bills', color: '#1A75BC', cycle: DAYS_28, manageUrl: 'https://portal.bsnl.in', india: true }, // URL unsure

  // TV
  { key: 'tata_play', name: 'Tata Play', aliases: ['tata sky', 'tatasky'], group: 'TV', category: 'bills', color: '#A3238E', cycle: MONTH, manageUrl: 'https://www.tataplay.com/my-account', india: true }, // URL unsure
  { key: 'airtel_dth', name: 'Airtel Digital TV', aliases: ['airtel dth', 'airtel xstream'], group: 'TV', category: 'bills', color: '#E40000', cycle: MONTH, manageUrl: 'https://www.airtel.in/dth', india: true }, // URL unsure
  { key: 'dish_tv', name: 'Dish TV', aliases: ['dishtv', 'd2h', 'videocon d2h'], group: 'TV', category: 'bills', color: '#D71920', cycle: MONTH, manageUrl: 'https://www.dishtv.in', india: true }, // URL unsure
  { key: 'sun_direct', name: 'Sun Direct', group: 'TV', category: 'bills', color: '#E57200', cycle: MONTH, manageUrl: 'https://www.sundirect.in', india: true }, // URL unsure

  // Broadband
  { key: 'jiofiber', name: 'JioFiber', aliases: ['jio fiber', 'jio airfiber', 'airfiber'], group: 'Broadband', category: 'bills', color: '#0A2885', cycle: MONTH, manageUrl: 'https://www.jio.com/selfcare/', india: true }, // URL unsure
  { key: 'airtel_fiber', name: 'Airtel Xstream Fiber', aliases: ['airtel broadband', 'airtel wifi'], group: 'Broadband', category: 'bills', color: '#E40000', cycle: MONTH, manageUrl: 'https://www.airtel.in/broadband', india: true }, // URL unsure
  { key: 'act_fibernet', name: 'ACT Fibernet', aliases: ['act broadband'], group: 'Broadband', category: 'bills', color: '#D6202A', cycle: MONTH, manageUrl: 'https://www.actcorp.in', india: true }, // URL unsure
  { key: 'hathway', name: 'Hathway', group: 'Broadband', category: 'bills', color: '#C8102E', cycle: MONTH, manageUrl: 'https://www.hathway.com', india: true }, // URL unsure
  { key: 'excitel', name: 'Excitel', group: 'Broadband', category: 'bills', color: '#E2561F', cycle: MONTH, manageUrl: 'https://www.excitel.com', india: true }, // URL unsure

  // News & reading
  { key: 'times_prime', name: 'Times Prime', group: 'News & reading', category: 'shopping', color: '#2B2B2B', cycle: YEAR, manageUrl: 'https://www.timesprime.com', india: true }, // URL unsure
  { key: 'toi_plus', name: 'TOI+', aliases: ['times of india'], group: 'News & reading', category: 'fun', color: '#C8102E', cycle: YEAR, manageUrl: 'https://timesofindia.indiatimes.com/toi-plus', india: true }, // URL unsure
  { key: 'et_prime', name: 'ET Prime', aliases: ['economic times'], group: 'News & reading', category: 'fun', color: '#B4212A', cycle: YEAR, manageUrl: 'https://economictimes.indiatimes.com/prime', india: true }, // URL unsure
  { key: 'the_hindu', name: 'The Hindu', group: 'News & reading', category: 'fun', color: '#1B3A5C', cycle: YEAR, manageUrl: 'https://www.thehindu.com/myaccount/', india: true }, // URL unsure
  { key: 'kindle_unlimited', name: 'Kindle Unlimited', aliases: ['kindle'], group: 'News & reading', category: 'fun', color: '#B35900', cycle: MONTH, manageUrl: 'https://www.amazon.in/kindle-dbs/ku/ku-central', india: true }, // URL unsure

  // Memberships
  { key: 'swiggy_one', name: 'Swiggy One', aliases: ['swiggy'], group: 'Memberships', category: 'food', color: '#FC8019', cycle: QUARTER, manageUrl: 'https://www.swiggy.com/one', india: true }, // URL unsure
  { key: 'zomato_gold', name: 'Zomato Gold', aliases: ['zomato'], group: 'Memberships', category: 'food', color: '#E23744', cycle: QUARTER, manageUrl: 'https://www.zomato.com/gold', india: true }, // URL unsure
  { key: 'bb_star', name: 'bbstar', aliases: ['bigbasket', 'big basket'], group: 'Memberships', category: 'groceries', color: '#5A8E1A', cycle: QUARTER, manageUrl: 'https://www.bigbasket.com', india: true }, // URL unsure
  { key: 'zepto_pass', name: 'Zepto Pass', aliases: ['zepto'], group: 'Memberships', category: 'groceries', color: '#5B1A8C', cycle: MONTH, manageUrl: 'https://www.zeptonow.com', india: true }, // URL unsure
  { key: 'flipkart_black', name: 'Flipkart Black', aliases: ['flipkart vip', 'flipkart'], group: 'Memberships', category: 'shopping', color: '#2874F0', cycle: YEAR, manageUrl: 'https://www.flipkart.com/account', india: true }, // URL unsure

  // Fitness
  { key: 'cult_fit', name: 'cult.fit', aliases: ['cultfit', 'cultpass', 'cure.fit'], group: 'Fitness', category: 'health', color: '#D3165A', cycle: MONTH, manageUrl: 'https://www.cult.fit', india: true }, // URL unsure
  { key: 'healthifyme', name: 'HealthifyMe', aliases: ['healthify'], group: 'Fitness', category: 'health', color: '#1E9E63', cycle: QUARTER, manageUrl: PLAY, india: true },

  // Learning
  { key: 'unacademy', name: 'Unacademy', group: 'Learning', category: 'other', color: '#08875A', cycle: YEAR, manageUrl: 'https://unacademy.com/settings', india: true }, // URL unsure
  { key: 'byjus', name: "BYJU'S", aliases: ['byjus'], group: 'Learning', category: 'other', color: '#7B2CBF', cycle: YEAR, manageUrl: 'https://byjus.com', india: true }, // URL unsure

  // Insurance
  { key: 'lic', name: 'LIC premium', aliases: ['lic', 'life insurance corporation'], group: 'Insurance', category: 'bills', color: '#0A57A4', cycle: YEAR, manageUrl: 'https://licindia.in', india: true }, // URL unsure
  { key: 'star_health', name: 'Star Health', aliases: ['health insurance'], group: 'Insurance', category: 'health', color: '#D21F3C', cycle: YEAR, manageUrl: 'https://www.starhealth.in', india: true }, // URL unsure

  /* EVERYWHERE ------------------------------------------------------------- */

  // Video
  { key: 'netflix', name: 'Netflix', group: 'Video', category: 'fun', color: '#E50914', cycle: MONTH, manageUrl: 'https://www.netflix.com/cancelplan', india: false },
  { key: 'youtube_premium', name: 'YouTube Premium', aliases: ['youtube'], group: 'Video', category: 'fun', color: '#FF0000', cycle: MONTH, manageUrl: 'https://www.youtube.com/paid_memberships', india: false },
  { key: 'apple_tv', name: 'Apple TV+', aliases: ['apple tv'], group: 'Video', category: 'fun', color: '#1C1C1E', cycle: MONTH, manageUrl: APPLE, india: false },
  { key: 'crunchyroll', name: 'Crunchyroll', aliases: ['anime'], group: 'Video', category: 'fun', color: '#F47521', cycle: MONTH, manageUrl: 'https://www.crunchyroll.com/account/membership', india: false }, // URL unsure
  { key: 'mubi', name: 'MUBI', group: 'Video', category: 'fun', color: '#1A1A1A', cycle: YEAR, manageUrl: 'https://mubi.com/account', india: false }, // URL unsure

  // Music & audio
  { key: 'spotify', name: 'Spotify Premium', aliases: ['spotify'], group: 'Music & audio', category: 'fun', color: '#1DB954', cycle: MONTH, manageUrl: 'https://www.spotify.com/account/subscription/', india: false },
  { key: 'youtube_music', name: 'YouTube Music', group: 'Music & audio', category: 'fun', color: '#FF0000', cycle: MONTH, manageUrl: 'https://www.youtube.com/paid_memberships', india: false },
  { key: 'apple_music', name: 'Apple Music', group: 'Music & audio', category: 'fun', color: '#FA243C', cycle: MONTH, manageUrl: APPLE, india: false },
  { key: 'audible', name: 'Audible', aliases: ['audiobooks'], group: 'Music & audio', category: 'fun', color: '#F7991C', cycle: MONTH, manageUrl: 'https://www.audible.in/account/overview', india: false }, // URL unsure

  // Cloud & storage
  { key: 'google_one', name: 'Google One', aliases: ['google drive', 'google storage'], group: 'Cloud & storage', category: 'bills', color: '#1A73E8', cycle: MONTH, manageUrl: 'https://one.google.com/settings', india: false }, // URL unsure
  { key: 'icloud', name: 'iCloud+', aliases: ['icloud', 'apple storage'], group: 'Cloud & storage', category: 'bills', color: '#3693F3', cycle: MONTH, manageUrl: APPLE, india: false },
  { key: 'microsoft_365', name: 'Microsoft 365', aliases: ['office 365', 'onedrive', 'office'], group: 'Cloud & storage', category: 'bills', color: '#D83B01', cycle: YEAR, manageUrl: 'https://account.microsoft.com/services', india: false },
  { key: 'dropbox', name: 'Dropbox', group: 'Cloud & storage', category: 'bills', color: '#0061FF', cycle: YEAR, currency: 'USD', manageUrl: 'https://www.dropbox.com/account/plan', india: false },
  { key: 'proton', name: 'Proton', aliases: ['protonmail', 'proton mail', 'proton vpn'], group: 'Cloud & storage', category: 'bills', color: '#6D4AFF', cycle: YEAR, currency: 'USD', manageUrl: 'https://account.proton.me/dashboard', india: false }, // URL unsure
  { key: 'one_password', name: '1Password', group: 'Cloud & storage', category: 'bills', color: '#0572EC', cycle: YEAR, currency: 'USD', manageUrl: 'https://my.1password.com/settings/billing', india: false }, // URL unsure
  { key: 'bitwarden', name: 'Bitwarden', group: 'Cloud & storage', category: 'bills', color: '#175DDC', cycle: YEAR, currency: 'USD', manageUrl: 'https://vault.bitwarden.com/#/settings/subscription', india: false }, // URL unsure

  // AI
  { key: 'chatgpt', name: 'ChatGPT Plus', aliases: ['openai', 'chatgpt', 'chatgpt go'], group: 'AI', category: 'bills', color: '#10A37F', cycle: MONTH, manageUrl: 'https://chatgpt.com/#settings/Account', india: false }, // URL unsure
  { key: 'claude', name: 'Claude Pro', aliases: ['anthropic', 'claude'], group: 'AI', category: 'bills', color: '#C15F3C', cycle: MONTH, currency: 'USD', manageUrl: 'https://claude.ai/settings/billing', india: false },
  { key: 'google_ai_pro', name: 'Google AI Pro', aliases: ['gemini', 'gemini advanced'], group: 'AI', category: 'bills', color: '#4C5FD5', cycle: MONTH, manageUrl: 'https://one.google.com/settings', india: false }, // URL unsure
  { key: 'perplexity', name: 'Perplexity Pro', aliases: ['perplexity'], group: 'AI', category: 'bills', color: '#1F7A85', cycle: MONTH, currency: 'USD', manageUrl: 'https://www.perplexity.ai/settings/account', india: false }, // URL unsure
  { key: 'midjourney', name: 'Midjourney', group: 'AI', category: 'bills', color: '#1A1A1A', cycle: MONTH, currency: 'USD', manageUrl: 'https://www.midjourney.com/account', india: false }, // URL unsure
  { key: 'github_copilot', name: 'GitHub Copilot', aliases: ['copilot', 'github'], group: 'AI', category: 'bills', color: '#24292F', cycle: MONTH, currency: 'USD', manageUrl: 'https://github.com/settings/copilot', india: false },
  { key: 'cursor', name: 'Cursor Pro', aliases: ['cursor'], group: 'AI', category: 'bills', color: '#1A1A1A', cycle: MONTH, currency: 'USD', manageUrl: 'https://cursor.com/settings', india: false }, // URL unsure

  // Software
  { key: 'adobe_cc', name: 'Adobe Creative Cloud', aliases: ['adobe', 'photoshop', 'lightroom'], group: 'Software', category: 'bills', color: '#DA1F26', cycle: MONTH, manageUrl: 'https://account.adobe.com/plans', india: false },
  { key: 'canva', name: 'Canva Pro', aliases: ['canva'], group: 'Software', category: 'bills', color: '#00838A', cycle: YEAR, manageUrl: 'https://www.canva.com/settings/billing-and-plans', india: false }, // URL unsure
  { key: 'notion', name: 'Notion', group: 'Software', category: 'bills', color: '#1A1A1A', cycle: MONTH, currency: 'USD', manageUrl: 'https://www.notion.so/settings', india: false }, // URL unsure
  { key: 'linkedin_premium', name: 'LinkedIn Premium', aliases: ['linkedin'], group: 'Software', category: 'bills', color: '#0A66C2', cycle: MONTH, manageUrl: 'https://www.linkedin.com/premium/manage/', india: false }, // URL unsure
  { key: 'grammarly', name: 'Grammarly Premium', aliases: ['grammarly'], group: 'Software', category: 'bills', color: '#0E8A63', cycle: YEAR, manageUrl: 'https://account.grammarly.com/subscription', india: false }, // URL unsure
  { key: 'godaddy_domain', name: 'Domain (GoDaddy)', aliases: ['godaddy', 'domain', 'website'], group: 'Software', category: 'bills', color: '#1A7A7A', cycle: YEAR, manageUrl: 'https://account.godaddy.com/products', india: false }, // URL unsure

  // Fitness
  { key: 'strava', name: 'Strava', group: 'Fitness', category: 'health', color: '#FC4C02', cycle: YEAR, manageUrl: 'https://www.strava.com/account', india: false }, // URL unsure
  { key: 'hevy', name: 'Hevy Pro', aliases: ['hevy'], group: 'Fitness', category: 'health', color: '#2563EB', cycle: YEAR, manageUrl: PLAY, india: false },

  // Learning
  { key: 'duolingo', name: 'Duolingo Super', aliases: ['duolingo'], group: 'Learning', category: 'other', color: '#3F8F02', cycle: YEAR, manageUrl: PLAY, india: false },
  { key: 'coursera_plus', name: 'Coursera Plus', aliases: ['coursera'], group: 'Learning', category: 'other', color: '#0056D2', cycle: YEAR, manageUrl: 'https://www.coursera.org/account-settings', india: false }, // URL unsure
  { key: 'udemy', name: 'Udemy Personal Plan', aliases: ['udemy'], group: 'Learning', category: 'other', color: '#8710D8', cycle: MONTH, manageUrl: 'https://www.udemy.com/user/edit-account/', india: false }, // URL unsure

  // Gaming
  { key: 'xbox_game_pass', name: 'Xbox Game Pass', aliases: ['game pass', 'xbox'], group: 'Gaming', category: 'fun', color: '#107C10', cycle: MONTH, manageUrl: 'https://account.microsoft.com/services', india: false },
  { key: 'playstation_plus', name: 'PlayStation Plus', aliases: ['ps plus', 'psn'], group: 'Gaming', category: 'fun', color: '#0070D1', cycle: MONTH, manageUrl: 'https://www.playstation.com/en-in/support/subscriptions/', india: false }, // URL unsure
  { key: 'google_play_pass', name: 'Google Play Pass', aliases: ['play pass'], group: 'Gaming', category: 'fun', color: '#01875F', cycle: MONTH, manageUrl: PLAY, india: false },
];

/** Lowercase letters and digits only, so "ZEE 5" finds "ZEE5" and "disney+" finds "Disney+". */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findService(key: string): Service | undefined {
  return CATALOGUE.find((s) => s.key === key);
}

/**
 * Services matching what was typed. Names starting with it rank first, then
 * other name matches, then alias matches (an old brand: "hotstar"); within
 * each, catalogue order, which puts Indian services first. Empty -> all.
 */
export function searchCatalogue(query: string): Service[] {
  const needle = squash(query);
  if (!needle) return [...CATALOGUE];

  const ranked: { service: Service; rank: number; index: number }[] = [];
  CATALOGUE.forEach((service, index) => {
    const name = squash(service.name);
    let rank = -1;
    if (name.startsWith(needle)) rank = 0;
    else if (name.includes(needle)) rank = 1;
    else if (service.aliases?.some((alias) => squash(alias).includes(needle))) rank = 2;
    if (rank >= 0) ranked.push({ service, rank, index });
  });

  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((r) => r.service);
}
