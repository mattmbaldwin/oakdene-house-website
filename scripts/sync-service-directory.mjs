// Rebuilds src/content/oakdene-service-directory.json from the HubEasy service directory, the single source for
// Oakdene's directory (decision 7 Nov 2026). HubEasy publishes a read-only feed of the services marked
// "Show on website", each under its organisation; this script reshapes it into the file the site already reads.
//
// Run by .github/workflows/sync-service-directory.yml every 30 minutes.
//
// Usage:
//   node scripts/sync-service-directory.mjs                 # reads the HubEasy feed (HUBEASY_FEED_URL, or the default below)
//   node scripts/sync-service-directory.mjs --from <file>   # reads a saved feed document instead (for testing)
//   add --check to report whether the file would change, without writing it
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../src/content/oakdene-service-directory.json', import.meta.url);
const FEED = process.env.HUBEASY_FEED_URL || 'https://oakdene.hubeasy.com.au/api/public-directory.php';

const args = process.argv.slice(2);
const fromFile = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const checkOnly = args.includes('--check');

async function feed() {
  if (fromFile) return JSON.parse(await readFile(fromFile, 'utf8'));
  const r = await fetch(FEED, { headers: { Accept: 'application/json', 'User-Agent': 'oakdene-website-directory-sync' } });
  if (!r.ok) throw new Error(`${r.status} from ${FEED}: ${(await r.text()).slice(0, 300)}`);
  const doc = await r.json();
  if (!doc || !Array.isArray(doc.organisations)) throw new Error('the feed did not return a directory document');
  return doc;
}

const blank = v => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) ? null : (typeof v === 'string' ? v.trim() : v);

function toService(org, svc) {
  // A service's own accounts win (Carer Gateway's page is not The Benevolent Society's); otherwise the organisation's.
  const own = svc.social && Object.keys(svc.social).length ? svc.social : (org.social || {});
  const social = {};
  for (const k of ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok']) if (blank(own[k])) social[k] = blank(own[k]);
  // A service with its own ABN is a local charity within a network (a Lifeline centre): its ABN and ACNC link win
  // as one set. HubEasy only sends a service's identifiers where they differ from its organisation's (stage s95).
  const svcId = svc.identifiers || {};
  const id = blank(svcId.abn) ? svcId : (org.identifiers || {});
  const c = svc.contact || {}, l = svc.location || {}, f = svc.flags || {};
  return {
    serviceName: blank(svc.name),
    organisation: blank(org.name),
    category: blank(svc.category),
    categoryGroup: blank(svc.categoryGroup),
    serviceType: blank(svc.serviceType),
    contact: { phone: blank(c.phone), email: blank(c.email), website: blank(c.website) },
    social,
    location: { suburb: blank(l.suburb), lga: blank(l.lga), coverage: blank(l.coverage) },
    identifiers: { abn: blank(id.abn), acncLink: blank(id.acncLink) },
    flags: { aod: !!f.aod, legal: !!f.legal },
    listedIn: blank(svc.listedIn)
  };
}

const sydneyDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);

function recount(list, keyOf, nameKey = 'name') {
  // Keep existing entries (and their descriptions) in order; refresh counts; append new values at the end.
  const counts = new Map();
  for (const k of keyOf) counts.set(k, (counts.get(k) || 0) + 1);
  const seen = new Set(list.map(x => x[nameKey]));
  const out = list.map(x => ({ ...x, count: counts.get(x[nameKey]) || 0 }));
  for (const [k, c] of counts) if (!seen.has(k)) out.push({ [nameKey]: k, count: c });
  return out;
}

async function main() {
  const doc0 = await feed();
  const all = doc0.organisations.flatMap(org => (org.services || []).map(svc => ({
    verified: svc.updatedAt ? sydneyDate(new Date(String(svc.updatedAt).replace(' ', 'T'))) : null, s: toService(org, svc) })));
  // The site groups and filters on these; a published service without them is reported, not shown.
  const incomplete = all.filter(r => !(r.s.serviceName && r.s.categoryGroup && r.s.category && r.s.serviceType && r.s.location.coverage));
  for (const r of incomplete) console.warn(`::warning::not shown (needs website group, category, type and coverage in HubEasy): ${r.s.serviceName}`);
  const rows = all.filter(r => !incomplete.includes(r));
  rows.sort((a, b) => a.s.serviceName.localeCompare(b.s.serviceName));
  const services = rows.map(r => r.s);
  if (services.length < 50) throw new Error(`refusing to publish only ${services.length} services (expected about 300): check the HubEasy feed`);

  const before = await readFile(FILE, 'utf8');
  const doc = JSON.parse(before);
  // Compare ignoring key order, and reuse the existing entry for every unchanged service so diffs show only real edits.
  const canon = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y))) : v);
  const pool = new Map();
  for (const o of doc.services) { const c = canon(o); if (!pool.has(c)) pool.set(c, []); pool.get(c).push(o); }
  for (let i = 0; i < services.length; i++) { const hit = pool.get(canon(services[i])); if (hit && hit.length) services[i] = hit.shift(); }
  const servicesChanged = JSON.stringify(doc.services) !== JSON.stringify(services);

  // Category groups: keep the group order, refresh counts and the categories mapped into each group.
  doc.categoryGroups = doc.categoryGroups.map(g => {
    const mine = services.filter(s => s.categoryGroup === g.name);
    const extra = [...new Set(mine.map(s => s.category))].filter(c => !g.mappedCategories.includes(c)).sort((a, b) => a.localeCompare(b));
    return { ...g, mappedCategories: [...g.mappedCategories, ...extra], count: mine.length };
  });
  for (const name of new Set(services.map(s => s.categoryGroup))) if (!doc.categoryGroups.some(g => g.name === name)) {
    const mine = services.filter(s => s.categoryGroup === name);
    doc.categoryGroups.push({ name, mappedCategories: [...new Set(mine.map(s => s.category))].sort(), count: mine.length });
  }
  doc.coverageTiers = recount(doc.coverageTiers, services.map(s => s.location.coverage));
  doc.lgaTiers = recount(doc.lgaTiers, services.map(s => s.location.lga ?? '<empty>'));

  const latestVerified = rows.map(r => r.verified).filter(Boolean).sort().pop();
  doc.meta = { ...doc.meta, totalServices: services.length,
    lastVerified: [doc.meta.lastVerified, latestVerified].filter(Boolean).sort().pop() };
  if (servicesChanged) Object.assign(doc.meta, { generatedAt: sydneyDate(), source: 'HubEasy service directory, synced automatically' });
  doc.services = services;

  const after = JSON.stringify(doc, null, 2);
  if (after === before) { console.log(`No change: ${services.length} services already match the list.`); return; }
  const changed = servicesChanged ? `${services.length} services` : 'counts only (services unchanged)';
  if (checkOnly) { console.log(`Would update: ${changed}.`); process.exitCode = 2; return; }
  await writeFile(FILE, after);
  console.log(`Updated ${FILE.pathname}: ${changed}.`);
}

main().catch(e => { console.error('Sync failed:', e.message); process.exit(1); });
