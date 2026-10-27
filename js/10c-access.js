/* 10c-access.js — sign-in page, roles, BU access and user maintenance.
   Users are a table in the workbook (sheet "Users") — Excel is the database, so an Admin can also maintain it in Excel:
     A Name · B Email (login) · C Password · D Role · E BU access · F Active · G Notes
   Role:      Admin = see + edit everything, Settings, Users · Editor = edit + save inside their BU access · Viewer = read only, inside their BU access
   BU access: comma list of BUs or Corporate Functions (e.g. "Finance, Procurement"); blank / All = every BU. Admin always sees all.
   Password:  blank = signs in with the e-mail only · typed in Excel as plain text works too (Settings → Users → "Secure passwords" hashes them)
   Remember me: the browser saves the password (autofill) and the Desk keeps the user signed in on this computer for 30 days.
   Only an Admin, signed in, can add people / change access: Settings → 👤 Users.
   NOTE: this controls what the Desk lets people do. Anyone who can open the .xlsx in Excel can still edit it there —
   real protection = SharePoint folder permissions (who can open / edit the file). */
"use strict";
const USERS_SHEET = "Users", U_COLS = ["A", "B", "C", "D", "E", "F", "G"], U_HEAD = ["Name", "Email (login)", "Password", "Role", "BU access", "Active", "Notes"];
const UC = { name: "A", login: "B", pw: "C", role: "D", bu: "E", active: "F", notes: "G" };
const ROLES = ["Admin", "Editor", "Viewer"], PW_MIN = 4;
const ROLE_INFO = { Admin: "Sees and edits everything; Settings and Users", Editor: "Sees and edits the projects of their BU access; can save", Viewer: "Sees the projects of their BU access; read only" };
let ACC = null;   // signed-in {r, login, name, role, bu:[...] | null}

const hasUsers = () => !!(S.sheets && S.sheets[USERS_SHEET] && S.sheets[USERS_SHEET].doc);
function userRows() { if (!hasUsers()) return []; const out = []; for (const r of S.sheets[USERS_SHEET].rows.keys()) if (r > 1 && String(gv(USERS_SHEET, UC.login, r) || "").trim()) out.push(r); return out.sort((a, b) => a - b); }
const buParse = v => { const a = String(v || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean); return !a.length || a.some(x => /^(all|\*)$/i.test(x)) ? null : a; };
const uGet = r => { const role0 = String(gv(USERS_SHEET, UC.role, r) || "").trim(); const role = ROLES.find(x => x.toLowerCase() === role0.toLowerCase()) || "Viewer";
  return { r, name: String(gv(USERS_SHEET, UC.name, r) || ""), login: String(gv(USERS_SHEET, UC.login, r) || "").trim(), role, pw: String(gv(USERS_SHEET, UC.pw, r) ?? ""), buTxt: String(gv(USERS_SHEET, UC.bu, r) || ""), bu: buParse(gv(USERS_SHEET, UC.bu, r)),
    active: !/^(n|no|false|0|inactive)$/i.test(String(gv(USERS_SHEET, UC.active, r) ?? "Y").trim()), notes: String(gv(USERS_SHEET, UC.notes, r) || "") }; };
const allUsers = () => userRows().map(uGet);
const accessOn = () => allUsers().some(u => u.active && u.role === "Admin");
const role = () => !accessOn() ? "Admin" : ACC ? ACC.role : "Viewer";
const canEdit = () => role() !== "Viewer";
const isAdmin = () => role() === "Admin";

/* ---- password: PBKDF2-SHA256 hash, or plain text typed in Excel ---- */
const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const isHashed = s => /^pbkdf2\$\d+\$/.test(String(s || ""));
async function pwHash(pw, saltB64, iter = 120000) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
  return `pbkdf2$${iter}$${b64(salt)}$${b64(bits)}`;
}
async function pwCheck(pw, stored) { stored = String(stored ?? ""); if (stored === "") return true; if (!isHashed(stored)) return pw === stored; const p = stored.split("$"); return (await pwHash(pw, p[2], +p[1])) === stored; }

/* ---- BU scope: what this user sees and may edit ---- */
function scope() { return accessOn() && ACC && ACC.role !== "Admin" && ACC.bu ? ACC.bu.map(x => x.toLowerCase()) : null; }
function projInScope(r, sc) { sc = sc || scope(); if (!sc) return true; const bu = String(gv("Projects", FP.bu, r) || "").toLowerCase(), cf = String(gv("Projects", FP.cf, r) || "").toLowerCase();
  if (!bu && !cf) return true; /* a new, not yet classified project */ return sc.includes(bu) || sc.includes(cf); }
let SC_CACHE = { k: "" };
const _rowsOf0 = rowsOf;
function scopeSets() { const sc = scope(); const k = (ACC ? ACC.login + ACC.bu : "") + "|" + S.changes.length + "|" + S.fileName; if (SC_CACHE.k === k) return SC_CACHE;
  const pr = _rowsOf0("Projects").filter(r => projInScope(r, sc)); const pids = new Set(pr.map(pId)); const bids = new Set(_rowsOf0("Benefits").filter(r => pids.has(gv("Benefits", FB.pid, r))).map(r => gv("Benefits", FB.id, r)));
  return SC_CACHE = { k, pr: new Set(pr), pids, bids }; }
rowsOf = function (sheet) {
  const a = _rowsOf0(sheet); if (!scope()) return a; const X = scopeSets();
  if (sheet === "Projects") return a.filter(r => X.pr.has(r));
  const pc = { Activities: FA.pid, Benefits: FB.pid, RAIDD: FD.pid, Realisation: FR.pid }[sheet];
  if (pc) return a.filter(r => { const p = gv(sheet, pc, r); return !p || X.pids.has(p) || (sheet === "Realisation" && X.bids.has(gv(sheet, FR.bid, r))); });
  if (sheet === "Benefit_Plan") return a.filter(r => { const b = gv(sheet, "B", r); return !b || X.bids.has(b); });
  return a;
};

/* ---- writes that bypass the guard (own password, first set-up) ---- */
let ACC_BYPASS = false;
function uSet(r, col, v) { ACC_BYPASS = true; try { setCell(USERS_SHEET, col, r, v); } finally { ACC_BYPASS = false; } }
async function ensureUsersSheet() {
  if (hasUsers()) return; ACC_BYPASS = true;
  try { await ensureSheet(USERS_SHEET, '<col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/><col min="4" max="4" width="10" customWidth="1"/><col min="5" max="5" width="28" customWidth="1"/><col min="6" max="6" width="8" customWidth="1"/><col min="7" max="7" width="40" customWidth="1"/>', U_HEAD, U_COLS); }
  finally { ACC_BYPASS = false; }
}
function uFreeRow() { const rs = userRows(); let r = 2; while (rs.includes(r)) r++; return r; }

/* ---- the guard: every cell write goes through setCell ---- */
function _projRow(id) { for (const r of _rowsOf0("Projects")) if (pId(r) === id) return r; return null; }
function accessGuard(sheet, col, row, val) {
  if (ACC_BYPASS || typeof LOG_SHEET !== "undefined" && sheet === LOG_SHEET) return;
  if (!accessOn()) return;
  if (!ACC) throw new Error("Sign in first");
  if (sheet === USERS_SHEET && ACC.role !== "Admin") throw new Error("Only an Admin can change users");
  if (ACC.role === "Viewer") { toast("View only — ask an Admin for edit access", 4000); throw new Error("View only"); }
  if ((sheet === "Master_Data" || sheet === "Lists") && ACC.role !== "Admin" && view === "Settings") throw new Error("Only an Admin can change Settings");
  const sc = scope(); if (!sc) return;
  const deny = () => { toast("Outside your BU access — ask an Admin", 4000); throw new Error("Outside your BU access"); };
  if (sheet === "Projects") { if (!projInScope(row, sc)) deny();
    if ((col === FP.bu || col === FP.cf) && val) { const other = String(gv("Projects", col === FP.bu ? FP.cf : FP.bu, row) || "").toLowerCase(); if (!sc.includes(String(val).toLowerCase()) && !sc.includes(other)) deny(); } return; }
  const pc = { Activities: FA.pid, Benefits: FB.pid, RAIDD: FD.pid, Realisation: FR.pid }[sheet];
  if (pc) { const pid = col === pc && val ? val : gv(sheet, pc, row); if (pid) { const pr = _projRow(pid); if (pr && !projInScope(pr, sc)) deny(); } }
}

/* ---- session / remember me ---- */
const SESS_KEY = "sga_acc";
function sessSave(keep) { const v = JSON.stringify({ login: ACC.login, until: keep ? Date.now() + 30 * 864e5 : 0 }); try { sessionStorage.setItem(SESS_KEY, v); if (keep) localStorage.setItem(SESS_KEY, v); else localStorage.removeItem(SESS_KEY); localStorage.setItem("sga_lastlogin", ACC.login); } catch (e) { } }
function sessGet() { try { const v = JSON.parse(sessionStorage.getItem(SESS_KEY) || localStorage.getItem(SESS_KEY) || "null"); if (v && v.until && v.until < Date.now()) { localStorage.removeItem(SESS_KEY); return null; } return v; } catch (e) { return null; } }
function sessClear() { try { sessionStorage.removeItem(SESS_KEY); localStorage.removeItem(SESS_KEY); } catch (e) { } }
function signInAs(u, keep) { ACC = { r: u.r, login: u.login, name: u.name || u.login, role: u.role, bu: u.role === "Admin" ? null : u.bu }; SC_CACHE = { k: "" }; sessSave(keep); paintAcc(); }
function signOut() { ACC = null; sessClear(); paintAcc(); accessGate(true).then(ok => { if (ok && view) render(); }); }

/* ---- after a workbook is opened: who are you? ---- */
function graphAccount() { try { if (typeof G_PCA !== "undefined" && G_PCA) return G_PCA.getActiveAccount() || G_PCA.getAllAccounts()[0] || null; } catch (e) { } return null; }
async function accessGate(force) {
  paintAcc(); if (!accessOn()) { ACC = null; paintAcc(); return true; }
  const users = allUsers().filter(u => u.active); const find = l => users.find(u => u.login.toLowerCase() === String(l || "").toLowerCase());
  if (!force) {
    const s = sessGet(); const u = s && find(s.login); if (u) { signInAs(u, !!s.until); return true; }
    const g = graphAccount(); const gu = g && (find(g.username) || find(g.name)); if (gu) { signInAs(gu, false); toast(`Signed in as ${gu.name || gu.login} (Microsoft 365)`, 3000); return true; }
  }
  return await loginPage();
}
/* the sign-in page: a real <form> so Edge / Chrome offer to save the password and fill it in next time */
function loginPage(msg) {
  return new Promise(res => {
    let pg = document.getElementById("loginPage"); if (pg) pg.remove();
    pg = document.createElement("div"); pg.id = "loginPage"; pg.className = "loginpage"; pg.setAttribute("role", "dialog"); pg.setAttribute("aria-modal", "true"); pg.setAttribute("aria-labelledby", "lpH");
    let last = ""; try { last = localStorage.getItem("sga_lastlogin") || ""; } catch (e) { }
    const ms = typeof gReady === "function" && gReady();
    pg.innerHTML = `<form class="lpcard" id="lpForm" autocomplete="on" novalidate>
      <div class="lpbrand"><span class="lplogo" aria-hidden="true">SG&amp;A</span><div><h1 id="lpH">Tracker Desk</h1><p>${esc(S.fileName || "")}</p></div></div>
      ${msg ? `<div class="lperr" role="alert">${esc(msg)}</div>` : ""}
      <label class="lpf"><span>Email</span><input id="lpUser" name="username" type="email" autocomplete="username" required value="${esc(last)}" placeholder="name@thaiunion.com"></label>
      <label class="lpf"><span>Password</span><input id="lpPw" name="password" type="password" autocomplete="current-password" placeholder="Leave blank if you have none"></label>
      <label class="lprem"><input type="checkbox" id="lpKeep" checked> Remember me on this computer</label>
      <button type="submit" class="btn primary lpgo">Sign in</button>
      ${ms ? `<button type="button" class="btn lpms" id="lpMs">Sign in with Microsoft</button>` : ""}
      <p class="lphint">Remember me: you stay signed in here for 30 days and your browser can save the password. No access yet, or forgot the password? Ask an Admin — they add people in Settings → 👤 Users.</p>
      <button type="button" class="lpclose" id="lpClose">Close workbook</button></form>`;
    document.body.appendChild(pg);
    const f = pg.querySelector("#lpForm"), u = pg.querySelector("#lpUser"), p = pg.querySelector("#lpPw");
    setTimeout(() => (u.value ? p : u).focus(), 30);
    const done = ok => { pg.remove(); res(ok); };
    f.onsubmit = async e => { e.preventDefault(); const users = allUsers().filter(x => x.active); const x = users.find(y => y.login.toLowerCase() === u.value.trim().toLowerCase());
      if (!x || !(await pwCheck(p.value, x.pw))) { pg.remove(); res(await loginPage(x && !p.value ? "Password needed for this account" : "Wrong email or password")); return; }
      signInAs(x, pg.querySelector("#lpKeep").checked); toast(`Welcome, ${x.name || x.login}${x.role !== "Admin" && x.bu ? " · " + x.bu.join(", ") : ""}`, 2500); done(true); };
    pg.querySelector("#lpClose").onclick = () => { done(false); closeWorkbook(); };
    const m = pg.querySelector("#lpMs"); if (m) m.onclick = async () => { try { await gToken(true); const g = graphAccount(); const x = g && allUsers().filter(y => y.active).find(y => [g.username, g.name].some(v => v && v.toLowerCase() === y.login.toLowerCase()));
      if (x) { signInAs(x, pg.querySelector("#lpKeep").checked); done(true); } else { pg.remove(); res(await loginPage(`${g ? g.username : "That account"} is not in the user list`)); } } catch (err) { pg.remove(); res(await loginPage("Microsoft sign-in failed: " + err.message)); } };
  });
}
function closeWorkbook() { ACC = null; Object.assign(S, { zip: null, sheets: {}, changes: [], handle: null, fileName: "" }); $("#fileName").textContent = "No workbook loaded"; $("#tabs").classList.add("hidden"); updateBadge(); paintAcc(); render(); }

/* ---- header chip + role look ---- */
function paintAcc() {
  const r = role(); document.body.classList.toggle("role-viewer", r === "Viewer" && !!S.zip); document.body.classList.toggle("role-editor", r === "Editor");
  let c = document.getElementById("accChip");
  if (!c) { const f = document.getElementById("connChip"); if (!f) return; c = document.createElement("button"); c.type = "button"; c.id = "accChip"; c.className = "accchip"; f.after(c); c.onclick = accMenu; }
  if (!S.zip || !accessOn()) { c.classList.add("hidden"); return; }
  const sc = ACC && ACC.role !== "Admin" && ACC.bu ? ACC.bu.join(", ") : "all BUs";
  c.classList.remove("hidden"); c.textContent = ACC ? `👤 ${ACC.name.split(/[ .@]/)[0]}${ACC.role === "Admin" ? " ★" : ACC.role === "Viewer" ? " 👁" : ""}` : "👤 Sign in";
  c.title = ACC ? `${ACC.name} · ${ACC.role} · ${sc} — click for password / sign out` : "Sign in";
  const sv = document.getElementById("btnSave"); if (sv) sv.classList.toggle("hidden", r === "Viewer");
}
async function accMenu() {
  if (!ACC) { if (await loginPage() && view) render(); return; }
  const sc = ACC.role !== "Admin" && ACC.bu ? ACC.bu.join(", ") : "All BUs";
  const k = await choose(`${esc(ACC.name)} · ${ACC.role}`, `<p class="muted" style="margin-top:0">${esc(ACC.login)}<br>${esc(ROLE_INFO[ACC.role])}.<br>BU access: <b>${esc(sc)}</b></p>`, [["c", "Close"], ...(ACC.role === "Admin" ? [["users", "Manage users"]] : []), ["pw", "Change my password"], ["out", "Sign out", "primary"]]);
  if (k === "out") signOut(); else if (k === "pw") changeMyPw(); else if (k === "users") { view = "Settings"; UI.stab = "users"; render(); }
}
async function changeMyPw() {
  const k = await choose("Change my password", `<label class="field"><span>Current password</span><input id="cpOld" type="password" autocomplete="current-password"></label><label class="field"><span>New password (min. ${PW_MIN} characters)</span><input id="cpNew" type="password" autocomplete="new-password"></label><label class="field"><span>Repeat new password</span><input id="cpNew2" type="password" autocomplete="new-password"></label>`, [["c", "Cancel"], ["ok", "Change", "primary"]]);
  if (k !== "ok") return; const g = id => (document.getElementById(id) || {}).value || ""; const o = g("cpOld"), n = g("cpNew"), n2 = g("cpNew2"); const u = uGet(ACC.r);
  if (!(await pwCheck(o, u.pw))) { toast("Current password is wrong", 5000); return; }
  if (n.length < PW_MIN || n !== n2) { toast(n !== n2 ? "The new passwords don't match" : `Use at least ${PW_MIN} characters`, 5000); return; }
  uSet(ACC.r, UC.pw, await pwHash(n)); toast("Password changed — click Save to Excel to keep it", 6000); if (view) render();
}

/* ---- Settings → 👤 Users (Admin only) ---- */
function buChoices() { const a = [...(hasMD() ? mdList("L_BU") : listFromName("L_BU")), ...(hasMD() ? mdList("L_CF") : listFromName("L_CF"))]; _rowsOf0("Projects").forEach(r => { a.push(gv("Projects", FP.bu, r), gv("Projects", FP.cf, r)); }); return uniqOrder(a.map(x => String(x || "").trim()).filter(Boolean)); }
function vUsers() {
  if (!accessOn()) return `<div class="card pad stcard" style="max-width:900px"><h2 style="margin-top:0">👤 Users &amp; sign-in</h2>
    <div class="note" style="margin:0 0 12px">Sign-in is <b>off</b> — anyone who opens this workbook in the Desk sees and edits everything.</div>
    <p>Turn it on by creating the first <b>Admin</b> (you). After that only a signed-in Admin can add people here, with a <b>role</b> (Admin / Editor / Viewer) and <b>BU access</b> (e.g. Finance, Procurement) — they only see and edit the projects of those BUs. The list is the <b>Users</b> sheet of the workbook, so it applies to everyone.</p>
    <div class="fgrid"><label class="field"><span>Your name</span><input id="uaName" value="${esc(curUser())}"></label><label class="field"><span>Email (login)</span><input id="uaLogin" type="email" placeholder="name@thaiunion.com"></label>
    <label class="field"><span>Password (min. ${PW_MIN})</span><input id="uaPw" type="password" autocomplete="new-password"></label><label class="field"><span>Repeat password</span><input id="uaPw2" type="password" autocomplete="new-password"></label></div>
    <p><button class="btn primary" id="uaOn">Turn on sign-in</button></p>
    <p class="muted" style="font-size:12px">Sign-in controls what the Desk allows. To stop people editing the file in Excel itself, set the SharePoint folder permissions (read vs edit).</p></div>`;
  const us = allUsers(); const last = {};
  if (typeof logRows === "function") for (const r of logRows()) { const w = String(gv(LOG_SHEET, "B", r) || ""), t = String(gv(LOG_SHEET, "A", r) || ""); if (!last[w] || t > last[w]) last[w] = t; }
  const pend = S.changes.some(c => c.sheet === USERS_SHEET); const plain = us.filter(u => u.pw && !isHashed(u.pw)).length;
  return `<div class="card pad stcard"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">👤 Users &amp; sign-in</h2><span class="muted">${us.filter(u => u.active).length} active · sign-in is on · only Admins see this page</span><span style="flex:1"></span>${plain ? `<button class="btn small" id="uSecure" title="Passwords typed into the Excel sheet are plain text — replace them with hashes">🔒 Secure ${plain} password${plain > 1 ? "s" : ""}</button>` : ""}<button class="btn small new" id="uAdd">+ Add user</button></div>
    ${pend ? `<div class="note" style="margin:10px 0 0">User changes are not saved yet — click <b>Save to Excel</b> so they apply for everyone.</div>` : ""}
    <div class="tablewrap" style="margin-top:10px"><table class="data sttab"><thead><tr><th>Name</th><th>Email (login)</th><th>Password</th><th>Role</th><th>BU access <span class="muted" style="font-weight:400">(blank = all)</span></th><th>Active</th><th>Last change saved</th><th>Notes</th><th></th></tr></thead><tbody>
    ${us.map(u => `<tr${u.active ? "" : ' class="muted"'}><td><input data-uf="${UC.name}" data-ur="${u.r}" value="${esc(u.name)}" style="width:140px" aria-label="Name"></td><td><input data-uf="${UC.login}" data-ur="${u.r}" value="${esc(u.login)}" style="width:230px" aria-label="Email"></td>
      <td style="white-space:nowrap">${!u.pw ? `<span class="muted">none — email only</span>` : isHashed(u.pw) ? "set" : `<span style="color:#B54708">plain text</span>`} <button class="btn small" data-upw="${u.r}">${u.pw ? "Reset" : "Set"}</button></td>
      <td><select data-uf="${UC.role}" data-ur="${u.r}" aria-label="Role">${ROLES.map(x => `<option ${x === u.role ? "selected" : ""}>${x}</option>`).join("")}</select></td>
      <td>${u.role === "Admin" ? `<span class="muted">All (Admin)</span>` : `<input data-uf="${UC.bu}" data-ur="${u.r}" list="buList" value="${esc(u.buTxt)}" placeholder="All" style="width:170px" aria-label="BU access">`}</td>
      <td><input type="checkbox" data-uact="${u.r}" ${u.active ? "checked" : ""} aria-label="Active"></td>
      <td class="muted" style="font-size:12px">${esc(last[u.name] || last[u.login] || "—")}</td><td><input data-uf="${UC.notes}" data-ur="${u.r}" value="${esc(u.notes)}" style="width:150px" aria-label="Notes"></td>
      <td>${ACC && ACC.r === u.r ? '<span class="usedn">you</span>' : `<button class="btn small danger" data-udel="${u.r}">Delete</button>`}</td></tr>`).join("")}</tbody></table></div>
    <datalist id="buList"><option value="All">${buChoices().map(x => `<option value="${esc(x)}">`).join("")}</datalist>
    <div class="stgrid" style="margin-top:12px">${ROLES.map(r => `<div class="kp" style="display:block"><b>${r}</b><div class="muted" style="font-size:12px">${ROLE_INFO[r]}</div></div>`).join("")}</div>
    <p class="muted" style="font-size:12px">BU access = BU or Corporate Function names, comma separated (e.g. <i>Finance, Procurement</i>). Changes apply after <b>Save to Excel</b> and go into the Activity log. The same table is the <b>Users</b> sheet in Excel (${U_HEAD.join(" · ")}); a password typed there in plain text works — 🔒 Secure turns it into a hash. At least one active Admin is always kept. To turn sign-in off, delete the other users, then <a href="#" id="uOff">turn sign-in off</a>.</p></div>`;
}
function bindUsers(m, re0) {
  const re = () => { re0(); try { renderTabs(); } catch (e) { } };
  const g = id => (m.querySelector("#" + id) || {}).value || "";
  const on = m.querySelector("#uaOn"); if (on) on.onclick = async () => {
    const name = g("uaName").trim(), login = g("uaLogin").trim(), pw = g("uaPw"), pw2 = g("uaPw2");
    if (!name || !login) { toast("Fill in your name and email"); return; } if (pw.length < PW_MIN || pw !== pw2) { toast(pw !== pw2 ? "Passwords don't match" : `Use at least ${PW_MIN} characters`, 5000); return; }
    await ensureUsersSheet(); const r = uFreeRow(); const h = await pwHash(pw);
    uSet(r, UC.name, name); uSet(r, UC.login, login); uSet(r, UC.pw, h); uSet(r, UC.role, "Admin"); uSet(r, UC.bu, "All"); uSet(r, UC.active, "Y"); uSet(r, UC.notes, "First Admin");
    signInAs(uGet(r), true); if (typeof setSavedUser === "function") setSavedUser(name); re(); toast("Sign-in is on — click Save to Excel so it applies to everyone", 7000);
  };
  const adminsLeft = (exceptR, roleOverride) => allUsers().filter(u => u.active && (u.r === exceptR ? roleOverride === "Admin" : u.role === "Admin")).length;
  const set = (r, c, v) => { try { setCell(USERS_SHEET, c, r, v); return true; } catch (e) { toast(e.message); return false; } };
  m.querySelectorAll("[data-uf]").forEach(el => el.onchange = () => { const r = +el.dataset.ur, c = el.dataset.uf; let v = el.value.trim();
    if (c === UC.login && !v) { toast("Email can't be empty"); re(); return; }
    if (c === UC.login && allUsers().some(u => u.r !== r && u.login.toLowerCase() === v.toLowerCase())) { toast("That email is already used"); re(); return; }
    if (c === UC.role && adminsLeft(r, v) < 1) { toast("Keep at least one active Admin"); re(); return; }
    set(r, c, v); if (ACC && ACC.r === r) { const u = uGet(r); ACC.name = u.name || u.login; ACC.role = u.role; ACC.login = u.login; ACC.bu = u.role === "Admin" ? null : u.bu; SC_CACHE = { k: "" }; paintAcc(); } re(); });
  m.querySelectorAll("[data-uact]").forEach(el => el.onchange = () => { const r = +el.dataset.uact; if (!el.checked && (ACC && ACC.r === r)) { toast("You can't deactivate yourself"); re(); return; }
    if (!el.checked && uGet(r).role === "Admin" && adminsLeft(r, "x") < 1) { toast("Keep at least one active Admin"); re(); return; }
    set(r, UC.active, el.checked ? "Y" : "N"); re(); });
  m.querySelectorAll("[data-upw]").forEach(b => b.onclick = async () => { const u = uGet(+b.dataset.upw);
    const k = await choose((u.pw ? "Reset" : "Set") + " password — " + esc(u.name || u.login), `<label class="field"><span>New password (min. ${PW_MIN}) — tell the user; they can change it with 👤 → Change my password</span><input id="rpNew" type="text" value="${esc(Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 7))}"></label>`, [["c", "Cancel"], ...(u.pw ? [["clr", "Remove (email only)"]] : []), ["ok", "Set password", "primary"]]);
    const v = (document.getElementById("rpNew") || {}).value || "";
    if (k === "clr") { set(u.r, UC.pw, ""); re(); return; }
    if (k !== "ok") return; if (v.length < PW_MIN) { toast(`Use at least ${PW_MIN} characters`); return; } set(u.r, UC.pw, await pwHash(v)); toast("Password set — Save to Excel to apply", 5000); re(); });
  m.querySelectorAll("[data-udel]").forEach(b => b.onclick = async () => { const u = uGet(+b.dataset.udel);
    if (u.role === "Admin" && u.active && adminsLeft(u.r, "x") < 1) { toast("Keep at least one active Admin"); return; }
    if (await choose("Delete user?", `<p>Remove <b>${esc(u.name || u.login)}</b> (${u.role})? Their past changes stay in the Activity log.</p>`, [["c", "Cancel"], ["ok", "Delete", "danger"]]) !== "ok") return;
    U_COLS.forEach(c => set(u.r, c, "")); re(); });
  const sec = m.querySelector("#uSecure"); if (sec) sec.onclick = async () => { let n = 0; for (const u of allUsers()) if (u.pw && !isHashed(u.pw)) { if (set(u.r, UC.pw, await pwHash(u.pw))) n++; } toast(`${n} password(s) hashed — Save to Excel to apply`, 5000); re(); };
  const add = m.querySelector("#uAdd"); if (add) add.onclick = async () => {
    const k = await choose("Add user", `<div class="fgrid"><label class="field"><span>Name</span><input id="uaName"></label><label class="field"><span>Email (login)</span><input id="uaLogin" type="email" placeholder="name@thaiunion.com"></label>
      <label class="field"><span>Role</span><select id="uaRole">${ROLES.map(r => `<option ${r === "Editor" ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label class="field"><span>BU access (comma separated · blank = all)</span><input id="uaBu" list="buList2" placeholder="e.g. Finance, Procurement"><datalist id="buList2"><option value="All">${buChoices().map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
      <label class="field"><span>Password (min. ${PW_MIN}) — blank = signs in with the email only</span><input id="uaPw" type="text" value=""></label>
      <label class="field"><span>Notes</span><input id="uaNotes"></label></div>`, [["c", "Cancel"], ["ok", "Add", "primary"]]);
    if (k !== "ok") return; const v = id => ((document.getElementById(id) || {}).value || "").trim();
    const name = v("uaName"), login = v("uaLogin"), rl = v("uaRole"), pw = v("uaPw"), bu = v("uaBu");
    if (!login) { toast("Email is needed"); return; } if (allUsers().some(u => u.login.toLowerCase() === login.toLowerCase())) { toast("That email is already used"); return; }
    if (pw && pw.length < PW_MIN) { toast(`Use at least ${PW_MIN} characters`); return; }
    const r = uFreeRow(); set(r, UC.name, name || login); set(r, UC.login, login); if (pw) set(r, UC.pw, await pwHash(pw)); set(r, UC.role, rl); set(r, UC.bu, rl === "Admin" ? "All" : (bu || "All")); set(r, UC.active, "Y"); if (v("uaNotes")) set(r, UC.notes, v("uaNotes"));
    re(); toast(`${name || login} added as ${rl}${rl !== "Admin" && bu ? " · " + bu : ""} — Save to Excel to apply`, 7000); };
  const off = m.querySelector("#uOff"); if (off) off.onclick = async e => { e.preventDefault();
    if (allUsers().length > 1) { toast("Delete the other users first", 5000); return; }
    if (await choose("Turn sign-in off?", `<p>Anyone who opens the workbook in the Desk will see and edit everything.</p>`, [["c", "Cancel"], ["ok", "Turn off", "danger"]]) !== "ok") return;
    for (const u of allUsers()) U_COLS.forEach(c => set(u.r, c, "")); ACC = null; sessClear(); paintAcc(); re(); toast("Sign-in off after you save"); };
}
document.addEventListener("input", e => { if (e.target && /^(uaName|uaLogin|uaNotes|uaBu|uaPw|rpNew)$/.test(e.target.id)) e.target.setAttribute("value", e.target.value); });
