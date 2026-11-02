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
  /* theme colours (accent1…6, dk1/2, lt1/2) so outlines like "accent2" keep their real colour */
  const theme = {}; try { const tn = list.map(e => e.name).filter(n => /^ppt\/theme\/theme\d+\.xml$/.test(n)).sort()[0];
    if (tn) { const td = P(await entryText(by[tn])); const cs = td.getElementsByTagNameNS(A, "clrScheme")[0];
      if (cs) for (const c of cs.children) { const v = c.firstElementChild; if (!v) continue; const hex = v.getAttribute("val") && v.localName === "srgbClr" ? v.getAttribute("val") : v.getAttribute("lastClr"); if (hex) theme[c.localName] = "#" + hex.toUpperCase(); } } } catch (e) { }
  const warn = [], perVer = { "AS-IS": [], "TO-BE": [] };
  for (const [si, sn] of slides.entries()) {
    const d = P(await entryText(by[sn])); const res = slideToPage(d, A, warn, si + 1, theme);
    if (!res) { warn.push(`Slide ${si + 1}: no boxes found — skipped`); continue; }
    const ver = /to[\s_-]?be|future|new process/i.test(res.title) ? "TO-BE" : "AS-IS"; perVer[ver].push(res);
  }
  const out = {};
  for (const ver of ["AS-IS", "TO-BE"]) { const pages = perVer[ver]; if (!pages.length) continue;
    const base = pages[0]; const title = (base.title || name || "Imported flow").replace(/\[[^\]]*\]/g, "").replace(/\b(as[\s-]?is|to[\s-]?be)\b/ig, "").replace(/\s{2,}/g, " ").trim() || name;
    const lanes = base.lanes; const shapes = [], links = [];
    pages.forEach((p, i) => { const pid = "p" + (i + 1); p.shapes.forEach(s => shapes.push({ ...s, id: "q" + (i + 1) + s.id, ...(pages.length > 1 ? { pg: pid } : {}) })); p.links.forEach(l => links.push({ ...l, id: "q" + (i + 1) + l.id, from: "q" + (i + 1) + l.from, to: "q" + (i + 1) + l.to })); });
    const nm = title && !/^(untitled|presentation\d*)$/i.test(title) ? title : (name || title);
    const doc = { id: "d" + Date.now() + ver.length, name: nm + " " + ver, title: nm, tag: ver, ori: "v", flow: base.flow, head: 46, lanes, secs: [], shapes, links,
      ...(base.legend.length ? { legend: base.legend } : {}), ...(pages.length > 1 ? { pages: pages.map((p, i) => ({ id: "p" + (i + 1), name: "Page " + (i + 1), flow: p.flow })) } : {}) };
    out[ver] = { doc, warn: [], stats: { pages: pages.length, lanes: lanes.length, boxes: shapes.length, links: links.length, styled: shapes.filter(s => s.fill).length, newLanes: 0 } };
  }
  return { res: out, warn, how: Object.fromEntries(Object.keys(out).map(v => [v, `PowerPoint → ${v} (${perVer[v].length} slide${perVer[v].length > 1 ? "s" : ""})`])) };
}

function slideToPage(d, A, warn, sno, theme) {
  theme = theme || {};
  /* colour element → #RRGGBB (srgb / scheme / sys + lumMod / lumOff / shade / tint) */
  const hsl = (h) => { let [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0; const L = (mx + mn) / 2;
    if (mx !== mn) { const dd = mx - mn; S = L > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); H = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; H /= 6; } return [H, S, L]; };
  const hex = (H, S, L) => { const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    let r, g, b; if (!S) r = g = b = L; else { const q = L < .5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q; r = f(p, q, H + 1 / 3); g = f(p, q, H); b = f(p, q, H - 1 / 3); }
    return "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase(); };
  const MAPK = { tx1: "dk1", tx2: "dk2", bg1: "lt1", bg2: "lt2" };
  const colorOf = (el) => { if (!el) return null; const c = [...el.children].find(x => /^(srgbClr|schemeClr|sysClr|prstClr)$/.test(x.localName)); if (!c) return null;
    let h = c.localName === "srgbClr" ? "#" + c.getAttribute("val").toUpperCase() : c.localName === "sysClr" ? "#" + (c.getAttribute("lastClr") || "000000").toUpperCase()
      : c.localName === "prstClr" ? ({ black: "#000000", white: "#FFFFFF", red: "#FF0000" }[c.getAttribute("val")] || null) : (theme[MAPK[c.getAttribute("val")] || c.getAttribute("val")] || null);
    if (!h) return null; let [H, S, L] = hsl(h); let ch = false;
    for (const m of c.children) { const v = +m.getAttribute("val") / 100000; if (m.localName === "lumMod") { L *= v; ch = true; } else if (m.localName === "lumOff") { L += v; ch = true; } else if (m.localName === "shade") { L *= v; ch = true; } else if (m.localName === "tint") { L = L + (1 - L) * (1 - v); ch = true; } }
    return ch ? hex(H, S, Math.max(0, Math.min(1, L))) : h; };
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
    const clr = el => colorOf(el);
    const ln = spPr ? kids(spPr, "ln", A)[0] : null; const lnNo = ln ? kids(ln, "noFill", A).length > 0 : false; const lnClr = ln ? clr(kids(ln, "solidFill", A)[0]) : null;
    const lnRef = one(n, "lnRef"), fillRef = one(n, "fillRef");
    const styleLn = !ln && lnRef && +lnRef.getAttribute("idx") > 0;   /* outline from the theme style */
    const styleLnClr = styleLn ? colorOf(lnRef) : null;
    const txBox = !!(nv && one(nv, "cNvSpPr") && one(nv, "cNvSpPr").getAttribute("txBox") === "1");
    const head = ln && kids(ln, "headEnd", A)[0], tail = ln && kids(ln, "tailEnd", A)[0]; const arrowHead = !!(head && head.getAttribute("type") && head.getAttribute("type") !== "none"), arrowTail = !!(tail && tail.getAttribute("type") && tail.getAttribute("type") !== "none");
    const tx = kids(n, "txBody")[0]; const paras = tx ? [...tx.getElementsByTagNameNS(A, "p")].map(p => [...p.getElementsByTagNameNS(A, "t")].map(t => t.textContent).join("")) : [];
    let text = paras.map(s => s.replace(/\s+$/, "")).filter((s, i, a) => s.trim() || (i > 0 && i < a.length - 1)).join("\n").trim();
    const rPr = tx && one(tx, "rPr"); const tcol = rPr ? clr(kids(rPr, "solidFill", A)[0]) : null; const sz = rPr && rPr.getAttribute("sz") ? +rPr.getAttribute("sz") / 100 : null; const bold = rPr && rPr.getAttribute("b") === "1";
    const st = n.localName === "cxnSp" ? one(n, "stCxn") : null, en = n.localName === "cxnSp" ? one(n, "endCxn") : null;
    /* custom path (freeform / elbow drawn by hand): points in slide coordinates */
    let poly = null; const cg = spPr && one(spPr, "custGeom");
    if (cg) { const path = one(cg, "path"); if (path) { const pw = +path.getAttribute("w") || (W * E / T.sx) || 1, ph = +path.getAttribute("h") || (H * E / T.sy) || 1; const pts = [];
      for (const c of path.children) { if (c.localName !== "moveTo" && c.localName !== "lnTo") { if (c.localName !== "close") { poly = null; break; } continue; } const pt = one(c, "pt"); if (!pt) continue;
        let u = +pt.getAttribute("x") / pw, v = +pt.getAttribute("y") / ph; if (fh) u = 1 - u; if (fv) v = 1 - v; pts.push({ x: X + u * W, y: Y + v * H, mv: c.localName === "moveTo" }); }
      if (pts.length >= 2 && !pts.slice(1).some(p => p.mv)) poly = pts; } }
    /* bold: most of the text is bold */
    let bc = 0, ac = 0; if (tx) for (const r of tx.getElementsByTagNameNS(A, "r")) { const t = (one(r, "t") || {}).textContent || "", rp = one(r, "rPr"); ac += t.trim().length; if (rp && rp.getAttribute("b") === "1") bc += t.trim().length; }
    return { id: cNvPr ? cNvPr.getAttribute("id") : "", nm: cNvPr ? cNvPr.getAttribute("name") || "" : "", X, Y, W, H, fh, fv, prst, fill: noFill ? null : clr(fillEl) || (!fillEl && !noFill && fillRef && +fillRef.getAttribute("idx") > 0 ? (colorOf(fillRef) || "scheme:style") : null), hasFill: (!!fillEl && !noFill) || (!fillEl && !noFill && !txBox && !!one(n, "fillRef") && +one(n, "fillRef").getAttribute("idx") > 0), line: lnNo ? null : (lnClr || styleLnClr), hasLine: !txBox && ((!!ln && !lnNo && !!lnClr) || styleLn), txBox,
      arrowHead, arrowTail, text, tcol, sz, bold: ac ? bc / ac > 0.6 : bold, poly, cxn: n.localName === "cxnSp", st: st ? st.getAttribute("id") : null, en: en ? en.getAttribute("id") : null };
  };
  const tree = one(d.documentElement, "spTree"); if (!tree) return null; walk(tree, xf0);
  const isLine = s => s.cxn || /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(s.prst) || (s.prst === "" && (s.W < 1.5 || s.H < 1.5) && !s.text) || (s.prst === "cust" && s.poly && !s.text && !s.hasFill);
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
  /* header = same-width shape at the top of the lane body, or sitting right on top of it */
  const lanes = laneBodies.map(b => { const hdr = shapesAll.filter(s => !used.has(s) && Math.abs(s.X - b.X) < 6 && Math.abs(s.W - b.W) < 8 && s.H < 90 &&
      ((s.Y >= b.Y - 4 && s.Y < b.Y + 25) || (s.Y + s.H <= b.Y + 6 && s.Y + s.H >= b.Y - 12)));
    hdr.forEach(h => used.add(h)); const hFill = hdr.find(h => h.hasFill && h.fill && !/^#FFFFFF$/i.test(h.fill) && !h.fill.startsWith("scheme"));
    const hTxt = hdr.map(h => h.text).filter(Boolean).join("\n") || b.text || ""; const [nm, ...sub] = hTxt.split("\n");
    const top = Math.min(b.Y, ...hdr.map(h => h.Y)), hb = hdr.length ? Math.max(...hdr.map(h => h.Y + h.H)) : top;
    return { body: b, name: nm.trim(), sub: sub.join("\n").trim(), hcolor: hFill ? hFill.fill : null, top, hb }; });
  const lanesTop = lanes.length ? Math.min(...lanes.map(l => l.top)) : minY;
  const hdrBottom = lanes.length ? Math.max(lanesTop, ...lanes.map(l => l.hb)) : minY;
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
    return { id: "s" + i, src: b, type: kind, x: Math.round((b.X - L0) * k), y: Math.round((b.Y - top) * k) + FS + 8, w: Math.max(24, Math.round(b.W * k)), h: Math.max(14, Math.round(b.H * k)), text: txt, ...(b.sz ? { fs: Math.max(8, Math.min(40, Math.round(b.sz * k))) } : {}), ...(b.bold ? { bold: true } : {}),
      ...(fill ? { fill } : term ? { fill: "#1F3864" } : {}), ...(line ? { stroke: line } : fill ? { stroke: fill } : {}), ...(tcol && !/^#(000000|1B2631|111827)$/i.test(tcol) ? { color: tcol } : (term && (!fill || lum(fill) < 110)) ? { color: "#FFFFFF" } : {}) }; });
  /* shrink the text until it fits its box (same wrapping as the studio: Arial, 7px padding, 1.25 line height, bullets indented 14px) */
  const cv = (typeof document !== "undefined") ? document.createElement("canvas").getContext("2d") : null;
  const tw = (t, fs, b) => { if (!cv) return t.length * fs * 0.55; cv.font = `${b ? "bold " : ""}${fs}px Arial, Helvetica, sans-serif`; return cv.measureText(t).width; };
  const nLines = (sh, fs) => { const pad = sh.type === "decision" ? Math.min(sh.w, sh.h) * 0.22 : 7, inner = Math.max(20, sh.w - 2 * pad); let n = 0;
    for (let ln of String(sh.text || "").split("\n")) { let ind = 0; const m = ln.match(/^\s*(?:[-*•]|\[[ xX]?\]|o)\s+/); if (m) { ind = 14; ln = ln.slice(m[0].length); } const av = inner - ind;
      if (!ln.trim()) { n++; continue; } let cur = ""; for (const w of ln.split(/(\s+)/)) { const t = cur + w; if (tw(t.trimEnd(), fs, sh.bold) <= av || !cur.trim()) cur = t; else { n++; cur = w.trimStart(); } while (tw(cur.trimEnd(), fs, sh.bold) > av && cur.length > 1) { let q = cur.length - 1; while (q > 1 && tw(cur.slice(0, q), fs, sh.bold) > av) q--; n++; cur = cur.slice(q); } } n++; }
    return { n, pad: sh.type === "decision" ? Math.min(sh.w, sh.h) * 0.22 : 7 }; };
  for (const sh of shapes) { if (!sh.text) continue; let fs = sh.fs || 13;
    for (; fs > 8; fs--) { const r = nLines(sh, fs); if (r.n * Math.round(fs * 1.25) + (sh.type === "decision" ? 2 * r.pad : 6) <= sh.h) break; }
    if (fs !== (sh.fs || 13)) sh.fs = fs; }
  function lum(h) { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; }
  const near = (p, b, t = 7) => p.x >= b.X - t && p.x <= b.X + b.W + t && p.y >= b.Y - t && p.y <= b.Y + b.H + t;
  const boxAt = p => { const c = shapes.filter(s => near(p, s.src)); return c.sort((a, b) => a.src.W * a.src.H - b.src.W * b.src.H)[0] || null; };
  /* arrows */
  const links = []; const add = (a, b, label) => { if (!a || !b || a === b) return; const id = "k" + a.id + "_" + b.id; if (links.some(l => l.id === id)) return; links.push({ id, from: a.id, to: b.id, label: label || "", auto: true }); };
  const byPid = {}; items.forEach(s => { if (s.id) byPid[s.id] = s; });
  const shapeOfItem = it => it && shapes.find(s => s.src === it || inside(it, s.src, 3) || (s.src.X <= ctr(it).x && ctr(it).x <= s.src.X + s.src.W && s.src.Y <= ctr(it).y && ctr(it).y <= s.src.Y + s.src.H));
  const segs = [];
  for (const l of lines) {
    if (l.cxn && l.st && l.en) { const a = shapeOfItem(byPid[l.st]), b = shapeOfItem(byPid[l.en]); if (a && b) { const fwd = !(l.arrowHead && !l.arrowTail); add(fwd ? a : b, fwd ? b : a, ""); if (l.arrowHead && l.arrowTail) links[links.length - 1].both = true; l._done = true; continue; } }
    const pts = l.poly || [{ x: l.X + (l.fh ? l.W : 0), y: l.Y + (l.fv ? l.H : 0) }, { x: l.X + (l.fh ? 0 : l.W), y: l.Y + (l.fv ? 0 : l.H) }];
    for (let i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1], tipA: i === 0 && l.arrowHead, tipB: i === pts.length - 2 && l.arrowTail, l });
  }
  const T = 3.5, same = (p, q) => Math.abs(p.x - q.x) <= T && Math.abs(p.y - q.y) <= T;
  const onSeg = (p, s) => { const minx = Math.min(s.a.x, s.b.x) - T, maxx = Math.max(s.a.x, s.b.x) + T, miny = Math.min(s.a.y, s.b.y) - T, maxy = Math.max(s.a.y, s.b.y) + T; if (p.x < minx || p.x > maxx || p.y < miny || p.y > maxy) return false;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy) || 1; return Math.abs((p.x - s.a.x) * dy - (p.y - s.a.y) * dx) / L <= T; };
  const tips = []; segs.forEach(s => { if (s.tipB) tips.push({ s, p: s.b }); if (s.tipA) tips.push({ s, p: s.a }); });
  const isTipOf = (p, s0) => tips.some(t => t.s !== s0 && same(t.p, p));
  const segPath = {}, route = {}, lineOf = {};
  /* follow each arrow head back along the drawn line(s) to the box it starts from — keeps the ordered points */
  for (const t of tips) {
    const tgt = boxAt(t.p); if (!tgt) continue;
    const seen = new Set([t.s]); const q = [{ s: t.s, enter: t.p, path: [t.p], segs: [t.s] }]; const found = new Map();
    while (q.length) { const st = q.shift(); const s0 = st.s;
      const atA = same(st.enter, s0.a), atB = same(st.enter, s0.b); const exits = atA ? [s0.b] : atB ? [s0.a] : [s0.a, s0.b];
      const step = (o, enter, path) => { if (seen.has(o)) return; seen.add(o); q.push({ s: o, enter, path, segs: [...st.segs, o] }); };
      /* other lines that end somewhere on this one (two sources merging into one arrow) */
      for (const o of segs) { if (seen.has(o)) continue; for (const e of [o.a, o.b]) if (onSeg(e, s0) && !same(e, st.enter)) { if (isTipOf(e, o) && (e === o.b ? o.tipB : o.tipA)) continue; step(o, e, [...st.path, e]); } }
      for (const e of exits) { const path = [...st.path, e];
        if (isTipOf(e, s0)) continue;
        const b = boxAt(e); if (b && b !== tgt) { if (!found.has(b)) found.set(b, { path, segs: st.segs }); continue; }
        for (const o of segs) { if (seen.has(o)) continue; if (same(o.a, e)) step(o, o.a, path); else if (same(o.b, e)) step(o, o.b, path); else if (onSeg(e, o)) step(o, e, path); } } }
    for (const [sb, info] of found) { add(sb, tgt, ""); const id = "k" + sb.id + "_" + tgt.id; segPath[id] = new Set([...(segPath[id] || []), ...info.segs]);
      if (!route[id]) route[id] = info.path.slice().reverse(); lineOf[id] = new Set([...(lineOf[id] || []), ...info.segs.map(x => x.l)]); }
  }
  /* a line with a head at both ends → one link with arrows on both ends */
  for (const L of [...links]) { if (!links.includes(L)) continue; const R = links.find(x => x.from === L.to && x.to === L.from); if (!R || L.both || R.both) continue;
    const a = lineOf[L.id], b = lineOf[R.id]; if (a && b && [...a].some(x => b.has(x))) { L.both = true; links.splice(links.indexOf(R), 1); } }
  /* keep the drawn route: pick the box sides + elbow position that best match the slide (and don't cut through other boxes) */
  const ST = 14 / k, SIDES = ["top", "bottom", "left", "right"], isHs = sd => sd === "left" || sd === "right";
  const portP = (B, sd) => sd === "top" ? { x: B.X + B.W / 2, y: B.Y } : sd === "bottom" ? { x: B.X + B.W / 2, y: B.Y + B.H } : sd === "left" ? { x: B.X, y: B.Y + B.H / 2 } : { x: B.X + B.W, y: B.Y + B.H / 2 };
  const edgeD = (p, B, sd) => { const cl = (v, a, b) => Math.max(a, Math.min(b, v)); if (sd === "top" || sd === "bottom") { const y = sd === "top" ? B.Y : B.Y + B.H; return Math.hypot(p.x - cl(p.x, B.X, B.X + B.W), p.y - y); } const x = sd === "left" ? B.X : B.X + B.W; return Math.hypot(p.x - x, p.y - cl(p.y, B.Y, B.Y + B.H)); };
  const near2 = (p, B) => { const c = SIDES.map(sd => ({ sd, d: edgeD(p, B, sd) })).sort((a, b) => a.d - b.d); return c.filter(x => x.d <= c[0].d + 4).map(x => x.sd); };
  const outP = (p, sd) => sd === "left" ? { x: p.x - ST, y: p.y } : sd === "right" ? { x: p.x + ST, y: p.y } : sd === "top" ? { x: p.x, y: p.y - ST } : { x: p.x, y: p.y + ST };
  const cross = (a, b, B) => { const x0 = B.X + 1.5, x1 = B.X + B.W - 1.5, y0 = B.Y + 1.5, y1 = B.Y + B.H - 1.5; let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
    for (const [pp, qq] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]]) { if (pp === 0) { if (qq < 0) return false; continue; } const r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return t1 - t0 > 0.02; };
  const plen = P => P.slice(1).reduce((a, p, i) => a + Math.abs(p.x - P[i].x) + Math.abs(p.y - P[i].y), 0);
  for (const L of links) { const P = route[L.id]; if (!P || P.length < 2) continue; const A0 = shapes.find(x => x.id === L.from).src, B0 = shapes.find(x => x.id === L.to).src;
    const inner = P.slice(1, -1); const vx = [], hy = [];
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) > 2) vx.push({ v: a.x, l: Math.abs(a.y - b.y), end: i === 0 || i === P.length - 2 }); if (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 2) hy.push({ v: a.y, l: Math.abs(a.x - b.x), end: i === 0 || i === P.length - 2 }); }
    const pick = arr => { const c = arr.filter(x => !x.end).sort((a, b) => b.l - a.l)[0] || arr.sort((a, b) => b.l - a.l)[0]; return c ? c.v : null; };
    let best = null;
    for (const fs of near2(P[0], A0)) for (const ts of near2(P[P.length - 1], B0)) {
      const p = portP(A0, fs), q = portP(B0, ts), p1 = outP(p, fs), q1 = outP(q, ts); let mid = [], mx = null, my = null;
      if (isHs(fs) && isHs(ts)) { mx = pick(vx); const m = mx != null ? mx : (p1.x + q1.x) / 2; mid = [{ x: m, y: p1.y }, { x: m, y: q1.y }]; }
      else if (!isHs(fs) && !isHs(ts)) { my = pick(hy); const m = my != null ? my : (p1.y + q1.y) / 2; mid = [{ x: p1.x, y: m }, { x: q1.x, y: m }]; }
      else if (isHs(fs)) mid = [{ x: q1.x, y: p1.y }]; else mid = [{ x: p1.x, y: q1.y }];
      let R = [p, p1, ...mid, q1, q];
      if ((isHs(fs) && isHs(ts) && Math.abs(p.y - q.y) < 2 && mx == null) || (!isHs(fs) && !isHs(ts) && Math.abs(p.x - q.x) < 2 && my == null)) R = [p, q];
      let hit = 0; for (const o of shapes) { if (o.src === A0 || o.src === B0) continue; for (let i = 0; i < R.length - 1; i++) if (cross(R[i], R[i + 1], o.src)) { hit++; break; } }
      /* walking back into its own box is ugly too */
      for (const [Bx, a, b] of [[A0, R[1], R[2]], [B0, R[R.length - 3], R[R.length - 2]]]) if (a && b && cross(a, b, Bx)) hit++;
      const sc = hit * 100 + 0.25 * (Math.hypot(p.x - P[0].x, p.y - P[0].y) + Math.hypot(q.x - P[P.length - 1].x, q.y - P[P.length - 1].y)) + 0.05 * Math.abs(plen(R) - plen(P)) + (R.length - 2) * 2;
      if (!best || sc < best.sc) best = { sc, fs, ts, mx, my }; }
    if (!best) continue;
    L.auto = false; L.fs = best.fs; L.ts = best.ts; delete L._r;
    if (best.mx != null) L.mx = Math.round((best.mx - L0) * k); if (best.my != null) L.my = Math.round((best.my - top) * k) + FS + 8; }
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
