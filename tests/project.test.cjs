const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { encodeProject, decodeProject, atomicWrite } = require('../desktop/lib/project.cjs');
const project = { format:'cv-atelier', version:1, name:'林玫 CV', html:'<!doctype html><div id="cv-content"><p>中文 / English</p></div>', fonts:[{family:'Arial',embedded:false}] };
test('Project round trip preserves bilingual content and font references', () => assert.deepEqual(decodeProject(encodeProject(project)),project));
test('Reject unsupported versions, truncated files and invalid font records', () => {
  assert.throws(()=>encodeProject({...project,version:2}));
  assert.throws(()=>encodeProject({...project,fonts:[{}]}));
  const data=encodeProject(project);assert.throws(()=>decodeProject(data.subarray(0,data.length-10)));
  assert.throws(()=>decodeProject(Buffer.from('not a project')));
});
test('Atomic save replaces a project without leaving temporary files', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atelier-save-'));
  try{const file=path.join(directory,'中文.cvatelier');await atomicWrite(file,encodeProject(project));await atomicWrite(file,encodeProject({...project,name:'Updated'}));assert.equal(decodeProject(await fs.readFile(file)).name,'Updated');assert.deepEqual(await fs.readdir(directory),['中文.cvatelier']);}
  finally{await fs.rm(directory,{recursive:true,force:true});}
});
