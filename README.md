# AMCRO INDIA WMS — Worker Management System

A real, standalone, mobile-and-desktop-optimized website for daily wage tracking across your sites, backed directly by Google Sheets.

## Status
- Apps Script deployed and live: `https://script.google.com/macros/s/AKfycbwdyoaLKPnDvu64okpbbooRDCIBBk_xqKVmAuE6-cD-oAaaXfPyokb2RSGpGGnF3UPRhg/exec`
- Sheet columns confirmed: `Site | Date | Worker Name | Site Name | Work Type | Wage | Payment Status`
- Website code complete and wired to that URL — ready to deploy to Vercel

## What's in this folder
- `src/App.jsx` — the entire application (UI + logic), responsive for phone and laptop
- `src/main.jsx`, `index.html`, `vite.config.js`, `package.json` — standard Vite project scaffolding
- `apps-script/Code.gs` — reference copy of the script that should be in your Sheet's Apps Script editor (already pasted in if you followed the last setup step)

## Deploy to Vercel (free)
1. Go to **github.com → New repository** → name it `amcro-wage-tracker` → Create
2. On the repo page, click **uploading an existing file**, drag in everything from this folder (keep `src/` as a folder)
3. Commit
4. Go to **vercel.com** → sign up free (GitHub login is easiest) → **Add New → Project → Import** your `amcro-wage-tracker` repo
5. Vercel auto-detects the Vite project → click **Deploy**
6. In about a minute you'll get a live link like `amcro-wage-tracker.vercel.app`

Share that link with supervisors — bookmark it on their phones.

## How it works
- **Supervisor flow**: pick site, enter the 4-digit site passcode, add/edit worker rows for the day (name, wage, site name, work type, paid/unpaid), then Save. Every save writes directly to your Google Sheet, replacing any existing rows for that site+date so re-saving never creates duplicates.
- **Owner flow**: enter the 6-digit admin passcode to reach a dashboard that reads live from the Sheet — totals, pending payments, per-worker summaries, and day-by-day entries you can tap into and toggle Paid/Unpaid directly (also writes straight back to the Sheet), plus a CSV export button.

## Passcodes
- Grand Omaxe Site: `1828`
- Meridian Site: `3128`
- Admin: `810128`

To change these, edit the `SITES` array and `ADMIN_PASSCODE` constant near the top of `src/App.jsx`.

## Sheet columns (do not reorder — the script depends on this exact order)
```
A: Site | B: Date | C: Worker Name | D: Site Name | E: Work Type | F: Wage | G: Payment Status
```

## Supervisor Attendance (new section)
This is a **separate feature with its own Google Sheet and its own Apps Script deployment** — it does not touch your wage-tracking Sheet at all.

### What it does
- Any supervisor opens the "Supervisor Attendance" card on the home screen.
- Enters their **Name** and **Site Name**.
- **Morning:** taps to click a photo of the site, then taps **Mark On Duty**. The current time is captured automatically.
- **Evening:** comes back, enters the same name + site, clicks a photo of the work done, then taps **Mark Off Duty**. Time captured automatically again.
- Everything writes straight to a new Google Sheet tab called `Attendance`, with columns:
  ```
  A: Name | B: Site Name | C: On Duty Timing | D: Picture at Start (PAS) | E: Off Duty Timing | F: Picture at End (PAE) | G: Date
  ```
  (Column G is a helper column the script uses to match a person's morning row to their evening row each day — you can ignore or hide it.)
- Photos are uploaded to a Drive folder called **"AMCRO Attendance Photos"** and the Sheet cell gets a clickable link to open the photo — Sheets can't store real embedded images from a script, so a link is the standard, reliable approach.
- The app checks the Sheet before showing buttons, so a supervisor can't mark On Duty twice or mark Off Duty before On Duty.

### One-time setup (you do this once)
1. Go to sheets.google.com → create a **brand new blank Sheet** (e.g. "AMCRO Attendance"). Don't reuse your wage-tracking sheet.
2. In that new Sheet: **Extensions → Apps Script**.
3. Delete any placeholder code, then paste in the entire contents of `apps-script/AttendanceCode.gs` from this folder.
4. **Deploy → New deployment** → gear icon → type: **Web app** → Execute as **Me** → Who has access: **Anyone** → **Deploy** → approve the Google authorization prompts.
5. Copy the Web app URL shown (ends in `/exec`).
6. In `src/App.jsx`, find:
   ```js
   const ATTENDANCE_WEBHOOK_URL = "PASTE_YOUR_ATTENDANCE_WEBAPP_URL_HERE";
   ```
   Replace the placeholder with your URL, keeping the quotes.
7. Push the updated files to GitHub — Vercel auto-redeploys.

You don't need to manually create the `Attendance` tab or the Drive photo folder — the script creates both automatically on first use.

### If a supervisor sees "Attendance sheet isn't connected yet"
Step 6 above hasn't been done — the placeholder URL is still in the code.

## Making future changes
Since this is now a real deployed site, not a live-editable Claude artifact:
1. Tell me what to change
2. I update `src/App.jsx` (or the script) and hand you the new file
3. Replace it in your GitHub repo — Vercel auto-redeploys within about a minute

## If something doesn't sync
Open the site, try a save, and read the toast message at the bottom — it shows the real error from Google if something fails, not a false "success." Common fixes:
- "Failed to fetch" — the Apps Script deployment may have been edited without redeploying; go to Apps Script → Deploy → Manage deployments and confirm the latest code is the active version
- Unexpected data errors — confirm your Sheet still has exactly the 7 columns listed above, in that order, with the header row intact
