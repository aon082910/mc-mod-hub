# MC Mod Hub

Self-hosted Minecraft mod/addon search hub for Unraid.

- Searches **Modrinth**, **CurseForge**, **PlanetMinecraft**, **9Minecraft**, and **BetterBedrock**, merging results into one table (styled after LimeTorrents' layout: category pills + search bar, green nav, notice board, sidebar quick-browse)
- **Browse by category** (Mods, Modpacks, Resource/Texture Packs, Data Packs, Shaders, Maps/Worlds, Bedrock Add-Ons) without typing a search term — category tiles on the homepage and in the sidebar
- **Notice board** on the homepage shows newly-posted mods/addons, pulled live from Modrinth's "newest" feed, 9Minecraft's blog homepage, and CurseForge's newest listings (if a key is configured)
- Every result and every mod detail page shows the **required game edition (Java or Bedrock)** and the **game version(s) it supports**
- Mod detail page shows **download links**, **community discussion/comments** (via Reddit, since none of these sites expose a public reviews API) with **heuristic fake-review flags**, and **YouTube videos** about the mod with **download links auto-extracted from video descriptions**
- **Search results and the notice board are cached** in SQLite (15 min by default, configurable, disable-able) so repeat searches are instant and the scraped sites aren't hit on every page load
- **Optional server integration** (off by default — mount a folder and flip a switch in admin config to turn it on):
  - **Install to my server**: a button on Modrinth/CurseForge results that downloads the file straight into your mounted Minecraft mods folder
  - **Update checker** ("My Mods" tab): scans every `.jar` in that folder by exact content hash (SHA1 against Modrinth, murmur2 fingerprint against CurseForge — the same method their own official apps use, not filename guessing) and flags anything with a newer version available, one click to update
- Admin config portal (`/admin.html`) to set/change API keys and toggle sources — no file editing required after first boot

**Honesty check on scope, per site:**
- **Modrinth, CurseForge** — official public APIs, most reliable
- **PlanetMinecraft, 9Minecraft** — no public API, so these are scraped from their server-rendered search-result HTML. This is inherently more fragile than an API: if either site redesigns its page markup, that source's results can silently drop to zero until the selectors are updated (search errors surface inline on the search page rather than failing silently)
- **BetterBedrock** — has no real search endpoint at all (confirmed: its `?s=` query parameter is ignored server-side). Instead this scrapes its public mods catalog page and filters by keyword locally, so it only covers what's on that catalog page, refreshed at most every 10 minutes
- **MC-Addons.com** — **not scraped**. Its own `robots.txt` explicitly disallows automated search (`Disallow: /*do=search`), so this app respects that and only offers a link to its homepage instead
- **MCPEDL** — **not scraped**. Its search results load entirely client-side via JavaScript after the page loads; the raw HTML response has nothing in it to parse, and adding a headless browser just for this one site was judged not worth the container weight/complexity. A direct search link is provided instead

Sites without scraping still show up as one-click "search on site" links right under the search box.

The Reddit-based "reviews" tab is community discussion, not verified store reviews — there isn't a public review API for Minecraft mods to pull from.

---

## 1. Get your API keys

You said you already have both — for reference/reissuing:

- **CurseForge API key**: https://console.curseforge.com/#/api-keys (free CurseForge Core account required)
- **YouTube Data API v3 key**: Google Cloud Console → APIs & Services → Library → enable "YouTube Data API v3" → Credentials → Create API key

Modrinth needs no key. Reddit's public JSON search needs no key.

You do **not** need to put these in a config file — enter them in the admin portal after first boot (step 4).

---

## 2. The image is already published

The image is public on Docker Hub at [`allornothing/mc-mod-hub`](https://hub.docker.com/r/allornothing/mc-mod-hub) — no local build needed. Source is at [github.com/aon082910/mc-mod-hub](https://github.com/aon082910/mc-mod-hub).

If you'd rather build it yourself (e.g. after editing the code):
```bash
git clone https://github.com/aon082910/mc-mod-hub.git
cd mc-mod-hub
docker build -t mc-mod-hub:latest .
```

---

## 3. Add the container in Unraid

**Option A — via Community Applications** (once the CA submission below is approved): search "MC Mod Hub" in the Apps tab and click Install.

**Option B — import the template manually right now** (works immediately, doesn't require CA approval):
1. Copy [`templates/mc-mod-hub.xml`](templates/mc-mod-hub.xml) into `/boot/config/plugins/dockerMan/templates-user/` on your Unraid box
2. Docker tab → Add Container → select "mc-mod-hub" from the template dropdown
3. Confirm the Data path (defaults to `/mnt/user/appdata/mc-mod-hub`) — `SESSION_SECRET` is optional and can be left blank
4. Apply

**Option C — manual container (equivalent settings):**
| Setting | Value |
|---|---|
| Repository | `allornothing/mc-mod-hub:latest` |
| Port | `8080` → your chosen host port |
| Path | `/data` → `/mnt/user/appdata/mc-mod-hub` |
| Variable | `SESSION_SECRET` = optional; leave unset to auto-generate one on first boot |
| Variable | `ADMIN_PASSWORD` = temporary first-boot password (default `admin`) |

---

## 4. First login and API key setup

1. Open `http://<unraid-ip>:8080/` — search page
2. Click **Admin config** (top right), or go to `http://<unraid-ip>:8080/admin.html`
3. Log in with the `ADMIN_PASSWORD` you set (default `admin` if you didn't change it)
4. Paste in your **CurseForge API key** and **YouTube Data API key**, toggle which sources you want enabled, save
5. **Change the admin password** immediately from the same page (bottom panel) — the first-boot password is meant to be temporary

Keys are stored in the SQLite database under `/data` (persisted via the Docker volume), editable any time from the same admin page — never in a file, so you can rotate a leaked key without touching the container.

---

## 5. Using it

- Search page: type a mod name → results merge Modrinth, CurseForge, PlanetMinecraft, 9Minecraft, and BetterBedrock, sorted by download count where available (scraped sites without a public download counter sort after ones that have one)
- Click a result → **Downloads** tab (direct file/project links), **Reviews / Comments** tab (Reddit threads mentioning the mod, each comment scored `normal` / `medium` / `low` trust with flags like "near-duplicate of another comment" or "generic praise, no specifics"), **YouTube** tab (videos about the mod, with any download links found in each video's description highlighted — a green checkmark means it matched a known mod-hosting domain)

### Optional: install/update mods directly on your server

1. Mount your Minecraft server's mods folder into the container at `/mods` (Unraid template: the "Mods Folder" Path config, advanced view; docker-compose: uncomment the `/mods` volume line)
2. Admin config → **Server Integration** → check **Enable mods folder integration** → Save. The page shows a green "Mounted and writable" line once it can actually see the folder
3. On any Modrinth/CurseForge search result's Downloads tab, an **⬇ Install to my server** button now appears — downloads the file straight into that folder
4. The **My Mods** tab in the main nav scans everything already in that folder and tells you what's outdated, with a one-click **Update** button per mod

This only works for Modrinth and CurseForge — PlanetMinecraft/9Minecraft/BetterBedrock don't expose a single reliable direct-file URL the way those two do, so there's no Install button on results from those sources. Requires being logged into Admin config (the same session cookie covers both pages).

## Notes / limitations

- Fake-review flags are heuristic pattern-matching (duplicate text, generic short praise, timing bursts) — treat them as "worth a second look," not a verdict
- YouTube video search costs API quota (100 units per search call against the default 10,000/day free quota — plenty for personal use)
- If a source's API key is missing/invalid, that source's errors show inline on the search page rather than breaking the whole search
- `SESSION_SECRET` is optional. If left unset, a random one is generated and stored in the SQLite database under `/data` on first boot, so admin login sessions keep working across container restarts as long as that volume persists. If you wipe `/data` (or run without a volume), a new secret gets generated and any logged-in admin session is invalidated — not a problem, just log back in
- Reddit sometimes 403s requests coming from datacenter/cloud IP ranges. From a typical home Unraid box this works fine; if you see "Reddit search failed: 403" in the Reviews tab, it means Reddit is blocking your specific network — the rest of the app is unaffected
- PlanetMinecraft is fronted by Cloudflare bot management that intermittently 403s even well-formed, identical requests — the app retries automatically and only surfaces an error if all retries fail
- Java vs. Bedrock edition and game version are read directly from structured fields on Modrinth/CurseForge (always accurate — those platforms are Java Edition only), but on the scraped sites they're parsed out of listing text with regex/keyword matching. PlanetMinecraft in particular mixes both editions under generic terms like "Addon," so occasionally a Java Edition result can show up while browsing the Bedrock Add-Ons category, or vice versa — the edition badge on that specific result is still correct, it's just filed under the wrong category tile
- Category browsing on CurseForge resolves each category name (e.g. "Shaders") to CurseForge's real classId at runtime via their official `/v1/categories` endpoint rather than a hardcoded guess, so it stays correct even if CurseForge renumbers classes — but if a category genuinely doesn't exist on CurseForge (e.g. Data Packs may not be a distinct class there), that source is silently skipped for that category rather than showing wrong results
- The "notice board" newest-posts feed from CurseForge uses a documented but not independently verified sort parameter (their API docs confirm the sort enum exists but don't publish the exact name-to-number mapping) — if it's ever wrong, that source simply drops out of the notice board rather than showing incorrect "newest" items
- The update checker only identifies mods it can get an exact content-hash match for. A `.jar` you built yourself, downloaded from somewhere else entirely, or that's been repackaged, will show up as "unmatched" rather than guessed at from its filename — that's intentional, a wrong guess here is worse than no answer
- CurseForge fingerprint matching (murmur2) is implemented from CurseForge's own documented algorithm and verified against the reference implementation's published test vectors, but end-to-end matching against real CurseForge data couldn't be tested during development without a live API key — if it ever silently matches nothing, Modrinth matching (independently verified end-to-end against real files) is unaffected
- "Install to my server" and the update checker both require an active admin login (same session as `/admin.html`) — a logged-out visitor sees the search/browse features only, never a way to write to your server's filesystem

---

## Submitting to Unraid Community Applications

This repo already meets every automated requirement at [ca.unraid.net/submit/new](https://ca.unraid.net/submit/new):
- ✅ Public GitHub repo with an OSI-approved license ([`LICENSE`](LICENSE), MIT)
- ✅ Valid Docker template at [`templates/mc-mod-hub.xml`](templates/mc-mod-hub.xml) with a `<Repository>` tag
- ✅ [`ca_profile.xml`](ca_profile.xml) in the repo root with a non-empty `<Profile>`

What's left is a few steps only you can do (they require your own Unraid Forums/GitHub login, which this automation intentionally doesn't touch):

1. Go to **[ca.unraid.net/submit/new](https://ca.unraid.net/submit/new)** and sign in
2. Enter repository: `aon082910/mc-mod-hub`
3. Run **Validate** then **Scan** — both should pass immediately since the template and profile are already in place
4. **Recommended before submitting:** create a support thread at [forums.unraid.net](https://forums.unraid.net) (Docker Containers subforum), then update the `<Support>` tag in `templates/mc-mod-hub.xml` from the GitHub Issues link it currently points to, to your new forum thread URL, and commit/push that change — CA submissions are expected to link to a forum thread, not just GitHub Issues, though GitHub Issues works as an interim placeholder
5. Submit — it goes into Unraid's moderation queue for a human review before it appears in Community Applications for other users

Until it's approved, Option B in step 3 above (manually import `templates/mc-mod-hub.xml`) makes the app installable on any Unraid box today, CA approval or not.
