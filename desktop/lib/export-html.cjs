'use strict';
const cheerio = require('cheerio');
const { MAX_BYTES } = require('./project.cjs');

function checkedHTML(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_BYTES) throw Error('The document exceeds the 256 MB limit.');
  const $ = cheerio.load(html);
  $('script,iframe,object,embed,base,meta[http-equiv],form,input,button,textarea,select').remove();
  $('*').each((_, el) => {
    for (const [key, value] of Object.entries(el.attribs || {})) {
      if (/^on/i.test(key) || ['srcdoc', 'srcset'].includes(key) ||
          (['href', 'src', 'xlink:href'].includes(key) && /^(?:javascript|vbscript):/i.test(value.replace(/[\u0000-\u0020]/g, '')))) {
        $(el).removeAttr(key);
      }
    }
  });
  return $.html();
}

module.exports = { checkedHTML };
