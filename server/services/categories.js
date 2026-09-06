// Shared category taxonomy used for browsing (not just keyword search).
// Each source maps a category differently:
//  - Modrinth: has a real `project_type` facet (mod/modpack/resourcepack/datapack/shader)
//  - CurseForge: has a real classId, but Minecraft's classIds aren't documented
//    with fixed numbers anywhere public, so it's resolved at runtime via
//    GET /v1/categories?gameId=432&classesOnly=true and cached (see curseforge.js)
//  - PlanetMinecraft/9Minecraft: no browse-by-category endpoint, so browsing
//    reuses their keyword search with the category's label as the query
//  - BetterBedrock: its whole catalog page IS a mods listing, so "mods" and
//    "bedrock" both just filter that catalog
//  - Hangar/Spigot (SpigotMC via the Spiget API): server-side plugins are a
//    genuinely different content type from client mods (different install
//    location, different loader), so they get their own "plugins" category
//    rather than being folded into "mods" — but they still show up in a
//    plain keyword search with no category selected, same as every source
//  - TLMods (TLauncher's own mod mirror): one template reused across five
//    content types, each under its own path segment (`tlmodsPath`) — "" for
//    mods (lives at the site root), "modpacks", "resourcepacks", "maps",
//    "shaderpacks". `null` means TLMods doesn't carry that type at all
//    (data packs, Bedrock add-ons, server plugins, skins) and is skipped.
//  - MinecraftSkins.net: skins are their own content type (cosmetic, not
//    edition-locked, no "install to server" concept) and the site has no
//    real keyword search (see minecraftskins.js) — it only ever contributes
//    to the "skins" category, never a plain keyword search.
//  - Polymart: a real Spigot/Paper plugin marketplace, same "plugins-only"
//    treatment as Hangar/Spigot (`includePolymart`).
//  - GitHub: searched (via `topic:minecraft`) across every category except
//    Skins — nobody hosts a cosmetic skin file as a GitHub repo — since a
//    huge amount of smaller mods/plugins have no listing anywhere else.
//    `excludeGithub` opts a category out; every other category defaults in.
//  - MCreator: a mod database for mods built with the MCreator tool — Java
//    Edition mods only, no modpacks/resourcepacks/etc. section on the site
//    at all, so `includeMcreator` is only set on "mods" (same treatment as
//    BetterBedrock: no real server-side search, catalog scraped and
//    filtered locally instead — see mcreator.js).
//
// Minecraft: Java Edition and Bedrock Edition content is not interchangeable
// (different mod formats, different marketplaces) — Modrinth and CurseForge
// only ever host Java Edition content, so those two are omitted entirely
// from the "bedrock" category rather than mislabeled.

const CATEGORIES = [
  {
    key: 'mods',
    label: 'Mods',
    icon: '🧩',
    modrinthProjectType: 'mod',
    curseforgeClassName: 'Mods',
    scrapeKeyword: 'mod',
    includeBetterBedrock: true,
    includeMcreator: true,
    tlmodsPath: ''
  },
  {
    key: 'modpacks',
    label: 'Modpacks',
    icon: '📦',
    modrinthProjectType: 'modpack',
    curseforgeClassName: 'Modpacks',
    scrapeKeyword: 'modpack',
    includeBetterBedrock: false,
    tlmodsPath: 'modpacks'
  },
  {
    key: 'resourcepacks',
    label: 'Resource / Texture Packs',
    icon: '🎨',
    modrinthProjectType: 'resourcepack',
    curseforgeClassName: 'Resource Packs',
    scrapeKeyword: 'texture pack',
    includeBetterBedrock: true,
    tlmodsPath: 'resourcepacks'
  },
  {
    key: 'datapacks',
    label: 'Data Packs',
    icon: '🗃️',
    modrinthProjectType: 'datapack',
    curseforgeClassName: 'Data Packs',
    scrapeKeyword: 'data pack',
    includeBetterBedrock: false,
    tlmodsPath: null
  },
  {
    key: 'shaders',
    label: 'Shaders',
    icon: '✨',
    modrinthProjectType: 'shader',
    curseforgeClassName: 'Shaders',
    scrapeKeyword: 'shader',
    includeBetterBedrock: false,
    tlmodsPath: 'shaderpacks'
  },
  {
    key: 'worlds',
    label: 'Maps / Worlds',
    icon: '🗺️',
    modrinthProjectType: null,
    curseforgeClassName: 'Worlds',
    scrapeKeyword: 'map',
    includeBetterBedrock: false,
    tlmodsPath: 'maps'
  },
  {
    key: 'bedrock',
    label: 'Bedrock Add-Ons',
    icon: '📱',
    modrinthProjectType: null,
    curseforgeClassName: null,
    scrapeKeyword: 'addon',
    includeBetterBedrock: true,
    javaSourcesExcluded: true,
    tlmodsPath: null
  },
  {
    key: 'plugins',
    label: 'Server Plugins',
    icon: '🔌',
    modrinthProjectType: 'plugin',
    curseforgeClassName: 'Bukkit Plugins',
    scrapeKeyword: 'plugin',
    includeBetterBedrock: false,
    includeHangar: true,
    includeSpigot: true,
    includePolymart: true,
    excludePlanetAndNineMc: true,
    tlmodsPath: null
  },
  {
    key: 'skins',
    label: 'Skins',
    icon: '🧑‍🎨',
    modrinthProjectType: null,
    curseforgeClassName: null,
    scrapeKeyword: 'skin',
    includeBetterBedrock: false,
    includeHangar: false,
    includeSpigot: false,
    // PlanetMinecraft's scraper only ever reads its /mods/ search page (see
    // planetminecraft.js), which doesn't cover its separate /skins/ section
    // at all — enabling it here would return mod results mislabeled as
    // skins, not real skin content. 9Minecraft's homepage/search template is
    // shared across all its content types, though, and does carry real skin
    // posts (verified), so it gets a narrow, skins-only override instead of
    // flipping the general PlanetMinecraft+9Minecraft toggle for everyone.
    excludePlanetAndNineMc: true,
    include9minecraft: true,
    excludeGithub: true,
    javaSourcesExcluded: true,
    tlmodsPath: null,
    includeMinecraftSkins: true
  }
];

function getCategory(key) {
  return CATEGORIES.find(c => c.key === key) || null;
}

module.exports = { CATEGORIES, getCategory };
