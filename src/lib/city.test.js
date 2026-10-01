import { describe, it, expect } from 'vitest';
import { CITIES, LAUNCH_CITY, sameCity, canonicalCity, matchCities } from './city';

// NCR used to be six separate entries in CITIES — Delhi, Gurugram, Noida,
// Faridabad, Ghaziabad, Meerut — and sameCity() is exact-match on the canonical
// name. That made each one an isolated scope: a member who picked the town she
// actually lives in saw zero Delhi events, and Delhi saw none of hers. Nobody
// in NCR could reach anybody else in NCR. The other five now alias to Delhi.

const NCR_TOWNS = ['Faridabad', 'Gurugram', 'Noida', 'Ghaziabad', 'Meerut'];

describe('NCR resolves to Delhi', () => {
  it.each(NCR_TOWNS)('%s matches Delhi', (town) => {
    expect(sameCity(town, 'Delhi')).toBe(true);
    expect(sameCity('Delhi', town)).toBe(true);
  });

  it('the towns match each other, not just Delhi', () => {
    expect(sameCity('Faridabad', 'Noida')).toBe(true);
    expect(sameCity('Gurugram', 'Ghaziabad')).toBe(true);
  });

  it.each(NCR_TOWNS)('%s canonicalises to Delhi, so the onboarding gate passes', (town) => {
    expect(canonicalCity(town)).toBe('Delhi');
  });

  it('is case and whitespace insensitive, like every other alias', () => {
    expect(sameCity('  faridabad ', 'DELHI')).toBe(true);
    expect(canonicalCity('NOIDA')).toBe('Delhi');
  });

  it('handles a geocoded value with a region suffix', () => {
    expect(canonicalCity('Gurugram, Haryana')).toBe('Delhi');
    expect(sameCity('Noida, Uttar Pradesh', 'Delhi')).toBe(true);
  });

  it('gurgaon still works and now lands on Delhi, not Gurugram', () => {
    expect(canonicalCity('Gurgaon')).toBe('Delhi');
  });

  it('drops all five from the pickable list — one NCR entry, not six', () => {
    for (const town of NCR_TOWNS) expect(CITIES).not.toContain(town);
    expect(CITIES).toContain('Delhi');
  });

  it('Meerut is in the set too', () => {
    expect(sameCity('Meerut', 'Delhi')).toBe(true);
    expect(sameCity('Meerut', 'Noida')).toBe(true);
    expect(canonicalCity('Meerut, Uttar Pradesh')).toBe('Delhi');
  });

  it('still suggests Delhi when someone types her own town', () => {
    // Without the alias pass this returned nothing and NCR looked unserved.
    expect(matchCities('faridabad')).toContain('Delhi');
    expect(matchCities('noida')).toContain('Delhi');
    expect(matchCities('gurgaon')).toContain('Delhi');
  });
});

describe('the rest of the city map is unchanged', () => {
  it('keeps Hyderabad and its localities together', () => {
    expect(sameCity('Madhapur', 'Hyderabad')).toBe(true);
    expect(sameCity('Gachibowli', 'Hyderabad')).toBe(true);
    expect(LAUNCH_CITY).toBe('Hyderabad');
  });

  it('keeps the renamed-city aliases working', () => {
    expect(canonicalCity('Bangalore')).toBe('Bengaluru');
    expect(canonicalCity('Bombay')).toBe('Mumbai');
    expect(canonicalCity('Vizag')).toBe('Visakhapatnam');
  });

  it('does not collapse unrelated cities into each other', () => {
    expect(sameCity('Delhi', 'Mumbai')).toBe(false);
    expect(sameCity('Faridabad', 'Hyderabad')).toBe(false);
    expect(sameCity('Delhi', 'Chandigarh')).toBe(false);
  });

  it('still refuses an empty or unserved city', () => {
    expect(sameCity('', 'Delhi')).toBe(false);
    expect(sameCity('Delhi', null)).toBe(false);
    expect(canonicalCity('Dubai')).toBe('');
  });
});
