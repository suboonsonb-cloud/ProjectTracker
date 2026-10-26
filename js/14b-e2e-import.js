/* 14b-e2e-import.js — build an E2E flow from an Excel sheet / pasted table (and a ready-made prompt so any AI can write that sheet).
   FORMAT (one sheet per version; sheet name containing "TO-BE" = TO-BE, otherwise AS-IS):
     row 1      = swimlane names, one per column, left → right
     rows 2…    = the process from top to bottom; every filled cell is one box:
                  Type ; Text ; Connect to ; Change ; Projects ; Hours/month   (only Type and Text are needed)
     Type       = Start | End | Process | Decision | Document | System | Note   (blank = Process)
     Text       = the box label; " // " or Alt+Enter = new line
     Connect to = cell addresses of the next box(es), e.g. "C5" or "C5 [Yes], E7 [No]"; blank = the box(es) in the next filled row; "-" = none
     Change     = New | Changed | Merged | Removed (TO-BE only)        Projects = project codes, comma separated      Hours = number */
"use strict";
const E2E_TYPES = { start: "rounded", end: "rounded", "start/end": "rounded", process: "process", task: "process", step: "process", decision: "decision", document: "document", doc: "document", system: "database", database: "database", data: "database", note: "note" };
const E2E_AI_PROMPT = `You are a process analyst. Turn the process I describe below into a swimlane table I can paste into Excel.

OUTPUT: one table per version (AS-IS = today, TO-BE = new design; give only AS-IS if I describe one process).
Put each version on its own Excel sheet named "AS-IS" or "TO-BE". If you cannot create a file, output each table as a Markdown table with the sheet name as its heading.

TABLE RULES
1. Row 1 = the swimlanes (roles, teams or systems), one per column, left to right in the order work passes between them.
2. Rows 2 onward = the process from top to bottom. Each step goes in ONE cell: the column of the lane that does it, the row of when it happens. Steps that happen at the same time share a row. Leave all other cells empty.
3. Every filled cell has this exact format, fields separated by semicolons:
   Type; Text; Connect to; Change; Projects; Hours/month
   - Type: Start, End, Process, Decision, Document, System or Note
   - Text: short label (max 8 words); use " // " for a second line (never use the | character)
   - Connect to: the Excel cell address(es) of the next step(s), e.g. C5 — for a decision add the answer in brackets: C5 [Yes], E7 [No]. Leave empty if the next step is simply the next filled row. Use "-" for the last step.
   - Change (TO-BE only): New, Changed, Merged or Removed compared with AS-IS; empty if unchanged
   - Projects: project codes that deliver this step (if I gave any), comma separated
   - Hours/month: time spent on this step per month (if I gave it)
   You may stop after Text when the later fields are empty, e.g. "Process; Check invoice".
4. Start with one Start box and finish with End box(es). Keep 4–8 lanes and 8–40 steps.
5. Cell addresses: column A = first lane, B = second …; row 1 = lane names, so the first step is in row 2.

EXAMPLE (sheet "AS-IS"):
| A | B | C |
| Requester | AP team | ERP system |
| Start; Submit invoice |  |  |
|  | Process; Check invoice | |
|  | Decision; Invoice OK?; C5 [Yes], A5 [No] |  |
| Process; Fix and resend; B3 |  | System; Post invoice; - |

MY PROCESS:
<describe the process here: who does what, in which order, systems used, decisions, and what changes in the new design>`;

/* --- read sheets of an .xlsx into string grids --- */
async function readXlsxGrids(buf) {
  const list = readZip(buf); const by = {}; list.forEach(e => by[e.name] = e);
  const P = x => parser.parseFromString(x, "application/xml");
  const wb = P(await entryText(by["xl/workbook.xml"])); const rels = P(await entryText(by["xl/_rels/workbook.xml.rels"]));
  const rel = {}; for (const r of rels.getElementsByTagName("Relationship")) rel[r.getAttribute("Id")] = r.getAttribute("Target");
  const sst = []; if (by["xl/sharedStrings.xml"]) { const d = P(await entryText(by["xl/sharedStrings.xml"])); for (const si of d.getElementsByTagNameNS(NS, "si")) { let t = ""; for (const x of si.getElementsByTagNameNS(NS, "t")) t += x.textContent; sst.push(t); } }
  const out = [];
  for (const sh of wb.getElementsByTagNameNS(NS, "sheet")) {
    const rid = sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sh.getAttribute("r:id");
    let tgt = rel[rid] || ""; tgt = tgt.startsWith("/") ? tgt.slice(1) : "xl/" + tgt.replace(/^\.\//, ""); if (!by[tgt]) continue;
    const d = P(await entryText(by[tgt])); const grid = [];
    for (const c of d.getElementsByTagNameNS(NS, "c")) {
      const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute("r") || ""); if (!m) continue;
      const t = c.getAttribute("t"); let v = "";
      if (t === "inlineStr") { for (const x of c.getElementsByTagNameNS(NS, "t")) v += x.textContent; }
      else { const ve = c.getElementsByTagNameNS(NS, "v")[0]; v = ve ? ve.textContent : ""; if (t === "s") v = sst[+v] || ""; }
      const r = +m[2] - 1, k = colIdx(m[1]) - 1; (grid[r] = grid[r] || [])[k] = v;
    }
    out.push({ name: sh.getAttribute("name") || "Sheet", grid: Array.from(grid, r => Array.from(r || [], x => x == null ? "" : String(x))) });
  }
  return out;
}
/* pasted text: TSV from Excel, CSV, or Markdown tables (each "## AS-IS" / "TO-BE" heading starts a sheet) */
function textGrids(txt) {
  const sheets = []; let cur = null; const lines = String(txt || "").replace(/\r/g, "").split("\n");
  const start = name => { cur = { name, grid: [] }; sheets.push(cur); };
  for (const raw of lines) {
    const line = raw.trimEnd(); const h = /^\s*(?:#+\s*|sheet\s*:?\s*|\*\*)?\s*(AS[- ]?IS|TO[- ]?BE)\b/i.exec(line);
    if (h && !line.includes("|") && !line.includes("\t")) { start(/TO/i.test(h[1]) ? "TO-BE" : "AS-IS"); continue; }
    if (!line.trim()) continue;
    let cells;
    if (/^\s*\|/.test(line)) { cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(x => x.trim()); if (cells.every(c => /^:?-{2,}:?$/.test(c) || c === "")) continue; }
    else if (line.includes("\t")) cells = line.split("\t");
    else cells = csvSplit(line);
    if (!cur) start("AS-IS");
    if (cur.grid.length === 0 && cells.every(c => /^[A-Z]{1,2}$/.test(c.trim()))) continue;   // an "A | B | C" letter row
    cur.grid.push(cells.map(c => c.replace(/<br\s*\/?>/gi, " // ")));
  }
  return sheets.filter(s => s.grid.length > 1);
}
function csvSplit(line) { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; }
/* grid → studio document (vertical lanes = columns) */
function gridToDoc(grid, name, ver) {
  const head = (grid[0] || []).map(s => String(s || "").trim()); let nL = head.length; while (nL && !head[nL - 1]) nL--;
  if (!nL) throw new Error("Row 1 must hold the swimlane names");
  const cells = []; const warn = [];
  for (let r = 1; r < grid.length; r++) for (let k = 0; k < Math.max(nL, (grid[r] || []).length); k++) {
    const raw = String((grid[r] || [])[k] || "").trim(); if (!raw) continue;
    if (k >= nL) { warn.push(`${colLet(k + 1)}${r + 1} is outside the lanes — skipped`); continue; }
    const f = raw.split(";").map(s => s.trim());
    let type = (f[0] || "").toLowerCase(), text = f[1];
    if (f.length === 1 || !E2E_TYPES[type] && text === undefined) { text = f[0]; type = "process"; }   // a bare label
    if (!E2E_TYPES[type]) { warn.push(`${colLet(k + 1)}${r + 1}: unknown type “${f[0]}” — used Process`); type = "process"; }
    cells.push({ r, k, ref: colLet(k + 1) + (r + 1), kind: type, type: E2E_TYPES[type], text: String(text || "").split(/\s*\/\/\s*|\n/).join("\n"), to: f[2] || "", chg: (f[3] || "").replace(/^\w/, c => c.toUpperCase()), proj: (f[4] || "").split(/[,\s]+/).filter(Boolean), hrs: f[5] !== undefined && f[5] !== "" && !isNaN(+f[5]) ? +f[5] : null });
  }
  if (!cells.length) throw new Error("No boxes found below the lane row");
  const size = 220, rowsUsed = [...new Set(cells.map(c => c.r))].sort((a, b) => a - b);
  const DEFS = { process: [150, 50], rounded: [140, 44], decision: [120, 80], document: [150, 60], database: [130, 64], note: [150, 80] };
  const lineW = t => Math.max(...String(t).split("\n").map(x => x.length)) * 6.6 + 26;
  let y = 46 + 46 + 30; const rowY = {};
  for (const r of rowsUsed) { const inRow = cells.filter(c => c.r === r); let hMax = 0;
    for (const c of inRow) { const [w0, h0] = DEFS[c.type] || [150, 50]; const lines = String(c.text).split("\n").length; c.w = Math.min(size - 20, Math.max(w0, Math.round(lineW(c.text) / 10) * 10)); c.h = Math.max(h0, 24 + lines * 16 + (c.type === "decision" ? 30 : 0)); hMax = Math.max(hMax, c.h); }
    for (const c of inRow) { c.x = Math.round((c.k * size + (size - c.w) / 2) / 10) * 10; c.y = Math.round((y + (hMax - c.h) / 2) / 10) * 10; }
    rowY[r] = y; y += hMax + 60; }
  const byRef = Object.fromEntries(cells.map(c => [c.ref, c])); const sid = c => "x" + c.ref;
  const side = (a, b) => { const dx = b.k - a.k, dy = b.r - a.r; if (!dx) return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"]; if (!dy) return dx > 0 ? ["right", "left"] : ["left", "right"]; return [dx > 0 ? "right" : "left", dy > 0 ? "top" : "bottom"]; };
  const links = [];
  for (const c of cells) {
    if (c.to === "-" || c.to === "–") continue;
    let tg = [];
    if (c.to) for (const part of c.to.split(/[,;]+/)) { const m = /([A-Z]{1,2})\s*(\d+)\s*(?:\[([^\]]*)\]|\(([^)]*)\))?/i.exec(part.trim()); if (!m) { warn.push(`${c.ref}: can't read “${part.trim()}”`); continue; } const t = byRef[m[1].toUpperCase() + m[2]]; if (!t) { warn.push(`${c.ref}: ${m[1].toUpperCase()}${m[2]} is empty`); continue; } tg.push([t, m[3] || m[4] || ""]); }
    else if (c.kind !== "end" && c.type !== "note") { const next = rowsUsed.find(r => r > c.r); if (next !== undefined) { const nx = cells.filter(x => x.r === next); tg = (nx.find(x => x.k === c.k) ? [nx.find(x => x.k === c.k)] : nx.length === 1 ? nx : nx.slice(0, 1)).map(t => [t, ""]); } }
    for (const [t, label] of tg) { links.push({ id: "l" + c.ref + t.ref, from: sid(c), to: sid(t), label, auto: true });   /* auto = routed around the boxes by the studio */ }
  }
  const shapes = cells.map(c => ({ id: sid(c), type: c.type, x: c.x, y: c.y, w: c.w, h: c.h, text: c.text, ...(c.type === "note" ? { fill: "#FFF2CC", stroke: "#C9A227" } : {}), ...(ver === "TO-BE" && CHG_OK.includes(c.chg) ? { chg: c.chg } : {}), ...(c.proj.length ? { proj: c.proj } : {}), ...(c.hrs != null ? { hrs: c.hrs } : {}) }));
  const doc = { id: "d" + Date.now() + ver.length, name: name + " " + ver, title: name, tag: ver, ori: "v", flow: Math.max(700, y - 92 + 40), head: 46,
    lanes: head.slice(0, nL).map((n, i) => ({ id: "L" + i, name: n || "Lane " + (i + 1), sub: "", size })), secs: [], shapes, links };
  return { doc, warn, stats: { lanes: nL, boxes: shapes.length, links: links.length } };
}
const CHG_OK = ["New", "Changed", "Merged", "Removed"];
function e2eImportFromGrids(sheets, name, forceVer) {
  const res = {}; const warn = [];
  for (const s of sheets) { const ver = forceVer || (/to[\s_-]?be/i.test(s.name) ? "TO-BE" : "AS-IS"); if (res[ver]) { warn.push(`Sheet “${s.name}” skipped — ${ver} already read`); continue; }
    try { const g = gridToDoc(s.grid, name || "Imported flow", ver); res[ver] = g; g.warn.forEach(w => warn.push(`${s.name}: ${w}`)); } catch (e) { warn.push(`${s.name}: ${e.message}`); } }
  return { res, warn };
}
function e2eTemplateCsv() {
  const rows = [["Requester", "AP team", "ERP system"], ["Start; Submit invoice", "", ""], ["", "Process; Check invoice", ""], ["", "Decision; Invoice OK?; C5 [Yes], A5 [No]", ""], ["Process; Fix and resend; B3", "", "System; Post invoice; -"]];
  return rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n");
}
