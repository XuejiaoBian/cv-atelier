'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { decodeProject } = require('../desktop/lib/project.cjs');
module.exports = async function ({ mainWindow, testPaths, recoveryFile }) {
  const wc=mainWindow.webContents, directory=path.join(__dirname,'..','test-output');
  await fs.mkdir(directory,{recursive:true});
  wc.on('console-message',event=>{if(event.level==='error')console.log('Renderer:',event.message);});
  const execute=source=>wc.executeJavaScript(source,true);
  assert.equal(await execute('window.desktopReady'),true,'Desktop initialization');
  await require('./ui-layout-smoke.cjs')(mainWindow, directory);
  const counts=await execute('({families:installedFaces.size,faces:[...installedFaces.values()].flat().length,fonts:fontManifest.length,secure:window.isSecureContext})');
  assert.ok(counts.secure);assert.ok(counts.families>0);assert.equal(counts.fonts,10);console.log('FONT CATALOG',JSON.stringify(counts));
  assert.equal(await execute('typeof window.require'),'undefined');
  assert.equal(await execute('fetch("https://example.com/").then(()=>false,()=>true)'),true,'No remote requests');
  await execute('root().innerHTML=`<section><h1>Desktop test · 桌面测试</h1><p>Portable CV / 中文简历</p><p><a href="https://example.com">Professional profile</a></p></section>`;$("filename").value="Offline test";$("scope").value="document";styleText("font-family",family("local:Arial"));changed();');
  assert.equal(await execute('settings.font'),'local:Arial');
  const projectFile=path.join(directory,'offline-test.cvatelier');testPaths.push(projectFile);
  assert.equal(await execute('saveDesktopProject(true)'),true);
  const project=decodeProject(await fs.readFile(projectFile));
  assert.match(project.html,/中文简历/);assert.ok(project.fonts.some(f=>f.family==='Arial'));
  console.log('FONT EMBEDDING',JSON.stringify(project.fonts));
  const pdfFile=path.join(directory,'offline-test.pdf');testPaths.push(pdfFile);
  assert.equal(await execute('exportDesktopPDF()'),true);
  assert.equal((await fs.readFile(pdfFile)).subarray(0,5).toString(),'%PDF-');
  const htmlFile=path.join(directory,'offline-test.html');testPaths.push(htmlFile);
  assert.equal(await execute('exportDesktopHTML()'),true);assert.match(await fs.readFile(htmlFile,'utf8'),/中文简历/);
  await execute('root().innerHTML="<p>Replaced</p>";changed();');
  testPaths.push(projectFile);await execute('openDesktopDocument()');
  assert.match(await execute('root().textContent'),/中文简历/);assert.equal(await execute('dirty'),false);
  assert.equal(await execute('doc().fonts.check("12px Arial")'),true);
  // Simulate moving a document to a computer without one referenced font.
  await execute('C.format(root().querySelector("p"),null,{"font-family":"Definitely Missing CV Font"},false);changed();updateFontIssues();');
  assert.ok((await execute('missingFamilies()')).includes('Definitely Missing CV Font'));
  await execute('$("missing-font").value="Definitely Missing CV Font";$("replacement-font").value="source";replaceMissingFont();');
  assert.ok(!(await execute('missingFamilies()')).includes('Definitely Missing CV Font'));
  await execute('autoRecover()');assert.match(decodeProject(await fs.readFile(recoveryFile)).html,/中文简历/);
  await execute('$("scope").value="document";styleText("font-family",family("local:Atelier face: ArialNarrow"));');
  const individual=await execute('makeDesktopProject()');assert.ok(individual.fonts.some(f=>f.family==='Atelier face: ArialNarrow'&&f.embedded));
  await execute('dirty=false');testPaths.push(htmlFile);await execute('openDesktopDocument()');assert.match(await execute('root().textContent'),/中文简历/);
  assert.equal(await execute('desktopBusy'),false);assert.equal(await execute('$("save-project").disabled'),false);
  // A catalog refresh removes vanished fonts without losing a bundled selection.
  await execute('addFamily("Removed smoke font");$("scope").value="document";styleText("font-family",family("source"));');
  await execute('refreshLocalFonts()');
  assert.equal(await execute('[...$("font").options,...$("replacement-font").options].some(o=>o.value==="local:Removed smoke font")'),false);
  assert.equal(await execute('$("font").value'),'source');
  const refreshedFonts=await execute(`(async()=>{
    const query=window.queryLocalFonts, has=value=>[...$('font').options].some(o=>o.value===value);
    try {
      window.queryLocalFonts=async()=>[{family:'Temporary installed font',postscriptName:'TemporaryFace',fullName:'Temporary installed font Regular'}];
      savedFaces.set('SmokeEmbedded',{family:'Smoke embedded font',postscriptName:'SmokeEmbedded',css:''});
      await refreshLocalFonts();
      const before=has('local:Temporary installed font')&&has('local:Atelier face: TemporaryFace');
      window.queryLocalFonts=async()=>[];
      await refreshLocalFonts();
      const removed=!has('local:Temporary installed font')&&!has('local:Atelier face: TemporaryFace');
      const embeddedKept=has('local:Smoke embedded font');
      readEmbeddedFonts();
      return {before,removed,embeddedKept,oldEmbeddedRemoved:!has('local:Smoke embedded font')};
    } finally {window.queryLocalFonts=query;await refreshLocalFonts();}
  })()`);
  assert.deepEqual(refreshedFonts,{before:true,removed:true,embeddedKept:true,oldEmbeddedRemoved:true});
  // Failed import must reject promptly, retain unsaved work and release Open.
  const failedOpen=await execute(`(async()=>{
    const originalSanitize=sanitize, before=root().innerHTML, previousSettings=JSON.stringify(settings), name=$('filename').value;
    dirty=true; sanitize=()=>{throw Error('Simulated invalid import');};
    try {
      const result=await Promise.race([
        runDesktop(()=>applyOpened({html:'<p>Invalid import</p>',name:'Replacement'})),
        new Promise(resolve=>setTimeout(()=>resolve('timed out'),2000))
      ]);
      return {result,dirty,busy:desktopBusy,unchanged:root().innerHTML===before,
        sameSettings:JSON.stringify(settings)===previousSettings,sameName:$('filename').value===name};
    } finally {sanitize=originalSanitize;dirty=false;}
  })()`);
  assert.equal(failedOpen.result,false,'Failed imports reject instead of hanging');
  assert.equal(failedOpen.dirty,true,'Failed import retains unsaved state');
  assert.equal(failedOpen.busy,false);
  assert.equal(failedOpen.unchanged,true);
  assert.equal(failedOpen.sameSettings,true);
  assert.equal(failedOpen.sameName,true);
  await new Promise(resolve=>setTimeout(resolve,300));
  const screenshot=await wc.capturePage();await fs.writeFile(path.join(directory,'desktop.png'),screenshot.toPNG());
  console.log('DESKTOP SMOKE PASSED: offline startup, fonts, project save/reopen, HTML, PDF, font replacement/refresh, recovery, failed-import preservation.');
};
