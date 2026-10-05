'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function (mainWindow, directory) {
  const wc = mainWindow.webContents;
  const execute = source => wc.executeJavaScript(source, true);
  const originalSize = mainWindow.getSize();
  const original = await execute('({html:root().innerHTML, selected, mode})');
  try {
    // A long outline must scroll inside its pane instead of painting over status bars.
    await execute(`root().innerHTML = Array.from({length:24}, (_,i) => '<section><h2>Section '+(i+1)+'</h2><p>Layout verification text.</p></section>').join(''); selected=-1; setMode('text');`);
    for (const [width, height] of [[1440, 960], [1040, 700]]) {
      mainWindow.setSize(width, height);
      await execute('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const layout = await execute(`(() => {
        const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
        const panes = ['.outline','#canvas','.properties'].map(selector => ({selector, ...rect(selector), overflow:getComputedStyle(document.querySelector(selector)).overflowY}));
        const footer = rect('footer'), desktopFooter=rect('.desktop-footer');
        const outline=document.querySelector('.outline'); outline.scrollTop=outline.scrollHeight;
        const properties=document.querySelector('.properties'); properties.scrollTop=properties.scrollHeight;
        return {panes,footer,desktopFooter,height:innerHeight,width:innerWidth,bodyWidth:document.body.scrollWidth,
          guide:rect('#guide'),privacy:rect('.privacy'),outlineScroll: outline.scrollHeight>outline.clientHeight,
          sectionPane:document.querySelector('#columns').closest('aside')?.className,
          pagePane:document.querySelector('#mt').closest('aside')?.className};
      })()`);
      for (const pane of layout.panes) {
        assert.ok(pane.bottom <= layout.footer.top + 1, `${width}: ${pane.selector} extends under footer`);
        assert.ok(['auto','scroll','hidden'].includes(pane.overflow), `${width}: ${pane.selector} allows content to paint beyond pane`);
      }
      assert.ok(layout.outlineScroll, 'Long outline can scroll');
      assert.ok(layout.guide.bottom <= layout.footer.top + 1, 'Last outline control is reachable above footer');
      assert.ok(layout.privacy.bottom <= layout.footer.top + 1, 'Last page settings text is reachable above footer');
      assert.ok(layout.footer.bottom <= layout.desktopFooter.top + 1, 'Status bars do not overlap');
      assert.ok(layout.desktopFooter.bottom <= layout.height + 1, 'Recovery status remains in viewport');
      assert.ok(layout.bodyWidth <= layout.width + 1, 'App shell does not overflow horizontally');
      assert.notEqual(layout.sectionPane, layout.pagePane, 'Section and page controls have separate panes');
      await fs.writeFile(path.join(directory, `layout-${width}x${height}.png`), (await wc.capturePage()).toPNG());
    }
    const behavior = await execute(`(() => {
      const margins=JSON.stringify([settings.mt,settings.mb,settings.ml,settings.mr]);
      setMode('text'); document.querySelectorAll('.section-name')[1].click();
      const modeAfterSelect=mode; $('columns').click();
      const result={selectedColumns:getBlocks()[1].dataset.atelierColumns,otherColumns:getBlocks()[0].dataset.atelierColumns,
        modeAfterSelect,sameMargins:margins===JSON.stringify([settings.mt,settings.mb,settings.ml,settings.mr])};
      $('layout-mode').click(); $('pos-x').value='2'; $('pos-x').dispatchEvent(new Event('change'));
      result.position=C.position(getBlocks()[1]).x;
      return result;
    })()`);
    assert.equal(behavior.selectedColumns, '2');
    assert.equal(behavior.otherColumns, undefined);
    assert.equal(behavior.sameMargins, true);
    assert.equal(behavior.modeAfterSelect, 'text', 'Selecting an outline entry preserves text editing mode');
    assert.equal(behavior.position, 2);
    console.log('UI LAYOUT PASSED: long outlines, minimum window, independent scrolling, separate settings, section-only columns and positioning.');
  } finally {
    mainWindow.setSize(...originalSize);
    await execute(`root().innerHTML=${JSON.stringify(original.html)}; selected=${original.selected}; setMode(${JSON.stringify(original.mode)}); document.querySelectorAll('.outline,.properties,#canvas').forEach(el=>el.scrollTop=0);`);
  }
};
