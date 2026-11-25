// Rink definitions. `id` is what the website filters on.
// Order here is the order the rink chips appear in the app (roughly north to south).
export const RINKS = [
  { id: "ev-cir",  name: "Everett Community Ice Rink", short: "Everett CIR",  city: "Everett",           color: "#e8833a",
    book: "https://schedule.bondsports.co/schedule/everett-community-ice-rink?layout=list" },
  { id: "ev-aotw", name: "Angel of the Winds Arena",   short: "AOTW Main",    city: "Everett",           color: "#d4534a",
    book: "https://schedule.bondsports.co/schedule/everett-community-ice-rink?layout=list" },
  { id: "lic",     name: "Lynnwood Ice Center",        short: "Lynnwood",     city: "Lynnwood",          color: "#7b6cf6",
    book: "https://fareharbor.com/embeds/book/lynnwoodicecenter/?full-items=yes" },
  { id: "ova",     name: "Olympic View Arena",         short: "Olympic View", city: "Mountlake Terrace", color: "#3f8ef5",
    book: "https://fareharbor.com/embeds/book/olympicviewarena/?full-items=yes" },
  { id: "kci",     name: "Kraken Community Iceplex",   short: "KCI",          city: "Seattle",           color: "#16b3b0",
    book: "https://apps.daysmartrecreation.com/dash/x/#/online/kraken/event-registration?facility_ids=1&sport_ids=20" },
  { id: "sk-kirk", name: "Sno-King Kirkland",          short: "SK Kirkland",  city: "Kirkland",          color: "#4fb35a",
    book: "https://apps.daysmartrecreation.com/dash/x/#/online/snoking/event-registration?facility_ids=1&sport_ids=20" },
  { id: "sk-rent", name: "Sno-King Renton",            short: "SK Renton",    city: "Renton",            color: "#9ab83a",
    book: "https://apps.daysmartrecreation.com/dash/x/#/online/snoking/event-registration?facility_ids=2&sport_ids=20" },
  { id: "sk-snoq", name: "Sno-King Snoqualmie",        short: "SK Snoqualmie",city: "Snoqualmie",        color: "#c9a227",
    book: "https://apps.daysmartrecreation.com/dash/x/#/online/snoking/event-registration?facility_ids=3&sport_ids=20" },
];

// DaySmart (Dash) companies. facilityToRink maps DaySmart facility_id -> rink id.
// Facilities not listed are ignored (e.g. Kraken's adult-league facility).
export const DAYSMART = [
  { company: "kraken",  facilityToRink: { 1: "kci" } },
  { company: "snoking", facilityToRink: { 1: "sk-kirk", 2: "sk-rent", 3: "sk-snoq" } },
];

// FareHarbor companies. Any bookable item whose name looks like stick & puck is scanned,
// so new items (e.g. "Stick and Puck OVA Drop In") are picked up automatically.
// rinkFor(itemName) decides which rink an item belongs to.
export const FAREHARBOR = [
  { company: "lynnwoodicecenter", rinkFor: (n) => (/\bOVA\b|olympic/i.test(n) ? "ova" : "lic") },
  { company: "olympicviewarena",  rinkFor: () => "ova" },
];

// Bond Sports public schedules. spaceToRink maps the schedule's "space" name -> rink id.
export const BOND = [
  { slug: "everett-community-ice-rink",
    spaceToRink: { "Community Rink": "ev-cir", "Main Rink": "ev-aotw" } },
];

export const DAYS_AHEAD = 28;
