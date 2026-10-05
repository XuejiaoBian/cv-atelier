'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const postcss = require('postcss');
const values = require('postcss-value-parser');
const { MAX_BYTES } = require('./project.cjs');
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
async function importHTML(filename) {
  const warnings = new Set(), base = await fs.realpath(path.dirname(filename));
  let total = 0;
  async function readLocal(url, directory) {
    if (!url || url.startsWith('#') || url.startsWith('data:')) return { existing: url };
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|[\\/])/i.test(url)) throw Error('external or absolute asset');
    const target = await fs.realpath(path.resolve(directory, decodeURIComponent(url.split(/[?#]/)[0])));
    const relative = path.relative(base, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('asset is outside the HTML folder');
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > 50 * 1024 * 1024 || total + stat.size > MAX_BYTES) throw Error('asset is too large');
    total += stat.size;
    return { bytes: await fs.readFile(target), target };
  }
  async function asset(url, directory) {
    try {
      const result = await readLocal(url, directory);
      if ('existing' in result) return result.existing;
      const type = mime[path.extname(result.target).toLowerCase()];
      if (!type) throw Error('unsupported asset type');
      // Imported font files are subject to the same embedding rules as local fonts.
      if (type.startsWith('font/')) {
        const { inspectFont } = require('../ui/font-support.js');
        const b = result.bytes;
        if (!inspectFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)).editable) throw Error('font cannot be embedded for editing');
      }
      return `data:${type};base64,${result.bytes.toString('base64')}`;
    } catch (error) { warnings.add(`Unavailable asset: ${url.slice(0, 180)} (${error.message})`); return ''; }
  }
  const seen = new Set();
  async function css(text, directory, depth = 0) {
    const sheet = postcss.parse(text), imports = [], declarations = [];
    sheet.walkAtRules('import', node => imports.push(node));
    for (const node of imports) {
      const parsed = values(node.params), token = parsed.nodes.find(n => n.type === 'string' || n.type === 'function');
      const url = token?.type === 'string' ? token.value : token?.nodes?.[0]?.value;
      try {
        if (depth > 8) throw Error('CSS import nesting is too deep');
        const result = await readLocal(url || '', directory);
        if (!result.target || seen.has(result.target)) throw Error('CSS import is unavailable or circular');
        seen.add(result.target);
        const imported = await css(result.bytes.toString('utf8'), path.dirname(result.target), depth + 1);
        const media = values.stringify(parsed.nodes.slice(parsed.nodes.indexOf(token) + 1)).trim();
        node.replaceWith(postcss.parse(media ? `@media ${media}{${imported}}` : imported));
      } catch (error) { warnings.add(`Unavailable stylesheet: ${url || node.params} (${error.message})`); node.remove(); }
    }
    sheet.walkDecls(node => declarations.push(node));
    for (const node of declarations) {
      const parsed = values(node.value), urls = [];
      parsed.walk(value => { if (value.type === 'function' && value.value.toLowerCase() === 'url') urls.push(value); });
      for (const value of urls) {
        const url = values.stringify(value.nodes).replace(/^["']|["']$/g, '');
        value.nodes = [{ type: 'string', quote: '"', value: await asset(url, directory) }];
      }
      node.value = parsed.toString();
    }
    return sheet.toString();
  }
  const stat = await fs.stat(filename);
  if (stat.size > 100 * 1024 * 1024) throw Error('Please use an HTML file smaller than 100 MB.');
  const $ = cheerio.load(await fs.readFile(filename, 'utf8'));
  $('script,iframe,object,embed,base,meta[http-equiv],form,input,button,textarea,select').remove();
  $('*').each((_, el) => {
    for (const [key, value] of Object.entries(el.attribs || {})) {
      if (/^on/i.test(key) || ['srcdoc', 'srcset'].includes(key) || (['href','src','xlink:href'].includes(key) && /^\s*(javascript|vbscript):/i.test(value.replace(/[\u0000-\u0020]/g, '')))) $(el).removeAttr(key);
    }
  });
  for (const el of $('link').toArray()) {
    if ($(el).attr('rel') !== 'stylesheet') { $(el).remove(); continue; }
    const url = $(el).attr('href');
    try {
      const result = await readLocal(url, base);
      if (!result.target) throw Error('external CSS is unavailable offline');
      $(el).replaceWith($('<style>').text(await css(result.bytes.toString('utf8'), path.dirname(result.target))));
    } catch (error) { warnings.add(`Unavailable stylesheet: ${url} (${error.message})`); $(el).remove(); }
  }
  for (const el of $('style').toArray()) {
    try { $(el).text(await css($(el).text(), base)); }
    catch { warnings.add('A malformed stylesheet was removed.'); $(el).remove(); }
  }
  for (const el of $('[style]').toArray()) {
    try { const result = await css(`x{${$(el).attr('style')}}`, base); $(el).attr('style', result.slice(2, -1)); }
    catch { $(el).removeAttr('style'); warnings.add('A malformed inline style was removed.'); }
  }
  for (const el of $('img,image').toArray()) {
    const attr = el.tagName === 'image' ? 'href' : 'src';
    const url = $(el).attr(attr) || $(el).attr('xlink:href');
    if (url) $(el).attr(attr, await asset(url, base)).removeAttr('xlink:href');
  }
  const html = $.html();
  if (Buffer.byteLength(html) > MAX_BYTES) throw Error('The imported document exceeds the 256 MB limit.');
  return { html, name: path.basename(filename, path.extname(filename)), warnings: [...warnings] };
}
module.exports = { importHTML };
