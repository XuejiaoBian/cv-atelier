'use strict';
const $ = id => document.getElementById(id);
const frame = $('editor'), C = window.CVCore, MM = 96 / 25.4;
const defaultCSS=`
#cv-content{color:#273744}#cv-content h1{font-size:27pt;line-height:1.1;font-weight:650;letter-spacing:-.7px;margin:0 0 6px;color:#1d3545}#cv-content h1 small{font-size:13pt;font-weight:450;letter-spacing:0;color:#637888}#cv-content .role{font-size:10.5pt;color:#416777;font-weight:600;margin:0 0 7px}#cv-content .contact{font-size:8.5pt;color:#687b85;border-bottom:1.5pt solid #274e60;padding-bottom:12px;margin:0}#cv-content .contact a{color:inherit;text-decoration:none}#cv-content h2{font-size:9pt;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#2b5768;margin:0 0 7px;border-bottom:.6pt solid #d1dce1;padding-bottom:4px}#cv-content h2 span{font-weight:400;letter-spacing:0;color:#7d8f98;margin-left:6px}#cv-content h3{font-size:10.5pt;font-weight:650;margin:0 0 2px;color:#233d4a}#cv-content .date{float:right;font-size:8.5pt;font-weight:400;color:#6b7e87}#cv-content .company{font-size:9pt;color:#587580;margin:0 0 4px}#cv-content p{margin:0 0 5px}#cv-content ul{padding-left:15px;margin:4px 0 9px}#cv-content li{padding-left:2px;margin:3px 0}#cv-content li::marker{color:#466c7e}#cv-content .credential{margin-bottom:7px}#cv-content .credential:last-child{margin-bottom:0}#cv-content .skills p{margin-bottom:4px}#cv-content .skills strong{font-weight:600;color:#2a5364}#cv-content .job{margin-bottom:10px}#cv-content .job:last-child{margin-bottom:0}#cv-content .job:last-child ul{margin-bottom:0}
`;
// Fictional example: not the user's qualifications or employment history.
const sample=`
<section><h1>Mei Lin <small>MBBS, DPhil · 林玫</small></h1><p class="role">Physician–Scientist | Clinical Development & Translational Medicine</p><p class="contact">Cambridge, UK · Open to global opportunities &nbsp; | &nbsp; <a href="mailto:mei.lin@example.com">mei.lin@example.com</a> &nbsp; | &nbsp; <a href="https://example.com/mei-lin">Professional profile ↗</a></p></section>
<section><h2>Professional profile <span>专业概述</span></h2><p>Physician–scientist with six years across patient care, translational oncology, and early clinical development. Combines medical judgment with biomarker strategy and quantitative evidence to advance targeted therapies. Experienced in Phase I/II study design, safety review, and investigator engagement; seeking a clinical development or medical affairs role in biopharma.</p></section>
<section><h2>Clinical & industry experience <span>工作经历</span></h2>
<article class="job"><h3>Senior Clinical Scientist, Oncology <span class="date">2024–Present</span></h3><p class="company">Arcwell Therapeutics · Cambridge, UK</p><ul><li>Co-developed a Phase II protocol, eligibility criteria, and biomarker plan for a targeted therapy program spanning 18 sites in four countries.</li><li>Integrated clinical, safety, and pharmacodynamic evidence into dose-expansion recommendations for a cross-functional governance team.</li><li>Established a medical data-review workflow with clinical operations and biostatistics, reducing median query-resolution time from 12 to 7 days.</li></ul></article>
<article class="job"><h3>Clinical Scientist, Translational Medicine <span class="date">2022–2024</span></h3><p class="company">Northbridge Biopharma · London, UK</p><ul><li>Designed a biomarker analysis plan for a 240-patient oncology study, linking tissue and circulating-DNA findings to clinical outcomes.</li><li>Authored clinical study report sections and investigator materials; partnered with regulatory, safety, and medical writing colleagues.</li><li>Delivered scientific training to 35 study-team members and synthesized investigator feedback into protocol amendments.</li></ul></article>
<article class="job"><h3>Clinical Research Fellow <span class="date">2020–2022</span></h3><p class="company">Cambridge University Hospitals · Cambridge, UK</p><ul><li>Combined supervised clinical care with prospective research; coordinated consent, eligibility review, and follow-up for a 120-participant cohort.</li><li>Led an interdisciplinary analysis of treatment-response predictors and mentored two junior researchers in reproducible data analysis.</li></ul></article></section>
<section><h2>Medical education <span>医学教育</span></h2><div class="credential"><h3>DPhil, Oncology <span class="date">2016–2020</span></h3><p>University of Oxford · Competitive doctoral scholarship. Research in tumor–immune interactions and translational biomarkers.</p></div><div class="credential"><h3>MBBS, Medicine — Distinction <span class="date">2010–2016</span></h3><p>University College London · Clinical medicine, pharmacology, and evidence-based practice; distinction in final examinations.</p></div></section>
<section><h2>Research & scientific contribution <span>科研成果</span></h2><ul><li>Nine peer-reviewed publications, including three first-author papers; research spanning oncology biomarkers and clinical outcomes.</li><li>Presented translational findings at international oncology meetings and contributed to two multidisciplinary grant proposals.</li><li>Built documented R analysis workflows for survival analysis, cohort characterization, and publication-quality figures.</li></ul></section>
<section class="skills"><h2>Expertise & credentials <span>专业技能</span></h2><p><strong>Clinical development:</strong> Phase I/II protocols · Medical data review · Benefit–risk assessment · Investigator engagement</p><p><strong>Translational science:</strong> Biomarker strategy · Oncology · Clinical evidence synthesis · Scientific communication</p><p><strong>Methods & training:</strong> R · Survival analysis · Good Clinical Practice training · Research ethics</p><p><strong>Languages:</strong> English, fluent · Mandarin Chinese, native（中文母语）</p></section>`;
const defaults = () => ({mt:18,mb:18,ml:20,mr:20,line:1.5,gap:18,cjk:true,font:'sans',size:11,cjkFace:'sc'});
const cjkNames = {sc:'Noto Sans SC',tc:'Noto Sans TC',jp:'Noto Sans JP',kr:'Noto Sans KR'};
let settings = {...defaults(),mt:15,mb:15,ml:17,mr:17,line:1.35,gap:12,font:'source',size:10.5}, zoom=.85, range=null, toolbarRange=null, mode='text';
let history=[], historyIndex=-1, dirty=false, selected=-1, dragIndex=-1, saveTimer, activeDrag=null;
let fontManifest=[], fontCache=new Map(), licenseCache=new Map(), linkRange=null, linkTargets=[];
let observedRoot=null, selectionTick=null, loadingFonts=0;
const resizeObserver = new ResizeObserver(() => measure());
function doc() { return frame.contentDocument; }
function root() { return doc()?.getElementById('cv-content'); }
function family(key) {
  const fallback = `"${cjkNames[settings.cjkFace] || cjkNames.sc}", "Noto Sans JP", "Noto Sans KR", sans-serif`;
  if(key?.startsWith('local:'))return JSON.stringify(key.slice(6))+', '+fallback;
  const families = {sans:'"Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif',tc:'"Noto Sans TC", "Noto Sans JP", "Noto Sans KR", sans-serif',jp:'"Noto Sans JP", "Noto Sans KR", sans-serif',kr:'"Noto Sans KR", "Noto Sans JP", sans-serif',inter:'"Inter", '+fallback,source:'"Source Sans 3", '+fallback,plex:'"IBM Plex Sans", '+fallback,serif:'Georgia, "Songti SC", SimSun, serif',system:'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'};
  return families[key] || families.sans;
}
function fontFace(face, url) {
  return `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url("${url}") format("truetype")}`;
}
function fontStyles() {
  return fontManifest.map(f => `<style data-atelier-font-file="${f.file}">${fontFace(f,fontCache.get(f.file) || new URL('fonts/'+f.file,location.href).href)}</style>`).join('');
}
function pageCSS() {
  return `html,body{margin:0!important;padding:0!important;background:white!important}#cv-page{box-sizing:border-box!important;width:210mm!important;min-height:297mm;padding:${settings.mt}mm ${settings.mr}mm ${settings.mb}mm ${settings.ml}mm!important;margin:0!important;background:white;position:relative}
#cv-content{outline:none!important;min-height:20px;font-family:${family(settings.font)};font-size:${settings.size}pt;line-height:${settings.line};line-break:${settings.cjk?'strict':'auto'};overflow-wrap:break-word;word-break:normal;column-gap:9mm;column-count:1!important}
#cv-content [data-atelier-page-wrapper]{width:100%!important;max-width:none!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;margin:0!important;overflow:visible!important;box-shadow:none!important;column-count:1!important}
#cv-content:has(>[data-atelier-page-wrapper]){column-count:1!important}
#cv-content [data-atelier-columns]{column-gap:8mm;column-fill:balance}#cv-content [data-atelier-columns]>h1,#cv-content [data-atelier-columns]>h2{column-span:all}#cv-content [data-atelier-columns="2"]{break-inside:auto}#cv-content [data-atelier-columns="2"]>article{break-inside:avoid}#cv-content section{margin-bottom:${settings.gap}pt;break-inside:avoid}#cv-content section:last-child{margin-bottom:0}#cv-content h1,#cv-content h2,#cv-content h3{break-after:avoid}#cv-content p,#cv-content li{orphans:2;widows:2}#cv-content img{max-width:100%;height:auto}#cv-content a{cursor:text}#cv-content[data-editor-mode="layout"]{user-select:none;cursor:move}#cv-content[data-editor-mode="layout"] *{cursor:move!important}#cv-content [data-active-section]{outline:1px dashed #a5bb97;outline-offset:5px}
@page{size:A4 portrait;margin:${settings.mt}mm ${settings.mr}mm ${settings.mb}mm ${settings.ml}mm}@media print{html,body{width:auto!important;height:auto!important;overflow:visible!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}#cv-page{width:auto!important;min-height:0!important;height:auto!important;padding:0!important;box-shadow:none!important}#cv-content{min-height:0!important}#cv-content [data-active-section]{outline:none!important}}`;
}
function setupHTML(content,styles='',attrs='') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${styles}${fontStyles()}${localWindowsStyles()}<style id="atelier-page-style">${pageCSS()}</style></head><body><div id="cv-page"><div id="cv-content" ${attrs} contenteditable="true" spellcheck="false">${content}</div></div></body></html>`;
}
function rememberSelection() {
  if (!root() || mode !== 'text') return;
  const s = doc().getSelection();
  if (s?.rangeCount && root().contains(s.anchorNode) && root().contains(s.focusNode)) range=s.getRangeAt(0).cloneRange();
}
function validRange(r) { return !!r && root()?.contains(r.startContainer) && root()?.contains(r.endContainer); }
function preserveForToolbar() { rememberSelection(); toolbarRange=validRange(range)?range.cloneRange():null; }
function restoreSelection(r=toolbarRange || range) {
  frame.contentWindow.focus();
  if (validRange(r)) { const s=doc().getSelection(); s.removeAllRanges(); s.addRange(r); range=r.cloneRange(); return r; }
  return null;
}
function normalizePageWrapper() {
  const children=[...root().children].filter(e=>!e.matches('style,link'));
  const wrapper=children.length===1?children[0]:null;
  if (!wrapper || wrapper.matches('p,h1,h2,h3,ul,ol,table')) return;
  const style=frame.contentWindow.getComputedStyle(wrapper);
  if (wrapper.matches('.sheet,.page,.resume-page,[data-atelier-page-wrapper]') || parseFloat(style.width)>=750 || parseFloat(style.height)>=1050) {
    wrapper.dataset.atelierPageWrapper='';
  }
}
function load(content,styles,attrs='') {
  range=toolbarRange=null; selected=-1;
  frame.onload=() => {
    const d=doc(), r=root();
    normalizePageWrapper();
    d.addEventListener('selectionchange',() => {
      // Focus on a native select/input must not replace the saved editor selection.
      if (document.activeElement!==frame || mode!=='text' || activeDrag) return;
      rememberSelection(); toolbarRange=null;
      clearTimeout(selectionTick); selectionTick=setTimeout(updateFormatting,30);
    });
    r.addEventListener('beforeinput',()=>flush());
    r.addEventListener('input',()=>{
      dirty=true; clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>{snapshot();refresh();},300);
      rememberSelection();measure();
    });
    r.addEventListener('click',e=>{
      if (e.target.closest('a')) e.preventDefault();
      const i=getBlocks().findIndex(b=>b===e.target||b.contains(e.target));
      if (i>=0) selectSection(i,false,false);
      if (mode==='text') { rememberSelection(); toolbarRange=null; updateFormatting(); }
    });
    r.addEventListener('dblclick',e=>{
      if (mode==='layout') { e.preventDefault(); setMode('text'); editSelected(); }
    });
    r.addEventListener('pointerdown',e=>{
      if (mode!=='layout'||e.button!==0) return;
      const i=getBlocks().findIndex(b=>b===e.target||b.contains(e.target));
      if (i<0) return;
      e.preventDefault();selectSection(i,false,false);startDrag(e,1);
    });
    d.addEventListener('keydown',handleKey);
    r.addEventListener('paste',e=>{
      e.preventDefault(); if(mode!=='text') return; flush();
      const html=e.clipboardData.getData('text/html');
      if(html) d.execCommand('insertHTML',false,sanitize(html).body.innerHTML);
      else d.execCommand('insertText',false,e.clipboardData.getData('text/plain'));
      changed();
    });
    if(observedRoot) resizeObserver.unobserve(observedRoot);
    observedRoot=r;resizeObserver.observe(r);
    history=[];historyIndex=-1;applySettings(false);setMode('text');snapshot();refresh();fit();
    d.fonts?.addEventListener('loading',()=>{ $('font-status').textContent='Loading bundled fonts…'; });
    d.fonts?.addEventListener('loadingdone',()=>{ $('font-status').textContent='Fonts ready';measure();updateFormatting(); });
    d.fonts?.addEventListener('loadingerror',()=>{ $('font-status').textContent='A font could not load'; });
    d.fonts?.ready.then(()=>{measure();updateFormatting();});
  };
  frame.srcdoc=setupHTML(content,styles,attrs);
}
function cleanClone() {
  const c=root().cloneNode(true);
  c.removeAttribute('data-editor-mode');c.removeAttribute('contenteditable');
  c.querySelectorAll('[data-active-section]').forEach(e=>e.removeAttribute('data-active-section'));
  return c;
}
function snapshot() {
  if(!root()) return;
  const s=JSON.stringify({html:cleanClone().innerHTML,style:root().getAttribute('style')||'',settings});
  if(history[historyIndex]===s) return;
  history=history.slice(0,historyIndex+1);history.push(s);
  if(history.length>120) history.shift();
  historyIndex=history.length-1;updateUndo();
}
function flush() { clearTimeout(saveTimer);snapshot(); }
function changed() { dirty=true;snapshot();refresh();updateFormatting(); }
function undo(direction) {
  flush();const next=historyIndex+direction;
  if(next<0||next>=history.length)return;
  historyIndex=next;const s=JSON.parse(history[next]);
  root().innerHTML=s.html;root().setAttribute('style',s.style);settings=s.settings;
  range=toolbarRange=null;dirty=true;selected=Math.min(selected,getBlocks().length-1);
  applySettings(false);refresh();updateUndo();updateFormatting();
}
function updateUndo() { $('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1; }
function targetForFormatting() {
  const scope=$('scope').value;
  const r=validRange(toolbarRange)?toolbarRange:validRange(range)?range:null;
  if(scope==='auto'&&mode==='text'&&r&&!r.collapsed) return {root:root(),range:r,label:'Selected text'};
  if(scope==='section') return {root:getBlocks()[selected],range:null,label:'Selected section'};
  if(scope==='document') return {root:root(),range:null,label:'Whole document'};
  return {root:root(),range:null,bodyOnly:true,label:'Body text · headings preserved'};
}
function styleText(property,value) {
  const target=targetForFormatting();
  if(!target.root){toast('Select a section on the page first.');return;}
  flush();
  const result=C.format(target.root,target.range,{[property]:value},target.bodyOnly);
  if(!result){toast('Select some text to format.');return;}
  if(!target.range && target.root===root()) {
    if(property==='font-size'){settings.size=parseFloat(value);root().style.fontSize=value;}
    if(property==='font-family'){root().style.fontFamily=value;settings.font=[...$('font').options].map(o=>o.value).find(k=>k&&family(k)===value)||settings.font;}
    applySettings(false);
  }
  if(target.range) { range=result;toolbarRange=result.cloneRange();restoreSelection(result); }
  else { range=toolbarRange=null;doc().getSelection()?.removeAllRanges(); }
  changed();
}
function updateFormatting() {
  if(!root()||activeDrag)return;
  updateBulletState();
  const target=targetForFormatting();
  const nodes=target.root?C.textNodes(target.root,target.range,target.bodyOnly):[];
  const sizes=new Set(),families=new Set();
  for(const node of nodes) {
    const s=frame.contentWindow.getComputedStyle(node.parentElement);
    sizes.add(String(Math.round(parseFloat(s.fontSize)*(s.fontSize.endsWith('pt')?1:.75)*100)/100));
    families.add(s.fontFamily.replace(/["']/g,'').split(',')[0].trim().toLowerCase());
  }
  const uniqueSize=sizes.size===1?[...sizes][0]:'';
  if(document.activeElement!==$('size'))$('size').value=uniqueSize==='NaN'?'':uniqueSize;
  const primary=families.size===1?[...families][0]:'';
  const key=[...$('font').options].map(o=>o.value).find(k=>k&&family(k).replace(/["']/g,'').split(',')[0].trim().toLowerCase()===primary);
  if(document.activeElement!==$('font'))$('font').value=key||'';
  $('format-context').textContent=target.label+(sizes.size>1?' · mixed sizes':'');
  $('size').title=sizes.size>1?'Mixed sizes — enter an exact size for this scope':`Font size in points · ${target.label}`;
}
function updateBulletState() {
  const button=$('bullets');
  const r=validRange(toolbarRange)?toolbarRange:validRange(range)?range:null;
  button.disabled=mode!=='text'||!r;
  let state='false';
  if(r) {
    const element=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement;
    const nodes=r.collapsed?[element]:C.textNodes(root(),r).map(n=>n.parentElement);
    const bulletFlags=nodes.map(n=>n.closest('li')?.parentElement?.tagName==='UL');
    if(bulletFlags.length&&bulletFlags.every(Boolean))state='true';
    else if(bulletFlags.some(Boolean))state='mixed';
  }
  button.setAttribute('aria-pressed',state);
  button.classList.toggle('active',state==='true');
  button.classList.toggle('mixed',state==='mixed');
  button.title=state==='true'?'Remove bullets from the current paragraph or selection':'Add bullets to the current paragraph or selection';
}
function updateSectionColumns() {
  const section=getBlocks()[selected];
  const count=section ? Number(section.dataset.atelierColumns || parseInt(frame.contentWindow.getComputedStyle(section).columnCount,10)) || 1 : 0;
  for(const [id,value] of [['single',1],['columns',2]]) {
    const button=$(id);button.disabled=!section;button.classList.toggle('active',count===value);button.setAttribute('aria-pressed',String(count===value));
  }
  $('column-target').textContent=section?'Editing: '+labelFor(section,selected):'Choose a section above or on the page to set its columns.';
}
function setSectionColumns(count) {
  const section=getBlocks()[selected];
  if(!section){toast('Select a section on the page first.');return;}
  flush();section.dataset.atelierColumns=String(count);
  section.style.setProperty('column-count',String(count),'important');
  section.style.setProperty('column-width','auto','important');
  changed();
}
function command(cmd,value) {
  if(mode!=='text'){toast('Switch to Text to format a passage.');return;}
  const r=toolbarRange||range;
  if(!validRange(r)){toast('Click or select text on the page first.');return;}
  flush();restoreSelection(r);doc().execCommand(cmd,false,value);rememberSelection();toolbarRange=range?.cloneRange();changed();
}
function getBlocks() {
  if(!root())return [];
  let b=[...root().children].filter(x=>!x.matches('style,link,script'));
  while(b.length===1 && b[0].children.length>1 && !b[0].matches('section,p,h1,h2,h3,ul,ol,table')) b=[...b[0].children].filter(x=>!x.matches('style,link,script'));
  return b;
}
function labelFor(b,i) { const h=b.querySelector('h1,h2,h3');return (h?.textContent||b.textContent||`Section ${i+1}`).trim().slice(0,40); }
function refresh() {
  const list=$('sections');list.replaceChildren();
  const blocks=getBlocks();
  blocks.forEach((b,i)=>{
    b.toggleAttribute('data-active-section',i===selected&&mode==='text');
    const item=document.createElement('div');item.className='section-item'+(i===selected?' active':'');item.draggable=true;
    const handle=document.createElement('span');handle.className='handle';handle.textContent='⠿';handle.setAttribute('aria-hidden','true');item.append(handle);
    const button=document.createElement('button');button.className='section-name';button.textContent=labelFor(b,i);button.title=button.textContent;
    button.onclick=()=>{selectSection(i,true,true);$('section-settings-heading').scrollIntoView({block:'nearest'});};item.append(button);
    for(const [direction,label] of [[-1,'↑'],[1,'↓']]){
      const m=document.createElement('button');m.className='move';m.textContent=label;m.disabled=i+direction<0||i+direction>=blocks.length;
      m.setAttribute('aria-label',`${direction<0?'Move up':'Move down'} ${button.textContent}`);m.onclick=()=>moveSection(i,i+direction);item.append(m);
    }
    item.ondragstart=e=>{dragIndex=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';};
    item.ondragover=e=>{e.preventDefault();item.classList.add('drag-over');};item.ondragleave=()=>item.classList.remove('drag-over');
    item.ondrop=e=>{e.preventDefault();item.classList.remove('drag-over');if(dragIndex>=0)moveSection(dragIndex,i);dragIndex=-1;};item.ondragend=()=>dragIndex=-1;
    list.append(item);
  });
  updatePositionInputs();updateSectionColumns();measure();
}
function selectSection(i,scroll=false,focus=false) {
  if(!getBlocks()[i])return;selected=i;refresh();
  if(scroll){const y=getBlocks()[i].getBoundingClientRect().top*zoom;$('canvas').scrollTo({top:Math.max(0,y-60),behavior:'smooth'});}
  if(focus&&mode==='layout')$('section-box').focus({preventScroll:true});
  updateFormatting();
}
function moveSection(from,to) {
  const b=getBlocks();if(!b[from]||!b[to]||from===to)return;
  if(b[from].parentElement!==b[to].parentElement){toast('These sections use different containers. Use Position sections to move them.');return;}
  flush();b[to].parentElement.insertBefore(b[from],from<to?b[to].nextSibling:b[to]);selected=to;range=toolbarRange=null;changed();
}
function setMode(next) {
  mode=next;document.body.classList.toggle('position-mode',mode==='layout');
  $('text-mode').classList.toggle('active',mode==='text');$('layout-mode').classList.toggle('active',mode==='layout');
  $('text-mode').setAttribute('aria-pressed',String(mode==='text'));$('layout-mode').setAttribute('aria-pressed',String(mode==='layout'));
  if(root()){root().contentEditable=String(mode==='text');root().dataset.editorMode=mode;}
  if(mode==='layout'){rememberSelection();range=toolbarRange=null;doc().getSelection()?.removeAllRanges();}
  $('mode-hint').textContent=mode==='layout'?'Click a section and drag to snap. Arrow keys: 0.25 mm · Shift: 1 mm.':'Select text to format. Switch to Position sections to move a section.';
  refresh();updateFormatting();
}
function editSelected() {
  const b=getBlocks()[selected];if(!b)return;setMode('text');
  const r=doc().createRange();r.selectNodeContents(b);r.collapse(true);range=r;toolbarRange=null;restoreSelection(r);
}
function updatePositionInputs() {
  const b=getBlocks()[selected],p=b?C.position(b):{x:0,y:0};
  for(const [id,key] of [['pos-x','x'],['pos-y','y']]){ $(id).disabled=!b;if(document.activeElement!==$(id))$(id).value=p[key]; }
}
function positionOverlay() {
  const b=getBlocks()[selected],box=$('section-box');
  box.hidden=mode!=='layout'||!b;
  if(box.hidden)return;
  const r=b.getBoundingClientRect();Object.assign(box.style,{left:r.left*zoom+'px',top:22+r.top*zoom+'px',width:r.width*zoom+'px',height:r.height*zoom+'px'});
  $('selected-label').textContent=labelFor(b,selected);
}
function snapTargets(block) {
  const targets=[{x:settings.ml},{x:210-settings.mr},{x:(settings.ml+210-settings.mr)/2},{y:settings.mt}];
  for(const b of getBlocks()) if(b!==block){const r=b.getBoundingClientRect();targets.push({x:r.left/MM},{x:r.right/MM},{y:r.top/MM},{y:r.bottom/MM});}
  return targets;
}
function showGuides(guides) {
  $('snap-guides').replaceChildren();
  for(const g of guides){const el=document.createElement('div');el.className='snap-guide '+g.axis;el.style[g.axis==='x'?'left':'top']=(g.value*MM*zoom+(g.axis==='y'?22:0))+'px';$('snap-guides').append(el);}
}
function startDrag(e,scale) {
  const block=getBlocks()[selected];if(!block)return;e.preventDefault();flush();
  const initial=C.position(block),rect=block.getBoundingClientRect();
  const base={left:rect.left/MM-initial.x,top:rect.top/MM-initial.y,width:rect.width/MM,height:rect.height/MM};
  const owner=e.target.ownerDocument,target=e.target,targets=snapTargets(block);
  const start={x:e.clientX,y:e.clientY,scroll:$('canvas').scrollTop};
  activeDrag={block,initial};target.setPointerCapture?.(e.pointerId);
  const move=event=>{
    const x=initial.x+(event.clientX-start.x)/scale/MM;
    const y=initial.y+(event.clientY-start.y)/scale/MM;
    const snapped=C.snapPosition(x,y,base,targets,$('snap').checked&&!event.altKey);
    C.setPosition(block,snapped.x,snapped.y);positionOverlay();updatePositionInputs();showGuides(snapped.guides);
  };
  const finish=event=>{
    if(event.type==='pointercancel')C.setPosition(block,initial.x,initial.y);
    owner.removeEventListener('pointermove',move);owner.removeEventListener('pointerup',finish);owner.removeEventListener('pointercancel',finish);
    try{target.releasePointerCapture(e.pointerId);}catch{}
    activeDrag=null;showGuides([]);changed();
    if(owner===document)$('section-box').focus({preventScroll:true});
  };
  owner.addEventListener('pointermove',move);owner.addEventListener('pointerup',finish);owner.addEventListener('pointercancel',finish);
}
function nudge(dx,dy) {
  const b=getBlocks()[selected];if(!b)return;flush();const p=C.position(b);C.setPosition(b,p.x+dx,p.y+dy);changed();
}
function handleKey(e) {
  const modifier=e.ctrlKey||e.metaKey;
  const input=e.target.closest?.('input,select,textarea');
    if(modifier&&e.key.toLowerCase()==='s'){e.preventDefault();saveDesktopProject(e.shiftKey);return;}
    if(modifier&&e.key.toLowerCase()==='o'){e.preventDefault();openDesktopDocument();return;}
    if(modifier&&e.key.toLowerCase()==='p'){e.preventDefault();exportDesktopPDF(true);return;}
  if(modifier&&e.key.toLowerCase()==='z'&&!input){e.preventDefault();undo(e.shiftKey?1:-1);return;}
  if(modifier&&e.key.toLowerCase()==='k'&&!input){e.preventDefault();rememberSelection();openLink();return;}
  if(input||document.querySelector('dialog[open]'))return;
  if(mode==='layout'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!modifier){
    e.preventDefault();const step=e.shiftKey?1:.25;nudge(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);
  }
  if(mode==='layout'&&e.key==='Enter'){e.preventDefault();editSelected();}
  if(mode==='layout'&&e.key==='Escape'){e.preventDefault();setMode('text');}
}
function applySettings(record=true) {
  for(const id of ['mt','mb','ml','mr','line','gap'])$(id).value=settings[id];
  $('cjk').checked=settings.cjk;$('cjk-face').value=settings.cjkFace||'sc';
  $('line-value').textContent=Number(settings.line).toFixed(2).replace(/0$/,'');$('gap-value').textContent=settings.gap+' pt';
  updateSectionColumns();
  doc().getElementById('atelier-page-style').textContent=pageCSS();if(record){dirty=true;snapshot();}measure();
}
function measure() {
  if(!root())return;
  const page=doc().getElementById('cv-page'),blocks=getBlocks(),rects=blocks.map(b=>b.getBoundingClientRect());
  const maxBottom=Math.max(0,...rects.map(r=>r.bottom));
  const height=Math.max(297*MM,page.getBoundingClientRect().height,maxBottom+settings.mb*MM);
  frame.style.width=210*MM+'px';frame.style.height=height+'px';frame.style.transform=`scale(${zoom})`;
  $('paper-wrap').style.width=210*MM*zoom+'px';$('paper-wrap').style.height=height*zoom+22+'px';$('zoom-reset').textContent=Math.round(zoom*100)+'%';
  const text=root().innerText||root().textContent;
  const cjk=(text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)||[]).length;
  const words=text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g,' ').trim().split(/\s+/).filter(Boolean).length;
  $('word-count').textContent=`${words} words${cjk?' · '+cjk+' CJK characters':''}`;
  const offPage=rects.some(r=>r.left<settings.ml*MM-2||r.right>(210-settings.mr)*MM+2||r.top<settings.mt*MM-2);
  const overlap=rects.some((r,i)=>rects.some((s,j)=>j>i&&Math.min(r.right,s.right)-Math.max(r.left,s.left)>3&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>3));
  const overflow=maxBottom>(297-settings.mb)*MM+2||root().scrollWidth>root().clientWidth+2;
  $('health').classList.toggle('warning',offPage||overlap||overflow);
  $('health-title').textContent=overlap?'Sections overlap':offPage?'Outside the margins':overflow?'Check page fit':'Room to breathe';
  $('health-text').textContent=overlap?'Move the highlighted section or adjust spacing to avoid covering text.':offPage?'A section extends beyond the printable content area.':overflow?'Content exceeds one A4 page. Review page breaks in print preview.':'Your CV fits on one A4 page.';
  $('doc-status').textContent=dirty?'Edited · save to keep changes':'Ready to edit';positionOverlay();
}
function fit(){zoom=Math.min(1,Math.max(.2,($('canvas').clientWidth-(innerWidth<=600?24:60))/(210*MM)));measure();}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function openLink() {
  if(mode!=='text'){toast('Switch to Text, then select text or click an existing link.');return;}
  const r=validRange(toolbarRange)?toolbarRange:validRange(range)?range:null;
  if(!r){toast('Select text or place the cursor in your CV first.');return;}
  linkRange=r.cloneRange();linkTargets=C.linksInRange(root(),linkRange);
  const existing=linkTargets.length===1?linkTargets[0]:null;
  $('link-title').textContent=existing?'Edit link':'Add a link';$('link-url').value=existing?.getAttribute('href')||'';
  $('link-text').value=existing?.textContent||linkRange.toString();$('link-text').disabled=!linkRange.collapsed&&!existing;
  $('link-remove').hidden=linkTargets.length===0;$('link-description').textContent=existing?'Update the address or remove the link.':linkRange.collapsed?'Enter the text to insert at your cursor.':'Selected text keeps its formatting.';
  $('link-error').textContent='';$('link-dialog').showModal();$('link-url').focus();
}
function applyLink(e) {
  e.preventDefault();const href=C.validURL($('link-url').value);
  if(!href){$('link-error').textContent='Use a valid https:// address, email, mailto:, tel:, or #anchor.';return;}
  if(!validRange(linkRange)){ $('link-error').textContent='Select the text again before applying this link.';return; }
  flush();const existing=linkTargets.length===1?linkTargets[0]:null;
  if(existing&&root().contains(existing)){
    existing.setAttribute('href',href);
    if($('link-text').value!==existing.textContent)existing.textContent=$('link-text').value||href;
  }else C.addLink(root(),linkRange,href,$('link-text').value);
  $('link-dialog').close();range=toolbarRange=null;changed();toast('Link updated.');
}
function removeLink() {
  flush();linkTargets.filter(a=>root().contains(a)).forEach(C.unwrap);$('link-dialog').close();range=toolbarRange=null;changed();toast('Link removed; text preserved.');
}
function sanitize(html) {
  const p=new DOMParser().parseFromString(html,'text/html');
  p.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],form,input,button,textarea,select').forEach(el=>el.remove());
  p.querySelectorAll('*').forEach(el=>{
    for(const a of [...el.attributes]){
      if(/^on/i.test(a.name)||a.name==='srcdoc'||(/^(href|src|action|xlink:href)$/i.test(a.name)&&/^[\s\u0000-\u0020]*(javascript|vbscript):/i.test(a.value.replace(/[\u0000-\u0020]/g,''))))el.removeAttribute(a.name);
    }
    el.removeAttribute('contenteditable');el.removeAttribute('data-active-section');el.removeAttribute('data-editor-mode');
  });
  return p;
}
async function importFile(file,{throwOnError=false,skipConfirmation=false}={}) {
  if(!file)return;
  if(file.size>256*1024*1024){throw Error('The document exceeds the 256 MB limit.');}
  if(!/\.html?$/i.test(file.name)){
    if(throwOnError)throw Error('Choose an .html or .htm document.');
    toast('Choose an .html or .htm document.');return;
  }
  if(dirty&&!skipConfirmation&&!confirm('Import a new CV? Unsaved changes in this tab will be replaced. Save HTML first if you need them.'))return;
  const previous={settings,dirty,filename:$('filename').value,documentKind:$('document-kind').textContent};
  try {
    const p=sanitize(await file.text());settings=defaults();
    const saved=p.querySelector('meta[name="atelier-settings"]');
    if(saved)try{
      const v=JSON.parse(saved.content);
      for(const k of ['mt','mb','ml','mr'])settings[k]=Math.max(5,Math.min(45,Number(v[k])||settings[k]));
      settings.line=Math.max(1.1,Math.min(2,Number(v.line)||1.5));settings.gap=Math.max(4,Math.min(32,Number(v.gap)||18));
      settings.cjk=v.cjk!==false;settings.cjkFace=cjkNames[v.cjkFace]?v.cjkFace:'sc';
      settings.font=(typeof v.font==='string'&&v.font.startsWith('local:')&&v.font.length<506)||['sans','tc','jp','kr','inter','source','plex','serif','system'].includes(v.font)?v.font:'sans';settings.size=Math.max(6,Math.min(72,Number(v.size)||11));
    }catch{}
    p.querySelectorAll('#atelier-page-style').forEach(el=>el.remove());
    p.querySelectorAll('style[data-atelier-font-file]').forEach(el=>{
      const file=el.dataset.atelierFontFile;
      const match=el.textContent.match(/url\(["']?(data:font\/ttf;base64,[A-Za-z0-9+/=]+)["']?\)/);
      if(match&&fontManifest.some(f=>f.file===file))fontCache.set(file,match[1]);
      el.remove();
    });
    const styles=[...p.head.querySelectorAll('style,link[rel="stylesheet"]')].map(x=>x.outerHTML).join('');
    const original=p.querySelector('#cv-content')||p.body,holder=p.createElement('div');
    for(const attr of ['style','class','dir','lang'])if(original.hasAttribute(attr))holder.setAttribute(attr,original.getAttribute(attr));
    const attrs=holder.outerHTML.match(/^<div(.*?)>/s)[1];
    dirty=false;$('document-kind').textContent='Local document';$('filename').value=file.name.replace(/\.html?$/i,'');load(original.innerHTML,styles,attrs);
    frame.addEventListener('load',()=>toast('Imported. Select Body text and enter 12 pt to normalize nested text styles.'),{once:true});
  } catch(error){
    settings=previous.settings;dirty=previous.dirty;
    $('filename').value=previous.filename;$('document-kind').textContent=previous.documentKind;
    console.error(error);toast('This HTML file could not be opened.');
    if(throwOnError)throw error;
  }
  finally{$('file').value='';}
}
function usedFontFiles() {
  const needed=new Set();
  for(const node of C.textNodes(root())){
    const cs=frame.contentWindow.getComputedStyle(node.parentElement);
    const names=cs.fontFamily.replace(/["']/g,'').split(',').map(s=>s.trim());
    const primary=names[0];
    const families=[primary];
    if(!primary.startsWith('Noto Sans')&&/[\u3400-\u9fff]/.test(node.data))families.push(names.find(n=>/^Noto Sans/.test(n)));
    if(/[\u3040-\u30ff]/.test(node.data)&&primary!=='Noto Sans JP')families.push('Noto Sans JP');
    if(/[\uac00-\ud7af]/.test(node.data)&&primary!=='Noto Sans KR')families.push('Noto Sans KR');
    for(const name of families){const faces=fontManifest.filter(f=>f.family===name);const face=faces.find(f=>f.style===cs.fontStyle)||faces.find(f=>f.style==='normal');if(face)needed.add(face.file);}
  }
  return [...needed];
}
async function fontData(file) {
  if(fontCache.has(file))return fontCache.get(file);
  const response=await fetch(new URL('fonts/'+file,location.href));if(!response.ok)throw new Error('Could not load '+file);
  const blob=await response.blob();
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.replace(/^data:[^;]+;/,'data:font/ttf;'));reader.onerror=reject;reader.readAsDataURL(blob);});
  fontCache.set(file,data);return data;
}
async function serialized(embedFonts=true) {
  const clone=doc().documentElement.cloneNode(true);
  clone.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable'));
  clone.querySelectorAll('[data-editor-mode]').forEach(x=>x.removeAttribute('data-editor-mode'));
  clone.querySelectorAll('[data-active-section]').forEach(x=>x.removeAttribute('data-active-section'));
  clone.querySelectorAll('meta[name="atelier-settings"],title').forEach(x=>x.remove());
  const head=clone.querySelector('head'),meta=doc().createElement('meta');meta.name='atelier-settings';meta.content=JSON.stringify(settings);head.append(meta);
  const title=doc().createElement('title');title.textContent=$('filename').value||'Curriculum vitae';head.append(title);
  if(embedFonts){
    const files=usedFontFiles();clone.querySelectorAll('style[data-atelier-font-file]').forEach(x=>x.remove());
    const entries=await Promise.all(files.map(async file=>{
      const face=fontManifest.find(f=>f.file===file),data=await fontData(file);
      if(!licenseCache.has(face.license)){const r=await fetch(new URL('fonts/'+face.license,location.href));if(!r.ok)throw new Error('Font license unavailable');licenseCache.set(face.license,await r.text());}
      return {face,data};
    }));
    for(const {face,data} of entries){const style=doc().createElement('style');style.dataset.atelierFontFile=face.file;style.textContent='/* '+licenseCache.get(face.license).replace(/\*\//g,'* /')+' */\n'+fontFace(face,data);head.append(style);}
  }
  return '<!doctype html>'+clone.outerHTML;
}
async function download() {
  if($('download').disabled)return;flush();$('download').disabled=true;toast('Preparing HTML with embedded fonts…');
  // Clone immediately, and only mark this exact document revision saved.
  const savedRevision=history[historyIndex];
  try{
    const html=await serialized();
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;
    a.download=($('filename').value.replace(/[^\p{L}\p{N} ._-]/gu,'').trim()||'curriculum-vitae')+'.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);flush();if(history[historyIndex]===savedRevision)dirty=false;measure();toast('HTML saved with embedded fonts, links, and section positions.');
  }catch(error){console.error(error);toast('A bundled font could not be embedded. Please retry Save HTML.');}
  finally{$('download').disabled=false;}
}
async function printPDF() {
  $('print-dialog').close();toast('Preparing fonts and images for print…');
  const faces=usedFontFiles().map(file=>fontManifest.find(f=>f.file===file));
  try {
    await Promise.all(faces.map(face=>doc().fonts.load(`${face.style} 400 12px "${face.family}"`,'CV')));
    await doc().fonts.ready;
  } catch { toast('A font could not load. Please retry before exporting.');return; }
  for(const face of faces)if(!doc().fonts.check(`${face.style} 400 12px "${face.family}"`)){toast('A font is still unavailable. Wait for it to load before exporting.');return;}
  await Promise.all([...doc().images].map(img=>img.complete?Promise.resolve():Promise.race([new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});}),new Promise(r=>setTimeout(r,4000))])));
  const old=document.title;document.title=$('filename').value;doc().title=$('filename').value;
  frame.contentWindow.focus();frame.contentWindow.print();document.title=old;
}
// Capture the selection before browser-native controls take focus, including keyboard Tab.
for(const el of document.querySelectorAll('.toolbar,.contextbar'))el.addEventListener('pointerdown',preserveForToolbar,{capture:true});
$('font').onchange=e=>{if(e.target.value)styleText('font-family',family(e.target.value));};
$('size').onchange=e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=6&&n<=72)styleText('font-size',n+'pt');else{toast('Use a font size between 6 and 72 pt.');updateFormatting();}};
$('size').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('size').blur();}};
$('size').onfocus=()=>{$('size').select();};$('size').onblur=()=>setTimeout(updateFormatting,0);
$('font').onblur=()=>setTimeout(updateFormatting,0);
$('scope').onchange=()=>updateFormatting();
$('color').onchange=e=>styleText('color',e.target.value);
$('block').onchange=e=>command('formatBlock',e.target.value);
for(const b of document.querySelectorAll('[data-cmd]')){b.onmousedown=e=>e.preventDefault();b.onclick=()=>command(b.dataset.cmd);}
$('import').onclick=()=>$('file').click();$('file').onchange=e=>importFile(e.target.files[0]);$('download').onclick=download;
$('undo').onclick=()=>undo(-1);$('redo').onclick=()=>undo(1);
$('link').onclick=openLink;$('link-form').onsubmit=applyLink;$('link-remove').onclick=removeLink;
$('text-mode').onclick=()=>setMode('text');$('layout-mode').onclick=()=>{setMode('layout');if(selected<0&&getBlocks().length)selectSection(0,false,true);};
$('section-drag').onpointerdown=e=>startDrag(e,zoom);$('section-edit').onclick=editSelected;
$('section-reset').onclick=()=>{const b=getBlocks()[selected];if(b){flush();C.setPosition(b,0,0);changed();}};
for(const [id,key] of [['pos-x','x'],['pos-y','y']])$(id).onchange=e=>{const b=getBlocks()[selected],value=Number(e.target.value);if(b&&Number.isFinite(value)){flush();const p=C.position(b);p[key]=Math.max(-500,Math.min(500,value));C.setPosition(b,p.x,p.y);changed();}};
for(const id of ['mt','mb','ml','mr','line','gap'])$(id).onchange=e=>{flush();settings[id]=Math.min(Number(e.target.max),Math.max(Number(e.target.min),Number(e.target.value)||Number(e.target.min)));applySettings();};
$('cjk').onchange=e=>{flush();settings.cjk=e.target.checked;applySettings();};
$('cjk-face').onchange=e=>{flush();settings.cjkFace=e.target.value;for(const key of ['inter','source','plex']){for(const el of root().querySelectorAll('[style]')){const f=el.style.fontFamily;if(f&&f.replace(/["']/g,'').split(',')[0].trim()===family(key).replace(/["']/g,'').split(',')[0].trim())el.style.setProperty('font-family',family(key),'important');}}applySettings();updateFormatting();};
$('balanced').onclick=()=>{flush();Object.assign(settings,{mt:18,mb:18,ml:20,mr:20});applySettings();};
$('single').onclick=()=>setSectionColumns(1);$('columns').onclick=()=>setSectionColumns(2);
$('add').onclick=()=>{flush();const section=doc().createElement('section');section.innerHTML='<h2>New section</h2><p>Add your experience here.</p>';const blocks=getBlocks();(blocks[0]?.parentElement||root()).append(section);changed();selectSection(getBlocks().length-1,true,false);editSelected();};
$('guide').onclick=()=>$('help').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('export').onclick=()=>$('print-dialog').showModal();$('print-now').onclick=printPDF;
$('zoom-out').onclick=()=>{zoom=Math.max(.2,zoom-.1);measure();};$('zoom-in').onclick=()=>{zoom=Math.min(1.5,zoom+.1);measure();};$('zoom-reset').onclick=()=>{zoom=1;measure();};$('fit').onclick=fit;
window.addEventListener('resize',fit);document.addEventListener('keydown',handleKey);
fetch(new URL('fonts/manifest.json',location.href)).then(r=>{if(!r.ok)throw new Error('Font catalog unavailable');return r.json();}).then(manifest=>{fontManifest=manifest;load(sample,`<style>${defaultCSS}</style>`);}).catch(error=>{console.error(error);load(sample,`<style>${defaultCSS}</style>`);toast('Font catalog could not load. Reload to use bundled fonts.');});
