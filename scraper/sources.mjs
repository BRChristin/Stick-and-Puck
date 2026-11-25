// Fetchers for each booking platform. Uses only the global fetch(), so it runs in
// Node 18+ (GitHub Actions) and in a browser console for debugging.

export const STICK_RE = /stick\s*(?:&|and|n|'n'?|-n-|\+)\s*puck/i;
const EXCLUDE_RE = /punch|gift|card|pass\b|membership/i;
const UA = "Mozilla/5.0 (StickAndPuckFinder; +https://github.com) AppleWebKit/537.36 Chrome/124 Safari/537.36";

// ---------- helpers ----------
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function pacificToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
const hm = (s) => s.slice(0, 5); // "06:00:00" -> "06:00"

export function tagsFor(title) {
  const t = title.toLowerCase();
  const tags = [];
  if (/family|parent/.test(t)) tags.push("Family");
  if (/female|women|girls|non-binary|wgh/.test(t)) tags.push("Women & girls");
  if (/youth|kids|\b1[0-4]u\b|under|& under|junior/.test(t)) tags.push("Youth");
  if (/adult|18\+|\b18 ?and ?over/.test(t)) tags.push("Adult");
  if (/goalie/.test(t)) tags.push("Goalies");
  if (/half/.test(t)) tags.push("Half ice");
  return tags;
}

// DaySmart is a JSON:API server and answers 406 to a plain "application/json" Accept header.
async function getJSON(url, accept = "application/vnd.api+json, application/json") {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: accept, "User-Agent": UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 3) throw new Error(`${url} -> ${e.message}`);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

// ---------- DaySmart / Dash (Kraken Community Iceplex, Sno-King) ----------
// Public JSON:API used by the Dash web app. Event summaries carry registered_count,
// composite_capacity and open_slots.
export async function fetchDaySmart({ company, facilityToRink }, from, to) {
  const out = [];
  let page = 1, last = 1;
  do {
    const q = new URLSearchParams({
      "cache[save]": "false",
      "page[size]": "100",
      "page[number]": String(page),
      sort: "start",
      include: "summary,resource",
      "filter[start_date__gte]": from,
      "filter[start_date__lte]": to,
      "filter[unconstrained]": "1",
      "filter[homeTeam.sport_id__in]": "20", // Hockey
      company,
    });
    const j = await getJSON(`https://api.daysmartrecreation.com/v1/events?${q}`);
    last = j.meta?.page?.["last-page"] ?? 1;
    const inc = {};
    for (const i of j.included || []) inc[`${i.type}:${i.id}`] = i;
    for (const e of j.data || []) {
      const a = e.attributes;
      const s = inc[`event-summaries:${e.id}`]?.attributes || {};
      const r = inc[`resources:${a.resource_id}`]?.attributes || {};
      const title = (s.name || a.desc || "").trim();
      if (!STICK_RE.test(`${title} ${s.event_type || ""}`) || EXCLUDE_RE.test(title)) continue;
      const rink = facilityToRink[r.facility_id];
      if (!rink || a.publish === false) continue;
      const date = a.start.slice(0, 10);
      out.push({
        id: `ds-${company}-${e.id}`,
        rink,
        title,
        sheet: (r.name || "").trim(),
        date,
        start: a.start.slice(11, 16),
        end: a.end.slice(11, 16),
        registered: s.registered_count ?? null,
        capacity: s.composite_capacity || a.register_capacity || null,
        status: s.registration_status || null, // "open", "closed", ...
        url: `https://apps.daysmartrecreation.com/dash/x/#/online/${company}/event-registration?date=${date}&facility_ids=${r.facility_id}&sport_ids=20`,
        source: "daysmart",
        live: { company, eventId: e.id },
        tags: tagsFor(title),
      });
    }
    page++;
  } while (page <= last && page <= 30);
  return out;
}

// ---------- FareHarbor (Lynnwood Ice Center, Olympic View Arena) ----------
// Embed API used by FareHarbor's booking widget. Gives times; capacity is usually hidden.
export async function fetchFareHarbor({ company, rinkFor }, from, to) {
  const items = (await getJSON(`https://fareharbor.com/api/v1/companies/${company}/items/`)).items || [];
  const stickItems = items.filter((i) => STICK_RE.test(i.name) && !EXCLUDE_RE.test(i.name));
  const out = [];
  for (const item of stickItems) {
    const b = await getJSON(
      `https://fareharbor.com/api/embed/${company}/bookability/v1/?start_date=${from}&end_date=${to}&item_pks=${item.pk}&allow_unlisted_items=yes`
    );
    for (const day of b.availabilities || []) {
      const a = await getJSON(
        `https://fareharbor.com/api/embed/${company}/availabilities-at-date/v1/?date=${day.date}&item_pks=${item.pk}&allow_unlisted_items=yes`
      );
      for (const av of a.availabilities || []) {
        const [y, m] = av.start_at.slice(0, 7).split("-");
        out.push({
          id: `fh-${company}-${av.id}`,
          rink: rinkFor(item.name),
          title: item.name,
          sheet: "",
          date: av.start_at.slice(0, 10),
          start: av.start_at.slice(11, 16),
          end: av.end_at.slice(11, 16),
          registered: null,
          capacity: null,
          spotsLeft: av.remaining_capacity ?? null,
          status: av.status === "bookable" ? "open" : av.status,
          url: `https://fareharbor.com/embeds/book/${company}/items/${item.pk}/calendar/${y}/${m}/?full-items=yes`,
          source: "fareharbor",
          tags: tagsFor(item.name),
        });
      }
    }
  }
  return out;
}

// ---------- Bond Sports public schedule (Everett Community Ice + Angel of the Winds) ----------
// The schedule page is server rendered; its embedded data holds every slot for ~2 months.
export function parseBond(html, spaceToRink, from, to, slug) {
  const txt = html
    .split('\\"').join('"')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const re = /"title":"([^"]*)","slotType":"(\w+)"[^{}]*?"startDate":"(\d{4}-\d{2}-\d{2})T[^"]*","startTime":"([\d:]+)","endDate":"[^"]*","endTime":"([\d:]+)"[^{}]*?"space":\{"id":(\d+),"name":"([^"]*)"/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(txt))) {
    const [, rawTitle, slotType, date, st, et, , space] = m;
    if (slotType === "maintenance" || !STICK_RE.test(rawTitle) || EXCLUDE_RE.test(rawTitle)) continue;
    if (date < from || date > to) continue;
    const rink = spaceToRink[space];
    if (!rink) continue;
    // Strip emoji and locker-room notes like "(LR 1 & 3)".
    const title = rawTitle.replace(/[^\p{L}\p{N}\s&'()+\-\/]/gu, "").replace(/\(\s*LR[^)]*\)/i, "").replace(/\s+/g, " ").trim() || "Stick & Puck";
    const key = `${rink}|${date}|${st}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      id: `bond-${key}`,
      rink,
      title,
      sheet: space,
      date,
      start: hm(st),
      end: hm(et),
      registered: null,
      capacity: null,
      status: "walkup",
      url: `https://schedule.bondsports.co/schedule/${slug}?layout=list`,
      source: "bond",
      tags: tagsFor(rawTitle),
    });
  }
  return [...seen.values()];
}

export async function fetchBond({ slug, spaceToRink }, from, to) {
  const r = await fetch(`https://schedule.bondsports.co/schedule/${slug}?layout=list`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!r.ok) throw new Error(`Bond ${slug} HTTP ${r.status}`);
  return parseBond(await r.text(), spaceToRink, from, to, slug);
}
