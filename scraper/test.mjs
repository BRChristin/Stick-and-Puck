// Offline test: feeds the scraper responses shaped like the real APIs (captured 2026-11-25).
// Run: node scraper/test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBond, STICK_RE, tagsFor } from "./sources.mjs";

// --- regex + tags ---
for (const t of ["Stick & Puck", "Stick N Puck ", "Stick and Puck LIC Drop In", "Family Stick & Puck", "stick-n-puck"]) assert.ok(STICK_RE.test(t), t);
for (const t of ["Glow Sticks vs Orcas", "Dumb Pucks vs Blades", "Seal Team Sticks vs Spittin' Llamas"]) assert.ok(!STICK_RE.test(t), t);
assert.deepEqual(tagsFor("Family Stick & Puck"), ["Family"]);
assert.deepEqual(tagsFor("Youth Stick & Puck (13U)"), ["Youth"]);

// --- Bond parsing on a fragment in the real escaped RSC format ---
const q = '\\"';
const slot = (title, date, st, et, space, type = "internal") =>
  `{${q}id${q}:1,${q}title${q}:${q}${title}${q},${q}slotType${q}:${q}${type}${q},${q}paymentStatus${q}:${q}purchase_order${q},${q}startDate${q}:${q}${date}T00:00:00.000Z${q},${q}startTime${q}:${q}${st}${q},${q}endDate${q}:${q}${date}T00:00:00.000Z${q},${q}endTime${q}:${q}${et}${q},${q}timezone${q}:${q}America/Los_Angeles${q},${q}spaceId${q}:5005,${q}instructorsIds${q}:[],${q}colorCodeId${q}:1,${q}space${q}:{${q}id${q}:5005,${q}name${q}:${q}${space}${q}}}`;
const html = `<script>self.__next_f.push([1,"[${[
  slot("🥅 Stick \\u0026 Puck (LR 1 \\u0026 3)", "2026-11-25", "06:00:00", "08:00:00", "Community Rink"),
  slot("🥅 Stick \\u0026 Puck (LR 1 \\u0026 3)", "2026-11-25", "06:00:00", "08:00:00", "Community Rink"), // duplicate
  slot("Stick \\u0026 Puck", "2026-11-30", "15:45:00", "17:45:00", "Main Rink"),
  slot("Ice Cut", "2026-11-25", "08:00:00", "08:15:00", "Community Rink", "maintenance"),
  slot("Public Skate", "2026-11-25", "12:00:00", "14:00:00", "Community Rink"),
].join(",")}]"])</script>`;
const bond = parseBond(html, { "Community Rink": "ev-cir", "Main Rink": "ev-aotw" }, "2026-11-25", "2026-12-20", "x");
assert.equal(bond.length, 2);
assert.equal(bond[0].title, "Stick & Puck");
assert.equal(bond[0].start, "06:00");
assert.equal(bond[1].rink, "ev-aotw");

// --- full run with mocked fetch ---
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const dsPage = (company) => ({
  meta: { page: { "last-page": 1 } },
  data: [
    { id: "1", type: "events", attributes: { start: `${today}T07:15:00`, end: `${today}T08:15:00`, resource_id: 7, register_capacity: 34, publish: true, desc: "" } },
    { id: "2", type: "events", attributes: { start: `${today}T17:10:00`, end: `${today}T18:20:00`, resource_id: 7, publish: true, desc: "" } },
  ],
  included: [
    { type: "event-summaries", id: "1", attributes: { name: "Stick & Puck", event_type: "Camp", registered_count: 12, composite_capacity: 34, registration_status: "open" } },
    { type: "event-summaries", id: "2", attributes: { name: "Glow Sticks vs Orcas", event_type: "Game", registered_count: 0, composite_capacity: 25 } },
    { type: "resources", id: "7", attributes: { name: "Starbucks Rink 1", facility_id: 1 } },
  ],
});
const routes = [
  [/daysmartrecreation.*company=kraken/, () => dsPage("kraken")],
  [/daysmartrecreation.*company=snoking/, () => { throw new Error("HTTP 503"); }], // simulate outage
  [/companies\/lynnwoodicecenter\/items\/$/, () => ({ items: [{ pk: 245296, name: "Stick and Puck LIC Drop In" }, { pk: 246111, name: "Stick and Puck Punch Card" }, { pk: 245312, name: "Public Skate" }] })],
  [/companies\/olympicviewarena\/items\/$/, () => ({ items: [{ pk: 313860, name: "Stick and Puck" }] })],
  [/lynnwoodicecenter\/bookability.*item_pks=245296/, () => ({ availabilities: [{ date: today, status: "bookable" }] })],
  [/olympicviewarena\/bookability/, () => ({ availabilities: [] })],
  [/lynnwoodicecenter\/availabilities-at-date/, () => ({ availabilities: [{ id: -61846227, start_at: `${today}T09:15:00`, end_at: `${today}T11:15:00`, remaining_capacity: null, status: "bookable" }] })],
  [/bondsports/, () => html.replaceAll("2026-11-25", today).replaceAll("2026-11-30", today)],
  [/previous\.json/, () => ({ sessions: [{ id: "ds-snoking-9", rink: "sk-rent", date: today, start: "10:00", end: "11:00" }] })],
];
const dir = mkdtempSync(join(tmpdir(), "snp-"));
writeFileSync(join(dir, "mock.mjs"), `
const routes = ${"["}${routes.map(([re, fn]) => `[${re}, ${fn.toString()}]`).join(",")}];
const today = ${JSON.stringify(today)};
const html = ${JSON.stringify(html)};
const dsPage = ${dsPage.toString()};
globalThis.fetch = async (url) => {
  for (const [re, fn] of routes) if (re.test(url)) {
    let body; try { body = fn(); } catch (e) { return { ok: false, status: 503, json: async () => ({}), text: async () => "" }; }
    return { ok: true, status: 200, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
  }
  throw new Error("unmocked " + url);
};`);
const out = join(dir, "sessions.json");
let stderr = "";
try {
  execFileSync(process.execPath, ["--import", join(dir, "mock.mjs"), new URL("./fetch-sessions.mjs", import.meta.url).pathname, out],
    { env: { ...process.env, PREVIOUS_URL: "https://example.test/previous.json" }, stdio: ["ignore", "pipe", "pipe"] });
} catch (e) { stderr = String(e.stderr); throw new Error(stderr); }
const d = JSON.parse(readFileSync(out, "utf8"));
const ids = d.sessions.map((s) => s.id);
assert.ok(ids.includes("ds-kraken-1"), "kraken stick & puck");
assert.ok(!ids.includes("ds-kraken-2"), "games excluded");
assert.ok(ids.some((i) => i.startsWith("fh-lynnwoodicecenter-")), "lynnwood");
assert.equal(d.sessions.filter((s) => s.rink === "ev-cir").length, 1);
const carried = d.sessions.find((s) => s.id === "ds-snoking-9");
assert.ok(carried && carried.stale, "failed source carried over from previous run");
assert.equal(d.sources.find((s) => s.name === "DaySmart snoking").ok, false);
const k = d.sessions.find((s) => s.id === "ds-kraken-1");
assert.equal(k.registered, 12); assert.equal(k.capacity, 34); assert.equal(k.sheet, "Starbucks Rink 1");
assert.deepEqual(d.sessions.map((s) => s.start), [...d.sessions.map((s) => s.start)].sort());
console.log(`All tests passed (${d.sessions.length} sessions in mocked run).`);
