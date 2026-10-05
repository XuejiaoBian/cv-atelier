const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkedHTML } = require('../desktop/lib/export-html.cjs');

test('Exported HTML removes executable attributes and controls from a crafted project', () => {
  const html = checkedHTML('<div id="cv-content"><img src="photo.png" onerror="alert(1)" srcset="evil.png 2x"><a href="java&#x73;cript:alert(1)" onclick="alert(2)">Profile</a><a href="https://example.com">Website</a><svg><image xlink:href="vbscript:alert(1)"></image></svg><textarea>unsafe</textarea></div>');
  assert.doesNotMatch(html, /onerror|onclick|srcset|javascript:|vbscript:|textarea/i);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /src="photo.png"/);
});
