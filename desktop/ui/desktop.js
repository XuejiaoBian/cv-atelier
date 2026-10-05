'use strict';
const installedFaces = new Map(), savedFaces = new Map();
const individualFaces = new Map();
let documentFonts = [], desktopBusy = false, recoveryRevision = '', recoveryBusy = false;
let desktopReadyResolve;
window.desktopReady = new Promise(resolve => { desktopReadyResolve = resolve; });
const genericFamilies = new Set(['serif','sans-serif','monospace','system-ui','cursive','fantasy','inherit','initial']);
function checkResult(result) { if(result?.error)throw Error(result.error); return result; }
async function runDesktop(task) {
  if(desktopBusy)return false;
  desktopBusy=true;
  for(const id of ['import','download','save-project','save-as','export'])$(id).disabled=true;
  try{return await task();}catch(error){console.error(error);toast(error.message);await window.desktop.report(error.message);return false;}
  finally{desktopBusy=false;for(const id of ['import','download','save-project','save-as','export'])$(id).disabled=false;}
}
function addFamily(name, group='Installed Windows fonts') {
  if([...$('font').options].some(o=>o.value==='local:'+name))return;
  let optgroup=[...$('font').querySelectorAll('optgroup')].find(g=>g.label===group);
  if(!optgroup){optgroup=document.createElement('optgroup');optgroup.label=group;$('font').append(optgroup);}
  const option=document.createElement('option');option.value='local:'+name;option.textContent=name;optgroup.append(option);
}
async function refreshLocalFonts() {
  if(!window.queryLocalFonts)throw Error('Windows font access is unavailable in this build.');
  const fonts=await window.queryLocalFonts();installedFaces.clear();individualFaces.clear();
  for(const face of fonts){const key=face.family.toLowerCase();if(!installedFaces.has(key))installedFaces.set(key,[]);installedFaces.get(key).push(face);}
  for(const family of [...new Set(fonts.map(f=>f.family))].sort((a,b)=>a.localeCompare(b)))addFamily(family);
  for(const face of [...fonts].sort((a,b)=>a.fullName.localeCompare(b.fullName))){
    const alias='Atelier face: '+face.postscriptName;individualFaces.set(alias.toLowerCase(),face);
    addFamily(alias,'Individual Windows font faces');
    [...$('font').options].find(o=>o.value==='local:'+alias).textContent=face.fullName;
  }
  if(root()){doc().getElementById('atelier-system-faces')?.remove();doc().head.insertAdjacentHTML('beforeend',localWindowsStyles());}
  $('local-font-count').textContent=`${installedFaces.size} Windows font families`;
  $('replacement-font').replaceChildren(...[...$('font').options].filter(o=>o.value).map(o=>o.cloneNode(true)));
  return fonts.length;
}
function faceReference(face,alias) {
  return `@font-face{font-family:${JSON.stringify(alias)};font-style:normal;font-weight:400;src:local(${JSON.stringify(face.postscriptName)}),local(${JSON.stringify(face.fullName)})}`;
}
function localWindowsStyles() {
  return '<style id="atelier-system-faces">'+[...individualFaces.values()].map(face=>faceReference(face,'Atelier face: '+face.postscriptName)).join('\n')+'</style>';
}
function fontLabel(family){return individualFaces.get(family.toLowerCase())?.fullName||family.replace(/^Atelier face: /,'');}
function usedFamilies() {
  const families=new Map();
  const available=new Set([...installedFaces.keys(),...individualFaces.keys(),...fontManifest.map(f=>f.family.toLowerCase()),...[...savedFaces.values()].map(f=>f.family.toLowerCase())]);
  for(const node of C.textNodes(root())){
    const names=frame.contentWindow.getComputedStyle(node.parentElement).fontFamily.match(/(?:"[^"]*"|'[^']*'|[^,])+/g)||[];
    for(const [index,name] of names.entries()){const clean=name.trim().replace(/^["']|["']$/g,''),key=clean.toLowerCase();if(!genericFamilies.has(key)&&(index===0||available.has(key)))families.set(key,clean);}
  }
  return families;
}
function readEmbeddedFonts() {
  savedFaces.clear();
  for(const el of doc().querySelectorAll('style[data-atelier-local-family]')){
    if(!/data:[^,]+;base64,/.test(el.textContent))continue;
    const family=el.dataset.atelierLocalFamily, postscriptName=el.dataset.atelierPostscript||family;
    savedFaces.set(postscriptName,{family,postscriptName,css:el.textContent});addFamily(family,'Fonts embedded in this project');
  }
}
async function blobData(blob) {
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('A font could not be read.'));r.readAsDataURL(blob);});
}
async function portableHTML() {
  const families=usedFamilies();
  const html=await serialized(true), p=new DOMParser().parseFromString(html,'text/html'), records=[];
  p.querySelector('#atelier-system-faces')?.remove();
  p.querySelectorAll('style[data-atelier-local-family]').forEach(el=>el.remove());
  const bundled=new Set(fontManifest.map(f=>f.family.toLowerCase()));
  function appendFace(face,css){
    const el=p.createElement('style');el.dataset.atelierLocalFamily=face.family;el.dataset.atelierPostscript=face.postscriptName;el.textContent=css;p.head.append(el);
  }
  for(const [key,family] of families){
    if(bundled.has(key))continue;
    const embedded=[...savedFaces.values()].filter(f=>f.family.toLowerCase()===key);
    if(embedded.length){for(const face of embedded){appendFace(face,face.css);records.push({family,postscriptName:face.postscriptName,embedded:true,reason:'Embedded in project'});}continue;}
    const individual=individualFaces.get(key), local=individual?[individual]:installedFaces.get(key);
    if(!local){records.push({family,embedded:false,reason:'Not installed'});continue;}
    for(const face of local){
      try{
        const blob=await face.blob(), info=AtelierFonts.inspectFont(await blob.arrayBuffer());
        records.push({family,postscriptName:face.postscriptName,embedded:info.editable,reason:info.reason});
        if(!info.editable){if(individual)appendFace({...face,family},faceReference(face,family));continue;}
        const data=await blobData(blob);
        appendFace({...face,family},`@font-face{font-family:${JSON.stringify(family)};font-style:${individual?'normal':info.style};font-weight:${individual?'400':info.weight};font-stretch:${individual?'100%':info.stretch};src:url("${data}") format("${info.format}");font-display:swap}`);
      }catch(error){records.push({family,postscriptName:face.postscriptName,embedded:false,reason:'Font data could not be read'});}
    }
  }
  // Every editable document is self-contained. Unsupported external resources
  // are surfaced, rather than silently relying on an Internet connection.
  const external=[...p.querySelectorAll('img')].filter(img=>img.getAttribute('src')&&!/^(data:|atelier:)/.test(img.getAttribute('src')));
  if(external.length)throw Error('This CV contains unavailable images. Import its HTML from the folder containing the images first.');
  return {html:'<!doctype html>'+p.documentElement.outerHTML,fonts:records};
}
async function makeDesktopProject() {
  flush();const name=$('filename').value||'Curriculum vitae', result=await portableHTML();
  return {format:'cv-atelier',version:1,name,savedAt:new Date().toISOString(),html:result.html,fonts:result.fonts};
}
async function saveDesktopProject(saveAs=false) {
  return runDesktop(async()=>{
    while(recoveryBusy)await new Promise(resolve=>setTimeout(resolve,50));
    flush();const revision=history[historyIndex], name=$('filename').value;toast('Saving project and portable fonts…');
    const project=await makeDesktopProject(), result=checkResult(await window.desktop.save(project,saveAs));
    if(result.canceled)return false;
    flush();if(history[historyIndex]===revision&&$('filename').value===name)dirty=false;
    documentFonts=project.fonts;recoveryRevision=dirty?'':history[historyIndex]+name;
    $('document-kind').textContent='Local project';$('filename').title=result.path;
    updateFontIssues();measure();toast('Project saved.');return true;
  });
}
async function canReplaceDocument() {
  if(!dirty)return true;
  const answer=checkResult(await window.desktop.discard());
  if(answer==='cancel')return false;
  if(answer==='save')return await saveDesktopProject()&&!dirty;
  return true;
}
async function applyOpened(result) {
  if(result.canceled)return;
  const project=result.project, html=project?.html||result.html;
  if(!html)return;
  dirty=false;documentFonts=project?.fonts||[];
  const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
  await importFile({name:(project?.name||result.name||'Curriculum vitae')+'.html',size:new Blob([html]).size,text:async()=>html});
  await loaded;readEmbeddedFonts();
  $('filename').value=project?.name||result.name||'Curriculum vitae';
  $('document-kind').textContent=result.recovered?'Recovered CV':project?'Local project':'Imported HTML';
  $('filename').title=result.path||'';dirty=Boolean(result.recovered)||!project;
  recoveryRevision='';updateFontIssues();measure();
  if(result.warnings?.length)await window.desktop.report('The HTML was imported. These assets could not be included offline:\n\n'+result.warnings.join('\n'));
  const missing=missingFamilies();if(missing.length)$('font-issues-dialog').showModal();
}
async function openDesktopDocument(startup=false) {
  if(desktopBusy||!await canReplaceDocument())return;
  return runDesktop(async()=>{
    while(recoveryBusy)await new Promise(resolve=>setTimeout(resolve,50));
    const result=checkResult(await window.desktop[startup?'startup':'open']());
    if(result.canceled)return false;
    if(result.html||result.project){await applyOpened(result);await window.desktop.clearRecovery();}
    return true;
  });
}
async function exportDesktopHTML() {
  return runDesktop(async()=>{
    toast('Preparing HTML with portable fonts…');const result=await portableHTML();
    const saved=checkResult(await window.desktop.exportHTML(result.html,$('filename').value));
    if(!saved.canceled)toast('HTML exported.');return !saved.canceled;
  });
}
async function exportDesktopPDF(print=false) {
  $('print-dialog').close();
  return runDesktop(async()=>{
    flush();toast(print?'Preparing print…':'Preparing A4 PDF…');
    await doc().fonts.ready;
    const result=checkResult(await window.desktop.exportPDF(await serialized(false),$('filename').value,print));
    if(!result.canceled)toast(print?'Sent to printer.':'PDF exported.');return !result.canceled;
  });
}
function missingFamilies() {
  const bundled=new Set(fontManifest.map(f=>f.family.toLowerCase()));
  const embedded=new Set([...savedFaces.values()].map(f=>f.family.toLowerCase()));
  return [...usedFamilies()].filter(([key])=>!bundled.has(key)&&!embedded.has(key)&&!installedFaces.has(key)&&!individualFaces.has(key)).map(([,name])=>name);
}
function updateFontIssues() {
  const missing=missingFamilies(), unavailable=[...new Set(documentFonts.filter(f=>!f.embedded&&f.reason!=='Not installed').map(f=>f.family))];
  const list=$('font-issues-list');list.replaceChildren();
  for(const name of missing){const item=document.createElement('li');item.textContent=fontLabel(name)+' — missing on this computer';list.append(item);}
  for(const name of unavailable){const item=document.createElement('li');item.textContent=fontLabel(name)+' — used locally; not embedded for editing';list.append(item);}
  if(!list.children.length){const item=document.createElement('li');item.textContent='All referenced fonts are installed or embedded.';list.append(item);}
  $('font-issues').textContent=missing.length?`Missing fonts (${missing.length})`:'Font portability';
  $('font-issues').classList.toggle('font-warning',missing.length>0);
  $('missing-font').replaceChildren();
  for(const name of missing){const option=document.createElement('option');option.value=name;option.textContent=fontLabel(name);$('missing-font').append(option);}
  $('font-replacement').hidden=!missing.length;
}
function replaceMissingFont() {
  const old=$('missing-font').value, replacement=$('replacement-font').value;
  if(!old||!replacement)return;
  flush();
  for(const node of C.textNodes(root())){
    const primary=frame.contentWindow.getComputedStyle(node.parentElement).fontFamily.replace(/["']/g,'').split(',')[0].trim();
    if(primary.toLowerCase()!==old.toLowerCase())continue;
    const r=doc().createRange();r.selectNodeContents(node);C.format(root(),r,{'font-family':family(replacement)},false);
  }
  if(settings.font==='local:'+old){settings.font=replacement;root().style.fontFamily=family(replacement);}
  documentFonts=documentFonts.filter(f=>f.family.toLowerCase()!==old.toLowerCase());changed();updateFontIssues();
}
async function autoRecover() {
  if(!dirty||desktopBusy||recoveryBusy||!root())return;
  flush();const revision=history[historyIndex]+$('filename').value;
  if(recoveryRevision===revision)return;
  recoveryBusy=true;
  try{const project=await makeDesktopProject();checkResult(await window.desktop.recover(project));recoveryRevision=revision;$('recovery-status').textContent='Recovery copy saved';}
  catch(error){$('recovery-status').textContent='Recovery failed — save your project';console.error(error);}
  finally{recoveryBusy=false;}
}
async function desktopAction(action) {
  if(action==='open')return openDesktopDocument();
  if(action==='open-startup')return openDesktopDocument(true);
  if(action==='save'||action==='save-as')return saveDesktopProject(action==='save-as');
  if(action==='html')return exportDesktopHTML();
  if(action==='pdf'||action==='print')return exportDesktopPDF(action==='print');
  if(action==='undo')return undo(-1);if(action==='redo')return undo(1);
  if(action==='help')return $('help').showModal();
  if(action==='close'&&!desktopBusy){
    if(!await canReplaceDocument())return;
    // A pending recovery must finish before its file is removed.
    while(recoveryBusy)await new Promise(resolve=>setTimeout(resolve,50));
    await window.desktop.clearRecovery();await window.desktop.close();
  }
}
async function initializeDesktop() {
  const info=checkResult(await window.desktop.info());
  $('desktop-mode').textContent=info.portable?'Portable · offline':'Windows · offline';
  $('desktop-mode').title='Settings and recovery: '+info.dataDirectory;
  while(!root())await new Promise(resolve=>setTimeout(resolve,50));
  try{await refreshLocalFonts();}catch(error){$('local-font-count').textContent='Font access failed';await window.desktop.report(error.message);}
  $('import').textContent='Open…';$('import').onclick=()=>openDesktopDocument();
  $('download').textContent='Export HTML';$('download').onclick=exportDesktopHTML;
  $('save-project').onclick=()=>saveDesktopProject();$('save-as').onclick=()=>saveDesktopProject(true);
  $('export').onclick=()=>exportDesktopPDF();$('print-now').onclick=()=>exportDesktopPDF();
  $('font-issues').onclick=()=>{updateFontIssues();$('font-issues-dialog').showModal();};
  $('replace-font').onclick=replaceMissingFont;
  $('font-refresh').onclick=async()=>{try{await refreshLocalFonts();updateFontIssues();toast('Windows fonts refreshed.');}catch(error){await window.desktop.report(error.message);}};
  $('replacement-font').replaceChildren(...[...$('font').options].filter(o=>o.value).map(o=>o.cloneNode(true)));
  $('filename').addEventListener('input',()=>{dirty=true;measure();});
  $('help').querySelectorAll('p')[3].textContent='Open accepts CV Atelier projects and HTML. Save project bundles the CV, settings, local images and editable fonts. Ctrl S saves; Ctrl Shift S saves a copy; Ctrl O opens; Ctrl P prints. Export HTML creates a portable HTML copy; Export PDF writes an A4 PDF directly. Missing or restricted fonts are listed in Font portability. A recovery copy is saved every 30 seconds while editing.';
  await applyOpened(checkResult(await window.desktop.startup()));
  window.desktop.onAction(action=>desktopAction(action).catch(error=>window.desktop.report(error.message)));
  setInterval(autoRecover,30000);desktopReadyResolve(true);
}
initializeDesktop().catch(error=>{console.error(error);window.desktop.report(error.message);desktopReadyResolve(false);});
