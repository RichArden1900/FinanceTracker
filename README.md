# Ledger — Personal Finance Tracker

A local-first expense tracker: log expenses, filter/visualize by day, week,
month, year, or custom range, and track monthly + yearly budget caps for
whichever categories you mark as budgeted.

## Requirements

- Node.js **20.19+ or 22.12+** (required by Vite 5). Check with `node -v`.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## Push it to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

`node_modules/` and `dist/` are already excluded via `.gitignore` — don't
commit those; anyone cloning the repo regenerates them with `npm install`
and `npm run build`.

## Deploying so it's actually live somewhere

Uploading to GitHub does **not** make the app accessible at a URL by itself
— that just stores the source. To get a working link, pick one:

- **Vercel or Netlify (least friction).** Import the GitHub repo, both
  auto-detect Vite (`npm run build`, output dir `dist`). No config needed.
- **GitHub Pages (free, but one extra step).** You must set `base` in
  `vite.config.js` to `/<repo-name>/` (already stubbed in as a commented-out
  line) — otherwise the deployed site loads a blank white page, because the
  built HTML requests assets from the domain root instead of the repo
  subpath. Then run `npm run build` and publish the `dist/` folder via
  GitHub Pages (either the `gh-pages` branch method or a GitHub Actions
  workflow — Pages' own docs cover both; not reproducing exact steps here
  since Pages' setup UI changes and I haven't verified it against the
  current interface).

## Data storage — read this before you rely on it

This app stores everything in the browser's `localStorage` (see
`src/lib/storage.js`). That means:

- Data lives in **one browser, on one device.** No account, no sync, no
  backend.
- Clearing site data/browser storage, or opening the app in a different
  browser or in incognito, means starting from zero.
- There's no backup. If you want this to survive a wiped browser profile,
  that's a real gap, not a hypothetical one — add an export/import (JSON)
  feature or swap in a real backend before trusting it with months of data.

## Dependency choices — why not "latest"

I deliberately did not pin the newest available major version of two
packages, because I can't run this build in my current environment to
verify compatibility, and a stale-but-known-working version is a safer
default than an untested new major:

- **recharts** is pinned to `^2.15.0`. Recharts is currently on a `3.x`
  major (v3.9 as of this writing) with real API changes (e.g. deprecation
  of `Pie`'s `activeShape`/`inactiveShape`). The chart code here uses only
  long-stable props (`BarChart`, `PieChart`, `XAxis`, `Tooltip`, etc.), so v3
  would likely work — "likely" being the operative word I'm not willing to
  ship on for you sight-unseen.
- **lucide-react** is pinned to `^0.383.0`. Lucide just shipped a `1.0`
  major (removing brand icons, restructuring internals) days before this
  was written. The icons used here (`Plus`, `Trash2`, `ChevronLeft`, etc.)
  are generic, not brand icons, so they're unlikely to be affected — but
  again, unverified against v1.
- **Vite** is pinned to `^5.4.0`, not the newly-released Vite 8 (which
  replaced its bundler internals with Rolldown). Vite 5 is the
  long-battle-tested version this exact `vite + @vitejs/plugin-react`
  combination has been running on for a long time.

If you want to live on the current majors instead, bump the versions in
`package.json` and run `npm install` — just budget time to actually test the
app afterward, since I haven't.
