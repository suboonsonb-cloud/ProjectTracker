/* 14b-e2e-import.js — build an E2E flow from an Excel sheet / pasted table (and a ready-made prompt so any AI can write that sheet).
   FORMAT (one sheet per version):
     row 1      = swimlanes, one per column, left → right:   Lane name ; Sub-title ; Style
                  Style = New (green frame + NEW stamp = a lane that only exists in TO-BE) and/or a header colour (Navy, Blue, Green, Olive, Purple, Grey)
     rows 2…    = the process top → bottom; every filled cell is one box:
                  Type ; Text ; Connect to ; Change ; Projects ; Hours/month ; Style      (only Type and Text are needed)
     Type       = Start | End | Process | Decision | Document | System | Note   (blank = Process)
     Text       = the box label; " // " or Alt+Enter = new line; "- " at a line start = bullet
     Connect to = cell address(es) of the next box(es): "C5", "C5 [Yes], E7 [No]", colour after it: "E7 [No] red"; blank = next filled row; "-" = none
     Change     = New | Changed | Merged | Removed  (green / orange / purple / red highlight + tag)
     Style      = "Fill Yellow, Border Red, Text Blue, Thick" — colour words or #RRGGBB
   Excel cell formatting also counts: a box cell's fill / font colour → box fill / text colour; a lane header cell's fill → header colour (green = new lane).
   PAGES: a row with only "PAGE BREAK" (or "Page 2") in one cell starts the next page (same lanes, numbering runs on).
   VERSION: sheet name with TO-BE / future → TO-BE, AS-IS / current → AS-IS; otherwise TO-BE when any box has a Change or a lane is New, else AS-IS. */
"use strict";
const E2E_TYPES = { start: "rounded", end: "rounded", "start/end": "rounded", process: "process", task: "process", step: "process", decision: "decision", document: "document", doc: "document", system: "database", database: "database", data: "database", note: "note" };
const E2E_FILL = { white: "#FFFFFF", blue: "#DDEBF7", lightblue: "#DDEBF7", green: "#E2F0D9", lightgreen: "#E2F0D9", yellow: "#FFF2CC", orange: "#FCE4D6", purple: "#EDE7F6", grey: "#F2F2F2", gray: "#F2F2F2", navy: "#1F4E79", red: "#FDE2E1", pink: "#FDE2E1", none: "none" };
const E2E_LINE = { black: "#1F2933", blue: "#2E75B6", green: "#22A33A", red: "#E02424", orange: "#C55A11", grey: "#7F7F7F", gray: "#7F7F7F", purple: "#7A5AF8", navy: "#1F4E79", yellow: "#C9A227", white: "#FFFFFF", none: "none" };
const E2E_HEAD = { navy: "#1F4E79", blue: "#2E75B6", green: "#375623", olive: "#7F6000", gold: "#7F6000", purple: "#7030A0", grey: "#404040", gray: "#404040" };
const e2eHex = (v, map) => { v = String(v || "").trim().toLowerCase().replace(/\s+/g, ""); if (/^#?[0-9a-f]{6}$/.test(v)) return "#" + v.replace("#", "").toUpperCase(); return map[v] || null; };
function e2eStyle(txt, warn, ref) {   // "Fill Yellow, Border Red, Text Blue, Thick" → shape props
  const o = {}; for (const part of String(txt || "").split(/[,/]+/).map(x => x.trim()).filter(Boolean)) {
    const m = /^(fill|background|bg|border|line|outline|text|font)?\s*:?\s*(.+)$/i.exec(part); const k = (m[1] || "").toLowerCase(), v = m[2];
    if (/^(thick|bold border|heavy)$/i.test(part)) { o.sw = 2.5; continue; }
    if (/^bold$/i.test(part)) continue;
    const want = !k || k === "fill" || k === "background" || k === "bg" ? ["fill", E2E_FILL] : k === "text" || k === "font" ? ["color", E2E_LINE] : ["stroke", E2E_LINE];
    const c = e2eHex(v, want[1]); if (c) o[want[0]] = c; else warn.push(`${ref}: unknown style “${part}”`);
  }
  if (o.fill === "#1F4E79" && !o.color) o.color = "#FFFFFF";
  return o;
}
const E2E_AI_PROMPT = `You are a process analyst. Turn the process I describe below into a swimlane table I can paste into Excel. The table is read by a tool that draws the swimlane diagram automatically.

OUTPUT
- One sheet per version: "AS-IS" (today) and/or "TO-BE" (new design). Give only AS-IS if I describe one process; give both if I describe a change.
- Make an Excel file (.xlsx) if you can; otherwise output each sheet as a Markdown table with the sheet name ("AS-IS" / "TO-BE") as a heading above it.

ROW 1 = SWIMLANES (one per column, left → right in the order work passes between them)
Each lane cell:  Lane name; Sub-title; Style
- Sub-title (optional): short benefit or role note, e.g. "✓ Handle by one team // ✓ Increase productivity"
- Style (optional): New = a lane that only exists in TO-BE (drawn with a green frame and a NEW stamp); and/or a header colour: Navy, Blue, Green, Olive, Purple, Grey.
  Example: "Document Center; ✓ Handle by one team // ✓ Increase productivity; New"

ROWS 2+ = STEPS (top → bottom). Each step goes in ONE cell: the column of the lane that does it, the row of when it happens. Steps at the same time share a row; leave other cells empty.
Each step cell, fields separated by semicolons:
  Type; Text; Connect to; Change; Projects; Hours/month; Style
- Type: Start, End, Process, Decision, Document, System or Note
- Text: short label (max 8 words per line). " // " = new line; start a line with "- " for a bullet, e.g. "Verify documents // - Invoice // - Receipt". Never use the | character.
- Connect to: the cell address(es) of the next step(s), e.g. C5. Decisions: C5 [Yes], E7 [No]. Optional arrow colour after it: E7 [No] red. Empty = the next filled row below; "-" = no arrow.
- Change (TO-BE only — fill it for EVERY TO-BE step compared with AS-IS): New (green highlight + NEW tag), Changed (orange + CHANGED), Merged (purple + MERGED), Removed (red + REMOVED); empty = unchanged.
- Projects: project codes that deliver the step, comma separated (only if I gave them)
- Hours/month: time spent on the step per month (only if I gave it)
- Style (optional, comma separated): Fill <colour>, Border <colour>, Text <colour>, Thick. Colours: White, Blue, Green, Yellow, Orange, Purple, Grey, Navy, Red, Black or #RRGGBB.
Empty middle fields keep their semicolons: "Process; Check invoice; ; New; ; ; Fill Yellow". You may stop after the last field you use.

LAYOUT RULES (they keep the arrows clean)
1. Cell addresses: column A = first lane, B = second …; the first step is in row 2.
2. Start with one Start step and finish with End step(s). Keep 4–8 lanes and 8–40 steps.
3. Main path flows downward: each next step is in a LOWER row (or the same row in a neighbouring lane). Avoid arrows pointing back up except for loop-backs ("No → fix and resend").
4. Put a lane's consecutive steps in consecutive rows of that column; order the lanes so most arrows go to a neighbouring lane.
5. At most 2 arrows leave a normal step; decisions have one arrow per answer.
6. TO-BE: new teams/systems = lane Style New; mark every step's Change.
7. Long flow (more than ~15 rows): put a row with only "PAGE BREAK" in column A to start Page 2 (same lanes). Arrows can't cross pages — the next page simply continues the flow.

EXAMPLE (sheet "TO-BE"):
| Requester | AP team; ✓ Reduce task | Automation; ✓ Auto checking; New |
| Start; Submit invoice; C3 |  |  |
|  |  | System; Read invoice (OCR); B4; New |
|  | Decision; Invoice OK?; B5 [Yes], A5 [No] red; Changed |  |
| Process; Fix and resend; C3 | Process; Post invoice // - EBS // - SAP; -; ; ; ; Fill Blue |  |

MY PROCESS:
<describe the process here: who does what, in which order, systems used, decisions, and what changes in the new design>`;

/* --- cell formatting: styles.xml + theme colours --- */
function xlTint(hex, tint) {
  if (!tint) return hex; let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
  if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  let R, G, B; if (!s) R = G = B = l; else { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; R = f(p, q, h + 1 / 3); G = f(p, q, h); B = f(p, q, h - 1 / 3); }
  return "#" + [R, G, B].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
async function xlStyles(by, P) {
  const theme = []; const th = Object.keys(by).find(n => /^xl\/theme\/theme\d*\.xml$/.test(n));
  if (th) { const d = P(await entryText(by[th])); const cs = d.getElementsByTagNameNS("*", "clrScheme")[0];
    if (cs) for (const k of ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) { const e = cs.getElementsByTagNameNS("*", k)[0]; const c = e && e.firstElementChild; theme.push(c ? (c.getAttribute("lastClr") || c.getAttribute("val") || "") : ""); } }
  const col = e => { if (!e) return null; const rgb = e.getAttribute("rgb"), t = e.getAttribute("theme"), tint = +(e.getAttribute("tint") || 0);
    let h = rgb ? "#" + rgb.slice(-6).toUpperCase() : t != null && theme[+t] ? "#" + theme[+t].toUpperCase() : (e.getAttribute("indexed") === "64" ? null : null); return h ? xlTint(h, tint) : null; };
  if (!by["xl/styles.xml"]) return [];
  const d = P(await entryText(by["xl/styles.xml"])); const kids = (n, tag) => n ? [...n.children].filter(x => x.localName === tag) : [];
  const root = d.documentElement, one = tag => kids(root, tag)[0];
  const fills = kids(one("fills"), "fill").map(f => { const pf = kids(f, "patternFill")[0]; if (!pf || (pf.getAttribute("patternType") || "none") === "none") return null; return col(kids(pf, "fgColor")[0]); });
  const fonts = kids(one("fonts"), "font").map(f => ({ color: col(kids(f, "color")[0]), bold: kids(f, "b").length > 0 }));
  return kids(one("cellXfs"), "xf").map(x => { const fi = fills[+(x.getAttribute("fillId") || 0)] || null, fo = fonts[+(x.getAttribute("fontId") || 0)] || {};
    return { fill: fi && fi !== "#FFFFFF" ? fi : null, color: fo.color && !/^#(000000|111827)$/.test(fo.color) ? fo.color : null, bold: !!fo.bold }; });
}
/* --- read sheets of an .xlsx into string grids (+ cell formatting) --- */
async function readXlsxGrids(buf) {
  const list = readZip(buf); const by = {}; list.forEach(e => by[e.name] = e);
  const P = x => parser.parseFromString(x, "application/xml");
  const wb = P(await entryText(by["xl/workbook.xml"])); const rels = P(await entryText(by["xl/_rels/workbook.xml.rels"]));
  const rel = {}; for (const r of rels.getElementsByTagName("Relationship")) rel[r.getAttribute("Id")] = r.getAttribute("Target");
  const sst = []; if (by["xl/sharedStrings.xml"]) { const d = P(await entryText(by["xl/sharedStrings.xml"])); for (const si of d.getElementsByTagNameNS(NS, "si")) { let t = ""; for (const x of si.getElementsByTagNameNS(NS, "t")) t += x.textContent; sst.push(t); } }
  let xfs = []; try { xfs = await xlStyles(by, P); } catch (e) { console.warn("styles", e); }
  const out = [];
  for (const sh of wb.getElementsByTagNameNS(NS, "sheet")) {
    const rid = sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sh.getAttribute("r:id");
    let tgt = rel[rid] || ""; tgt = tgt.startsWith("/") ? tgt.slice(1) : "xl/" + tgt.replace(/^\.\//, ""); if (!by[tgt]) continue;
    const d = P(await entryText(by[tgt])); const grid = [], fmt = {};
    for (const c of d.getElementsByTagNameNS(NS, "c")) {
      const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute("r") || ""); if (!m) continue;
      const t = c.getAttribute("t"); let v = "";
      if (t === "inlineStr") { for (const x of c.getElementsByTagNameNS(NS, "t")) v += x.textContent; }
      else { const ve = c.getElementsByTagNameNS(NS, "v")[0]; v = ve ? ve.textContent : ""; if (t === "s") v = sst[+v] || ""; }
      const r = +m[2] - 1, k = colIdx(m[1]) - 1; (grid[r] = grid[r] || [])[k] = v;
      const st = xfs[+(c.getAttribute("s") || 0)]; if (st && (st.fill || st.color)) fmt[m[1] + m[2]] = st;
    }
    out.push({ name: sh.getAttribute("name") || "Sheet", grid: Array.from(grid, r => Array.from(r || [], x => x == null ? "" : String(x))), fmt });
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
/* split one cell into fields ("Type; Text; …"); a bare label = Process */
function e2eFields(raw) { return String(raw || "").split(";").map(x => x.trim()); }
function e2eLaneCell(raw, fmt, warn, ref) {
  const f = e2eFields(raw); const l = { name: f[0] || "", sub: (f[1] || "").split(/\s*\/\/\s*|\n/).join("\n"), hl: false };
  for (const t of String(f[2] || "").split(/[,\s]+/).filter(Boolean)) {
    if (/^(new|highlight|hl|green-?frame)$/i.test(t)) l.hl = true;
    else { const c = e2eHex(t.replace(/^header:?/i, ""), E2E_HEAD); if (c) l.hcolor = c; else warn.push(`${ref}: unknown lane style “${t}”`); }
  }
  if (fmt && fmt.fill) { const h = fmt.fill; const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    if (g > r + 25 && g > b + 15) l.hl = true; else if (!l.hcolor && (r + g + b) / 3 < 160) l.hcolor = h; }
  return l;
}
/* which version is this sheet? → [ver, reason] */
function e2eDetectVer(sheet) {
  const n = String(sheet.name || "");
  if (/to[\s_-]?be|future|target|new[\s_-]?process/i.test(n)) return ["TO-BE", `sheet name “${n}”`];
  if (/as[\s_-]?is|current|today|existing/i.test(n)) return ["AS-IS", `sheet name “${n}”`];
  const g = sheet.grid || []; let chg = 0, newLane = 0;
  (g[0] || []).forEach((c, i) => { const f = e2eFields(c); const fm = sheet.fmt && sheet.fmt[colLet(i + 1) + "1"];
    if (/\b(new|highlight|hl)\b/i.test(f[2] || "") || (fm && fm.fill && e2eLaneCell(c, fm, [], "").hl)) newLane++; });
  for (let r = 1; r < g.length; r++) for (const c of g[r] || []) { const f = e2eFields(c); if (/^(new|changed|merged|removed)$/i.test(f[3] || "")) chg++; }
  if (chg || newLane) return ["TO-BE", `${chg ? chg + " step" + (chg > 1 ? "s" : "") + " marked New/Changed/Merged/Removed" : ""}${chg && newLane ? " · " : ""}${newLane ? newLane + " new lane" + (newLane > 1 ? "s" : "") : ""}`];
  return ["AS-IS", "no Change marks"];
}
/* grid → studio document (vertical lanes = columns) */
function gridToDoc(grid, name, ver, fmt) {
  fmt = fmt || {}; const warn = [];
  const head = (grid[0] || []).map(s => String(s || "").trim()); let nL = head.length; while (nL && !head[nL - 1]) nL--;
  if (!nL) throw new Error("Row 1 must hold the swimlane names");
  const lanesIn = head.slice(0, nL).map((h, i) => e2eLaneCell(h, fmt[colLet(i + 1) + "1"], warn, colLet(i + 1) + "1"));
  const cells = []; const pageOf = {}; let pg = 0; const isBreak = r => { const row = (grid[r] || []).map(x => String(x || "").trim()); const f = row.filter(Boolean);
    return f.length === 1 && /^(?:[-=_*#\s]*)(page\s*break|new\s*page|page\s*\d+)(?:[-=_*#\s]*)$/i.test(f[0]); };
  let seen = false; for (let r = 1; r < grid.length; r++) { if (isBreak(r)) { if (seen) { pg++; seen = false; } continue; } pageOf[r] = pg; if ((grid[r] || []).some(x => String(x || "").trim())) seen = true; }
  for (let r = 1; r < grid.length; r++) if (pageOf[r] !== undefined) for (let k = 0; k < Math.max(nL, (grid[r] || []).length); k++) {
    const raw = String((grid[r] || [])[k] || "").trim(); if (!raw) continue; const ref = colLet(k + 1) + (r + 1);
    if (k >= nL) { warn.push(`${ref} is outside the lanes — skipped`); continue; }
    const f = e2eFields(raw);
    let type = (f[0] || "").toLowerCase(), text = f[1];
    if (f.length === 1 || !E2E_TYPES[type] && text === undefined) { text = f[0]; type = "process"; }   // a bare label
    if (!E2E_TYPES[type]) { warn.push(`${ref}: unknown type “${f[0]}” — used Process`); type = "process"; }
    const chg = (f[3] || "").toLowerCase().replace(/^\w/, c => c.toUpperCase());
    if (chg && !CHG_OK.includes(chg)) warn.push(`${ref}: unknown change “${f[3]}” (New, Changed, Merged, Removed)`);
    const st = e2eStyle(f[6], warn, ref); const cf = fmt[ref];
    if (cf) { if (cf.fill && !st.fill) st.fill = cf.fill; if (cf.color && !st.color) st.color = cf.color; }
    const txt = String(text || "").split(/\s*\/\/\s*|\n/).map(x => x.replace(/^\s*[•·*]\s+/, "- ")).join("\n");
    cells.push({ r, k, ref, pg: pageOf[r], kind: type, type: E2E_TYPES[type], text: txt, to: f[2] || "", chg: CHG_OK.includes(chg) ? chg : "", proj: (f[4] || "").split(/[,\s]+/).filter(Boolean), hrs: f[5] !== undefined && f[5] !== "" && !isNaN(+f[5]) ? +f[5] : null, st });
  }
  if (!cells.length) throw new Error("No boxes found below the lane row");
  const rowsUsed = [...new Set(cells.map(c => c.r))].sort((a, b) => a - b);
  const DEFS = { process: [150, 44], rounded: [140, 40], decision: [130, 76], document: [150, 56], database: [130, 60], note: [150, 70] };
  const lineW = t => Math.max(...String(t).split("\n").map(x => x.length)) * 6.6 + 26;
  /* lane width = widest box in it (+ room), so boxes and vertical arrows line up in the lane centre */
  const laneW = lanesIn.map((l, k) => { const inL = cells.filter(c => c.k === k); const need = Math.max(150, ...inL.map(c => Math.min(250, lineW(c.text)))) + 40;
    return Math.max(150, Math.min(290, Math.round(need / 10) * 10, ), Math.round((Math.max(...String(l.name).split("\n").map(x => x.length)) * 9 + 30) / 10) * 10); });
  const laneX = []; laneW.reduce((x, w, i) => (laneX[i] = x, x + w), 0);
  const Y0 = 46 + 46 + 28; let y = Y0; const rowY = {}; let curPg = 0; const pgFlow = [];
  for (const r of rowsUsed) { if (pageOf[r] !== curPg) { pgFlow[curPg] = Math.max(600, y - 92 + 20); curPg = pageOf[r]; y = Y0; } const inRow = cells.filter(c => c.r === r); let hMax = 0;
    for (const c of inRow) { const [w0, h0] = DEFS[c.type] || [150, 44]; const lines = String(c.text).split("\n").length;
      c.w = Math.min(laneW[c.k] - 30, Math.max(w0, Math.round(lineW(c.text) / 10) * 10)); c.h = Math.max(h0, 22 + lines * 15 + (c.type === "decision" ? 30 : 0)); hMax = Math.max(hMax, c.h); }
    for (const c of inRow) { c.x = Math.round(laneX[c.k] + (laneW[c.k] - c.w) / 2); c.y = Math.round(y + (hMax - c.h) / 2); }
    rowY[r] = y; y += hMax + 44; }
  const byRef = Object.fromEntries(cells.map(c => [c.ref, c])); const sid = c => "x" + c.ref;
  const links = [];
  for (const c of cells) {
    if (c.to === "-" || c.to === "–") continue;
    let tg = [];
    if (c.to) for (const part of c.to.split(/,+/)) { const m = /^\s*([A-Z]{1,2})\s*(\d+)\s*(?:\[([^\]]*)\]|\(([^)]*)\))?\s*(#[0-9a-f]{6}|[a-z]+)?\s*$/i.exec(part); if (!m) { if (part.trim()) warn.push(`${c.ref}: can't read “${part.trim()}”`); continue; }
      const t = byRef[m[1].toUpperCase() + m[2]]; if (!t) { warn.push(`${c.ref}: ${m[1].toUpperCase()}${m[2]} is empty`); continue; }
      const colr = m[5] ? e2eHex(m[5], E2E_LINE) : null; if (m[5] && !colr) warn.push(`${c.ref}: unknown arrow colour “${m[5]}”`); tg.push([t, m[3] || m[4] || "", colr]); }
    else if (c.kind !== "end" && c.type !== "note") { const next = rowsUsed.find(r => r > c.r); if (next !== undefined && pageOf[next] === c.pg) { const nx = cells.filter(x => x.r === next); tg = (nx.find(x => x.k === c.k) ? [nx.find(x => x.k === c.k)] : nx.length === 1 ? nx : nx.slice(0, 1)).map(t => [t, "", null]); } }
    for (const [t, label, colr] of tg) if (t.pg !== c.pg) warn.push(`${c.ref} → ${t.ref}: on another page — no arrow (continue the flow with a box on the new page)`); else links.push({ id: "l" + c.ref + t.ref, from: sid(c), to: sid(t), label, ...(colr ? { color: colr } : {}), auto: true });   /* auto = routed around the boxes by the studio */
  }
  const isTo = ver === "TO-BE";
  if (!isTo && cells.some(c => c.chg)) warn.push("AS-IS: New/Changed/Merged/Removed marks are only shown on TO-BE — ignored");
  const shapes = cells.map(c => ({ id: sid(c), type: c.type, x: c.x, y: c.y, w: c.w, h: c.h, text: c.text,
    ...(c.type === "note" ? { fill: "#FFF2CC", stroke: "#C9A227" } : {}), ...c.st,
    ...(isTo && c.chg ? { chg: c.chg } : {}), ...(pg ? { pg: "p" + (c.pg + 1) } : {}), ...(c.proj.length ? { proj: c.proj } : {}), ...(c.hrs != null ? { hrs: c.hrs } : {}) }));
  const anyNew = isTo && (lanesIn.some(l => l.hl) || cells.some(c => c.chg === "New"));
  const doc = { id: "d" + Date.now() + ver.length, name: name + " " + ver, title: name, tag: anyNew ? "TO-BE + NEW" : ver, ori: "v", flow: Math.max(600, y - 92 + 20), head: 46,
    ...(pg ? { pages: Array.from({ length: pg + 1 }, (_, i) => ({ id: "p" + (i + 1), name: "Page " + (i + 1), flow: i === pg ? Math.max(600, y - 92 + 20) : pgFlow[i] || 700 })) } : {}),
    lanes: lanesIn.map((l, i) => ({ id: "L" + i, name: l.name || "Lane " + (i + 1), sub: l.sub || "", size: laneW[i], ...(isTo && l.hl ? { hl: true } : {}), ...(l.hcolor ? { hcolor: l.hcolor } : {}) })), secs: [], shapes, links };
  if (!isTo && lanesIn.some(l => l.hl)) warn.push("AS-IS: lane “New” highlight ignored (TO-BE only)");
  return { doc, warn, stats: { pages: pg + 1, lanes: nL, boxes: shapes.length, links: links.length, styled: shapes.filter(s => s.fill || s.stroke || s.color || s.chg).length, newLanes: doc.lanes.filter(l => l.hl).length } };
}
const CHG_OK = ["New", "Changed", "Merged", "Removed"];
/* forceVer: "" / "auto" = detect per sheet */
function e2eImportFromGrids(sheets, name, forceVer) {
  const res = {}; const warn = []; const how = {};
  const one = sheets.length === 1;
  for (const s of sheets) {
    let [ver, why] = forceVer && forceVer !== "auto" && one ? [forceVer, "chosen"] : e2eDetectVer(s);
    if (res[ver]) { const other = ver === "AS-IS" ? "TO-BE" : "AS-IS"; if (!res[other] && !/sheet name/.test(why)) { ver = other; why = "second sheet"; } else { warn.push(`Sheet “${s.name}” skipped — ${ver} already read`); continue; } }
    try { const g = gridToDoc(s.grid, name || "Imported flow", ver, s.fmt); res[ver] = g; how[ver] = `${s.name} → ${ver} (${why})`; g.warn.forEach(w => warn.push(`${s.name}: ${w}`)); } catch (e) { warn.push(`${s.name}: ${e.message}`); }
  }
  return { res, warn, how };
}
function e2eTemplateCsv() {
  const rows = [["Requester", "AP team; ✓ Reduce task", "Automation; ✓ Auto checking; New"],
    ["Start; Submit invoice; C3", "", ""],
    ["", "", "System; Read invoice (OCR); B4; New"],
    ["", "Decision; Invoice OK?; B5 [Yes], A5 [No] red; Changed", ""],
    ["Process; Fix and resend; C3", "Process; Post invoice // - EBS // - SAP; -; ; ; ; Fill Blue", ""]];
  return rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n");
}
