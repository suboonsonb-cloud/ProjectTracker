/* 14d-e2e-pptx-import.js — turn a PowerPoint swimlane slide into an E2E flow, without AI.
   Reads the slide's shapes directly:
     lanes   = tall rectangles (lane bodies) + the coloured header rectangle / text at their top
     boxes   = rectangles, rounded rectangles, diamonds (decision), ovals / terminators (start · end), document, cylinder
     text    = the shape's own text, or a text box lying on top of it
     arrows  = real connectors (glued to boxes), or drawn lines / elbows — followed from the arrow head back to the box it starts at
     labels  = small text near an arrow ("Yes", "ไม่ใช่"…)
     legend  = small coloured swatch + text above the lanes · title = text above the lanes
   Slide title with "TO-BE" → TO-BE version, otherwise AS-IS; several slides of the same version become Page 1, 2 … */
"use strict";
async function pptxToFlows(buf, name) {
  const list = readZip(buf); const by = {}; list.forEach(e => by[e.name] = e);
  const P = x => parser.parseFromString(x, "application/xml");
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main", PN = "http://schemas.openxmlformats.org/presentationml/2006/main", RN = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const pres = P(await entryText(by["ppt/presentation.xml"])), prels = P(await entryText(by["ppt/_rels/presentation.xml.rels"]));
  const relT = {}; for (const r of prels.getElementsByTagName("Relationship")) relT[r.getAttribute("Id")] = r.getAttribute("Target");
  const slides = [...pres.getElementsByTagNameNS(PN, "sldId")].map(s => "ppt/" + relT[s.getAttributeNS(RN, "id") || s.getAttribute("r:id")].replace(/^\//, "").replace(/^ppt\//, "")).filter(n => by[n]);
  const warn = [], perVer = { "AS-IS": [], "TO-BE": [] };
  for (const [si, sn] of slides.entries()) {
    const d = P(await entryText(by[sn])); const res = slideToPage(d, A, warn, si + 1);
    if (!res) { warn.push(`Slide ${si + 1}: no boxes found — skipped`); continue; }
    const ver = /to[\s_-]?be|future|new process/i.test(res.title) ? "TO-BE" : "AS-IS"; perVer[ver].push(res);
  }
  const out = {};
  for (const ver of ["AS-IS", "TO-BE"]) { const pages = perVer[ver]; if (!pages.length) continue;
    const base = pages[0]; const title = (base.title || name || "Imported flow").replace(/\[[^\]]*\]/g, "").replace(/\b(as[\s-]?is|to[\s-]?be)\b/ig, "").replace(/\s{2,}/g, " ").trim() || name;
    const lanes = base.lanes; const shapes = [], links = [];
    pages.forEach((p, i) => { const pid = "p" + (i + 1); p.shapes.forEach(s => shapes.push({ ...s, id: "q" + (i + 1) + s.id, ...(pages.length > 1 ? { pg: pid } : {}) })); p.links.forEach(l => links.push({ ...l, id: "q" + (i + 1) + l.id, from: "q" + (i + 1) + l.from, to: "q" + (i + 1) + l.to })); });
    const doc = { id: "d" + Date.now() + ver.length, name: (name || title) + " " + ver, title: name || title, tag: ver, ori: "v", flow: base.flow, head: 46, lanes, secs: [], shapes, links,
      ...(base.legend.length ? { legend: base.legend } : {}), ...(pages.length > 1 ? { pages: pages.map((p, i) => ({ id: "p" + (i + 1), name: "Page " + (i + 1), flow: p.flow })) } : {}) };
    out[ver] = { doc, warn: [], stats: { pages: pages.length, lanes: lanes.length, boxes: shapes.length, links: links.length, styled: shapes.filter(s => s.fill).length, newLanes: 0 } };
  }
  return { res: out, warn, how: Object.fromEntries(Object.keys(out).map(v => [v, `PowerPoint → ${v} (${perVer[v].length} slide${perVer[v].length > 1 ? "s" : ""})`])) };
}

function slideToPage(d, A, warn, sno) {
  const E = 12700;   // EMU per point
  const items = [];   // flattened shapes with absolute geometry (points)
  const kids = (n, tag, ns) => [...n.children].filter(c => c.localName === tag && (!ns || c.namespaceURI === ns));
  const one = (n, tag) => n ? [...n.getElementsByTagNameNS("*", tag)][0] : null;
  const xf0 = { ox: 0, oy: 0, sx: 1, sy: 1 };
  const walk = (node, T) => { for (const c of node.children) {
    if (c.localName === "grpSp") { const x = one(one(c, "grpSpPr"), "xfrm"); let t = T;
      if (x) { const g = (tag, a) => { const e = kids(x, tag)[0]; return e ? +e.getAttribute(a) : 0; }; const ox = g("off", "x"), oy = g("off", "y"), cx = g("ext", "cx"), cy = g("ext", "cy"), chx = g("chOff", "x"), chy = g("chOff", "y"), chcx = g("chExt", "cx") || cx, chcy = g("chExt", "cy") || cy;
        const sx = cx / (chcx || 1), sy = cy / (chcy || 1); t = { ox: T.ox + T.sx * (ox - chx * sx), oy: T.oy + T.sy * (oy - chy * sy), sx: T.sx * sx, sy: T.sy * sy }; }
      walk(c, t); continue; }
    if (c.localName === "sp" || c.localName === "cxnSp") items.push(readShape(c, T));
    else if (c.localName === "spTree") walk(c, T);
  } };
  const readShape = (n, T) => {
    const spPr = kids(n, "spPr")[0]; const x = spPr && kids(spPr, "xfrm", A)[0]; const nv = n.firstElementChild; const cNvPr = nv && one(nv, "cNvPr");
    let X = 0, Y = 0, W = 0, H = 0, fh = false, fv = false;
    if (x) { const off = kids(x, "off", A)[0], ext = kids(x, "ext", A)[0]; X = +(off && off.getAttribute("x") || 0); Y = +(off && off.getAttribute("y") || 0); W = +(ext && ext.getAttribute("cx") || 0); H = +(ext && ext.getAttribute("cy") || 0); fh = x.getAttribute("flipH") === "1"; fv = x.getAttribute("flipV") === "1"; }
    X = (T.ox + T.sx * X) / E; Y = (T.oy + T.sy * Y) / E; W = T.sx * W / E; H = T.sy * H / E;
    const geom = spPr && one(spPr, "prstGeom"); const prst = geom ? geom.getAttribute("prst") : (spPr && one(spPr, "custGeom") ? "cust" : "");
    const fillEl = spPr ? kids(spPr, "solidFill", A)[0] : null, noFill = spPr ? kids(spPr, "noFill", A).length > 0 : false;
    const clr = el => { if (!el) return null; const s = one(el, "srgbClr"); if (s) return "#" + s.getAttribute("val").toUpperCase(); const sc = one(el, "schemeClr"); return sc ? "scheme:" + sc.getAttribute("val") : null; };
    const ln = spPr ? kids(spPr, "ln", A)[0] : null; const lnNo = ln ? kids(ln, "noFill", A).length > 0 : false; const lnClr = ln ? clr(kids(ln, "solidFill", A)[0]) : null;
    const styleLn = !ln && one(n, "lnRef") && +one(n, "lnRef").getAttribute("idx") > 0;   /* outline from the theme style */
    const txBox = !!(nv && one(nv, "cNvSpPr") && one(nv, "cNvSpPr").getAttribute("txBox") === "1");
    const head = ln && kids(ln, "headEnd", A)[0], tail = ln && kids(ln, "tailEnd", A)[0]; const arrowHead = !!(head && head.getAttribute("type") && head.getAttribute("type") !== "none"), arrowTail = !!(tail && tail.getAttribute("type") && tail.getAttribute("type") !== "none");
    const tx = kids(n, "txBody")[0]; const paras = tx ? [...tx.getElementsByTagNameNS(A, "p")].map(p => [...p.getElementsByTagNameNS(A, "t")].map(t => t.textContent).join("")) : [];
    let text = paras.map(s => s.replace(/\s+$/, "")).filter((s, i, a) => s.trim() || (i > 0 && i < a.length - 1)).join("\n").trim();
    const rPr = tx && one(tx, "rPr"); const tcol = rPr ? clr(kids(rPr, "solidFill", A)[0]) : null; const sz = rPr && rPr.getAttribute("sz") ? +rPr.getAttribute("sz") / 100 : null; const bold = rPr && rPr.getAttribute("b") === "1";
    const st = n.localName === "cxnSp" ? one(n, "stCxn") : null, en = n.localName === "cxnSp" ? one(n, "endCxn") : null;
    return { id: cNvPr ? cNvPr.getAttribute("id") : "", nm: cNvPr ? cNvPr.getAttribute("name") || "" : "", X, Y, W, H, fh, fv, prst, fill: noFill ? null : clr(fillEl) || (!fillEl && !noFill && one(n, "fillRef") && +one(n, "fillRef").getAttribute("idx") > 0 ? "scheme:style" : null), hasFill: (!!fillEl && !noFill) || (!fillEl && !noFill && !txBox && !!one(n, "fillRef") && +one(n, "fillRef").getAttribute("idx") > 0), line: lnNo ? null : lnClr, hasLine: !txBox && ((!!ln && !lnNo && !!lnClr) || styleLn), txBox,
      arrowHead, arrowTail, text, tcol, sz, bold, cxn: n.localName === "cxnSp", st: st ? st.getAttribute("id") : null, en: en ? en.getAttribute("id") : null };
  };
  const tree = one(d.documentElement, "spTree"); if (!tree) return null; walk(tree, xf0);
  const isLine = s => s.cxn || /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(s.prst) || (s.prst === "" && (s.W < 1.5 || s.H < 1.5) && !s.text);
  const lines = items.filter(isLine), shapesAll = items.filter(s => !isLine(s));
  if (!shapesAll.length) return null;
  const maxY = Math.max(...shapesAll.map(s => s.Y + s.H)), minY = Math.min(...shapesAll.map(s => s.Y));
  const inside = (p, q, tol = 0) => p.X >= q.X - tol && p.Y >= q.Y - tol && p.X + p.W <= q.X + q.W + tol && p.Y + p.H <= q.Y + q.H + tol;
  const ctr = s => ({ x: s.X + s.W / 2, y: s.Y + s.H / 2 });
  const isFilledish = s => s.hasFill || s.hasLine;
  /* lanes: tall rectangles, side by side */
  let laneBodies = shapesAll.filter(s => /^(rect|)$/.test(s.prst) && isFilledish(s) && s.H > (maxY - minY) * 0.45 && s.W > 40).sort((a, b) => a.X - b.X);
  laneBodies = laneBodies.filter((s, i, a) => !a.some((o, j) => j !== i && Math.abs(o.X - s.X) < 3 && Math.abs(o.W - s.W) < 3 && j < i));
  const used = new Set(laneBodies);
  const lanesTop = laneBodies.length ? Math.min(...laneBodies.map(s => s.Y)) : minY;
  const lanes = laneBodies.map(b => { const hdr = shapesAll.filter(s => !used.has(s) && Math.abs(s.X - b.X) < 4 && Math.abs(s.W - b.W) < 6 && s.Y >= b.Y - 4 && s.Y < b.Y + 25 && s.H < 90);
    hdr.forEach(h => used.add(h)); const hFill = hdr.find(h => h.hasFill && h.fill && !/^#FFFFFF$/i.test(h.fill) && !h.fill.startsWith("scheme"));
    const hTxt = hdr.map(h => h.text).filter(Boolean).join("\n") || b.text || ""; const [nm, ...sub] = hTxt.split("\n");
    return { body: b, name: nm.trim(), sub: sub.join("\n").trim(), hcolor: hFill ? hFill.fill : null, hh: hdr.length ? Math.max(...hdr.map(h => h.Y + h.H)) - b.Y : 0 }; });
  const hdrBottom = lanes.length ? lanesTop + Math.max(...lanes.map(l => l.hh), 0) : minY;
  /* candidates: anything else */
  const rest = shapesAll.filter(s => !used.has(s));
  const textOnlySet = new Set(rest.filter(s => s.text && !s.hasLine && !s.hasFill));   /* text boxes without outline / fill = overlays or labels */
  const boxes0 = rest.filter(s => !textOnlySet.has(s) && (s.hasFill || s.hasLine) && s.W >= 18 && s.H >= 12);
  /* legend: small swatches above the lanes, with a text to the right */
  const legend = []; const above = s => s.Y + s.H <= lanesTop + 2;
  for (const sw of boxes0.filter(s => above(s) && s.W < 40 && s.H < 30)) { const t = [...textOnlySet].concat(rest.filter(s => s.text)).filter(o => o !== sw && above(o) && o.X >= sw.X + sw.W - 2 && o.X < sw.X + sw.W + 30 && Math.abs(ctr(o).y - ctr(sw).y) < 12).sort((a, b) => a.X - b.X)[0];
    if (t) { legend.push({ fill: sw.fill && !sw.fill.startsWith("scheme") ? sw.fill : "#FFFFFF", stroke: sw.line && !sw.line.startsWith("scheme") ? sw.line : "#7F8C8D", text: t.text.split("\n")[0] }); used.add(sw); used.add(t); textOnlySet.delete(t); } }
  /* title: biggest text above the lanes */
  const titleCand = rest.filter(s => s.text && above(s) && !used.has(s)).sort((a, b) => (b.sz || 0) - (a.sz || 0) || a.Y - b.Y)[0]; const title = titleCand ? titleCand.text.split("\n")[0] : "";
  if (titleCand) used.add(titleCand);
  /* boxes inside the lanes area; attach overlay texts */
  const boxes = boxes0.filter(s => !used.has(s) && (!lanes.length || s.Y >= hdrBottom - 4));
  const kindOf = s => /diamond|flowChartDecision/.test(s.prst) ? "decision" : /ellipse|flowChartTerminator|flowChartAlternateProcess/.test(s.prst) ? "rounded" : /flowChartDocument|flowChartMultidocument/.test(s.prst) ? "document" : /can|flowChartMagneticDisk/.test(s.prst) ? "database" : /roundRect/.test(s.prst) ? "process" : "process";
  // drop boxes that are just a text overlay on another box (same area, smaller/equal, with text) — keep the outer one
  const bx = []; for (const s of boxes.sort((a, b) => b.W * b.H - a.W * a.H)) { const host = bx.find(o => inside(s, o, 3) && (s.text || !s.hasLine)); if (host) { if (s.text && !host.text) host.text = s.text, host.tcol = host.tcol || s.tcol; continue; } bx.push({ ...s }); }
  const labels = [];
  for (const t of rest.filter(s => s.text && !used.has(s) && !boxes0.includes(s) || textOnlySet.has(s))) { if (used.has(t)) continue;
    const host = bx.filter(b => { const c = ctr(t); return c.x >= b.X - 2 && c.x <= b.X + b.W + 2 && c.y >= b.Y - 2 && c.y <= b.Y + b.H + 2; }).sort((a, b) => a.W * a.H - b.W * b.H)[0];
    if (host) { host.text = host.text ? host.text + "\n" + t.text : t.text; host.tcol = host.tcol || t.tcol; } else if (!lanes.length || t.Y >= hdrBottom - 4) labels.push(t); }
  if (!bx.length) return null;
  /* geometry → studio coordinates */
  const k = 1.33, L0 = lanes.length ? lanes[0].body.X : Math.min(...bx.map(b => b.X)) - 20, FS = 92, top = lanes.length ? hdrBottom : Math.min(...bx.map(b => b.Y)) - 20;
  const outLanes = lanes.length ? lanes.map((l, i) => ({ id: "L" + i, name: l.name || "Lane " + (i + 1), sub: l.sub, size: Math.round(l.body.W * k), ...(l.hcolor ? { hcolor: l.hcolor } : {}) }))
    : [{ id: "L0", name: "Process", sub: "", size: Math.round((Math.max(...bx.map(b => b.X + b.W)) - L0 + 20) * k) }];
  const shapes = bx.map((b, i) => { const kind = kindOf(b); const term = kind === "rounded";
    const fill = b.fill && !b.fill.startsWith("scheme") ? b.fill : null, line = b.line && !b.line.startsWith("scheme") ? b.line : null, tcol = b.tcol && !b.tcol.startsWith("scheme") ? b.tcol : null;
    const txt = String(b.text || "").split("\n").map(s => s.replace(/^\s*[•·▪●]\s*/, "- ")).join("\n");
    return { id: "s" + i, src: b, type: kind, x: Math.round((b.X - L0) * k), y: Math.round((b.Y - top) * k) + FS + 8, w: Math.max(40, Math.round(b.W * k)), h: Math.max(24, Math.round(b.H * k)), text: txt,
      ...(fill ? { fill } : term ? { fill: "#1F3864" } : {}), ...(line ? { stroke: line } : fill ? { stroke: fill } : {}), ...(tcol && !/^#(000000|1B2631|111827)$/i.test(tcol) ? { color: tcol } : (term && (!fill || lum(fill) < 110)) ? { color: "#FFFFFF" } : {}) }; });
  function lum(h) { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; }
  const near = (p, b, t = 7) => p.x >= b.X - t && p.x <= b.X + b.W + t && p.y >= b.Y - t && p.y <= b.Y + b.H + t;
  const boxAt = p => { const c = shapes.filter(s => near(p, s.src)); return c.sort((a, b) => a.src.W * a.src.H - b.src.W * b.src.H)[0] || null; };
  /* arrows */
  const links = []; const add = (a, b, label) => { if (!a || !b || a === b) return; const id = "k" + a.id + "_" + b.id; if (links.some(l => l.id === id)) return; links.push({ id, from: a.id, to: b.id, label: label || "", auto: true }); };
  const byPid = {}; items.forEach(s => { if (s.id) byPid[s.id] = s; });
  const shapeOfItem = it => it && shapes.find(s => s.src === it || inside(it, s.src, 3) || (s.src.X <= ctr(it).x && ctr(it).x <= s.src.X + s.src.W && s.src.Y <= ctr(it).y && ctr(it).y <= s.src.Y + s.src.H));
  const segs = [];
  for (const l of lines) {
    if (l.cxn && l.st && l.en) { const a = shapeOfItem(byPid[l.st]), b = shapeOfItem(byPid[l.en]); if (a && b) { const fwd = !(l.arrowHead && !l.arrowTail); add(fwd ? a : b, fwd ? b : a, ""); l._done = true; continue; } }
    const p0 = { x: l.X + (l.fh ? l.W : 0), y: l.Y + (l.fv ? l.H : 0) }, p1 = { x: l.X + (l.fh ? 0 : l.W), y: l.Y + (l.fv ? 0 : l.H) };
    segs.push({ a: p0, b: p1, tipA: l.arrowHead, tipB: l.arrowTail, l });
  }
  const T = 3.5, same = (p, q) => Math.abs(p.x - q.x) <= T && Math.abs(p.y - q.y) <= T;
  const onSeg = (p, s) => { const minx = Math.min(s.a.x, s.b.x) - T, maxx = Math.max(s.a.x, s.b.x) + T, miny = Math.min(s.a.y, s.b.y) - T, maxy = Math.max(s.a.y, s.b.y) + T; if (p.x < minx || p.x > maxx || p.y < miny || p.y > maxy) return false;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy) || 1; return Math.abs((p.x - s.a.x) * dy - (p.y - s.a.y) * dx) / L <= T; };
  const tips = []; segs.forEach(s => { if (s.tipB) tips.push({ s, p: s.b }); if (s.tipA) tips.push({ s, p: s.a }); });
  const isTip = p => tips.some(t => same(t.p, p));
  const segPath = {};   // link id → set of segments
  for (const t of tips) {
    const tgt = boxAt(t.p); if (!tgt) continue;
    const seen = new Set([t.s]), q = [t.s], srcs = new Set();
    while (q.length) { const s = q.shift();
      for (const p of [s.a, s.b]) { if (p === t.p && s === t.s) continue;
        if (!(isTip(p) && !(s === t.s))) { const b = boxAt(p); if (b && b !== tgt && !isTip(p)) srcs.add(b); }
        if (isTip(p) && s !== t.s) continue;
        for (const o of segs) if (!seen.has(o) && (same(o.a, p) || same(o.b, p) || onSeg(p, o) || onSeg(o.a, s) || onSeg(o.b, s))) { seen.add(o); q.push(o); } } }
    for (const sb of srcs) { add(sb, tgt, ""); const id = "k" + sb.id + "_" + tgt.id; segPath[id] = new Set([...(segPath[id] || []), ...seen]); }
  }
  /* labels → nearest arrow segment → that arrow */
  const dist = (p, s) => { const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy || 1; let u = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L2; u = Math.max(0, Math.min(1, u)); return Math.hypot(p.x - (s.a.x + u * dx), p.y - (s.a.y + u * dy)); };
  /* each label goes to the closest arrow that has no label yet (two labels at a fork → one per branch) */
  const lbl = labels.map(lb => ({ c: ctr(lb), txt: lb.text.split("\n")[0].trim() })).filter(x => x.txt && x.txt.length <= 40);
  const dOf = (c, L) => { let bd = Infinity; const ss = segPath[L.id]; if (ss) for (const s of ss) { const own = !segs.some(o => o !== s && false); bd = Math.min(bd, dist(c, s)); }
    if (bd === Infinity) { const a = shapes.find(s => s.id === L.from), b = shapes.find(s => s.id === L.to); bd = dist(c, { a: ctr(a.src), b: ctr(b.src) }); } return bd; };
  /* prefer the arrow whose END is near the label (branch labels sit next to the branch, not the shared trunk) */
  const endD = (c, L) => { const b = shapes.find(s => s.id === L.to); const t = tips.filter(t => near(t.p, b.src)).map(t => Math.hypot(t.p.x - c.x, t.p.y - c.y)); return t.length ? Math.min(...t) : 1e9; };
  const pairs = []; for (const x of lbl) for (const L of links) { const d0 = dOf(x.c, L); if (d0 < 45) pairs.push({ x, L, d: d0 + endD(x.c, L) * 0.15 }); }
  pairs.sort((a, b) => a.d - b.d); const doneX = new Set();
  for (const p of pairs) { if (doneX.has(p.x) || p.L.label) continue; p.L.label = p.x.txt; doneX.add(p.x); }
  const flow = Math.max(500, Math.round(((lanes.length ? Math.max(...lanes.map(l => l.body.Y + l.body.H)) : maxY) - top) * k) + 20);
  shapes.forEach(s => delete s.src);
  return { title, lanes: outLanes, shapes, links, legend, flow };
}
