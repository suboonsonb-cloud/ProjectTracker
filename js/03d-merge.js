/* 03d-merge.js — many people, one workbook: merge instead of overwrite.
   When the file on disk / SharePoint is newer than the copy you opened (someone else saved), Save:
     1. reloads the newer file,
     2. re-applies YOUR changes cell by cell — a cell only you changed is simply written; a cell the other person
        also changed to something else is a conflict (you pick: mine / theirs),
     3. puts the rows YOU added (new projects, tasks, benefits, RAIDD, actuals, users) into free rows, so two people adding at the
        same time never overwrite each other, and gives your new items a fresh ID if the other person took the same number,
     4. then saves. No question is asked unless there is a real conflict.
   While you work, the Desk also checks the file every minute: with nothing unsaved it quietly loads the newer version;
   with unsaved changes it tells you someone saved and that your Save will merge. */
"use strict";
const MERGE_SHEETS = { Projects: { key: () => KEY.Projects, id: () => FP.lock }, Activities: { key: () => KEY.Activities, id: () => FA.lock }, Benefits: { key: () => KEY.Benefits, id: () => FB.lock },
  RAIDD: { key: () => KEY.RAIDD, id: () => FD.id }, Realisation: { key: () => KEY.Realisation, id: () => null }, Users: { key: () => "B", id: () => null } };
const sameV = (a, b) => String(a ?? "") === String(b ?? "");

/* who saved since I opened the file (from the Activity log of the newer file) */
function mergeWho(since) {
  if (typeof logRows !== "function" || !hasLog()) return [];
  const p = x => String(x).padStart(2, "0"), d = new Date(since || 0), s0 = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const me = (typeof curUser === "function" ? curUser() : "") || "";
  return [...new Set(logRows().filter(r => String(gv(LOG_SHEET, "A", r)) >= s0).map(r => String(gv(LOG_SHEET, "B", r) || "")).filter(w => w && w !== me))];
}

async function smartMerge(handle, changes) {
  toast("Someone else saved — merging your changes into the newer file…", 20000);
  const keepAcc = typeof ACC !== "undefined" ? ACC : null, openedAt = S._openedAt || S.lastMod || 0;
  const mineE2E = typeof e2eCollectMine === "function" ? e2eCollectMine(changes) : [];
  /* 1. my net change per cell (first old value → last new value) */
  const net = new Map(); for (const c of changes) { if (c.sheet === E2EF || c.sheet === E2EM || (typeof LOG_SHEET !== "undefined" && c.sheet === LOG_SHEET)) continue; const k = c.sheet + "!" + c.ref; if (!net.has(k)) net.set(k, { sheet: c.sheet, ref: c.ref, orig: c.old, val: c.val }); else net.get(k).val = c.val; }
  /* 2. which rows did I create? (their key / ID cell was empty when I opened the file) */
  const newRows = {}; for (const x of net.values()) { const M = MERGE_SHEETS[x.sheet]; if (!M) continue; const col = x.ref.replace(/\d+/g, ""), r = +x.ref.replace(/[A-Z]+/g, "");
    if ((col === M.key() || col === M.id()) && sameV(x.orig, "") && !sameV(x.val, "")) (newRows[x.sheet] = newRows[x.sheet] || new Set()).add(r); }
  const oldIds = {}; for (const sh in newRows) { const M = MERGE_SHEETS[sh]; if (!M.id()) continue; for (const r of newRows[sh]) oldIds[sh + "!" + r] = String(gv(sh, M.id(), r) || ""); }
  /* 3. reload the newer file (keep who is signed in) */
  const f = await handle.getFile(); await loadWorkbook(await f.arrayBuffer(), f.name, handle, f.lastModified);
  if (keepAcc && typeof ACC !== "undefined") { ACC = keepAcc; if (typeof paintAcc === "function") paintAcc(); }
  const who = mergeWho(openedAt);
  /* 4. place my new rows: same row if it is still empty, else the next free row */
  const rowMap = {}; S.newRows = S.newRows || {};
  for (const sh in newRows) { const M = MERGE_SHEETS[sh]; if (!S.sheets[sh]) continue; S.newRows[sh] = S.newRows[sh] || new Set();
    const empty = r => sameV(gv(sh, M.key(), r), "") && (!M.id() || sameV(gv(sh, M.id(), r), "")) && !S.newRows[sh].has(r);
    for (const r of [...newRows[sh]].sort((a, b) => a - b)) { let t = r;
      if (!empty(r)) { t = null; if (sh === "Users") { let x = 2; while (!empty(x)) x++; t = x; } else { const c = CFG[sh]; for (let x = c.first; x <= c.last; x++) if (empty(x)) { t = x; break; } } }
      if (t == null) continue; rowMap[sh + "!" + r] = t; S.newRows[sh].add(t); } }
  /* 5. apply my cells */
  let ok = 0, skip = 0, moved = 0; const conflicts = [];
  for (const x of net.values()) { if (!S.sheets[x.sheet] || !S.sheets[x.sheet].vals) { skip++; continue; }
    const col = x.ref.replace(/\d+/g, ""), r0 = +x.ref.replace(/[A-Z]+/g, ""), nr = rowMap[x.sheet + "!" + r0];
    try {
      if (nr != null) { if (nr !== r0) moved++; setCell(x.sheet, col, nr, x.val); ok++; continue; }
      if (newRows[x.sheet] && newRows[x.sheet].has(r0)) { skip++; continue; }   // a new row with no free place left
      const disk = gv(x.sheet, col, r0);
      if (sameV(disk, x.orig)) { setCell(x.sheet, col, r0, x.val); ok++; }      // only I changed it
      else if (sameV(disk, x.val)) ok++;                                         // we both made the same change
      else conflicts.push({ ...x, col, row: r0, disk });                         // both changed it differently
    } catch (e) { skip++; }
  }
  /* 6. my new items took an ID someone else also used → give them the next free number and fix references */
  let renum = 0;
  const reId = (sh, r, gen, refs) => { const M = MERGE_SHEETS[sh]; const idc = M.id(); if (!idc) return; const cur = String(gv(sh, idc, r) || ""); if (!cur) return;
    const dup = _rowsOf0Safe(sh).some(x => x !== r && String(gv(sh, idc, x) || "") === cur); if (!dup) return;
    const nid = gen(r); if (!nid || nid === cur) return; setCell(sh, idc, r, nid); renum++;
    for (const [rs, rc] of refs) for (const x of _rowsOf0Safe(rs)) { const v = String(gv(rs, rc, x) || ""); if (v === cur) setCell(rs, rc, x, nid); else if (rs === "Activities" && rc === FA.lock && v.startsWith(cur + "-")) setCell(rs, rc, x, nid + v.slice(cur.length)); } };
  for (const sh of ["Projects", "Benefits", "Activities"]) for (const r of (newRows[sh] ? [...newRows[sh]].map(r => rowMap[sh + "!" + r]).filter(x => x != null) : []))
    try { if (sh === "Projects") reId(sh, r, genProjectId, [["Activities", FA.pid], ["Benefits", FB.pid], ["RAIDD", FD.pid], ["Realisation", FR.pid], ["Activities", FA.lock]]);
      else if (sh === "Benefits") reId(sh, r, genBenefitId, [["Realisation", FR.bid], ["Benefit_Plan", "B"]]);
      else reId(sh, r, genTaskId, [["RAIDD", FD.tid]]); } catch (e) { console.warn("re-id", e); }
  /* 7. conflicts: one dialog, pick per cell */
  if (conflicts.length) {
    const label = c => { let rec = ""; try { rec = c.sheet === "Users" ? String(gv("Users", "B", c.row) || "") : rowProject(c.sheet, c.row) || ""; } catch (e) { } const colH = ((CFG[c.sheet] ? CFG[c.sheet].cols : []).find(y => y.col === c.col) || {}).h || c.col; return [rec, colH]; };
    const fv = (c, v) => { if (c.sheet === "Users" && c.col === "C") return v ? "••••" : "—"; const col = (CFG[c.sheet] ? CFG[c.sheet].cols : []).find(y => y.col === c.col); const t = col && col.type === "date" ? fmtDate(v) : col && col.type === "pct" ? fmtPct(v) : v; return String(t ?? "") || "—"; };
    const k = await choose(`${conflicts.length} change${conflicts.length > 1 ? "s" : ""} clash with ${who.length ? esc(who.join(", ")) : "someone else"}'s save`,
      `<p class="muted" style="margin-top:0">You and the other person changed the same field to different values. Choose which value to keep for each — everything else was merged automatically.</p>
       <div class="tablewrap" style="max-height:340px"><table class="data"><tr><th>Record</th><th>Field</th><th>Theirs (saved)</th><th>Mine</th></tr>
       ${conflicts.map((c, i) => { const [rec, h] = label(c); return `<tr><td><span class="clip">${esc(rec || c.sheet + " row " + c.row)}</span></td><td>${esc(h)}</td>
         <td><label style="display:flex;gap:6px"><input type="radio" name="cf${i}" value="theirs"> ${esc(fv(c, c.disk))}</label></td><td><label style="display:flex;gap:6px"><input type="radio" name="cf${i}" value="mine" checked> <b>${esc(fv(c, c.val))}</b></label></td></tr>`; }).join("")}</table></div>
       <p style="margin:8px 0 0"><button type="button" class="btn small" id="cfAllT">All theirs</button> <button type="button" class="btn small" id="cfAllM">All mine</button></p>`,
      [["cancel", "Cancel save"], ["ok", "Merge & save", "primary"]]);
    if (k === "cancel") { conflicts.forEach(c => { try { setCell(c.sheet, c.col, c.row, c.val); } catch (e) { } }); updateBadge(); return { ok, skip, conflicts: conflicts.length, cancelled: true, who }; }
    conflicts.forEach((c, i) => { const v = (document.querySelector(`input[name="cf${i}"]:checked`) || {}).value; if (v !== "theirs") { try { setCell(c.sheet, c.col, c.row, c.val); ok++; } catch (e) { skip++; } } });
  }
  if (hasE2E() && (mineE2E.length || changes.some(c => c.sheet === E2EM))) { const r = await e2eReapply(mineE2E); ok += r.ok; skip += r.skip; }
  S._openedAt = Date.now(); updateBadge();
  return { ok, skip, conflicts: conflicts.length, moved, renum, who };
}
function _rowsOf0Safe(sh) { return typeof _rowsOf0 === "function" ? _rowsOf0(sh) : rowsOf(sh); }
document.addEventListener("click", e => { const t = e.target; if (!t || (t.id !== "cfAllT" && t.id !== "cfAllM")) return; const v = t.id === "cfAllT" ? "theirs" : "mine"; document.querySelectorAll(`#confirm input[type=radio][value="${v}"]`).forEach(x => x.checked = true); });
function mergeMsg(r) { return `Merged with ${r.who && r.who.length ? r.who.join(", ") + "'s" : "the newer"} save — ${r.ok} of your change(s) applied${r.moved ? `, ${r.moved} moved to a free row` : ""}${r.renum ? `, ${r.renum} new ID(s) renumbered` : ""}${r.conflicts ? `, ${r.conflicts} clash(es) resolved` : ""}${r.skip ? ` (${r.skip} skipped)` : ""}`; }

/* ---- keep up with other people while the Desk is open ---- */
let PEEK_T = 0, PEEK_WARNED = 0;
async function peekNewer() {
  if (!S.zip || !S.handle || document.hidden || PEEK_BUSY) return; let f;
  try { PEEK_BUSY = true; f = await S.handle.getFile(); } catch (e) { PEEK_BUSY = false; return; }
  try {
    if (!S.lastMod || f.lastModified === S.lastMod) return;
    if (S.saved && S.saved.at && f.lastModified <= S.lastMod) return;
    if (!S.changes.length) {   // nothing of mine to lose → load the newer file quietly
      const keepAcc = typeof ACC !== "undefined" ? ACC : null, keepView = view, since = S._openedAt || S.lastMod;
      await loadWorkbook(await f.arrayBuffer(), f.name, S.handle, f.lastModified); if (keepAcc && typeof ACC !== "undefined") { ACC = keepAcc; if (typeof paintAcc === "function") paintAcc(); }
      const who = mergeWho(since); S._openedAt = Date.now(); view = keepView; if (typeof E2E_CACHE !== "undefined") E2E_CACHE = null; render();
      toast(`Updated with ${who.length ? who.join(", ") + "'s" : "the latest"} changes`, 4000);
    } else if (PEEK_WARNED !== f.lastModified) { PEEK_WARNED = f.lastModified; toast("Someone else saved the workbook — your Save will merge your changes into theirs", 7000); }
  } catch (e) { console.warn("peek", e); } finally { PEEK_BUSY = false; }
}
let PEEK_BUSY = false;
setInterval(peekNewer, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(peekNewer, 800); });
