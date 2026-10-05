'use strict';
// Shared browser/Node parser. Never install document fonts into Windows.
(function (global) {
  function inspectFont(buffer) {
    const d = new DataView(buffer), tag = offset => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    try {
      if (d.byteLength < 12) throw Error();
      const countFaces = tag(0) === 'ttcf' ? d.getUint32(8) : 1;
      if(countFaces>100||!countFaces)throw Error();
      const offsets = tag(0) === 'ttcf' ? Array.from({ length: countFaces }, (_, i) => d.getUint32(12 + i * 4)) : [0];
      if (offsets.length > 100 || !offsets.length) throw Error();
      let result;
      for (const start of offsets) {
        const tables = {}, count = d.getUint16(start + 4);
        for (let i = 0; i < count; i++) {
          const at = start + 12 + i * 16, offset = d.getUint32(at + 8), length = d.getUint32(at + 12);
          if (offset + length > d.byteLength) throw Error();
          tables[tag(at)] = { offset, length };
        }
        const os = tables['OS/2'];
        if (!os || os.length < 10) throw Error();
        const bits = d.getUint16(os.offset + 8);
        // Editable projects need installable (0) or editable (8) permissions.
        // No subsetting is safe: the whole font is embedded. Bitmap-only is not.
        const rights = bits & 14;
        const editable = !(bits & 0x200) && (rights === 0 || Boolean(rights & 8));
        const reason = bits & 0x200 ? 'Bitmap-only embedding' : rights & 8 ? 'Editable embedding' : rights & 4 ? 'Preview/print only' : rights & 2 ? 'Restricted embedding' : 'Installable embedding';
        let weight = String(d.getUint16(os.offset + 4) || 400);
        let stretch = ([50,62.5,75,87.5,100,112.5,125,150,200][d.getUint16(os.offset + 6)-1]||100)+'%';
        if (tables.fvar) {
          const base = tables.fvar.offset, axes = d.getUint16(base + 4), axisCount = d.getUint16(base + 8), axisSize = d.getUint16(base + 10);
          for (let i = 0; i < axisCount; i++) {
            const at = base + axes + i * axisSize;
            if (tag(at) === 'wght') weight = `${d.getInt32(at + 4) / 65536} ${d.getInt32(at + 12) / 65536}`;
            if (tag(at) === 'wdth') stretch = `${d.getInt32(at + 4) / 65536}% ${d.getInt32(at + 12) / 65536}%`;
          }
        }
        const info = { editable, reason, weight, stretch, style: os.length >= 64 && (d.getUint16(os.offset + 62) & 1) ? 'italic' : 'normal', format: tag(start) === 'OTTO' ? 'opentype' : 'truetype' };
        if (!result || !editable) result = info;
      }
      return result;
    } catch { return { editable: false, reason: 'Embedding permission could not be read', weight: '400', style: 'normal', format: 'truetype' }; }
  }
  if (typeof module === 'object') module.exports = { inspectFont };
  else global.AtelierFonts = { inspectFont };
})(globalThis);
