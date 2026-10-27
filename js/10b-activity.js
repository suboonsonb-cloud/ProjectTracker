/* 10b-activity.js — activity log (who changed what) + who is editing + dismissable warnings.
   Every Save appends one row per changed field to the "Activity_Log" sheet of the workbook (created on the first save),
   so everyone who opens the file sees the same history in Settings → Activity log. */
"use strict";
const LOG_SHEET = "Activity_Log", LOG_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const LOG_HEAD = ["When", "Who", "Area", "Record", "Field", "Old value", "New value", "Cell"];

/* ---- who am I ---- */
function graphUser() { try { if (typeof G_PCA !== "undefined" && G_PCA) { const a = G_PCA.getActiveAccount() || G_PCA.getAllAccounts()[0]; if (a) return a.name || a.username || ""; } } catch (e) { } return ""; }
function savedUser() { try { return localStorage.getItem("sga_user") || ""; } catch (e) { return ""; } }
function setSavedUser(v) { try { v ? localStorage.setItem("sga_user", v) : localStorage.removeItem("sga_user"); } catch (e) { } }
function curUser() { return savedUser() || graphUser() || ""; }
async function ensureUser() {
  if (curUser()) return true;
  const k = await choose("Who is saving?", `<p>Your name goes into the <b>activity log</b> (Settings → Activity log) next to every change you save. Asked once on this computer.</p>
    <label class="field"><span>Your name</span><input id="whoName" placeholder="e.g. Lot S." autocomplete="name"></label>`, [["skip", "Skip"], ["ok", "Save name", "primary"]]);
  const v = ((document.getElementById("whoName") || {}).value || "").trim();
  if (k === "ok" && v) setSavedUser(v); return true;
}
document.addEventListener("input", e => { if (e.target && e.target.id === "whoName") e.target.setAttribute("value", e.target.value); });

/* ---- the sheet ---- */
const hasLog = () => !!(S.sheets && S.sheets[LOG_SHEET] && S.sheets[LOG_SHEET].doc);
function logRows() { if (!hasLog()) return []; const out = []; for (const r of S.sheets[LOG_SHEET].rows.keys()) if (r > 1 && gv(LOG_SHEET, "A", r) !== "") out.push(r); return out.sort((a, b) => a - b); }
async function ensureLogSheet() {
  if (hasLog()) return true;
  const enc = new TextEncoder(); const by = S.byName;
  const ct = parser.parseFromString(await entryText(by["[Content_Types].xml"]), "application/xml");
  const relsName = "xl/_rels/workbook.xml.rels"; const rels = parser.parseFromString(await entryText(by[relsName]), "application/xml");
  let n = 1; while (by["xl/worksheets/sheet" + n + ".xml"]) n++; const path = "xl/worksheets/sheet" + n + ".xml";
  const relIds = [...rels.getElementsByTagName("Relationship")].map(r => r.getAttribute("Id")); let k = 1; while (relIds.includes("rIdLog" + k)) k++; const rid = "rIdLog" + k;
  const R = rels.createElementNS(rels.documentElement.namespaceURI, "Relationship");
  R.setAttribute("Id", rid); R.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"); R.setAttribute("Target", "worksheets/sheet" + n + ".xml"); rels.documentElement.appendChild(R);
  const O = ct.createElementNS(ct.documentElement.namespaceURI, "Override"); O.setAttribute("PartName", "/" + path); O.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"); ct.documentElement.appendChild(O);
  const shs = S.wbDoc.getElementsByTagNameNS(NS, "sheets")[0]; const ids = [...shs.getElementsByTagNameNS(NS, "sheet")].map(s => +s.getAttribute("sheetId") || 0);
  const sh = S.wbDoc.createElementNS(NS, "sheet"); sh.setAttribute("name", LOG_SHEET); sh.setAttribute("sheetId", Math.max(0, ...ids) + 1); sh.setAttributeNS(RNS, "r:id", rid); shs.appendChild(sh);
  const xml = `<worksheet xmlns="${NS}" xmlns:r="${RNS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="44" customWidth="1"/><col min="5" max="5" width="24" customWidth="1"/><col min="6" max="7" width="36" customWidth="1"/><col min="8" max="8" width="16" customWidth="1"/></cols><sheetData/><autoFilter ref="A1:H1"/></worksheet>`;
  const doc = parser.parseFromString(xml, "application/xml"); const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
  const ent = { name: path, method: 0, time: 0, date: 0x21, crc: 0, csize: 0, usize: 0, data: new Uint8Array(0) }; S.zip.push(ent); by[path] = ent;
  S.sheets[LOG_SHEET] = { path, doc, sd, rows: new Map(), cells: new Map(), vals: new Map() };
  S.extraParts = S.extraParts || {};
  S.extraParts[relsName] = () => enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ser.serializeToString(rels).replace(/^<\?xml[^>]*>\s*/, ""));
  S.extraParts["[Content_Types].xml"] = () => enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ser.serializeToString(ct).replace(/^<\?xml[^>]*>\s*/, ""));
  logWrite(1, LOG_HEAD);
  return true;
}
function logWrite(r, vals) { const n = S.changes.length; vals.forEach((v, i) => setCell(LOG_SHEET, LOG_COLS[i], r, v)); S.changes.length = n; }   // the log itself is not a "change"

/* net changes → readable log lines */
function logLines(all) {
  const out = []; const fmtv = (col, v) => { const x = col && col.type === "date" ? fmtDate(v) : col && col.type === "pct" ? fmtPct(v) : v; const t = String(x ?? ""); return t.length > 300 ? t.slice(0, 300) + "…" : t; };
  const area = { Projects: "Project", Activities: "Task", Benefits: "Benefit", RAIDD: "RAIDD", Realisation: "Actuals", Master_Data: "Settings", Lists: "Settings", Benefit_Plan: "Benefit plan", Migration_Log: "Sync" };
  for (const c of all) {
    if (c.sheet === LOG_SHEET || (typeof E2EF !== "undefined" && (c.sheet === E2EF || c.sheet === E2EM))) continue;
    const r = +c.ref.replace(/[A-Z]+/g, ""), colL = c.ref.replace(/\d+/g, "");
    const col = (CFG[c.sheet] ? CFG[c.sheet].cols : []).find(x => x.col === colL);
    let rec = ""; try { rec = rowProject(c.sheet, r) || ""; } catch (e) { }
    if (c.sheet === "Activities" && typeof FA !== "undefined") { const t = gv("Activities", FA.id, r); const nm = gv("Activities", FA.task, r); if (t || nm) rec = (t ? t + " · " : "") + (nm || "") + (rec ? " (" + rec.split(" · ")[0] + ")" : ""); }
    else if (c.sheet === "RAIDD" || c.sheet === "Benefits") { const id = gv(c.sheet, KEY[c.sheet], r); if (id) rec = id + (rec ? " (" + rec.split(" · ")[0] + ")" : ""); }
    const kind = String(c.orig ?? "") === "" ? "added" : String(c.val ?? "") === "" ? "cleared" : "";
    out.push([area[c.sheet] || c.sheet, rec, (col ? col.h : colL) + (kind ? " (" + kind + ")" : ""), fmtv(col, c.orig), fmtv(col, c.val), c.sheet + "!" + c.ref]);
  }
  try { for (const x of e2eChangeLines(all)) out.push(["E2E flow", x.name + " · " + x.ver, "Diagram", "", x.text, ""]); } catch (e) { }
  return out;
}
/* called from buildBlob(): append the current unsaved changes once per save */
async function appendLog() {
  if (S._logFor === S.changes || !S.changes.length) return; const lines = logLines(netChanges()); if (!lines.length) { S._logFor = S.changes; return; }
  try { await ensureLogSheet(); } catch (e) { console.warn("activity log", e); return; }
  const rows = logRows(); let r = (rows.length ? rows[rows.length - 1] : 1) + 1;
  const d = new Date(), p = x => String(x).padStart(2, "0"); const when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const who = curUser() || "(not named)";
  for (const L of lines) logWrite(r++, [when, who, ...L]);
  S._logFor = S.changes;
}

/* ---- Settings → Activity log ---- */
function vActivity() {
  const F = UI.alog = UI.alog || { q: "", who: "", area: "", from: "", to: "", n: 200 };
  const all = logRows().map(r => ({ r, v: LOG_COLS.map(c => String(gv(LOG_SHEET, c, r) ?? "")) })).reverse();
  const whos = uniqOrder(all.map(x => x.v[1])).filter(Boolean).sort(), areas = uniqOrder(all.map(x => x.v[2])).filter(Boolean).sort();
  const q = F.q.toLowerCase();
  const rows = all.filter(x => (!F.who || x.v[1] === F.who) && (!F.area || x.v[2] === F.area) && (!F.from || x.v[0].slice(0, 10) >= F.from) && (!F.to || x.v[0].slice(0, 10) <= F.to) && (!q || x.v.join(" ").toLowerCase().includes(q)));
  const saves = new Set(all.map(x => x.v[0] + "|" + x.v[1])).size;
  const pend = S.changes.length ? logLines(netChanges()) : [];
  const sel = (id, list, v, all0) => `<select id="${id}"><option value="">${all0}</option>${list.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
  let lastKey = "";
  const body = rows.slice(0, F.n).map(x => { const key = x.v[0] + "|" + x.v[1]; const hd = key !== lastKey ? `<tr class="grph"><td colspan="6"><b>${esc(x.v[0])}</b> · ${esc(x.v[1] || "(not named)")} <span class="muted">— ${rows.filter(y => y.v[0] + "|" + y.v[1] === key).length} change(s)</span></td></tr>` : ""; lastKey = key;
    return hd + `<tr><td><span class="alarea a-${esc(x.v[2]).replace(/\W/g, "")}">${esc(x.v[2])}</span></td><td><span class="clip">${esc(x.v[3])}</span></td><td>${esc(x.v[4])}</td><td class="muted"><span class="clip">${esc(x.v[5])}</span></td><td><b class="clip">${esc(x.v[6])}</b></td><td class="muted" style="font-size:11px">${esc(x.v[7])}</td></tr>`; }).join("");
  return `<div class="card pad stcard"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Activity log</h2>
      <span class="muted">${all.length ? `${all.length.toLocaleString()} change(s) in ${saves} save(s)` : "Nothing logged yet — every Save adds who changed what here (sheet “Activity_Log” in the workbook)."}</span><span style="flex:1"></span>
      <span class="muted" style="font-size:12.5px">You: <b>${esc(curUser() || "not named")}</b></span><button class="btn small" id="alWho">✎ Change name</button></div>
    ${pend.length ? `<div class="note" style="margin:10px 0 0">${pend.length} unsaved change(s) will be logged as <b>${esc(curUser() || "(not named)")}</b> when you save. <a href="#" id="alRev">Review</a></div>` : ""}
    ${all.length ? `<div class="alfilters"><input type="search" id="alQ" placeholder="Search record, field, value…" value="${esc(F.q)}">${sel("alWhoF", whos, F.who, "Everyone")}${sel("alArea", areas, F.area, "All areas")}
      <label>From <input type="date" id="alFrom" value="${esc(F.from)}"></label><label>To <input type="date" id="alTo" value="${esc(F.to)}"></label>
      ${F.q || F.who || F.area || F.from || F.to ? `<button class="btn small" id="alClr">✕ Clear</button>` : ""}<span class="muted" style="font-size:12px">${rows.length.toLocaleString()} shown</span><button class="btn small" id="alCsv">⬇ CSV</button></div>
    <div class="tablewrap" style="max-height:620px;margin-top:8px"><table class="data altab"><thead><tr><th>Area</th><th>Record</th><th>Field</th><th>Old</th><th>New</th><th>Cell</th></tr></thead><tbody>${body || `<tr><td colspan="6" class="muted">No entries match</td></tr>`}</tbody></table></div>
    ${rows.length > F.n ? `<p><button class="btn small" id="alMore">Show ${Math.min(500, rows.length - F.n)} more</button></p>` : ""}` : ""}</div>`;
}
function bindActivity(m, re) {
  const F = UI.alog; const g = id => m.querySelector("#" + id);
  const set = (k, v) => { F[k] = v; F.n = 200; re(); };
  if (g("alQ")) { g("alQ").oninput = e => { clearTimeout(g("alQ")._t); const v = e.target.value; g("alQ")._t = setTimeout(() => { set("q", v); const n = document.getElementById("alQ"); if (n) { n.focus(); n.setSelectionRange(v.length, v.length); } }, 250); }; }
  if (g("alWhoF")) g("alWhoF").onchange = e => set("who", e.target.value);
  if (g("alArea")) g("alArea").onchange = e => set("area", e.target.value);
  if (g("alFrom")) g("alFrom").onchange = e => set("from", e.target.value);
  if (g("alTo")) g("alTo").onchange = e => set("to", e.target.value);
  if (g("alClr")) g("alClr").onclick = () => { Object.assign(F, { q: "", who: "", area: "", from: "", to: "", n: 200 }); re(); };
  if (g("alMore")) g("alMore").onclick = () => { F.n += 500; re(); };
  if (g("alRev")) g("alRev").onclick = e => { e.preventDefault(); view = "Changes"; render(); };
  if (g("alWho")) g("alWho").onclick = async () => { const v = prompt("Your name for the activity log (blank = use your Microsoft 365 account when signed in):", savedUser() || graphUser()); if (v === null) return; setSavedUser(v.trim()); re(); };
  if (g("alCsv")) g("alCsv").onclick = () => { const all = logRows().map(r => LOG_COLS.map(c => String(gv(LOG_SHEET, c, r) ?? ""))).reverse();
    const csv = [LOG_HEAD, ...all].map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n"); download(new Blob(["﻿" + csv], { type: "text/csv" }), "SGA_activity_log.csv"); };
}

/* ---- warnings that can be hidden (and shown again in Settings) ---- */
const WARN_KINDS = { preview: "Opened inside a SharePoint / Teams preview", sharepoint: "Opened from SharePoint in the browser", web: "Opened from a web link", download: "Opened from Downloads / a temp folder" };
function hiddenWarns() { try { return JSON.parse(localStorage.getItem("sga_warn_hide") || "[]"); } catch (e) { return []; } }
function setHiddenWarns(a) { try { localStorage.setItem("sga_warn_hide", JSON.stringify([...new Set(a)])); } catch (e) { } }
function vWarnings() {
  const hid = hiddenWarns(); const cur = S.env || {};
  let saveAsk = false; try { saveAsk = localStorage.getItem("sga_saveloc_ok") === "1"; } catch (e) { }
  const row = (k, t, on, extra) => `<tr><td>${t}${extra || ""}</td><td>${on ? `<span class="muted">Hidden</span>` : `<span style="color:#1E6B24">Shown</span>`}</td><td><button class="btn small" data-wtog="${k}">${on ? "Show again" : "Hide"}</button></td></tr>`;
  return `<div class="card pad stcard" style="max-width:860px"><h2 style="margin-top:0">Warnings &amp; messages</h2>
    <p class="muted" style="margin-top:0">Hide the red / orange bars at the top of the page here, or with <b>Dismiss</b> on the bar itself. Hidden only on this computer and browser.</p>
    <table class="data sttab"><thead><tr><th>Warning</th><th>Status</th><th></th></tr></thead><tbody>
      ${Object.entries(WARN_KINDS).map(([k, t]) => row(k, t, hid.includes(k), cur.kind === k ? ` <span class="usedn">this page now</span>` : "")).join("")}
      ${row("saveloc", "“Before the first save — where is this file?” question", saveAsk)}
    </tbody></table>
    <p style="margin-top:10px"><button class="btn small" id="wAll">Show all warnings again</button></p></div>`;
}
function bindWarnings(m, re) {
  m.querySelectorAll("[data-wtog]").forEach(b => b.onclick = () => { const k = b.dataset.wtog;
    if (k === "saveloc") { try { localStorage.getItem("sga_saveloc_ok") === "1" ? localStorage.removeItem("sga_saveloc_ok") : localStorage.setItem("sga_saveloc_ok", "1"); } catch (e) { } re(); return; }
    const h = hiddenWarns(); setHiddenWarns(h.includes(k) ? h.filter(x => x !== k) : [...h, k]); try { sessionStorage.removeItem("sga_env_dismiss"); } catch (e) { } envCheck(); re(); });
  const a = m.querySelector("#wAll"); if (a) a.onclick = () => { setHiddenWarns([]); try { localStorage.removeItem("sga_saveloc_ok"); sessionStorage.removeItem("sga_env_dismiss"); } catch (e) { } envCheck(); re(); toast("All warnings will show again"); };
}
