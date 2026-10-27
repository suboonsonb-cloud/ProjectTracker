# Initiatives Tracker Desk — source

Standard layout for development. Users still get **one file** (`dist/SGA_Tracker_Desk.html`).

```
index.html                 page markup; loads css/ and js/ (open it directly to run in dev)
css/desk.css               all styles
js/00-config.js            workbook column map (CFG, field letters)
js/01-core.js              utilities, today, ZIP + XLSX read/write, records
js/02-calc.js              live calculation engine (mirrors the Excel formulas)
js/03-io.js                open / save workbook, modal
js/04-dashboard.js         views router, dashboard, zoom panel, banners
js/05-benefit-analysis.js  benefit realisation & analysis chart
js/06-list-editor.js       list pages, editor drawer, delete
js/07-realisation.js       ✓ Actuals
js/08-gantt.js             Gantt report
js/09-projects.js          project workspace, task Gantt, benefit plan + plan vs actual
js/10-settings.js          master data, combobox, settings, review changes
js/11-sync.js              sync from the old 2T Club file
js/12-projects-list.js     Projects list (simple/table), filters, E2E bar, RAIDD panel
js/13-studio-embed.js      GENERATED from studio/ by build.py — do not edit
js/14-e2e.js               E2E flows
js/15-boot.js              start-up
studio/Swimlane_Studio.html  swimlane editor (runs inside the E2E page)
build.py                   bundles everything into dist/
```

## Build
```
python build.py          # dist/SGA_Tracker_Desk.html (readable single file)
python build.py --min    # + dist/SGA_Tracker_Desk.min.html (minified, needs esbuild: npm i -g esbuild)
```
Run `build.py` after editing `studio/Swimlane_Studio.html` (it regenerates `js/13-studio-embed.js`).

## Notes
- Scripts are classic (no modules) so the page works from `file://` (double-click, OneDrive, offline).
  All files share one global scope; load order = the order in `index.html`.
- In the built file all scripts become one `<script>`, so behaviour is identical to the dev page.

## SharePoint-link mode
Paste the .xlsx link → sign in → the Desk reads and saves the file in SharePoint directly (no OneDrive sync).
Needs once: IT registers an Entra app (Single-page application, redirect URI http://localhost:8765/SGA_Tracker_Desk.html,
Microsoft Graph delegated Files.ReadWrite.All). Put the Client ID in GRAPH_DEFAULT (js/03c-sharepoint.js) before building,
or users enter it once in the app ("How to set it up"). Start the Desk with dist/Start_Tracker_Desk.cmd.
