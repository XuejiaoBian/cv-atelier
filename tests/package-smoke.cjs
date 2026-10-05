'use strict';
// Pass the installed Playwright module path as the first argument.
const { chromium } = require(process.argv[2] || 'playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory=path.resolve('test-output/portable-qa');
const child=spawn(path.join(directory,'CV Atelier.exe'),['--remote-debugging-port=9224'],{cwd:directory,windowsHide:true,stdio:'ignore'});
(async()=>{
  let browser;
  try{
    for(let i=0;i<80;i++){
      try{await fetch('http://127.0.0.1:9224/json/version');break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}
    }
    browser=await chromium.connectOverCDP('http://127.0.0.1:9224');
    const context=browser.contexts()[0];let page;
    for(let i=0;i<80;i++){
      page=context.pages().find(p=>p.url().startsWith('atelier://app'));
      if(page)break;await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(page,'Packaged editor window');assert.equal(await page.evaluate(()=>window.desktopReady),true);
    const info=await page.evaluate(()=>window.desktop.info());
    assert.equal(info.portable,true);assert.equal(path.resolve(info.dataDirectory),path.join(directory,'data'));
    assert.ok(await page.evaluate(()=>installedFaces.size>0&&individualFaces.size>0));
    assert.equal(await page.evaluate(()=>typeof require),'undefined');
    assert.ok(await page.locator('#save-project').isEnabled());
    await page.setViewportSize({width:1040,height:760});
    const exportBounds=await page.locator('#export').boundingBox();assert.ok(exportBounds.x+exportBounds.width<=1040,'Header controls fit at minimum width');
    await page.setViewportSize({width:1440,height:960});await page.screenshot({path:'test-output/packaged-desktop.png'});
    assert.equal(await page.evaluate(()=>fetch('https://example.com/').then(()=>false,()=>true)),true);
    await fs.access(path.join(directory,'resources','fonts','notosanssc.ttf'));
    await fs.access(path.join(directory,'resources','app.asar'));
    console.log('PACKAGED PORTABLE PASSED: runtime, bundled fonts, installed font faces, adjacent settings, minimum-window controls, no network.');
    await page.evaluate(()=>window.desktop.close()).catch(error=>{if(!/closed/.test(error.message))throw error;});
  }finally{if(browser)await browser.close().catch(()=>{});if(child.exitCode===null)child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
