/* Exact text formatting and section geometry. No browser editing commands for fonts. */
(function (global) {
  'use strict';
  const SKIP = 'style,script,svg,math,[data-editor-ui]';
  function textNodes(root, range = null, bodyOnly = false) {
    const walker = root.ownerDocument.createTreeWalker(root, 4);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim() || node.parentElement.closest(SKIP)) continue;
      if (bodyOnly && node.parentElement.closest('h1,h2,h3,h4,h5,h6,[role="heading"]')) continue;
      if (range) {
        if (!range.intersectsNode(node)) continue;
        const from = node === range.startContainer ? range.startOffset : 0;
        const to = node === range.endContainer ? range.endOffset : node.length;
        if (to <= from) continue;
      }
      nodes.push(node);
    }
    return nodes;
  }
  function segments(root, range = null, bodyOnly = false) {
    return textNodes(root, range, bodyOnly).map(node => ({
      node,
      from: range && node === range.startContainer ? range.startOffset : 0,
      to: range && node === range.endContainer ? range.endOffset : node.length
    }));
  }
  function isolate({node, from, to}) {
    if (to < node.length) node.splitText(to);
    return from ? node.splitText(from) : node;
  }
  function format(root, range, properties, bodyOnly = false) {
    const chunks = segments(root, range, bodyOnly);
    const selected = [];
    for (const chunk of chunks.reverse()) {
      const node = isolate(chunk);
      let element = node.parentElement;
      // A dedicated leaf span wins over nested class rules and legacy font tags.
      if (element.tagName !== 'SPAN' || element.childNodes.length !== 1) {
        element = root.ownerDocument.createElement('span');
        node.before(element);
        element.append(node);
      }
      for (const [property, value] of Object.entries(properties)) element.style.setProperty(property, value, 'important');
      selected.unshift(node);
    }
    if (!selected.length) return null;
    const result = root.ownerDocument.createRange();
    result.setStart(selected[0], 0);
    result.setEnd(selected[selected.length - 1], selected[selected.length - 1].length);
    return result;
  }
  function validURL(value) {
    let url = value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) url = 'mailto:' + url;
    if (/^(?:[a-z\d-]+\.)+[a-z]{2,}(?:[/?#:]|$)/i.test(url)) url = 'https://' + url;
    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url)) {
      try { const parsed = new URL(url); if (/^https?:$/.test(parsed.protocol) && !parsed.hostname) return null; return parsed.href; } catch { return null; }
    }
    if (/^#[^\s]+$/.test(url)) return url;
    return null;
  }
  function unwrap(element) { element.replaceWith(...element.childNodes); }
  function linksInRange(root, range) {
    if (!range) return [];
    const parent = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    if (range.collapsed) { const a = parent.closest('a'); return a && root.contains(a) ? [a] : []; }
    return [...root.querySelectorAll('a')].filter(a => range.intersectsNode(a));
  }
  function addLink(root, range, href, label = '') {
    if (!validURL(href)) throw new Error('Unsupported link');
    const d = root.ownerDocument;
    if (!range || range.collapsed) {
      const a = d.createElement('a'); a.setAttribute('href', href); a.textContent = label || href;
      if (range) { range.deleteContents(); range.insertNode(a); } else root.append(a);
      return [a];
    }
    // Keep paragraph boundaries, emphasis, and exact fonts intact.
    const chunks = segments(root, range);
    const links = [];
    for (const chunk of chunks.reverse()) {
      const node = isolate(chunk);
      const ancestor = node.parentElement.closest('a');
      if (ancestor) { ancestor.setAttribute('href', href); links.unshift(ancestor); continue; }
      const a = d.createElement('a'); a.setAttribute('href', href); node.before(a); a.append(node); links.unshift(a);
    }
    return [...new Set(links)];
  }
  function position(element) {
    return {x: Number(element.dataset.atelierX) || 0, y: Number(element.dataset.atelierY) || 0};
  }
  function setPosition(element, x, y) {
    const round = n => Math.round(n * 100) / 100;
    element.dataset.atelierX = String(round(x)); element.dataset.atelierY = String(round(y));
    element.style.setProperty('translate', `${round(x)}mm ${round(y)}mm`, 'important');
  }
  function snapPosition(x, y, base, targets, enabled, threshold = 1.5) {
    if (!enabled) return {x, y, guides: []};
    let dx = threshold, dy = threshold, guideX, guideY;
    for (const target of targets) {
      for (const edge of [0, base.width / 2, base.width]) {
        const diff = target.x - (base.left + x + edge);
        if (Number.isFinite(target.x) && Math.abs(diff) < Math.abs(dx)) { dx = diff; guideX = target.x; }
      }
      for (const edge of [0, base.height]) {
        const diff = target.y - (base.top + y + edge);
        if (Number.isFinite(target.y) && Math.abs(diff) < Math.abs(dy)) { dy = diff; guideY = target.y; }
      }
    }
    return {x: guideX === undefined ? Math.round(x) : x + dx, y: guideY === undefined ? Math.round(y) : y + dy,
      guides: [...(guideX === undefined ? [] : [{axis:'x', value:guideX}]), ...(guideY === undefined ? [] : [{axis:'y', value:guideY}])]};
  }
  const api = {textNodes, format, segments, validURL, unwrap, linksInRange, addLink, position, setPosition, snapPosition};
  if (typeof module !== 'undefined') module.exports = api;
  global.CVCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
