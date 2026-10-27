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
function curUser() { return (typeof ACC !== "undefined" && ACC && ACC.name) || savedUser() || graphUser() || ""; }
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
/* add a new worksheet to the open workbook (sheet XML + workbook.xml + rels + [Content_Types]) */
async function ensureSheet(name, colsXml, head, cols) {
  if (S.sheets[name] && S.sheets[name].doc) return S.sheets[name];
  const enc = new TextEncoder(); const by = S.byName; S.extraParts = S.extraParts || {};
  const relsName = "xl/_rels/workbook.xml.rels";
  const parsed = S._wbParts || (S._wbParts = {
    ct: parser.parseFromString(await entryText(by["[Content_Types].xml"]), "application/xml"),
    rels: parser.parseFromString(await entryText(by[relsName]), "application/xml") });
  const { ct, rels } = parsed;
  let n = 1; while (by["xl/worksheets/sheet" + n + ".xml"]) n++; const path = "xl/worksheets/sheet" + n + ".xml";
  const relIds = [...rels.getElementsByTagName("Relationship")].map(r => r.getAttribute("Id")); let k = 1; while (relIds.includes("rIdX" + k)) k++; const rid = "rIdX" + k;
  const R = rels.createElementNS(rels.documentElement.namespaceURI, "Relationship");
  R.setAttribute("Id", rid); R.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"); R.setAttribute("Target", "worksheets/sheet" + n + ".xml"); rels.documentElement.appendChild(R);
  const O = ct.createElementNS(ct.documentElement.namespaceURI, "Override"); O.setAttribute("PartName", "/" + path); O.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"); ct.documentElement.appendChild(O);
  const shs = S.wbDoc.getElementsByTagNameNS(NS, "sheets")[0]; const ids = [...shs.getElementsByTagNameNS(NS, "sheet")].map(s => +s.getAttribute("sheetId") || 0);
  const sh = S.wbDoc.createElementNS(NS, "sheet"); sh.setAttribute("name", name); sh.setAttribute("sheetId", Math.max(0, ...ids) + 1); sh.setAttributeNS(RNS, "r:id", rid); shs.appendChild(sh);
  const last = cols[cols.length - 1];
  const xml = `<worksheet xmlns="${NS}" xmlns:r="${RNS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colsXml}</cols><sheetData/><autoFilter ref="A1:${last}1"/></worksheet>`;
  const doc = parser.parseFromString(xml, "application/xml"); const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
  const ent = { name: path, method: 0, time: 0, date: 0x21, crc: 0, csize: 0, usize: 0, data: new Uint8Array(0) }; S.zip.push(ent); by[path] = ent;
  S.sheets[name] = { path, doc, sd, rows: new Map(), cells: new Map(), vals: new Map() };
  S.extraParts[relsName] = () => enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ser.serializeToString(rels).replace(/^<\?xml[^>]*>\s*/, ""));
  S.extraParts["[Content_Types].xml"] = () => enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ser.serializeToString(ct).replace(/^<\?xml[^>]*>\s*/, ""));
  const nn = S.changes.length; head.forEach((v, i) => setCell(name, cols[i], 1, v)); S.changes.length = nn; S.dirty.add(name);
  return S.sheets[name];
}
async function ensureLogSheet() {
  if (hasLog()) return true;
  await ensureSheet(LOG_SHEET, '<col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="44" customWidth="1"/><col min="5" max="5" width="24" customWidth="1"/><col min="6" max="7" width="36" customWidth="1"/><col min="8" max="8" width="16" customWidth="1"/>', LOG_HEAD, LOG_COLS);
  return true;
}
function logWrite(r, vals) { const n = S.changes.length; vals.forEach((v, i) => setCell(LOG_SHEET, LOG_COLS[i], r, v)); S.changes.length = n; }   // the log itself is not a "change"

/* only important edits are logged: input fields of these sheets (+ users and E2E flows) */
const LOG_SHEETS_KEEP = ["Projects", "Activities", "Benefits", "RAIDD", "Realisation", "Master_Data", "Lists"];
/* net changes → readable log lines */
function logLines(all) {
  const out = []; const fmtv = (col, v) => { const x = col && col.type === "date" ? fmtDate(v) : col && col.type === "pct" ? fmtPct(v) : v; const t = String(x ?? ""); return t.length > 300 ? t.slice(0, 300) + "…" : t; };
  const area = { Projects: "Project", Activities: "Task", Benefits: "Benefit", RAIDD: "RAIDD", Realisation: "Actuals", Master_Data: "Settings", Lists: "Settings", Benefit_Plan: "Benefit plan", Migration_Log: "Sync" };
  for (const c of all) {
    if (c.sheet === "Users") { const r = +c.ref.replace(/[A-Z]+/g, ""), cl = c.ref.replace(/\d+/g, ""); if (r === 1) continue; const pw = cl === UC.pw;
      const cell = col => all.find(y => y.sheet === "Users" && y.ref === col + r); const oB = cell("B") ? String(cell("B").orig ?? "") : String(gv("Users", "B", r) || ""), oA = cell("A") ? String(cell("A").orig ?? "") : String(gv("Users", "A", r) || "");
      const nB = String(gv("Users", "B", r) || ""), nA = String(gv("Users", "A", r) || "");
      const field = U_HEAD[U_COLS.indexOf(cl)] || cl, recO = oB + (oA ? " · " + oA : ""), recN = nB + (nA ? " · " + nA : "");
      const replaced = oB && nB && oB.toLowerCase() !== nB.toLowerCase() && oA !== nA;   /* a deleted user's row re-used for a new person → log as delete + create */
      if (replaced) { if (c.orig !== "" && c.orig != null) out.push(["Access", recO, field + (pw ? " (cleared)" : ""), pw ? "" : String(c.orig), "", "Users!" + c.ref]);
        if (c.val !== "" && c.val != null) out.push(["Access", recN, field + (pw ? " (set / reset)" : ""), "", pw ? "" : String(c.val), "Users!" + c.ref]); continue; }
      out.push(["Access", nB ? recN : recO, field + (pw ? (c.val ? " (set / reset)" : " (cleared)") : ""), pw ? "" : String(c.orig ?? ""), pw ? "" : String(c.val ?? ""), "Users!" + c.ref]); continue; }
    if (c.sheet === LOG_SHEET || (typeof E2EF !== "undefined" && (c.sheet === E2EF || c.sheet === E2EM))) continue;
    if (!LOG_SHEETS_KEEP.includes(c.sheet)) continue;   /* system sheets (E2E_Map, Migration_Log, GanttKeys …) are not logged */
    const r = +c.ref.replace(/[A-Z]+/g, ""), colL = c.ref.replace(/\d+/g, "");
    const col = (CFG[c.sheet] ? CFG[c.sheet].cols : []).find(x => x.col === colL);
    if (CFG[c.sheet] && (!col || col.kind && col.kind !== "in")) continue;   /* only input columns — no IDs, locks or calculated cells */
    let rec = ""; try { rec = rowProject(c.sheet, r) || ""; } catch (e) { }
    let fpre = "";
    if (c.sheet === "Activities" && typeof FA !== "undefined") { const nm = gv("Activities", FA.task, r) || gv("Activities", FA.id, r); fpre = nm ? nm + " · " : ""; /* tasks are grouped under their project: one line per project */ }
    else if (c.sheet === "RAIDD" || c.sheet === "Benefits") { const id = gv(c.sheet, KEY[c.sheet], r); if (id) rec = id + (rec ? " (" + rec.split(" · ")[0] + ")" : ""); }
    const kind = String(c.orig ?? "") === "" ? "added" : String(c.val ?? "") === "" ? "cleared" : "";
    out.push([c.sheet === "Activities" ? "Task" : area[c.sheet] || c.sheet, rec, fpre + (col ? col.h : colL) + (kind ? " (" + kind + ")" : ""), fmtv(col, c.orig), fmtv(col, c.val), c.sheet + "!" + c.ref]);
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
  /* one line per action (save × area × record), its field changes underneath (▸) */
  const NOUN = { Access: "user", Project: "project", Task: "tasks of", Benefit: "benefit line", RAIDD: "RAIDD item", Actuals: "actuals", Settings: "setting", "E2E flow": "flow", "Benefit plan": "benefit plan", Sync: "sync record" };
  const groups = []; const gi = {};
  for (const x of rows) { const k = x.v[0] + "|" + x.v[1] + "|" + x.v[2] + "|" + x.v[3]; if (!(k in gi)) { gi[k] = groups.length; groups.push({ k, when: x.v[0], who: x.v[1], area: x.v[2], rec: x.v[3], items: [] }); } groups[gi[k]].items.push(x); }
  F.open = F.open || {};
  const fld = f => String(f).replace(/\s*\((added|cleared|set \/ reset)\)$/, "");
  const verb = g => { const it = g.items; if (g.area === "E2E flow") return "Changed"; const allNew = it.every(x => !x.v[5]), allGone = it.every(x => !x.v[6] && !/set \/ reset/.test(x.v[4]));
    return allNew ? "Created" : allGone ? "Deleted" : "Updated"; };
  const short = g => { const it = g.items.filter(x => x.v[4]); const parts = it.slice(0, 4).map(x => { const f = fld(x.v[4]); if (/password/i.test(f)) return /cleared/.test(x.v[4]) ? "password removed" : "password set"; const v = x.v[6] || "(blank)"; return `${f}: ${v.length > 40 ? v.slice(0, 40) + "…" : v}`; });
    return parts.join(" · ") + (it.length > 4 ? ` · +${it.length - 4} more` : ""); };
  const val = (x, nv) => { const f = x.v[4]; if (/password/i.test(f)) return /cleared/.test(f) ? "removed" : "changed"; const t = nv ? x.v[6] : x.v[5]; return t ? (t.length > 36 ? t.slice(0, 36) + "…" : t) : "blank"; };
  const sentence = g => { const v = verb(g); const it = g.items;
    if (v === "Created" || v === "Deleted") { const keys = it.filter(x => !/^(name|title|project name|task name|email)/i.test(fld(x.v[4]))).slice(0, 3).map(x => /password/i.test(x.v[4]) ? "password" : `${fld(x.v[4])}: ${val(x, v === "Created")}`); return keys.join(" · ") + (it.length > 4 ? " …" : ""); }
    return it.slice(0, 3).map(x => /password/i.test(x.v[4]) ? "password changed" : `${fld(x.v[4])}: ${val(x, false)} → ${val(x, true)}`).join(" · ") + (it.length > 3 ? ` · +${it.length - 3} more` : ""); };
  const body = groups.slice(0, F.n).map(g => { const v = verb(g), open = !!F.open[g.k], more = g.items.length > 3;
    const sub = open ? g.items.map(x => `<tr class="alsub"><td colspan="3"></td><td><span class="alfld">${esc(fld(x.v[4]))}</span>: ${/password/i.test(x.v[4]) ? (/cleared/.test(x.v[4]) ? "removed" : "changed (hidden)") : `<span class="muted">${esc(x.v[5] || "blank")}</span> → <b>${esc(x.v[6] || "blank")}</b>`}</td></tr>`).join("") : "";
    return `<tr class="alact${more ? " alcan" : ""}" ${more ? `data-alk="${esc(g.k)}" tabindex="0" role="button" aria-expanded="${open}" title="Show every change"` : ""}>
      <td class="nowrap muted">${esc(g.when.slice(5))}</td><td class="nowrap">${esc(g.who || "—")}</td><td><span class="alarea a-${esc(g.area).replace(/\W/g, "")}">${esc(g.area)}</span></td>
      <td><span class="alverb v-${v}">${v} ${NOUN[g.area] || ""}</span> <b>${esc(g.rec || "")}</b><div class="alline">${esc(sentence(g))}${more ? ` <span class="altw">${open ? "▾ less" : "▸ all changes"}</span>` : ""}</div></td></tr>` + sub; }).join("");
  return `<div class="card pad stcard"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Activity log</h2>
      <span class="muted">${all.length ? `${saves} save(s)` : "Nothing logged yet — every Save adds who changed what here (sheet “Activity_Log” in the workbook)."}</span><span style="flex:1"></span>
      <span class="muted" style="font-size:12.5px">You: <b>${esc(curUser() || "not named")}</b></span><button class="btn small" id="alWho">✎ Change name</button></div>
    ${pend.length ? `<div class="note" style="margin:10px 0 0">${pend.length} unsaved change(s) will be logged as <b>${esc(curUser() || "(not named)")}</b> when you save. <a href="#" id="alRev">Review</a></div>` : ""}
    ${all.length ? `<div class="alfilters"><input type="search" id="alQ" placeholder="Search record, field, value…" value="${esc(F.q)}">${sel("alWhoF", whos, F.who, "Everyone")}${sel("alArea", areas, F.area, "All areas")}
      <label>From <input type="date" id="alFrom" value="${esc(F.from)}"></label><label>To <input type="date" id="alTo" value="${esc(F.to)}"></label>
      ${F.q || F.who || F.area || F.from || F.to ? `<button class="btn small" id="alClr">✕ Clear</button>` : ""}<span class="muted" style="font-size:12px">${groups.length.toLocaleString()} change(s)</span><button class="btn small" id="alCsv">⬇ CSV</button></div>
    <div class="tablewrap" style="max-height:620px;margin-top:8px"><table class="data altab"><thead><tr><th>When</th><th>Who</th><th>Area</th><th>What changed</th></tr></thead><tbody>${body || `<tr><td colspan="4" class="muted">No entries match</td></tr>`}</tbody></table></div>
    ${groups.length > F.n ? `<p><button class="btn small" id="alMore">Show ${Math.min(500, groups.length - F.n)} more</button></p>` : ""}` : ""}</div>`;
}
function bindActivity(m, re) {
  m.querySelectorAll("[data-alk]").forEach(t => { const tg = () => { const F = UI.alog; F.open[t.dataset.alk] ? delete F.open[t.dataset.alk] : F.open[t.dataset.alk] = 1; re(); }; t.onclick = tg; t.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tg(); } }; });
  const ex = m.querySelector("#alExp"); if (ex) ex.onclick = () => { const F = UI.alog; if (Object.keys(F.open).length) F.open = {}; else m.querySelectorAll("[data-alk]").forEach(t => F.open[t.dataset.alk] = 1); re(); };
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
