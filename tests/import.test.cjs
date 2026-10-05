const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { importHTML } = require('../desktop/lib/import-html.cjs');
test('Import embeds local assets, nested CSS and removes executable content',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-import-'));
  try{
    await fs.writeFile(path.join(dir,'photo.png'),Buffer.from('89504e470d0a1a0a','hex'));
    await fs.writeFile(path.join(dir,'nested.css'),'p{color:blue}');
    await fs.writeFile(path.join(dir,'layout.css'),'@import "nested.css";section{background-image:url(photo.png)}');
    await fs.writeFile(path.join(dir,'cv.html'),'<link rel="stylesheet" href="layout.css"><script>alert(1)</script><section onclick="alert(1)"><img src="photo.png"><img src="https://example.com/remote.png"><p>中文</p></section>');
    const result=await importHTML(path.join(dir,'cv.html'));
    assert.match(result.html,/data:image\/png;base64/);assert.match(result.html,/color:blue/);assert.match(result.html,/中文/);assert.doesNotMatch(result.html,/<script|onclick|src="https:/);assert.equal(result.warnings.length,1);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('HTML cannot copy local files outside its chosen folder',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-boundary-'));
  try{await fs.mkdir(path.join(dir,'cv'));await fs.writeFile(path.join(dir,'private.svg'),'<svg>secret</svg>');await fs.writeFile(path.join(dir,'cv','cv.html'),'<img src="../private.svg">');const result=await importHTML(path.join(dir,'cv','cv.html'));assert.equal(result.warnings.length,1);assert.doesNotMatch(result.html,/secret|base64/);}
  finally{await fs.rm(dir,{recursive:true,force:true});}
});
