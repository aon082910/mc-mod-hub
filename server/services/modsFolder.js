const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const fetch = require('node-fetch');

// Mounted as a Docker volume — see the "Data"-style Path config in the
// Unraid template. Left unmounted by default; enable_mods_folder gates the
// whole feature so nothing tries to touch a folder that isn't there.
const MODS_DIR = process.env.MODS_DIR || '/mods';

async function isAvailable() {
  try {
    await fsp.access(MODS_DIR, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

async function listJarFiles() {
  const entries = await fsp.readdir(MODS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.jar'))
    .map(e => e.name);
}

async function readFile(filename) {
  const safeName = path.basename(filename);
  return fsp.readFile(path.join(MODS_DIR, safeName));
}

// Only ever writes a basename inside MODS_DIR — filename is never trusted
// as a path, so a crafted "../../etc/passwd"-style name can't escape the
// mods folder.
async function downloadTo(filename, url) {
  const safeName = path.basename(filename);
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid filename');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = await res.buffer();
  await fsp.writeFile(path.join(MODS_DIR, safeName), buffer);
  return safeName;
}

async function deleteFile(filename) {
  const safeName = path.basename(filename);
  try {
    await fsp.unlink(path.join(MODS_DIR, safeName));
  } catch (e) {
    // Already gone or never existed — not an error for our purposes.
  }
}

module.exports = { MODS_DIR, isAvailable, listJarFiles, readFile, downloadTo, deleteFile };
