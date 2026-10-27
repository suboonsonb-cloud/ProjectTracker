/* 03c-sharepoint.js — open and save the workbook straight from a SharePoint link (Microsoft Graph).
   Paste the "Copy link" / address-bar URL of the .xlsx → sign in with the company account → the app reads the file
   from SharePoint and Save writes it back (no OneDrive sync needed). The link is remembered for auto-connect.
   Needs (once, by IT): an Entra ID app registration, type "Single-page application", redirect URI = the address this
   page runs from (e.g. http://localhost:8765/SGA_Tracker_Desk.html via Start_Tracker_Desk.cmd), delegated permission
   Files.ReadWrite.All. A page opened as a local file (file://) cannot sign in — browsers don't allow it. */
"use strict";
const GRAPH_DEFAULT = { clientId: "", tenant: "organizations" };   // IT can fill these in here before building
const MSAL_CDN = "https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.28.1/lib/msal-browser.min.js";
const G_SCOPES = ["Files.ReadWrite.All"];
function gCfg() { let o = {}; try { o = JSON.parse(localStorage.getItem("sga_graph") || "{}"); } catch (e) { } return { ...GRAPH_DEFAULT, ...o }; }
function gSetCfg(o) { try { localStorage.setItem("sga_graph", JSON.stringify(o)); } catch (e) { } G_PCA = null; }
const gReady = () => !!gCfg().clientId && /^https?:$/.test(location.protocol);
function spLinkRec() { try { return JSON.parse(localStorage.getItem("sga_splink") || "null"); } catch (e) { return null; } }
function spSetLink(r) { try { r ? localStorage.setItem("sga_splink", JSON.stringify(r)) : localStorage.removeItem("sga_splink"); } catch (e) { } }
const isSpLink = u => /^https:\/\/[^/]+\.sharepoint\.com\//i.test(String(u || "").trim());

let G_PCA = null, G_MSAL_P = null;
function loadMsal() {
  if (window.msal) return Promise.resolve();
  return G_MSAL_P = G_MSAL_P || new Promise((res, rej) => { const s = document.createElement("script"); s.src = MSAL_CDN; s.onload = res; s.onerror = () => rej(new Error("Could not load the Microsoft sign-in library (no internet?)")); document.head.appendChild(s); });
}
async function gPca() {
  if (G_PCA) return G_PCA;
  await loadMsal(); const c = gCfg();
  const p = new msal.PublicClientApplication({ auth: { clientId: c.clientId, authority: `https://login.microsoftonline.com/${c.tenant || "organizations"}`, redirectUri: location.origin + location.pathname },
    cache: { cacheLocation: "localStorage" } });
  await p.initialize(); await p.handleRedirectPromise().catch(() => null);
  return G_PCA = p;
}
/* interactive=false → silent only (auto-connect at start-up, no pop-up without a click) */
async function gToken(interactive) {
  const p = await gPca(); const acc = p.getActiveAccount() || p.getAllAccounts()[0];
  if (acc) { try { const r = await p.acquireTokenSilent({ scopes: G_SCOPES, account: acc }); p.setActiveAccount(r.account); return r.accessToken; } catch (e) { if (!interactive) throw e; } }
  if (!interactive) throw new Error("sign-in needed");
  const r = await p.acquireTokenPopup({ scopes: G_SCOPES, prompt: acc ? undefined : "select_account" }); p.setActiveAccount(r.account); return r.accessToken;
}
async function gFetch(path, opt = {}, interactive) {
  const t = await gToken(interactive);
  const r = await fetch(path.startsWith("http") ? path : "https://graph.microsoft.com/v1.0" + path, { ...opt, headers: { Authorization: "Bearer " + t, ...(opt.headers || {}) } });
  if (!r.ok) { let m = r.status + ""; try { const j = await r.json(); m = (j.error && (j.error.message || j.error.code)) || m; } catch (e) { } const err = new Error(m); err.status = r.status; throw err; }
  return r;
}
const shareId = url => "u!" + btoa(unescape(encodeURIComponent(url.trim()))).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
const SEL = "?$select=id,name,eTag,lastModifiedDateTime,size,parentReference,webUrl";
/* a file "handle" the rest of the app can use like a local one: getFile() + createWritable() */
function graphHandle(item) {
  const h = {
    kind: "graph", name: item.name, item,
    meta: async () => { const m = await (await gFetch(`/drives/${h.item.parentReference.driveId}/items/${h.item.id}${SEL}`)).json(); h.item = m; return m; },
    async getFile() {
      const m = await h.meta();
      return { name: m.name, lastModified: Date.parse(m.lastModifiedDateTime), size: m.size,
        arrayBuffer: async () => (await gFetch(`/drives/${m.parentReference.driveId}/items/${m.id}/content`)).arrayBuffer() };
    },
    async createWritable() {
      let data = null;
      return { write: async b => { data = b; }, close: async () => { await gUpload(h, data); } };
    }
  };
  return h;
}
async function gUpload(h, blob) {
  const d = h.item.parentReference.driveId, i = h.item.id;
  if (blob.size <= 4 * 1024 * 1024) {
    const r = await gFetch(`/drives/${d}/items/${i}/content`, { method: "PUT", body: blob, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }, true);
    h.item = { ...h.item, ...(await r.json()) }; return;
  }
  const s = await (await gFetch(`/drives/${d}/items/${i}/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) }, true)).json();
  const r = await fetch(s.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Range": `bytes 0-${blob.size - 1}/${blob.size}` } });
  if (!r.ok) throw new Error("Upload to SharePoint failed (" + r.status + ")");
  h.item = { ...h.item, ...(await r.json()) };
}
/* open a SharePoint link (interactive = from a click) */
async function openSpLink(url, interactive = true) {
  url = String(url || "").trim();
  if (!isSpLink(url)) { toast("Paste the link of the .xlsx in SharePoint (https://….sharepoint.com/…)", 6000); return false; }
  if (!gReady()) { spSetupDialog(); return false; }
  try {
    toast("Connecting to SharePoint…", 20000);
    const item = await (await gFetch(`/shares/${shareId(url)}/driveItem${SEL}`, {}, interactive)).json();
    if (!/\.xlsx$/i.test(item.name)) { toast("That link is not an .xlsx workbook: " + item.name, 7000); return false; }
    const h = graphHandle(item); const f = await h.getFile();
    await ingest(await f.arrayBuffer(), f.name, h, f.lastModified);
    S._locOk = true; spSetLink({ url, name: item.name, at: Date.now() }); try { localStorage.setItem("sga_lastsrc", "sp"); } catch (e) { }
    $("#fileName").textContent = item.name + " · SharePoint · saves in place"; paintConn(); return true;
  } catch (e) {
    console.warn(e); const m = e.status === 404 || e.status === 403 ? "you don't have access to that file, or the link is wrong" : e.message;
    if (interactive || !/sign-in needed|interaction_required|login_required/i.test(e.message)) toast("Could not open the SharePoint file: " + m, 8000);
    return false;
  }
}
async function bootSpConnect() {
  const r = spLinkRec(); if (!r || !gReady() || !autoOn() || S.zip) return false;
  let last = ""; try { last = localStorage.getItem("sga_lastsrc") || ""; } catch (e) { } if (last && last !== "sp") return false;
  return await openSpLink(r.url, false);   // silent; if sign-in is needed the landing card offers one click
}
function spCardHtml() {
  const r = spLinkRec(); const fileProto = location.protocol === "file:";
  const disabled = fileProto || !gCfg().clientId;
  const why = fileProto ? "Opening from a SharePoint link needs the Desk started with <b>Start_Tracker_Desk.cmd</b> (it runs at http://localhost) — a page opened as a local file can't sign in to Microsoft 365."
    : !gCfg().clientId ? "Needs a one-time app registration by IT (Client ID)." : "";
  return `<div class="spcard"><b>Open from a SharePoint link</b>
    ${r ? `<p class="muted" style="margin:4px 0 8px;font-size:12.5px">Remembered: <b>${esc(r.name)}</b> <button class="btn small primary" id="spGo" ${disabled ? "disabled" : ""}>Connect</button> <button class="btn small" id="spForget">Forget</button></p>` : ""}
    <div class="sprow"><input type="url" id="spUrl" placeholder="Paste the SharePoint link of the .xlsx (Copy link or the address bar)" value="" ${disabled ? "disabled" : ""}><button class="btn" id="spOpen" ${disabled ? "disabled" : ""}>Open link</button></div>
    ${why ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${why} <a href="#" id="spHow">How to set it up</a></p>` : `<p class="muted" style="font-size:12px;margin:6px 0 0">Signs in with your company account; Save writes straight back to SharePoint. <a href="#" id="spHow">Settings</a></p>`}</div>`;
}
function bindSpCard(root) {
  const go = root.querySelector("#spGo"); if (go) go.onclick = () => openSpLink(spLinkRec().url, true);
  const fg = root.querySelector("#spForget"); if (fg) fg.onclick = () => { spSetLink(null); render(); };
  const o = root.querySelector("#spOpen"), u = root.querySelector("#spUrl");
  if (o) o.onclick = () => openSpLink(u.value, true);
  if (u) u.onkeydown = e => { if (e.key === "Enter") openSpLink(u.value, true); };
  const how = root.querySelector("#spHow"); if (how) how.onclick = e => { e.preventDefault(); spSetupDialog(); };
}
async function spSetupDialog() {
  const c = gCfg(); const here = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : "http://localhost:8765/SGA_Tracker_Desk.html";
  const k = await choose("Open from SharePoint links — setup", `<ol class="steps" style="margin:0 0 10px 18px;font-size:13px">
      <li><b>IT, once:</b> Entra ID → App registrations → New → name "Initiatives Tracker Desk" → platform <b>Single-page application</b>, redirect URI <code>${esc(here)}</code> → API permissions: Microsoft Graph, delegated <b>Files.ReadWrite.All</b> (grant admin consent).</li>
      <li>Paste the <b>Application (client) ID</b> below (and your tenant ID or domain).</li>
      <li>Start the Desk with <b>Start_Tracker_Desk.cmd</b> (opens it at http://localhost:8765) — or host it on a company web server and register that address instead.</li></ol>
    <label class="field"><span>Client ID</span><input id="gCid" value="${esc(c.clientId)}" placeholder="00000000-0000-0000-0000-000000000000"></label>
    <label class="field"><span>Tenant (ID or domain)</span><input id="gTen" value="${esc(c.tenant)}" placeholder="thaiunion.onmicrosoft.com"></label>`,
    [["c", "Cancel"], ["save", "Save", "primary"]]);
  if (k === "save") { const cid = (document.getElementById("gCid") || {}).value, ten = (document.getElementById("gTen") || {}).value; gSetCfg({ clientId: (cid || "").trim(), tenant: (ten || "").trim() || "organizations" }); toast("Saved"); if (!S.zip) render(); }
}
document.addEventListener("input", e => { if (e.target && (e.target.id === "gCid" || e.target.id === "gTen")) e.target.setAttribute("value", e.target.value); });
