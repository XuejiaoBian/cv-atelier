'use strict';
const { app, BrowserWindow, protocol, session, ipcMain, dialog, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { encodeProject, decodeProject, atomicWrite, MAX_BYTES } = require('./lib/project.cjs');
const { importHTML } = require('./lib/import-html.cjs');
const cheerio = require('cheerio');
const ORIGIN = 'atelier://app';
app.setName('CV Atelier');
app.setAppUserModelId('com.cvatelier.desktop');
const ENTRY = ORIGIN + '/index.html';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; frame-src 'self' about:; object-src 'none'; base-uri 'none'; form-action 'none'";
protocol.registerSchemesAsPrivileged([{ scheme: 'atelier', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const smoke = !app.isPackaged && process.argv.includes('--smoke-test');
const portable = process.env.CVATELIER_PORTABLE_DIR || (app.isPackaged && require('node:fs').existsSync(path.join(path.dirname(process.execPath), 'portable.json')) ? path.dirname(process.execPath) : null);
if (portable) app.setPath('userData', path.join(portable, 'data'));
if (smoke) app.setPath('userData', path.join(__dirname, '..', 'test-output', 'profile'));
const recoveryFile = path.join(app.getPath('userData'), 'recovery.cvatelier');
let mainWindow, currentPath = null, closing = false, startupFile = process.argv.find(arg => /\.cvatelier$/i.test(arg));
const prints = new Map();
const testPaths = [];
function safeName(value) { return (String(value || 'Curriculum vitae').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 120) || 'Curriculum vitae').replace(/[. ]+$/, ''); }
async function pickSave(defaultPath, filters) {
  if (smoke) return testPaths.shift();
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath, filters });
  return result.canceled ? null : result.filePath;
}
async function readProject(filename) {
  if ((await fs.stat(filename)).size > MAX_BYTES) throw Error('The project exceeds the 256 MB limit.');
  const project = decodeProject(await fs.readFile(filename));
  currentPath = filename;
  return { project, path: filename };
}
function checkSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== ENTRY) throw Error('This operation is available only in the desktop editor.');
}
function handle(channel, action) {
  ipcMain.handle('atelier:' + channel, async (event, ...args) => {
    checkSender(event);
    try { return await action(...args); }
    catch (error) { return { error: error.message }; }
  });
}
function checkedHTML(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_BYTES) throw Error('The document exceeds the 256 MB limit.');
  const $ = cheerio.load(html);
  $('script,iframe,object,embed,base,meta[http-equiv],form,input,button').remove();
  return $.html();
}
async function writeRecovery(project) { await atomicWrite(recoveryFile, encodeProject(project)); return { ok: true }; }
async function saveProject(project, saveAs) {
  const bytes = encodeProject(project);
  let filename = !saveAs && currentPath ? currentPath : await pickSave(safeName(project.name) + '.cvatelier', [{ name: 'CV Atelier project', extensions: ['cvatelier'] }]);
  if (!filename) return { canceled: true };
  if (!/\.cvatelier$/i.test(filename)) filename += '.cvatelier';
  await atomicWrite(filename, bytes); currentPath = filename;
  await fs.rm(recoveryFile, { force: true });
  return { path: filename };
}
async function exportPDF(html, name, print) {
  const id = randomUUID(); prints.set(id, checkedHTML(html));
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  try {
    await win.loadURL(ORIGIN + '/print/' + id);
    await win.webContents.executeJavaScript(`(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));})()`);
    if (print) {
      if (smoke) return { ok: true };
      const result = await new Promise(resolve => win.webContents.print({ silent: false, printBackground: true, pageSize: 'A4' }, (success, reason) => resolve({ success, reason })));
      return result.success ? { ok: true } : { canceled: true, reason: result.reason };
    }
    const filename = await pickSave(safeName(name) + '.pdf', [{ name: 'PDF document', extensions: ['pdf'] }]);
    if (!filename) return { canceled: true };
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, generateTaggedPDF: true });
    await atomicWrite(filename, pdf);
    return { path: filename };
  } finally { prints.delete(id); win.destroy(); }
}
handle('info', () => ({ version: app.getVersion(), portable: Boolean(portable), dataDirectory: app.getPath('userData') }));
handle('open', async () => {
  let filename;
  if (smoke) filename = testPaths.shift();
  else {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'CV Atelier / HTML', extensions: ['cvatelier','html','htm'] }] });
    if (result.canceled) return { canceled: true }; filename = result.filePaths[0];
  }
  if (!filename) return { canceled: true };
  if (/\.cvatelier$/i.test(filename)) return readProject(filename);
  const result = await importHTML(filename); currentPath = null; return result;
});
handle('startup', async () => {
  if (startupFile) { const filename = startupFile; startupFile = null; return readProject(filename); }
  try {
    await fs.access(recoveryFile);
    const answer = smoke ? 0 : (await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Recover your CV', message: 'An unsaved CV is available from the previous session.', buttons: ['Recover CV','Discard'], defaultId: 0, cancelId: 0 })).response;
    if (answer === 0) return { project: decodeProject(await fs.readFile(recoveryFile)), recovered: true };
    await fs.rm(recoveryFile, { force: true });
  } catch (error) { if (error.code !== 'ENOENT') return { error: 'Recovery could not be read: ' + error.message }; }
  return {};
});
handle('save', saveProject);
handle('export-html', async (html, name) => {
  const data = checkedHTML(html), filename = await pickSave(safeName(name) + '.html', [{ name: 'HTML document', extensions: ['html'] }]);
  if (!filename) return { canceled: true }; await atomicWrite(filename, Buffer.from(data)); return { path: filename };
});
handle('export-pdf', exportPDF);
handle('recover', writeRecovery);
handle('clear-recovery', async () => { await fs.rm(recoveryFile, { force: true }); return { ok: true }; });
handle('discard', async () => smoke ? 'discard' : ['save','discard','cancel'][(await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Save your CV?', message: 'This CV has unsaved changes.', buttons: ['Save project','Discard changes','Cancel'], defaultId: 0, cancelId: 2 })).response]);
handle('close', () => { closing = true; mainWindow.close(); return { ok: true }; });
handle('report', async message => {
  if (!smoke) await dialog.showMessageBox(mainWindow, { type: 'info', title: 'CV Atelier', message: message.slice(0, 20000) });
  return { ok: true };
});
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
  app.on('second-instance', (_, args) => {
    const filename = args.find(arg => /\.cvatelier$/i.test(arg));
    if (filename) { startupFile = filename; mainWindow?.webContents.send('atelier:action', 'open-startup'); }
    if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.focus();
  });
  app.whenReady().then(async () => {
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    // Confirm that the portable folder supports settings/recovery writes.
    const probe = path.join(app.getPath('userData'), '.write-test');
    await fs.writeFile(probe, ''); await fs.rm(probe);
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin, details) => permission === 'local-fonts' && wc === mainWindow?.webContents && details.isMainFrame !== false && (origin === ORIGIN || origin === ORIGIN + '/'));
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => callback(permission === 'local-fonts' && wc === mainWindow?.webContents && details.isMainFrame !== false));
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !/^(atelier:|data:|blob:|about:)/.test(details.url) }));
    const ui = path.join(__dirname, 'ui'), fonts = app.isPackaged ? path.join(process.resourcesPath, 'fonts') : path.join(__dirname, '..', 'dist', 'fonts');
    protocol.handle('atelier', async request => {
      try {
        const url = new URL(request.url);
        if (url.host !== 'app') return new Response('Not found', { status: 404 });
        const headers = { 'Content-Security-Policy': CSP };
        if (url.pathname.startsWith('/print/')) {
          const html = prints.get(url.pathname.slice(7));
          return new Response(html || 'Not found', { status: html ? 200 : 404, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
        }
        const isFont = url.pathname.startsWith('/fonts/'), base = isFont ? fonts : ui;
        const relative = decodeURIComponent(isFont ? url.pathname.slice(7) : url.pathname.slice(1) || 'index.html');
        const filename = path.resolve(base, relative), inside = path.relative(base, filename);
        if (inside.startsWith('..') || path.isAbsolute(inside)) return new Response('Forbidden', { status: 403 });
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
        return new Response(await fs.readFile(filename), { headers: { ...headers, 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' } });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    mainWindow = new BrowserWindow({ title: 'CV Atelier', width: 1440, height: 960, minWidth: 1040, minHeight: 700, show: !smoke, backgroundColor: '#f9faf8', icon: path.join(__dirname, '..', 'build', 'icon.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== ENTRY) event.preventDefault(); });
    mainWindow.webContents.on('will-frame-navigate', event => { if (event.url !== ENTRY && event.url !== 'about:srcdoc' && event.url !== 'about:blank') event.preventDefault(); });
    mainWindow.on('close', event => { if (!closing) { event.preventDefault(); mainWindow.webContents.send('atelier:action', 'close'); } });
    const action = name => () => mainWindow.webContents.send('atelier:action', name);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [
        { label: 'Open project or HTML…', accelerator: 'CmdOrCtrl+O', click: action('open') },
        { label: 'Save project', accelerator: 'CmdOrCtrl+S', click: action('save') },
        { label: 'Save project as…', accelerator: 'CmdOrCtrl+Shift+S', click: action('save-as') },
        { type: 'separator' }, { label: 'Export HTML…', click: action('html') }, { label: 'Export PDF…', click: action('pdf') },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: action('print') }, { type: 'separator' }, { label: 'Exit', click: action('close') }
      ] },
      { label: 'Edit', submenu: [{ label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: action('undo') }, { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: action('redo') }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'Help', submenu: [{ label: 'Editing shortcuts', click: action('help') }, { label: 'About CV Atelier', click: async () => dialog.showMessageBox(mainWindow, { title: 'CV Atelier', message: `CV Atelier ${app.getVersion()}\nWindows offline edition\n${portable ? 'Portable' : 'Installed'} mode\nSettings and recovery: ${app.getPath('userData')}` }) }] }
    ]));
    await mainWindow.loadURL(ENTRY);
    if (smoke) {
      try { await require('../tests/desktop-smoke.cjs')({ mainWindow, testPaths, recoveryFile, readProject, writeRecovery, saveProject, exportPDF }); closing = true; app.exit(0); }
      catch (error) { console.error(error); closing = true; app.exit(1); }
    }
  }).catch(error => { dialog.showErrorBox('CV Atelier could not start', error.message + (portable ? '\nMove the portable folder to a writable location.' : '')); app.exit(1); });
}
app.on('window-all-closed', () => app.quit());
