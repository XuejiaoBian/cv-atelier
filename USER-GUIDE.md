# CV Atelier for Windows

Windows 10/11 · Intel/AMD 64-bit · Offline desktop edition

## Start the app

**Portable:** extract the complete `CV-Atelier-1.0.0-x64-portable.zip` into a writable folder, then open `CV Atelier.exe`. Keep `portable.json` and every other extracted file together. Settings and the recovery copy live in the adjacent `data` folder. Move the whole folder to move the application and settings. Keep your saved CV projects in that folder too if you want them to travel together. Close the app before moving the folder or removing a USB drive.

**Installer:** run `CV-Atelier-1.0.0-x64-setup.exe`. No administrator access or Internet connection is required. Settings and recovery live in `%APPDATA%\CV Atelier`. Projects are saved wherever you choose. Uninstalling leaves your documents and settings intact.

The runtime, editor and bundled bilingual fonts are included. The app has no sign-in, cloud sync, telemetry or automatic network updates. Future releases are installed or unpacked manually. The existing website is retained as-is; this desktop edition is the continuing product.

## Save and export

- **Open / Ctrl O:** open `.cvatelier`, `.html` or `.htm` files.
- **Save project / Ctrl S:** save a self-contained `.cvatelier` project with content, layout settings, images and fonts that permit editable embedding.
- **Save as / Ctrl Shift S:** save a project under another name or location.
- **Export HTML:** create a standalone HTML copy. Exporting does not replace the project's Save operation.
- **Export PDF:** save an A4 PDF directly, with selectable text and hyperlinks.
- **Print / Ctrl P:** open the Windows printer dialog.

A recovery copy is saved every 30 seconds while the document has unsaved changes. On the next start after an unexpected exit, choose Recover CV to continue, then save it as a project. Closing normally prompts you to save or discard unsaved changes. Recovery keeps the latest unsaved document, not a document history.

## Editing layout

The left sidebar lists document sections. Select a section there or on the page, then use **Selected section** in the left sidebar to switch between one and two columns. Choose **Position sections** above the page to reveal that section's horizontal and vertical position controls. The left sidebar scrolls when its contents exceed the window height; the page preview and right sidebar scroll separately.

The right sidebar contains page-wide settings: A4 paper, margins, typography, and page fit. Changes there affect the whole document. In the left sidebar, use the arrows beside a section to change its order. Drag a section in **Position sections** mode to adjust its location; double-click it to edit its text.

## Fonts and migration

The font menu lists bundled fonts and installed Windows font families. Use **Font portability** to refresh the catalog, inspect missing fonts or replace a missing family. Bold and italic choose the relevant face within a family. Windows fonts can be used without copying them into the app.

Project and HTML exports embed complete font faces when the font's OpenType permission flags permit installable or editable embedding. Fonts limited to preview/print, restricted embedding, bitmap-only embedding or unreadable permission metadata remain references. These fonts still work on a computer where they are installed; on another computer, install the same licensed font or use the replacement control. Font flags do not supersede the supplier's separate license terms. Embedded fonts stay inside the document and are never installed system-wide.

## Import an HTML CV offline

Open the HTML from a folder containing its images, font files and stylesheets. Relative assets inside that folder are embedded, including nested CSS. Internet assets, absolute file paths, assets outside that folder, unsupported files and fonts without editable embedding permission are reported. Prepare an offline copy of those assets in the HTML's folder and update its references before import. Links in the CV remain hyperlinks in exports, but the editor does not navigate to websites.

Projects have a 256 MB uncompressed size limit; individual imported assets have a 50 MB limit, and source HTML has a 100 MB limit. All four bundled CJK families remain available as fallbacks. The font selected in the toolbar may not cover every character; fallback fonts supply missing glyphs.

## Development

`npm ci`, `npm test`, `npm run test:desktop`, `npm start`, `npm run dist`.

Source for the offline edition is in `desktop/`. The original website in `dist/` is preserved. Builds use Electron and electron-builder. The installer and portable ZIP contain their own runtime; build-time dependency downloads require Internet, app use does not. The build is unsigned unless the distributor configures a signing certificate.

Font embedding follows the [Microsoft OpenType OS/2 specification](https://learn.microsoft.com/en-us/typography/opentype/spec/os2). Bundled font license texts are included beside the font files in `resources/fonts`.
