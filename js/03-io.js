/* 03-io.js — save, where the page was opened from, modal helper, open workbook */
"use strict";
/* ---------------- save ---------------- */
async function buildBlob(log=true){
  if(log)await appendLog();
  const changed={};const enc=new TextEncoder();for(const [p,f] of Object.entries(S.extraParts||{}))changed[p]=f();
  for(const n of S.dirty){const sh=S.sheets[n];changed[sh.path]=enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+ser.serializeToString(sh.doc).replace(/^<\?xml[^>]*>\s*/,""))}
  let calc=S.wbDoc.getElementsByTagNameNS(NS,"calcPr")[0];
  if(!calc){calc=S.wbDoc.createElementNS(NS,"calcPr");const dn=S.wbDoc.getElementsByTagNameNS(NS,"definedNames")[0]||S.wbDoc.getElementsByTagNameNS(NS,"sheets")[0];dn.parentNode.insertBefore(calc,dn.nextSibling)}
  calc.setAttribute("fullCalcOnLoad","1");calc.setAttribute("calcMode","auto");
  changed["xl/workbook.xml"]=enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+ser.serializeToString(S.wbDoc).replace(/^<\?xml[^>]*>\s*/,""));
  return await writeZip(S.zip,changed);
}
const XTYPE=[{description:"Excel workbook",accept:{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":[".xlsx"]}}];
async function writeHandle(h,blob){
  if(h.queryPermission&&(await h.queryPermission({mode:"readwrite"}))!=="granted"){if((await h.requestPermission({mode:"readwrite"}))!=="granted")throw new Error("Write permission was not granted")}
  const w=await h.createWritable();await w.write(blob);await w.close();return (await h.getFile()).lastModified;
}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000)}

/* ---- where was this page opened from? (SharePoint web / preview / Downloads cannot save back) ---- */
function envInfo(loc,framed){const proto=loc.protocol,host=(loc.hostname||"").toLowerCase();let path="";try{path=decodeURIComponent(loc.pathname||"")}catch(e){path=loc.pathname||""}
  const sp=/sharepoint\.com|sharepoint|onedrive|1drv|office\.com|officeapps|live\.com|teams|microsoft/.test(host);
  if(framed)return {level:"bad",kind:"preview",title:"This page is open inside a SharePoint / Teams preview",why:"Inside a preview the browser does not let the app read or write files, so <b>changes cannot be saved</b>."};
  if((proto==="http:"||proto==="https:")&&(/^(localhost|127\.0\.0\.1)$/.test(host)||(typeof gReady==="function"&&gReady()&&!sp)))return {level:"ok",kind:"web-graph",title:"",why:""};
  if(proto==="http:"||proto==="https:")return {level:"bad",kind:sp?"sharepoint":"web",title:sp?"This page is open from SharePoint in the browser":"This page is open from a web link",why:"From the website the app cannot save into the SharePoint workbook — saving only downloads a copy."};
  if(proto==="file:"){const p=path.replace(/\\/g,"/").toLowerCase();
    if(/\/(downloads|temp|tmp)\/|inetcache|temporary internet files|\/content\.outlook\/|\/appdata\/local\/temp/.test(p))return {level:"warn",kind:"download",title:"This page is a downloaded / temporary copy",why:"It was opened from Downloads or a temp folder. That copy is fine to use, but make sure the <b>workbook</b> you open is the one in your OneDrive-synced SharePoint folder."};
    if(/onedrive|sharepoint/.test(p))return {level:"ok",kind:"synced",title:"Opened from your OneDrive / SharePoint synced folder",why:""};
    return {level:"info",kind:"local",title:"",why:""}}
  return {level:"info",kind:"other",title:"",why:""}}
function envCheck(){let framed=false;try{framed=window.top!==window.self}catch(e){framed=true}
  const e=envInfo(location,framed);S.env=e;const box=$("#envWarn");if(!box)return e;
  let dismissed=false;try{dismissed=sessionStorage.getItem("sga_env_dismiss")===e.kind}catch(x){}if(hiddenWarns().includes(e.kind))dismissed=true;
  if((e.level==="bad"||e.level==="warn")&&!dismissed){
    box.innerHTML=`<div class="envbar ${e.level}"><b>⚠ ${e.title}.</b> <span>${e.why}</span>
      <button class="btn small" id="envHow">How to open it correctly</button><button class="btn small" id="envX" title="Hide until the page is opened again">Dismiss</button><button class="btn small" id="envNever" title="Show it again from Settings → Warnings">Don't show again</button></div>`;
    $("#envHow").onclick=envHelp;$("#envX").onclick=()=>{try{sessionStorage.setItem("sga_env_dismiss",e.kind)}catch(x){}box.innerHTML=""};
    $("#envNever").onclick=()=>{setHiddenWarns([...hiddenWarns(),e.kind]);box.innerHTML="";toast("Hidden — show it again in Settings → ⚠ Warnings",5000)};
    if(e.level==="bad"&&!envHelp._shown){envHelp._shown=true;setTimeout(envHelp,300)}}
  else box.innerHTML="";
  return e}
function envHelp(){const e=S.env||{};choose("Open the Tracker Desk so it can save to SharePoint",`${e.why?`<div class="warnbox" style="margin-bottom:10px">${e.why}</div>`:""}
  <ol class="steps" style="margin:0 0 0 18px">
   <li>In SharePoint, open the library that holds the tracker and click <b>Sync</b> (or <b>Add shortcut to My files</b>) — once per PC.</li>
   <li>Open <b>File Explorer</b> → your organisation's SharePoint / OneDrive folder → the tracker folder.</li>
   <li>Double-click <b>SGA_Tracker_Desk.html</b> there (it opens in Edge or Chrome as a local file). <i>Do not</i> open it by clicking it on the SharePoint website — SharePoint opens a preview or a download.</li>
   <li>Click <b>Open workbook…</b> and pick <b>SGA_Reduction_Initiative_Tracker.xlsx</b> from the same synced folder.</li>
   <li>Close the workbook in Excel before saving here. After saving, OneDrive uploads it (green tick).</li></ol>
  <p class="muted" style="font-size:12px;margin-top:8px">Tip: on the SharePoint website you can also use <b>⋯ → Open → Open in File Explorer / Open in app</b> to jump to the synced copy.</p>`,[["ok","Got it","primary"]])}

/* ---- modal helper ---- */
function choose(title,html,buttons){return new Promise(res=>{const box=$("#confirm");box.querySelector(".box").innerHTML=`<h2>${title}</h2>${html}<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">${buttons.map(([k,t,c])=>`<button class="btn ${c||""}" data-k="${k}">${t}</button>`).join("")}</div>`;
  box.classList.add("on");box.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{box.classList.remove("on");res(b.dataset.k)})})}
async function sha8(buf){const h=await crypto.subtle.digest("SHA-256",buf);return [...new Uint8Array(h)].slice(0,10).map(b=>b.toString(16).padStart(2,"0")).join("")}
/* re-load the workbook from disk and re-apply a list of cell changes on top (merge) */
async function reloadAndReapply(handle,changes){toast("Reloading the latest file and re-applying your changes…",20000);const mineE2E=e2eCollectMine(changes);
  const f=await handle.getFile();await loadWorkbook(await f.arrayBuffer(),f.name,handle,f.lastModified);
  let ok=0,skip=0;for(const c of changes){if(c.sheet===E2EF||c.sheet===E2EM)continue;const col=c.ref.replace(/\d+/g,""),row=+c.ref.replace(/[A-Z]+/g,"");try{if(S.sheets[c.sheet]&&S.sheets[c.sheet].vals){setCell(c.sheet,col,row,c.val);ok++}else skip++}catch(e){skip++}}
  if(hasE2E()&&(mineE2E.length||changes.some(c=>c.sheet===E2EM))){const r=await e2eReapply(mineE2E);ok+=r.ok;skip+=r.skip}
  updateBadge();return {ok,skip}}
async function saveLocationCheck(){let skip=false;try{skip=localStorage.getItem("sga_saveloc_ok")==="1"}catch(e){}if(skip||S._locOk)return true;
  const k=await choose("Before the first save — where is this file?",`<p>Save writes into <b>${esc(S.fileName)}</b> — the exact file you opened on this computer.</p>
   <div class="note" style="margin:8px 0"><b>✓ Reaches SharePoint:</b> a file opened from your <b>OneDrive-synced</b> folder in File Explorer (SharePoint library → <i>Sync</i>, or <i>Add shortcut to My files</i>). OneDrive uploads it after saving.</div>
   <div class="warnbox"><b>✗ Does NOT reach SharePoint:</b> a file opened from the SharePoint website, from <i>Downloads</i>, from Teams/Outlook attachments or from a temp folder — those are copies. Use <b>Save a copy…</b> and pick the synced SharePoint folder instead.</div>
   <p class="muted" style="font-size:12px">Also close the workbook in Excel (desktop and browser) first — Excel AutoSave can overwrite your save with its own older copy.</p>
   <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="locNo"> Don't ask again on this computer</label>`,
   [["cancel","Cancel"],["copy","Save a copy into the synced folder…"],["ok","Yes — it is the synced file, save","primary"]]);
  try{if(document.getElementById("locNo")?.checked)localStorage.setItem("sga_saveloc_ok","1")}catch(e){}
  if(k==="ok"){S._locOk=true;return true}if(k==="copy"){return "copy"}return false}
async function save(asCopy){
  if(!asCopy&&typeof canEdit==="function"&&!canEdit()){toast("View only — you can't save changes",4000);return}
  if(hasE2E()){await e2eFlush();clearTimeout(E2E_MAPQ);e2eRebuildMap();updateBadge()}/* commit text being typed in the flow editor + current E2E_Map */
  if(!asCopy&&!S.changes.length){toast("Nothing to save");return}
  if(!asCopy)await ensureUser();
  if(!asCopy&&S.handle&&S.handle.createWritable){const lc=await saveLocationCheck();if(lc===false)return;if(lc==="copy"){S._forcePick=true}}
  const n=S.changes.length;const savedChanges=S.changes.slice();
  if(!asCopy&&S.handle&&S.handle.createWritable&&!S._forcePick){
    try{const cur=await S.handle.getFile();
      if(S.lastMod&&cur.lastModified!==S.lastMod){
        const k=await choose("The file changed after you opened it",`<p><b>${esc(S.fileName)}</b> on disk is newer than the version you opened (saved ${new Date(cur.lastModified).toLocaleString()}). Someone else, Excel AutoSave or OneDrive sync updated it.</p>
          <ul style="margin:6px 0 0 18px;font-size:13px"><li><b>Merge (recommended)</b> — reload the newer file and re-apply your ${n} change(s) on top, then save. Other people's edits are kept; if you both changed the same process flow you choose whose diagram to keep.</li><li><b>Overwrite</b> — replace the newer file with your version (their edits are lost).</li></ul>`,
          [["cancel","Cancel"],["over","Overwrite","danger"],["merge","Merge my changes & save","primary"]]);
        if(k==="cancel")return;
        if(k==="merge"){const r=await reloadAndReapply(S.handle,savedChanges);render();toast(`Reloaded the newer file and re-applied ${r.ok} change(s)${r.skip?` (${r.skip} skipped)`:""}`,5000)}}
      const blob=await buildBlob();const buf=await blob.arrayBuffer();const hash=await sha8(buf);
      S.lastMod=await writeHandle(S.handle,blob);
      S.saved={handle:S.handle,hash,blob,changes:savedChanges,name:S.fileName,at:Date.now(),warned:false};
      finishSave(`Saved ${n} change(s) into ${S.fileName}. Checking that it stays saved…`);watchSaved();return}
    catch(err){if(err.name==="AbortError")return;console.error(err);toast("Could not write to the original file ("+err.message+"). Choose where to save instead.",6000)}
  }
  S._forcePick=false;
  let blob;try{blob=await buildBlob(!asCopy)}catch(e){console.error(e);toast("Could not build the file: "+e.message,7000);return}
  if(window.showSaveFilePicker){
    try{const h=await window.showSaveFilePicker({suggestedName:asCopy?S.fileName.replace(/\.xlsx$/i,"")+" (copy).xlsx":S.fileName,types:XTYPE});
      const buf=await blob.arrayBuffer();const hash=await sha8(buf);const lm=await writeHandle(h,blob);
      if(!asCopy){S.handle=h;S.lastMod=lm;S.fileName=h.name;$("#fileName").textContent=h.name+" · saves in place";S._locOk=true;rememberWorkbook(h)}
      if(asCopy&&!S.changes.length){toast("Copy saved as "+h.name,5000);return}
      if(asCopy){toast(`Copy saved as ${h.name}. Your ${n} change(s) are still unsaved in the original.`,6000);return}
      S.saved={handle:h,hash,blob,changes:savedChanges,name:h.name,at:Date.now(),warned:false};
      finishSave(`Saved ${n} change(s) into ${h.name}. From now on Save writes to this file directly.`);watchSaved();return}
    catch(err){if(err.name==="AbortError")return;console.error(err)}
  }
  if(!asCopy&&!S._dlOk){const k=await choose("This copy cannot be saved back to SharePoint",`<p>${S.env&&S.env.level==="bad"?S.env.title+". ":""}The app can't write into the workbook from here, so <b>Save</b> will only <b>download</b> an updated copy.</p><p>To save directly: open the Tracker Desk from your OneDrive-synced folder (see <i>How to open it correctly</i>). Or download now and upload the file to SharePoint with the same name.</p>`,[["cancel","Cancel"],["how","How to open it correctly"],["dl","Download updated copy","primary"]]);
    if(k==="how"){envHelp();return}if(k!=="dl")return;S._dlOk=true}
  download(blob,asCopy?S.fileName.replace(/\.xlsx$/i,"")+" (copy).xlsx":S.fileName);
  if(asCopy)toast("Copy downloaded",4000);else finishSave("Downloaded the updated workbook. Replace the file in SharePoint (same name) with it.");
}
/* after saving, re-read the file a few times: OneDrive sync or Excel AutoSave can silently put an older version back */
function watchSaved(){const sv=S.saved;if(!sv)return;clearTimeout(watchSaved._t);const plan=[0,8000,30000,90000,180000];let i=0;
  const tick=async()=>{if(S.saved!==sv)return;const st=await checkSaved();if(st==="reverted")return;i++;if(i<plan.length)watchSaved._t=setTimeout(tick,plan[i]-plan[i-1]);else{setSaveState("ok")}};tick()}
async function checkSaved(){const sv=S.saved;if(!sv||!sv.handle)return "none";
  try{const f=await sv.handle.getFile();const h=await sha8(await f.arrayBuffer());
    if(h===sv.hash){setSaveState(Date.now()-sv.at>60000?"ok":"checking");return "ok"}
    setSaveState("reverted");if(!sv.warned){sv.warned=true;revertDialog(f)}return "reverted"}catch(e){console.warn(e);return "error"}}
function setSaveState(st){const el=$("#saveState");if(!el)return;const t={checking:"⟳ verifying save…",ok:"✓ saved & verified",reverted:"⚠ file was replaced — click"}[st]||"";el.textContent=t;el.className="savestate "+st;el.onclick=st==="reverted"?()=>revertDialog():null}
async function revertDialog(f){const sv=S.saved;if(!sv)return;f=f||await sv.handle.getFile().catch(()=>null);
  const k=await choose("⚠ Your saved changes were replaced",`<p>The file <b>${esc(sv.name)}</b> no longer contains what this app saved at ${new Date(sv.at).toLocaleTimeString()}${f?` — it was replaced at ${new Date(f.lastModified).toLocaleTimeString()}`:""}.</p>
    <p class="muted">Usual causes: <b>Excel has the file open with AutoSave</b> (it writes its own older copy back), <b>OneDrive sync conflict</b> (cloud version kept, your copy renamed with your PC name), or the library requires <b>check-out</b>.</p>
    <ul style="margin:6px 0 0 18px;font-size:13px"><li><b>Merge & save again (recommended)</b> — take the current file and re-apply the ${sv.changes.length} change(s) you saved.</li><li><b>Write my version again</b> — overwrite with exactly what you saved.</li><li><b>Save a copy</b> — keep your version as a separate file to compare.</li></ul>
    <p class="muted" style="font-size:12px">Close the workbook in Excel (desktop and browser) and wait for OneDrive to show a green tick before retrying.</p>`,
    [["later","Later"],["copy","Save a copy…"],["again","Write my version again","danger"],["merge","Merge & save again","primary"]]);
  if(k==="later")return;
  try{if(k==="again"){S.lastMod=await writeHandle(sv.handle,sv.blob);sv.at=Date.now();sv.warned=false;toast("Written again — verifying…",4000);watchSaved();return}
    if(k==="merge"){await reloadAndReapply(sv.handle,sv.changes);const blob=await buildBlob();const hash=await sha8(await blob.arrayBuffer());S.lastMod=await writeHandle(sv.handle,blob);
      S.saved={...sv,hash,blob,at:Date.now(),warned:false};S.changes=[];S.dirty.clear();S.newRows={};updateBadge();render();toast("Merged and saved again — verifying…",4000);watchSaved();return}
    if(k==="copy"&&window.showSaveFilePicker){const h=await window.showSaveFilePicker({suggestedName:sv.name.replace(/\.xlsx$/i,"")+" (my version).xlsx",types:XTYPE});await writeHandle(h,sv.blob);toast("Your version was saved as "+h.name,5000)}}
  catch(e){if(e.name!=="AbortError")toast("Could not write: "+e.message,6000)}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S.saved)checkSaved()});
function finishSave(msg){S.changes=[];S.dirty.clear();S.newRows={};updateBadge();toast(msg,6000);render()}
/* net changes: last value per cell, dropping cells that are back to their original value */
function netChanges(){const first={},last={};for(const c of S.changes){const k=c.sheet+"!"+c.ref;if(!(k in first))first[k]=c;last[k]=c}
  return Object.keys(last).map(k=>({...last[k],orig:first[k].old})).filter(c=>String(c.orig??"")!==String(c.val??""))}
function rowProject(sheet,row){if(sheet==="Projects")return pId(row)+" · "+gv("Projects",FP.name,row);const c={Activities:FA.pid,Benefits:FB.pid,RAIDD:FD.pid}[sheet];if(!c)return "";const pid=gv(sheet,c,row);const pr=pid?projRowById(pid):null;return pid?(pid+(pr?" · "+gv("Projects",FP.name,pr):"")):""}
function updateBadge(){const b=$("#chgBadge");const n=S.changes.length?e2eNetCount(netChanges()):0;b.textContent=(n||0)+" unsaved";b.classList.remove("hidden");b.style.visibility=n?"visible":"hidden";$("#btnSave").disabled=!n;$("#btnCopy").disabled=!S.zip}
window.addEventListener("beforeunload",e=>{if(S.changes.length){e.preventDefault();e.returnValue=""}});

/* ---------------- open ---------------- */
async function openFile(){
  if(window.showOpenFilePicker){
    try{const [h]=await window.showOpenFilePicker({types:[{description:"Excel workbook",accept:{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":[".xlsx"]}}]});
      const f=await h.getFile();await ingest(await f.arrayBuffer(),f.name,h,f.lastModified);return}
    catch(e){if(e.name==="AbortError")return;console.warn(e)}
  }
  $("#filePick").click();
}
$("#filePick").addEventListener("change",async e=>{const f=e.target.files[0];if(f)await ingest(await f.arrayBuffer(),f.name,null,f.lastModified);e.target.value=""});
async function ingest(buf,name,handle,lastMod){
  if(S.changes.length&&!confirm("You have unsaved changes. Discard them and open another file?"))return;
  try{toast("Reading workbook…",20000);await loadWorkbook(buf,name,handle,lastMod);$("#fileName").textContent=name+(handle?" · saves in place":" · saves as download");
    if(typeof accessGate==="function"){toast("",1);if(!(await accessGate()))return}
    $("#tabs").classList.remove("hidden");updateBadge();toast("Workbook loaded",1500);if(handle&&typeof rememberWorkbook==="function")rememberWorkbook(handle);if(typeof paintConn==="function")paintConn();view=view||"Dashboard";render();tickToday(false)}
  catch(e){console.error(e);toast("Could not open: "+e.message,7000)}
}

