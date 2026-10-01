/**
 * src/data/interests.js — single source of truth for interest taxonomies
 *
 * Three exports, one file:
 *  • HOBBY_CATEGORIES  → drives HobbySelector in onboarding
 *  • HOBBY_TO_CAT      → maps hobby names to broad event categories (scoring fallback)
 *  • CAT_TAGS          → maps event categories to interest tags (CreateEvent picker)
 *
 * Adding a hobby? Update all three here. Do not add it elsewhere.
 */

// ── Onboarding hobby groups (drives HobbySelector) ───────────────────────────
export const HOBBY_CATEGORIES = [
  {
    label: 'Sports & Fitness',
    hobbies: ['Football', 'Basketball', 'Tennis', 'Running', 'Yoga', 'Swimming', 'Cycling', 'Hiking', 'Martial Arts', 'Volleyball', 'Cricket', 'Badminton'],
  },
  {
    label: 'Arts & Creative',
    hobbies: ['Painting', 'Photography', 'Sketching', 'Pottery', 'Graphic Design', 'Film Making', 'Writing', 'Calligraphy'],
  },
  {
    label: 'Music',
    hobbies: ['Guitar', 'Piano', 'Singing', 'DJing', 'Drums', 'Vinyl Collecting', 'Jazz', 'Classical Music'],
  },
  {
    label: 'Food & Drink',
    hobbies: ['Cooking', 'Baking', 'Wine Tasting', 'Mixology', 'Coffee', 'Food Photography'],
  },
  {
    label: 'Mind & Culture',
    hobbies: ['Reading', 'Book Clubs', 'Philosophy', 'Chess', 'Board Games', 'Meditation', 'Languages'],
  },
  {
    label: 'Tech & Science',
    hobbies: ['Coding', 'AI / ML', 'Data Science', 'UX Design', 'Cybersecurity', 'Robotics', 'Astronomy', 'Gaming', '3D Printing'],
  },
  {
    label: 'Career & Business',
    hobbies: ['Startups', 'Entrepreneurship', 'Product', 'Marketing', 'Finance', 'Investing', 'Public Speaking', 'Consulting', 'Freelancing', 'Leadership'],
  },
  {
    label: 'Outdoors & Adventure',
    hobbies: ['Camping', 'Rock Climbing', 'Surfing', 'Skateboarding', 'Gardening', 'Stargazing'],
  },
];

// ── Hobby → broad event category (fallback scoring signal in Discover) ────────
// Keys are lowercase hobby names. Values are event category keys.
export const HOBBY_TO_CAT = {
  // Music
  music: 'music', dancing: 'music', dance: 'music', concerts: 'music',
  jazz: 'music', 'live music': 'music', guitar: 'music', piano: 'music',
  singing: 'music', djing: 'music', drums: 'music', 'vinyl collecting': 'music',
  'classical music': 'music', electronic: 'music',
  // Arts
  painting: 'arts', drawing: 'arts', pottery: 'arts', sculpture: 'arts',
  art: 'arts', photography: 'arts', sketching: 'arts', calligraphy: 'arts',
  'graphic design': 'arts', 'film making': 'arts', writing: 'arts',
  // Food
  cooking: 'food', food: 'food', 'wine tasting': 'food', baking: 'food',
  brunch: 'food', mixology: 'food', coffee: 'food', 'food photography': 'food',
  // Literature
  reading: 'lit', books: 'lit', poetry: 'lit', literature: 'lit',
  'book clubs': 'lit', languages: 'lit', philosophy: 'lit',
  // Sports
  hiking: 'sports', yoga: 'sports', fitness: 'sports', running: 'sports',
  climbing: 'sports', sports: 'sports', football: 'sports', basketball: 'sports',
  tennis: 'sports', swimming: 'sports', cycling: 'sports', volleyball: 'sports',
  cricket: 'sports', badminton: 'sports', 'martial arts': 'sports',
  'rock climbing': 'sports', surfing: 'sports', skateboarding: 'sports',
  camping: 'sports',
  // Film
  film: 'film', movies: 'film', cinema: 'film',
  // Wellness
  wellness: 'wellness', meditation: 'wellness', mindfulness: 'wellness', selfcare: 'wellness',
  // Tech
  tech: 'tech', coding: 'tech', technology: 'tech', robotics: 'tech',
  astronomy: 'tech', gaming: 'tech', '3d printing': 'tech', 'ai / ml': 'tech',
  'data science': 'tech', 'ux design': 'tech', cybersecurity: 'tech',
  // Networking / Career & Business
  networking: 'networking', startups: 'networking', entrepreneurship: 'networking',
  career: 'networking', leadership: 'networking', product: 'networking',
  marketing: 'networking', finance: 'networking', investing: 'networking',
  'public speaking': 'networking', consulting: 'networking', freelancing: 'networking',
  // Social / other
  social: 'social', travel: 'social',
  chess: 'social', 'board games': 'social', gardening: 'social',
  stargazing: 'social',
};

// ── Event category → interest tags (drives CreateEvent tag picker) ────────────
// Tag strings must match hobby names in HOBBY_CATEGORIES (case-insensitive) for
// direct tag-hobby overlap scoring to work in Discover.jsx.
export const CAT_TAGS = {
  music:  ['Jazz', 'Classical Music', 'Electronic', 'Live Music', 'DJing', 'Singing', 'Vinyl Collecting', 'Concerts', 'Guitar', 'Piano', 'Drums'],
  arts:   ['Painting', 'Photography', 'Pottery', 'Sketching', 'Calligraphy', 'Film Making', 'Graphic Design', 'Writing'],
  food:   ['Cooking', 'Baking', 'Wine Tasting', 'Mixology', 'Coffee', 'Food Photography', 'Brunch'],
  lit:    ['Reading', 'Book Clubs', 'Poetry', 'Philosophy', 'Writing', 'Languages'],
  sports: ['Yoga', 'Running', 'Hiking', 'Cycling', 'Badminton', 'Tennis', 'Cricket', 'Swimming', 'Martial Arts', 'Volleyball', 'Football', 'Basketball', 'Rock Climbing'],
  film:   ['Film Making', 'Cinema', 'Documentaries', 'Short Films', 'Photography'],
  other:      ['Board Games', 'Chess', 'Meditation', 'Coding', 'AI / ML', 'Data Science', 'UX Design', 'Cybersecurity', 'Astronomy', 'Gardening', 'Stargazing', 'Gaming', 'Robotics', 'Camping'],
  networking: ['Startups', 'Entrepreneurship', 'Product', 'Marketing', 'Finance', 'Investing', 'Public Speaking', 'Consulting', 'Freelancing', 'Leadership', 'Career', 'Panels', 'Workshops'],
};
