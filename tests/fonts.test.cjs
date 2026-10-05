const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { inspectFont } = require('../desktop/ui/font-support.js');
function font(bits){const b=Buffer.alloc(100);b.writeUInt32BE(0x10000,0);b.writeUInt16BE(1,4);b.write('OS/2',12);b.writeUInt32BE(28,20);b.writeUInt32BE(64,24);b.writeUInt16BE(400,32);b.writeUInt16BE(bits,36);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
test('Editable and installable fonts are embedded, restricted/preview/bitmap fonts are not',()=>{
  for(const bits of [0,8,0x108,12])assert.equal(inspectFont(font(bits)).editable,true);
  for(const bits of [2,4,0x200,0x208])assert.equal(inspectFont(font(bits)).editable,false);
  assert.equal(inspectFont(new ArrayBuffer(2)).editable,false);
});
test('Bundled variable font weight ranges are preserved',()=>{
  const b=fs.readFileSync('dist/fonts/inter.ttf');const info=inspectFont(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert.equal(info.editable,true);assert.equal(info.weight,'100 900');
});
