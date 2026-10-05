'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { randomUUID } = require('node:crypto');
const MAGIC = Buffer.from('CVATELIER\x00\x01');
const MAX_BYTES = 256 * 1024 * 1024;
function validateProject(value) {
  if (!value || value.format !== 'cv-atelier' || value.version !== 1) throw new Error('This project format is not supported.');
  if (typeof value.html !== 'string' || !value.html.includes('id="cv-content"')) throw new Error('The project does not contain a CV.');
  if (typeof value.name !== 'string' || value.name.length > 500) throw new Error('Invalid project name.');
  if (!Array.isArray(value.fonts) || value.fonts.length > 5000) throw new Error('Invalid project font list.');
  for (const font of value.fonts) {
    if (!font || typeof font.family !== 'string' || font.family.length > 500 || typeof font.embedded !== 'boolean') throw new Error('Invalid project font record.');
  }
  return value;
}
function encodeProject(value) {
  const bytes = Buffer.from(JSON.stringify(validateProject(value)), 'utf8');
  if (bytes.length > MAX_BYTES) throw new Error('The project exceeds the 256 MB limit.');
  return Buffer.concat([MAGIC, zlib.gzipSync(bytes)]);
}
function decodeProject(bytes) {
  if (bytes.length > MAX_BYTES || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('This is not a CV Atelier project.');
  let value;
  try { value = JSON.parse(zlib.gunzipSync(bytes.subarray(MAGIC.length), { maxOutputLength: MAX_BYTES }).toString('utf8')); }
  catch { throw new Error('The project is damaged or exceeds the 256 MB limit.'); }
  return validateProject(value);
}
async function atomicWrite(filename, bytes) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = filename + '.' + randomUUID() + '.tmp';
  try {
    const file = await fs.open(temporary, 'wx');
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    await fs.rename(temporary, filename);
  } finally { await fs.rm(temporary, { force: true }); }
}
module.exports = { encodeProject, decodeProject, validateProject, atomicWrite, MAX_BYTES };
