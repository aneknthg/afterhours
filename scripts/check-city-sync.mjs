#!/usr/bin/env node
/**
 * check-city-sync.mjs — fail if the two city maps have drifted apart.
 *
 * src/lib/city.js here and lib/city.ts in Afterhours-App-main have to agree.
 * sameCity() is exact-match on the canonical name, so a city that is aliased in
 * one repo and standalone in the other splits its members by platform: the same
 * woman is in Delhi on her phone and in Noida on the web, and neither surface
 * shows her the other's events. Both files carry a "keep in sync" comment,
 * which is honour-system and has no teeth.
 *
 * Compares meaning, not bytes: it reads CITIES, POPULAR_CITIES and ALIASES out
 * of each file's source text, so the .js and the .ts are comparable and
 * formatting, ordering and comments are free to differ.
 *
 * Usage:
 *   node scripts/check-city-sync.mjs <path-to-app-city.ts>
 *   node scripts/check-city-sync.mjs            # tries ../Afterhours-App-main
 *
 * Exit 0 in sync, 1 drifted, 2 could not read or parse a file.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_CITY = resolve(HERE, '../src/lib/city.js');
const DEFAULT_APP_CITY = resolve(HERE, '../../Afterhours-App-main/lib/city.ts');

/** Every single-quoted or double-quoted string inside a named array literal. */
function parseArray(src, name, file) {
  const m = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\]`).exec(src);
  if (!m) fail(`could not find ${name} in ${file}`);
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

/** Every `key: 'value'` pair inside a named object literal, keys unquoted. */
function parseMap(src, name, file) {
  const m = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (!m) fail(`could not find ${name} in ${file}`);
  const body = m[1].replace(/\/\/[^\n]*/g, ''); // comments may contain colons
  const out = {};
  for (const [, rawKey, value] of body.matchAll(/(?:^|,)\s*(['"][^'"]+['"]|[A-Za-z0-9_$]+)\s*:\s*['"]([^'"]+)['"]/g)) {
    out[rawKey.replace(/^['"]|['"]$/g, '')] = value;
  }
  if (!Object.keys(out).length) fail(`parsed ${name} in ${file} but found no entries`);
  return out;
}

function fail(msg) {
  console.error(`city-sync: ${msg}`);
  process.exit(2);
}

const appCity = resolve(process.argv[2] || DEFAULT_APP_CITY);
if (!existsSync(WEB_CITY)) fail(`missing ${WEB_CITY}`);
if (!existsSync(appCity)) {
  console.error(`city-sync: cannot see the app's city file at ${appCity}`);
  console.error('city-sync: pass its path as an argument, or clone Afterhours-App-main beside this repo.');
  process.exit(2);
}

const web = readFileSync(WEB_CITY, 'utf8');
const app = readFileSync(appCity, 'utf8');

const problems = [];

function compareList(name) {
  const a = parseArray(web, name, 'website');
  const b = parseArray(app, name, 'app');
  const onlyWeb = a.filter((x) => !b.includes(x));
  const onlyApp = b.filter((x) => !a.includes(x));
  if (onlyWeb.length) problems.push(`${name}: only in website — ${onlyWeb.join(', ')}`);
  if (onlyApp.length) problems.push(`${name}: only in app — ${onlyApp.join(', ')}`);
  return a.length;
}

function compareAliases() {
  const a = parseMap(web, 'ALIASES', 'website');
  const b = parseMap(app, 'ALIASES', 'app');
  for (const k of Object.keys(a)) {
    if (!(k in b)) problems.push(`ALIASES: "${k}" only in website`);
    else if (a[k] !== b[k]) problems.push(`ALIASES: "${k}" -> "${a[k]}" in website but "${b[k]}" in app`);
  }
  for (const k of Object.keys(b)) {
    if (!(k in a)) problems.push(`ALIASES: "${k}" only in app`);
  }
  return Object.keys(a).length;
}

// An alias pointing at a city nobody serves resolves to '' and scopes to no
// events, which is the same silent empty app the sync check exists to prevent.
function checkAliasTargets() {
  const cities = parseArray(web, 'CITIES', 'website').map((c) => c.toLowerCase());
  const aliases = parseMap(web, 'ALIASES', 'website');
  for (const [from, to] of Object.entries(aliases)) {
    if (!cities.includes(to.toLowerCase())) {
      problems.push(`ALIASES: "${from}" points at "${to}", which is not in CITIES`);
    }
    if (cities.includes(from.toLowerCase())) {
      problems.push(`ALIASES: "${from}" is aliased but is also still in CITIES`);
    }
  }
}

const cityCount = compareList('CITIES');
compareList('POPULAR_CITIES');
const aliasCount = compareAliases();
checkAliasTargets();

if (problems.length) {
  console.error('city-sync: the two city maps have drifted.\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nBoth files must carry the same CITIES, POPULAR_CITIES and ALIASES.');
  console.error(`  website: ${WEB_CITY}`);
  console.error(`  app:     ${appCity}`);
  process.exit(1);
}

console.log(`city-sync: in sync — ${cityCount} cities, ${aliasCount} aliases, all alias targets served.`);
