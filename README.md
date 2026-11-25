# Stick & Puck Finder

One page that lists every stick and puck session at these rinks, day by day:

| Rink | Booking system | What you see |
|---|---|---|
| Kraken Community Iceplex | DaySmart (Dash) | Times + **signed up / capacity** (live) |
| Sno-King Kirkland, Renton, Snoqualmie | DaySmart (Dash) | Times + **signed up / capacity** (live) |
| Lynnwood Ice Center | FareHarbor | Times (headcount not published) |
| Olympic View Arena | FareHarbor | Times (headcount not published) |
| Everett Community Ice Rink + Angel of the Winds main rink | Bond Sports | Times (walk-up, pay at desk) |

It costs nothing to run. GitHub Actions pulls every rink every 30 minutes and publishes the
page on GitHub Pages. When you open the page, the DaySmart signup counts also refresh live.

## How it works

```
GitHub Actions (every 30 min, free)
  └─ scraper/fetch-sessions.mjs  → pulls DaySmart, FareHarbor, Bond → site/sessions.json
GitHub Pages (free hosting)
  └─ site/index.html             → reads sessions.json, day picker, rink filters
```

* If one rink's site is down during a run, the last good copy of that rink is kept and marked
  "May be outdated" so the page never goes blank.
* GitHub pauses scheduled jobs after 60 days with no commits; the workflow re-enables itself each run.

## Setup (about 10 minutes, one time)

1. **Make a free GitHub account** at github.com if you don't have one.
2. **Create a repository**: click **+ → New repository**, name it `stick-and-puck`, choose **Public**
   (free Pages needs public), tick **Add a README**, and click **Create repository**.
3. **Upload the files**: unzip `stick-and-puck.zip`, then on the repo page click **Add file → Upload files**
   and drag in everything from the unzipped folder (`scraper`, `site`, `README.md`). Commit.
   * The workflow lives in a hidden `.github` folder that drag-and-drop often skips. Add it by hand:
     **Add file → Create new file**, type the name `.github/workflows/update.yml`, paste the contents of
     that file from the zip, and commit.
4. **Turn on Pages**: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. **Run it once**: **Actions** tab → **Update stick & puck schedules** → **Run workflow**. It takes about a minute.
6. **Open your site**: `https://<your-github-username>.github.io/stick-and-puck/`
7. **On your phone**: open that link in Safari, tap **Share → Add to Home Screen**. It opens like an app.

## Using it

* Tap a day in the strip, or swipe left/right on the list. Swipe through ~4 weeks ahead.
* Rink chips under the time filter toggle rinks on and off; the filter button has the full list
  and a "Hide full sessions" switch. Choices are saved on that device.
* Tap a session to open that rink's booking page for that day.
* Each day's count in the strip is the number of upcoming sessions after your filters.

## Changing things

* **Add or rename a rink, change colors**: `scraper/rinks.mjs`.
* **Look further ahead**: `DAYS_AHEAD` in `scraper/rinks.mjs` (default 28).
* **Run more or less often**: the `cron` line in `.github/workflows/update.yml`.
* **Test the scraper offline**: `node scraper/test.mjs`. **Run it for real**: `node scraper/fetch-sessions.mjs site/sessions.json` (Node 18+).

## Known limits

* Lynnwood and Olympic View only open online booking a few days out, so those rinks show up
  closer to the date. Olympic View had no stick and puck listed when this was built (Nov 2026).
* Everett's sessions are walk-up only, so there is no headcount to show.
* These are the rinks' own public booking feeds, not official APIs. If a rink changes systems,
  that rink's section in `scraper/sources.mjs` needs an update. The page footer warns you when a source fails.
