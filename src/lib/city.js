// City scoping for events. Discover/Search show only events in the user's set city.
// Curated/seed events with no city are treated as belonging to the launch city.
export const LAUNCH_CITY = 'Hyderabad';

// The city universe members can pick from, and the reason picking is a list and
// not free text: two women in Hyderabad who store "Madhapur" and "Hyderabad"
// stop matching under sameCity(), which empties Discover, Search and People for
// one of them with nothing on screen explaining why. Keep in sync with the
// app's lib/city.ts.
export const CITIES = [
  'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Pune', 'Kolkata',
  'Ahmedabad', 'Jaipur', 'Kochi', 'Goa', 'Chandigarh',
  'Lucknow', 'Indore', 'Nagpur', 'Surat', 'Bhopal', 'Visakhapatnam',
  'Vijayawada', 'Coimbatore', 'Mysuru', 'Thiruvananthapuram', 'Nashik',
  'Vadodara', 'Patna', 'Ludhiana', 'Agra', 'Kanpur', 'Guwahati', 'Bhubaneswar',
  'Dehradun', 'Amritsar', 'Raipur', 'Ranchi', 'Jodhpur', 'Udaipur',
  'Mangaluru', 'Warangal', 'Tirupati', 'Madurai', 'Tiruchirappalli',
  'Kozhikode', 'Thrissur', 'Rajkot',
  'Jamshedpur',
];

// The short list surfaced as one-tap chips before anyone types.
export const POPULAR_CITIES = [
  'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Pune', 'Kolkata',
  'Ahmedabad', 'Jaipur', 'Kochi', 'Goa',
];

// Spellings that mean a city already on the list. Covers renamed cities and the
// localities people reach for instead of the city itself, so rows written before
// the picker was a fixed list still resolve. Keep in sync with the app.
const ALIASES = {
  hyd: 'hyderabad',
  secunderabad: 'hyderabad',
  cyberabad: 'hyderabad',
  madhapur: 'hyderabad',
  gachibowli: 'hyderabad',
  kukatpally: 'hyderabad',
  begumpet: 'hyderabad',
  'banjara hills': 'hyderabad',
  'jubilee hills': 'hyderabad',
  'hitec city': 'hyderabad',
  'hitech city': 'hyderabad',
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  'new delhi': 'delhi',
  // NCR resolves to Delhi. These were offered as their own cities, which made
  // each one an isolated scope: a member in Faridabad saw no Delhi events and
  // Delhi saw none of hers, so picking the town you actually live in was the
  // one choice guaranteed to empty the app. People travel across NCR for an
  // evening; the city boundary is not the thing that decides whether they can
  // meet. Rows written while these were separate cities keep their old value
  // and resolve through here, exactly as the Hyderabad localities do.
  gurugram: 'delhi',
  gurgaon: 'delhi',
  noida: 'delhi',
  faridabad: 'delhi',
  ghaziabad: 'delhi',
  meerut: 'delhi',
  madras: 'chennai',
  calcutta: 'kolkata',
  cochin: 'kochi',
  ernakulam: 'kochi',
  trivandrum: 'thiruvananthapuram',
  mysore: 'mysuru',
  mangalore: 'mangaluru',
  calicut: 'kozhikode',
  trichy: 'tiruchirappalli',
  vizag: 'visakhapatnam',
  baroda: 'vadodara',
  poona: 'pune',
};

// Lowercased, comma-stripped, alias-resolved. Geocoded values arrive as
// "Hyderabad, Telangana", so scope on the part before the comma.
function normalize(city) {
  const lower = (city || '').split(',')[0].trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

// Case-insensitive city equality. Empty/missing on either side never matches
// (an event with no city isn't "in" any city).
export function sameCity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb;
}

// Cities matching what's typed — by name, or through an alias someone is likelier
// to type than the canonical name ("Bangalore", "Vizag", "Madhapur"). Without the
// alias pass, typing your own locality looks like the city isn't served at all.
export function matchCities(query, limit = 6) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const byName = CITIES.filter((c) => c.toLowerCase().includes(q));
  const viaAlias = Object.entries(ALIASES)
    .filter(([alias]) => alias.includes(q))
    .map(([, target]) => CITIES.find((c) => normalize(c) === target))
    .filter(Boolean);
  return [...new Set([...byName, ...viaAlias])].slice(0, limit);
}

// The CITIES entry a free-typed or geocoded value refers to, or '' if it isn't
// a city we serve. Use this to validate before writing profile.city — storing
// only canonical values is what keeps everyone in one city on one string.
export function canonicalCity(input) {
  const n = normalize(input);
  if (!n) return '';
  return CITIES.find((c) => normalize(c) === n) || '';
}
