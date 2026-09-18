# trash2treasure

A phone app for flipping curbside finds. Snap a photo, price it, get it ready to post on Facebook
Marketplace, OfferUp, Craigslist, Nextdoor, Mercari, eBay or Poshmark, and track it all the way to
sold and how much you made.

**Live at https://mawklin.github.io/trash2treasure/** (repo `Mawklin/trash2treasure`, GitHub Pages from
`main` `/docs`). Renamed from Curbside on 2026-09-18; the old /curbside/ address no longer exists, and
she reinstalled from the new one. The internal names (IndexedDB `curbside`, the `curbside-theme` key,
cache names, the backup's `curbside.json` and `app: 'curbside'` marker, theme id `curbside`) and this
folder deliberately keep the old name: old backups still restore, and on the same site (mawklin.github.io)
the database name is what finds the saved data.

It's a plain web app (HTML/CSS/JS in `docs/`, no build step) that installs to the Home Screen and
works offline. **Everything is stored on the phone** (IndexedDB), so nobody else can see her
inventory and there's no server to pay for.

## What it does

- **Look**: deep purple with pink and lavender and white text, the same on every phone (she asked for no
  white panels). Every text colour is checked with `node tools/check-contrast.mjs`.
- **App theme** (Settings, first card): the original purple, a theme for each major American
  holiday (New Year's, MLK Day, Valentine's, Presidents' Day, St. Patrick's, Easter, Mother's Day,
  Memorial Day, Father's Day, Juneteenth, Fourth of July, Labor Day, Halloween, Veterans Day,
  Thanksgiving, Hanukkah, Christmas, Kwanzaa), or Automatic, which follows the calendar (Easter and
  Hanukkah dates are worked out each year). Each theme has its own gradient and emoji: next to the
  name, on the camera button, and faintly in the background. Colours are generated from a few key
  colours per theme by `node tools/make-themes.mjs` (writes `docs/themes.css`), and every theme is
  checked by `tools/check-contrast.mjs`.
- **Guided tours**: the first time she opens the app, and the first time she opens a find, the
  posting page, a site's steps or Money, the screen dims and each part is lit up in turn with a note
  on what it's for. Skip on the first tour turns them all off; Settings → Show the tour again brings
  them back. On iPhone in Safari the only step is "add it to your Home Screen", because the Home
  Screen app keeps separate data. Add `?notour` to the URL to keep tours out of the way when testing.
- **Add a find**: the camera button takes photos or picks from the library. Photos are shrunk to
  1600px JPEGs plus thumbnails as they're saved, so it stays fast.
- **Items**: statuses To list → Listed → Pending → Sold (or Kept/Gave away/Donated/Tossed), a
  to-do strip (pickups coming up, ready to post, needs details, listed too long, sold but still
  posted), search, and filters.
- **Post it**: tick every site she wants (last time's sites come pre-ticked), then a four-step kit
  per site: save the photos to the camera roll (iPhone share sheet → Save Images; downloads
  elsewhere), open the site's sell page, copy title / price / description one tap each, then "I
  posted it", which moves straight on to the next site. Photos are saved once per run. If the phone
  restarts the app mid-run, a "Carry on posting" card picks it back up. Descriptions get the size,
  her pickup area and footer on local sites (not the pickup lines on ship-only ones); Facebook's
  condition wording is spelled out.
- **Photo checklist** per item (front, sides, label, flaws, plus extras by category) and a **Size**
  box that's added to every description.
- **Reply to buyers**: one-tap copies of the usual answers (still available, pickup info, size &
  condition, lowest price, price is firm, confirm pickup, it's sold), filled in from the item.
- **Pickup reminders**: after marking pending with a time, "Add to calendar" offers Google Calendar
  (a link; works everywhere) or a .ics file with a 30-minute reminder. iPhone Home Screen apps can't
  reliably hand .ics files to Apple Calendar, which is why Google is the first option.
- **After posting**: "Mark pending" (buyer, pickup time, agreed price), "Sold it!" (price, site,
  fees), then a reminder to take it down from the other sites. Listings older than the reminder
  setting (14 days by default) get one-tap price drops or "I renewed it".
- **What's it worth?**: searches the title on eBay sold listings, Marketplace, OfferUp, Vinted and Google.
- **Write it for me** (optional AI): works out what the item is from the photos, writes the title and
  description, and suggests a price. Free either way:
  - no key: shares the photos + a prompt to ChatGPT (or any AI app); she pastes the answer back;
  - with a free Google AI Studio key: one tap, using Gemini's free tier straight from the phone.
- **Money**: profit this month / year / all time, average sale, days to sell, what's waiting to sell,
  a 6-month chart, profit by site, and a spreadsheet (CSV) download.
- **Backup**: a `.zip` with every item and photo (plus `inventory.csv`) saved to Files / Drive /
  email. Restore merges it back in. The app nags every two weeks once there are 3+ items. The AI
  key is never put in a backup.

## Why it posts the way it does

None of these sites let an outside app create listings for a regular seller (no public API for
Marketplace, OfferUp, Craigslist, Nextdoor), so "posting" means getting everything ready to paste
and opening the site's own sell page. On a phone with the site's app installed, those links usually
open the app; if they open a web page she can switch to the app herself.

## Installing on her phone

It has to be served over HTTPS (GitHub Pages works: serve `docs/` from the main branch).

- **iPhone**: open the link in Safari → Share → **Add to Home Screen**. Do this before real use:
  Safari can clear data for websites that haven't been opened in a while, but Home Screen apps keep
  theirs. The app shows this tip until it's installed.
- **Android**: Chrome shows an Install button in the app (or ⋮ → Install app).

A new address means a new app as far as the phone is concerned: data only moves across via
Backup → Restore.

## Releasing a change

Bump `VERSION` in `docs/app.js` **and** `CACHE` in `docs/sw.js` together. The service worker is
cache-first, so without the bump installed phones keep the old files.

## Working on it

- Preview: the `curbside` config in `D:\Epic Games\.claude\launch.json` serves `docs/` on
  http://localhost:5174. The service worker is skipped on localhost so edits show straight away;
  add `?sw` to the URL to test offline mode.
- Tests: `node --test tests/logic.test.mjs` (listing text, AI-answer parsing, sales maths, price
  drops, spreadsheet, backup zip round-trip, replies, calendar). Browser walkthroughs are in
  `tests/browser/` (`e2e.mjs`, `tour.mjs`, `live-check.mjs`, `offline.mjs`).
- Icons: `node tools/make-icons.mjs` redraws `docs/icons/` (borrows `sharp` from the Lessons app's
  worker folder).
- The page's security policy blocks inline `style=""` attributes, so sizes set at runtime go
  through `el.style` in `app.js` (see `afterRender`). Everything user-typed goes through `esc()`.
- The only outside address the app may call is `generativelanguage.googleapis.com` (the optional
  AI). Adding any other service means adding it to the `connect-src` in `docs/index.html`.

## Files

| File | What's in it |
|---|---|
| `docs/app.js` | state, navigation, saving, every button's action, backup/restore |
| `docs/views.js` | every screen as HTML |
| `docs/model.js` | an item's life (listed, pending, sold…), money maths, to-do lists, CSV |
| `docs/listing.js` | categories, conditions, photo checklist, description builder, AI prompt + answer parsing |
| `docs/replies.js` | ready-made buyer replies |
| `docs/calendar.js` | pickup reminders: Google Calendar link and .ics file |
| `docs/themes.js` | theme names, emoji, holiday dates and Automatic |
| `docs/themes.css` | generated colours for every theme (edit `tools/make-themes.mjs` instead) |
| `docs/tour.js` | the dim-and-spotlight tour engine, and what each screen's tour says |
| `docs/platforms.js` | the selling sites, their post/search links |
| `docs/photos.js` | shrinking photos, rotating, blob URLs, files for sharing |
| `docs/ai.js` | Gemini free-tier call with model fallback |
| `docs/zip.js` | minimal zip writer/reader for backups |
| `docs/db.js` | IndexedDB |
