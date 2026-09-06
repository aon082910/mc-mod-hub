# MC Mod Hub

Self-hosted Minecraft mod/addon search hub for Unraid.

- Searches **Modrinth**, **CurseForge**, **PlanetMinecraft**, **9Minecraft**, **BetterBedrock**, **Hangar**, **SpigotMC**, **TLMods**, **MinecraftSkins.net**, **Polymart**, **GitHub**, and **MCreator.net**, merging results into one table (styled after LimeTorrents' layout: category pills + search bar, green nav, notice board, sidebar quick-browse)
- **Browse by category** (Mods, Modpacks, Resource/Texture Packs, Data Packs, Shaders, Maps/Worlds, Bedrock Add-Ons, Server Plugins, Skins) without typing a search term — category tiles on the homepage and in the sidebar
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
- **Hangar** — PaperMC's official plugin repository (Paper/Waterfall/Velocity server plugins). Official public API, no key required — same reliability tier as Modrinth/CurseForge
- **SpigotMC** — SpigotMC itself has no public API and is fronted by anti-bot protection that blocks direct scraping (a direct download attempt gets a hard 403). This uses **Spiget**, a long-running third-party API that mirrors free SpigotMC resources on its own CDN — verified end-to-end (search, icon, and download all confirmed working against real resources). Paid ("premium") resources aren't downloadable through it, so those show a project-page link instead of a download button, same as any source without a direct file
- **PlanetMinecraft, 9Minecraft** — no public API, so these are scraped from their server-rendered search-result HTML. This is inherently more fragile than an API: if either site redesigns its page markup, that source's results can silently drop to zero until the selectors are updated (search errors surface inline on the search page rather than failing silently)
- **BetterBedrock** — has no real search endpoint at all (confirmed: its `?s=` query parameter is ignored server-side). Instead this scrapes its public mods catalog page and filters by keyword locally, so it only covers what's on that catalog page, refreshed at most every 10 minutes
- **TLMods** (tlmods.org) — TLauncher's own mod/modpack/resourcepack/map/shaderpack mirror. No public API; scraped from server-rendered HTML. Its keyword search turned out to be a real server-rendered endpoint (`/en/?search=`, `/en/{type}/?search=`) confirmed by watching the actual network request its own search box makes, not a guess. Java Edition only — TLauncher doesn't carry Bedrock content. Per-file supported game versions live only on each mod's own detail page as a long text list, not on search-result cards, so `gameVersions` is left empty on results rather than firing one extra request per result
- **MinecraftSkins.net** — the only skins-specific source, since none of the other sites/APIs here carry skins at all. **Its `?s=` search parameter is confirmed to do nothing** (a nonsense query returns byte-identical results to no query — verified directly), and `robots.txt` separately disallows crawling `/search/` anyway, so this only ever powers the dedicated **Skins** category browse, never a plain keyword search where its unfiltered results would just be noise mixed into every other search. PlanetMinecraft was *not* extended to the Skins category alongside it — PlanetMinecraft's scraper only reads its `/mods/` search page (a different page template than its separate `/skins/` section), so doing that properly is separate selector work, not a one-line flag flip. 9Minecraft *was* extended to Skins, since its one shared listing template already covers skin posts and returns real results for a "skin" query (verified)
- **Polymart** — a real Spigot/Paper/Purpur plugin marketplace (trading under the name voxel.shop, though its API is still hosted at api.polymart.org). No published API docs for the free tier exist publicly (`polymart.org/wiki/api` redirects into the same Cloudflare wall as the rest of the site) — the working `search` action was found by testing candidate action names directly against the live endpoint. No key required; free listings show a project-page link like every other non-installable source, paid ones the same
- **GitHub** — searches repos tagged `topic:minecraft` via GitHub's own public search API. Exists specifically to catch mods/plugins that only ever get released as a GitHub Releases attachment (Hangar's own EssentialsX listing, mentioned above, is exactly this case) with no listing on any of the sites above. Unauthenticated search is capped at 10 requests/minute by GitHub itself — a free personal access token (no scopes needed) raises that to 30/min, entered in admin config the same way the CurseForge/YouTube keys are. Repos have no structured edition/game-version field the way Modrinth/CurseForge do, so those are left blank rather than guessed, and since GitHub doesn't publish a download counter on the repo itself, its star count rides along in the description text instead of masquerading as a download count. **Install to my server** works here too: it looks at the repo's latest release for a `.jar` asset at install time — when a repo (like Sodium) publishes releases with no jar attached because it only ships through Modrinth/CurseForge, that's reported honestly as "no downloadable file," not silently faked
- **MCreator.net** — a database of mods built with the MCreator mod-making tool, Java Edition only, no modpacks/resourcepacks/other sections on the site. **Its `keys=` search field is also confirmed to do nothing** (same byte-identical-results test as MinecraftSkins.net) — its `/modifications` catalog page is scraped and filtered by keyword locally instead, same approach as BetterBedrock, so it only covers what's on that one catalog page, refreshed at most every 10 minutes
- **MC-Addons.com** — **not scraped**. Its own `robots.txt` explicitly disallows automated search (`Disallow: /*do=search`), so this app respects that and only offers a link to its homepage instead
- **MCPEDL** — **not scraped**. Its search results load entirely client-side via JavaScript after the page loads; the raw HTML response has nothing in it to parse, and adding a headless browser just for this one site was judged not worth the container weight/complexity. A direct search link is provided instead

Sites without scraping still show up as one-click "search on site" links right under the search box.

**Sites considered and deliberately not added, with the specific reason each was rejected:**
- **ModDex.gg** — a genuinely nice-looking mod rating site with clean per-mod pages, but browsing/search is a client-rendered SPA (Vue + Inertia over Laravel) — `curl`/`wget` get nothing to parse, and its documented API requires a logged-in account (`/api/docs` redirects to `/login`). Same limitation class as MCPEDL
- **Nexus Mods** — sits behind a full Cloudflare JS challenge on every page, including `robots.txt` itself, so it can't be scraped the way PlanetMinecraft's lighter bot-management can be worked around. It does have an official API, but keys require manual per-application approval — worth revisiting if you obtain one, just ask
- **ModpackIndex.com** — same full Cloudflare JS challenge as Nexus; not reliably reachable without a real browser
- **Feed The Beast** (feed-the-beast.com) — client-rendered Next.js app, and more importantly its modpacks are hosted on CurseForge (FTB and CurseForge are both Overwolf properties), so a scraper here would just re-surface content the existing CurseForge source already returns, under a different source tag
- **ModBay.org** — loads fine, but its download flow is gated behind a captcha widget on essentially every page — the same ad-revenue-via-captcha-wall pattern that makes a "download" site low-trust rather than a straightforward mirror, so it was left out on the same grounds as the general web-search decision below
- **Minecraft Forum** — old forum threads have no consistent structured metadata (version/edition/download link) the way a dedicated mod-listing page does, and much of the content is years stale; not a good fit for a results table that promises accurate version/edition per row
- **Rock Paper Shotgun's "best Minecraft mods" article** — a single curated editorial post, not a searchable catalog. There's nothing to query against; it's one article, not a database
- **BuiltByBit** (formerly MC-Market) — another real plugin/script marketplace, but every page (including its wiki) is behind the same full Cloudflare JS challenge as Nexus Mods/ModpackIndex — not reliably reachable without a real browser
- **NameMC** — by far the biggest skins site, but its homepage returns a Cloudflare JS challenge (403) the same way Nexus Mods/BuiltByBit do
- **Torrent/Usenet/debrid indexers** — deliberately not pursued. That ecosystem indexes media and cracked software, not individual mod jars (every mod here is already free and officially distributed); what it would actually surface is either nothing or pirated modpacks/cracked-launcher bundles, the same low-trust category the "Google-style search" section below already explains staying away from
- **itch.io** — `robots.txt` explicitly disallows crawling `/search`, and its official API requires an authorization header for essentially every real endpoint (confirmed: even a plain game-search call returns `"missing authorization header"`) — it's not a keyless public API, and what it does expose is scoped around a developer's own uploads/purchases rather than general site-wide discovery. Between the disallowed search path and the auth-gated API, there isn't a scrapable or freely-searchable way in

**On going broader (site-agnostic "what would show up in a Google search"):** deliberately not done. A lot of what actually ranks for mod-download searches is low-trust ad-farm reposting sites, some of which bundle malware in their "download" buttons — and none of it carries the structured version/edition/download data every other source here does, which is what makes the results table and the one-click install feature trustworthy in the first place. If that's still wanted, it should be a clearly-separated, visibly-unverified "web search" tab rather than merged into the main table — ask if you want that built.

The Reddit-based "reviews" tab is community discussion, not verified store reviews — there isn't a public review API for Minecraft mods to pull from.

---

## 1. Get your API keys

You said you already have both — for reference/reissuing:

- **CurseForge API key**: https://console.curseforge.com/#/api-keys (free CurseForge Core account required)
- **YouTube Data API v3 key**: Google Cloud Console → APIs & Services → Library → enable "YouTube Data API v3" → Credentials → Create API key
- **GitHub personal access token** (optional): github.com/settings/tokens → generate one with no scopes selected (public read access is all this needs). Not required — GitHub search just works unauthenticated at 10 requests/minute instead of 30/minute

Modrinth, Hangar, SpigotMC (via Spiget), TLMods, MinecraftSkins.net, and Polymart need no key. Reddit's public JSON search needs no key.

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

- Search page: type a mod name → results merge Modrinth, CurseForge, PlanetMinecraft, 9Minecraft, BetterBedrock, Hangar, SpigotMC, TLMods, Polymart, GitHub, and MCreator.net, sorted by download count where available (sources without a public download counter sort after ones that have one). MinecraftSkins.net only appears when browsing the dedicated Skins category (see above — it has no real keyword search)
- Click a result → **Overview** tab (author, edition, game version(s), download count, last-updated date, tags/categories, and price for marketplace sources — everything the source actually publishes, laid out so you don't need to open the project page just to see it; a field a given source doesn't provide says so honestly rather than showing blank), **Downloads** tab (direct file/project links), **Reviews / Comments** tab (Reddit threads mentioning the mod, each comment scored `normal` / `medium` / `low` trust with flags like "near-duplicate of another comment" or "generic praise, no specifics"), **YouTube** tab (videos about the mod, with any download links found in each video's description highlighted — a green checkmark means it matched a known mod-hosting domain)

### Optional: install/update mods directly on your server

1. Mount your Minecraft server's mods folder into the container at `/mods` (Unraid template: the "Mods Folder" Path config, advanced view; docker-compose: uncomment the `/mods` volume line)
2. Admin config → **Server Integration** → check **Enable mods folder integration** → Save. The page shows a green "Mounted and writable" line once it can actually see the folder
3. On any Modrinth/CurseForge search result's Downloads tab, an **⬇ Install to my server** button now appears — downloads the file straight into that folder
4. The **My Mods** tab in the main nav scans everything already in that folder and tells you what's outdated, with a one-click **Update** button per mod

This works for Modrinth, CurseForge, Hangar, SpigotMC, and GitHub (free/public files only — premium Spigot resources and GitHub repos with no `.jar` release asset have no direct link to install, and are reported as such rather than failing silently). PlanetMinecraft/9Minecraft/BetterBedrock/TLMods/MinecraftSkins.net/Polymart/MCreator.net don't expose a single reliable direct-file URL the way those do, so there's no Install button on results from those sources. Requires being logged into Admin config (the same session cookie covers both pages).

The update checker's hash matching only covers Modrinth and CurseForge — Hangar and SpigotMC don't publish a public hash-lookup API, so a plugin installed from either shows as "unmatched" in My Mods *unless* it happens to also be published on Modrinth or CurseForge under the same file (matching is purely by file content, not by where you got it from, so cross-published plugins can still get identified that way).

## Notes / limitations

- Fake-review flags are heuristic pattern-matching (duplicate text, generic short praise, timing bursts) — treat them as "worth a second look," not a verdict
- YouTube video search costs API quota (100 units per search call against the default 10,000/day free quota — plenty for personal use)
- If a source's API key is missing/invalid, that source's errors show inline on the search page rather than breaking the whole search
- `SESSION_SECRET` is optional. If left unset, a random one is generated and stored in the SQLite database under `/data` on first boot, so admin login sessions keep working across container restarts as long as that volume persists. If you wipe `/data` (or run without a volume), a new secret gets generated and any logged-in admin session is invalidated — not a problem, just log back in
- Reddit sometimes 403s requests coming from datacenter/cloud IP ranges. From a typical home Unraid box this works fine; if you see "Reddit search failed: 403" in the Reviews tab, it means Reddit is blocking your specific network — the rest of the app is unaffected
- **PlanetMinecraft is fronted by Cloudflare bot management that genuinely, probabilistically 403s/429s some fraction of requests — including well-formed, identical ones — for reasons outside this app's control.** This was investigated in detail on 2026-09-06 after a user report: a same-origin Referer header looked like a fix in an initial test (identical request, 403 without it, 200 with it), but a wider A/B test afterward showed that conclusion didn't hold up — the exact same request with the exact same headers returned 200 sometimes and 403/429 other times, headers held constant. The honest conclusion is there is no header combination that reliably avoids this from outside Cloudflare's system; retries with increasing backoff (400ms, 800ms, 1200ms — bumped from a flat immediate retry) are a real but partial mitigation, not a fix, and repeated diagnostic requests in a short window make it measurably worse (429s appeared specifically after heavy testing). If the inline error bothers you more than the value of PlanetMinecraft's results, toggle it off in admin config — the rest of the search table is unaffected either way
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
