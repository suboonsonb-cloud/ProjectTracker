/* 03b-connect.js — remember the workbook and open it automatically next time (Edge / Chrome).
   The browser never reveals a file's full path; it gives a file *handle* that can be kept in IndexedDB.
   Opening it again needs the browser's permission: Edge/Chrome ask once ("Allow on every visit" = fully automatic). */
"use strict";
const WB_DB = "sga_desk", WB_STORE = "kv";
let WB = { rec: null, perm: "" };                       // remembered {handle, name, at} + current permission
const canRemember = () => !!(window.showOpenFilePicker && window.indexedDB);
function autoOn() { try { return localStorage.getItem("sga_autoconnect") !== "0"; } catch (e) { return true; } }
function setAuto(v) { try { localStorage.setItem("sga_autoconnect", v ? "1" : "0"); } catch (e) { } }
function wbDb() {
  return new Promise((res, rej) => { const r = indexedDB.open(WB_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(WB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function wbGet(k) {
  try { const db = await wbDb(); return await new Promise((res, rej) => { const q = db.transaction(WB_STORE).objectStore(WB_STORE).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  catch (e) { return null; }
}
async function wbPut(k, v) {
  try { const db = await wbDb(); await new Promise((res, rej) => { const t = db.transaction(WB_STORE, "readwrite"); const s = t.objectStore(WB_STORE); v == null ? s.delete(k) : s.put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  catch (e) { }
}
async function rememberWorkbook(h) {
  if (!h || h.kind === "graph" || !canRemember() || !autoOn()) return;
  WB.rec = { handle: h, name: h.name, at: Date.now() }; WB.perm = "granted";
  await wbPut("wb", WB.rec); try { localStorage.setItem("sga_lastsrc", "file"); } catch (e) { } paintConn();
}
async function forgetWorkbook() { await wbPut("wb", null); WB = { rec: null, perm: "" }; paintConn(); }
async function wbPerm(h, ask) {
  try { let p = await h.queryPermission({ mode: "readwrite" }); if (p !== "granted" && ask) p = await h.requestPermission({ mode: "readwrite" }); return p; }
  catch (e) { return "denied"; }
}
/* open the remembered workbook; ask=true only from a click (the browser needs a user gesture to ask) */
async function connectRemembered(ask) {
  const r = WB.rec; if (!r) return false;
  WB.perm = await wbPerm(r.handle, ask);
  if (WB.perm !== "granted") { if (ask) toast("Permission not given — the workbook stays closed", 5000); paintConn(); return false; }
  try { const f = await r.handle.getFile(); await ingest(await f.arrayBuffer(), f.name, r.handle, f.lastModified); return true; }
  catch (e) { toast(`Could not open “${r.name}” (moved, renamed or deleted?) — choose it again`, 7000); return false; }
}
async function bootConnect() {
  if (!canRemember()) return;
  WB.rec = await wbGet("wb"); if (!WB.rec) return;
  WB.perm = await wbPerm(WB.rec.handle, false);
  let last = ""; try { last = localStorage.getItem("sga_lastsrc") || ""; } catch (e) { }
  if (autoOn() && WB.perm === "granted" && !S.zip && last !== "sp") await connectRemembered(false);
  else if (!S.zip) render();
}
/* landing card: reconnect in one click */
function connectCardHtml() {
  if (!canRemember()) return `<p class="muted" style="font-size:12px">This browser cannot remember files — use Microsoft Edge or Google Chrome for automatic connection.</p>`;
  const r = WB.rec;
  const auto = `<label class="connauto"><input type="checkbox" id="connAuto" ${autoOn() ? "checked" : ""}> Remember the workbook and open it automatically next time</label>`;
  if (!r) return auto;
  return `<div class="conncard"><div class="connrow"><span class="connico" aria-hidden="true">🔗</span><div><b>${esc(r.name)}</b><div class="muted" style="font-size:12px">Remembered workbook · last opened ${fmtDate(dateToSerial(new Date(r.at)))}${WB.perm === "granted" ? " · access allowed" : " · the browser will ask once for access"}</div></div></div>
    <p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="connGo">Connect to ${esc(r.name)}</button><button class="btn" id="connOther">Choose another file…</button><button class="btn" id="connForget">Forget it</button></p>${auto}
    <p class="muted" style="font-size:11.5px;margin:6px 0 0">Tip: when Edge / Chrome asks, pick <b>Allow on every visit</b> — then the workbook opens by itself.</p></div>`;
}
function bindConnectCard(root) {
  const g = root.querySelector("#connGo"); if (g) g.onclick = () => connectRemembered(true);
  const o = root.querySelector("#connOther"); if (o) o.onclick = openFile;
  const f = root.querySelector("#connForget"); if (f) f.onclick = async () => { await forgetWorkbook(); render(); toast("Forgotten — choose the workbook next time"); };
  const a = root.querySelector("#connAuto"); if (a) a.onchange = async () => { setAuto(a.checked); if (a.checked && S.handle) await rememberWorkbook(S.handle); if (!a.checked) toast("Auto-open off — the workbook is still remembered until you click Forget"); paintConn(); };
}
/* header chip next to the file name: connection status + settings */
function paintConn() {
  const c = document.getElementById("connChip"); if (!c) return;
  if (S.handle && S.handle.kind === "graph") { c.classList.remove("hidden"); c.classList.add("on"); c.textContent = autoOn() ? "🔗 SharePoint · auto" : "🔗 SharePoint"; c.title = "Connected to SharePoint · click for options"; return; }
  if (!canRemember()) { c.classList.add("hidden"); return; }
  const on = !!(WB.rec && S.handle && WB.rec.name === S.handle.name && autoOn());
  c.classList.remove("hidden"); c.classList.toggle("on", on);
  c.textContent = on ? "🔗 auto-connect on" : "🔗 connect";
  c.title = on ? `Opens “${WB.rec.name}” automatically · click for options` : "Remember a workbook and open it automatically · click for options";
}
async function connMenu() {
  const r = WB.rec;
  const k = await choose("Workbook connection", `<p class="muted">The app remembers the <b>file</b> you pick (the browser does not reveal its folder path) and opens it automatically when you open this page.</p>
    ${r ? `<p>Remembered: <b>${esc(r.name)}</b></p>` : `<p>No workbook remembered yet.</p>`}
    <label class="connauto"><input type="checkbox" id="connAuto2" ${autoOn() ? "checked" : ""}> Open it automatically next time</label>`,
    [["c", "Close"], ...(r ? [["forget", "Forget"]] : []), ["sp", "SharePoint link…"], ["pick", r ? "Choose another file…" : "Choose workbook…", "primary"]]);
  if (k === "sp") { if (!gReady()) { spSetupDialog(); return; } const u = prompt("Paste the SharePoint link of the .xlsx:", (spLinkRec() || {}).url || ""); if (u) await openSpLink(u, true); paintConn(); return; }
  if (k === "pick") { await openFile(); }
  else if (k === "forget") { await forgetWorkbook(); toast("Forgotten"); }
  paintConn();
}
document.addEventListener("change", e => { if (e.target && e.target.id === "connAuto2") { setAuto(e.target.checked); if (e.target.checked && S.handle) rememberWorkbook(S.handle); paintConn(); } });
