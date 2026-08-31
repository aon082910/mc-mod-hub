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
    includeBetterBedrock: true
  },
  {
    key: 'modpacks',
    label: 'Modpacks',
    icon: '📦',
    modrinthProjectType: 'modpack',
    curseforgeClassName: 'Modpacks',
    scrapeKeyword: 'modpack',
    includeBetterBedrock: false
  },
  {
    key: 'resourcepacks',
    label: 'Resource / Texture Packs',
    icon: '🎨',
    modrinthProjectType: 'resourcepack',
    curseforgeClassName: 'Resource Packs',
    scrapeKeyword: 'texture pack',
    includeBetterBedrock: true
  },
  {
    key: 'datapacks',
    label: 'Data Packs',
    icon: '🗃️',
    modrinthProjectType: 'datapack',
    curseforgeClassName: 'Data Packs',
    scrapeKeyword: 'data pack',
    includeBetterBedrock: false
  },
  {
    key: 'shaders',
    label: 'Shaders',
    icon: '✨',
    modrinthProjectType: 'shader',
    curseforgeClassName: 'Shaders',
    scrapeKeyword: 'shader',
    includeBetterBedrock: false
  },
  {
    key: 'worlds',
    label: 'Maps / Worlds',
    icon: '🗺️',
    modrinthProjectType: null,
    curseforgeClassName: 'Worlds',
    scrapeKeyword: 'map',
    includeBetterBedrock: false
  },
  {
    key: 'bedrock',
    label: 'Bedrock Add-Ons',
    icon: '📱',
    modrinthProjectType: null,
    curseforgeClassName: null,
    scrapeKeyword: 'addon',
    includeBetterBedrock: true,
    javaSourcesExcluded: true
  }
];

function getCategory(key) {
  return CATEGORIES.find(c => c.key === key) || null;
}

module.exports = { CATEGORIES, getCategory };
