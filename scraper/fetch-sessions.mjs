#!/usr/bin/env node
// Pulls stick & puck sessions from every rink and writes site/sessions.json.
// Usage: node scraper/fetch-sessions.mjs [outputPath]
// Optional env PREVIOUS_URL: the live sessions.json. If a source fails this run,
// its sessions are carried over from there so one flaky site never blanks the app.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { RINKS, DAYSMART, FAREHARBOR, BOND, DAYS_AHEAD } from "./rinks.mjs";
import { fetchDaySmart, fetchFareHarbor, fetchBond, pacificToday, addDays } from "./sources.mjs";

const outPath = process.argv[2] || "site/sessions.json";
const from = pacificToday();
const to = addDays(from, DAYS_AHEAD);

const jobs = [
  ...DAYSMART.map((c) => ({ name: `DaySmart ${c.company}`, rinks: Object.values(c.facilityToRink), run: () => fetchDaySmart(c, from, to) })),
  ...FAREHARBOR.map((c) => ({ name: `FareHarbor ${c.company}`, rinks: null, company: c.company, run: () => fetchFareHarbor(c, from, to) })),
  ...BOND.map((c) => ({ name: `Bond ${c.slug}`, rinks: Object.values(c.spaceToRink), run: () => fetchBond(c, from, to) })),
];

let previous = null;
async function loadPrevious() {
  if (previous !== null || !process.env.PREVIOUS_URL) return previous;
  try {
    const r = await fetch(process.env.PREVIOUS_URL, { cache: "no-store" });
    previous = r.ok ? await r.json() : { sessions: [] };
  } catch { previous = { sessions: [] }; }
  return previous;
}

const results = await Promise.allSettled(jobs.map((j) => j.run()));
const sessions = [];
const sources = [];

for (let i = 0; i < jobs.length; i++) {
  const job = jobs[i], res = results[i];
  if (res.status === "fulfilled") {
    sessions.push(...res.value);
    sources.push({ name: job.name, ok: true, count: res.value.length });
    console.log(`✓ ${job.name}: ${res.value.length} sessions`);
  } else {
    const prev = await loadPrevious();
    const carried = (prev?.sessions || []).filter((s) =>
      s.date >= from &&
      (job.rinks ? job.rinks.includes(s.rink) : s.id.startsWith(`fh-${job.company}-`))
    ).map((s) => ({ ...s, stale: true }));
    sessions.push(...carried);
    sources.push({ name: job.name, ok: false, error: String(res.reason?.message || res.reason).slice(0, 300), carried: carried.length });
    console.error(`✗ ${job.name}: ${res.reason?.message || res.reason} (carried over ${carried.length})`);
  }
}

// De-duplicate and sort chronologically.
const byId = new Map(sessions.map((s) => [s.id, s]));
const sorted = [...byId.values()].sort((a, b) =>
  (a.date + a.start).localeCompare(b.date + b.start) || a.rink.localeCompare(b.rink));

const payload = {
  generatedAt: new Date().toISOString(),
  timezone: "America/Los_Angeles",
  from, to,
  rinks: RINKS,
  sources,
  sessions: sorted,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload));
console.log(`Wrote ${sorted.length} sessions (${from} → ${to}) to ${outPath}`);

if (sources.every((s) => !s.ok)) process.exit(1); // every source failed: fail the run so you get an email
