/* 10-settings.js — master data, searchable combobox, settings, review changes */
"use strict";
/* ---------------- Master data (Master_Data sheet) ---------------- */
const MDE=205;const hasMD=()=>!!(S.sheets.Master_Data&&S.sheets.Master_Data.vals);
const mg=(c,r)=>{const v=gv("Master_Data",c,r);return v===""||v==null?"":String(v)};
function mdRows(cols){const o=[];if(!hasMD())return o;for(let r=6;r<=MDE;r++)if(cols.some(c=>mg(c,r)!==""))o.push(r);return o}
function mdFree(cols){for(let r=6;r<=MDE;r++)if(cols.every(c=>mg(c,r)===""))return r;return null}
function uniqOrder(a){const s=new Set,o=[];for(const x of a)if(x!==""&&!s.has(x)){s.add(x);o.push(x)}return o}
const ORGC=["F","G","H","I","J"];
function mdPairs(vc,cc,cols){const rs=mdRows(cols||[vc]);const v=uniqOrder(rs.map(r=>mg(vc,r)));return {v,c:cc?v.map(x=>{const r=rs.find(r=>mg(vc,r)===x&&mg(cc,r)!=="");return r?mg(cc,r):""}):[]}}
const MDNAMES={L_Init:["B","C",["B","C"],"v"],L_InitCode:["B","C",["B","C"],"c"],L_BU:["F","G",ORGC,"v"],L_BUCode:["F","G",ORGC,"c"],L_CF:["H","I",ORGC,"v"],L_CFCode:["H","I",ORGC,"c"],L_Proc:["J",null,ORGC,"v"],L_Region:["O",null,["O"],"v"],L_Leader:["R",null,["R"],"v"]};
function mdList(nm){const [vc,cc,cols,w]=MDNAMES[nm];const p=mdPairs(vc,cc,cols);return w==="v"?p.v:p.c}
function orgCF(bu){const rs=mdRows(ORGC);const m=uniqOrder(rs.filter(r=>!bu||mg("F",r)===bu||mg("F",r)==="").map(r=>mg("H",r)));return m.length?m:mdList("L_CF")}
function orgProc(bu,cf){const rs=mdRows(ORGC);const m=uniqOrder(rs.filter(r=>(!bu||mg("F",r)===bu||mg("F",r)==="")&&(!cf||mg("H",r)===cf||mg("H",r)==="")).map(r=>mg("J",r)));return m.length?m:mdList("L_Proc")}
const ADDABLE={L_Init:"initiative",L_Region:"region",L_BU:"BU",L_CF:"corporate function",L_Proc:"process area",L_Leader:"leader / project lead",L_People:"person"};
function suggestCode(name,taken,len=3){const w=String(name).toUpperCase().replace(/&/g," ").split(/[^A-Z0-9]+/).filter(Boolean);
  let c=w.length>=2?w.map(x=>x[0]).join("").slice(0,len):(w[0]||"NEW").slice(0,len);if(c.length<2)c=(w.join("")+"XXX").slice(0,len);
  let o=c,i=2;while(taken.includes(o))o=c.slice(0,len-1)+i++;return o}
function nameRef(nm){const ref=S.names[nm];if(!ref)return null;const m=ref.replace(/\$/g,"").match(/^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);return m?{sh:m[1],col:m[2],r1:+m[3],r2:+(m[5]||m[3])}:null}
function addMaster(list,value,ctx={}){value=String(value).trim();if(!value)return "";
  if(list==="L_People"){const nr=nameRef("L_People");for(let r=nr.r1;r<=nr.r2;r++)if(gv(nr.sh,nr.col,r)===""){setCell(nr.sh,nr.col,r,value);toast(`Added “${value}” to the People list`);return value}toast("People list is full",5000);return ""}
  if(!hasMD()){toast("This workbook has no Master_Data sheet — open the latest tracker version",6000);return ""}
  const orgHas=(bu,cf,pa)=>mdRows(ORGC).some(r=>(list==="L_CF"?((mg("F",r)===bu||mg("F",r)==="")&&mg("H",r)===value):((!bu||mg("F",r)===bu||mg("F",r)==="")&&(!cf||mg("H",r)===cf||mg("H",r)==="")&&mg("J",r)===value)));
  if(list==="L_CF"||list==="L_Proc"){if(orgHas(ctx.bu||"",ctx.cf||""))return value}else if(mdList(list).includes(value))return value;
  const put=(r,o)=>{for(const[c,v] of Object.entries(o))if(v!==""&&v!=null)setCell("Master_Data",c,r,v)};
  let r;
  if(list==="L_Init"){r=mdFree(["B","C"]);if(r)put(r,{B:value,C:suggestCode(value,mdList("L_InitCode"))})}
  else if(list==="L_Region"){r=mdFree(["O"]);if(r)put(r,{O:value})}
  else if(list==="L_Leader"){r=mdFree(["R"]);if(r)put(r,{R:value})}
  else{r=mdFree(ORGC);if(r){const bu=ctx.bu||"",cf=ctx.cf||"";const buc=bu?codeFor("L_BU","L_BUCode",bu,""):"",cfc=cf?codeFor("L_CF","L_CFCode",cf,""):"";
    if(list==="L_BU")put(r,{F:value,G:suggestCode(value,mdList("L_BUCode"))});
    if(list==="L_CF")put(r,{F:bu,G:buc,H:value,I:suggestCode(value,mdList("L_CFCode"))});
    if(list==="L_Proc")put(r,{F:bu,G:buc,H:cf,I:cfc,J:value})}}
  if(!r){toast("Master_Data table is full — insert rows in Excel first",6000);return ""}
  toast(`Added “${value}” as a new ${ADDABLE[list]} (Master_Data). Codes and links can be changed under ⚙ Settings.`,5000);return value}

/* ---------------- searchable combobox ---------------- */
const COMBO={};
function comboHtml(id,val,opts,o){COMBO[id]={opts,...o};return `<div class="combo"><input id="${id}" data-combo="${id}" value="${esc(val)}" data-prev="${esc(val)}" autocomplete="off" spellcheck="false" placeholder="${id==="fQ"||id==="rfP"?"All projects — type to search…":id==="fld_Q"?"— calculated (no override) —":"Pick…"}" title="Type or pick from the list"><span class="cbarrow">▾</span></div>`}
let CB={el:null,items:[],hi:0};
let CB_PICKED=0;
function cbOpen(el){if(Date.now()-CB_PICKED<800)return;/* the page re-focuses the box after a pick — don't pop the list open again */CB.el=el;CB.hi=-1;let pop=document.getElementById("cbpop");if(!pop){pop=document.createElement("div");pop.id="cbpop";document.body.appendChild(pop)}cbRender(true)}
function cbClose(){const p=document.getElementById("cbpop");if(p)p.style.display="none";CB.el=null}
function cbRender(all){const el=CB.el;if(!el)return;const cfg=COMBO[el.dataset.combo];if(!cfg)return;const pop=document.getElementById("cbpop");
  const q=all?"":el.value.trim().toLowerCase();const opts=typeof cfg.opts==="function"?cfg.opts():cfg.opts;
  let items=opts.filter(o=>!q||String(o.t).toLowerCase().includes(q)||String(o.v).toLowerCase().includes(q)).slice(0,300).map(o=>({...o,k:"opt"}));if(q){const ex=items.findIndex(o=>String(o.v).toLowerCase()===q);if(ex>0)items.unshift(items.splice(ex,1)[0])}
  const exact=opts.some(o=>String(o.v).toLowerCase()===el.value.trim().toLowerCase());
  if(cfg.add&&el.value.trim()&&!exact){const tv=el.value.trim(),cx=cfg.ctx?cfg.ctx():{};const known=(cfg.add==="L_CF"||cfg.add==="L_Proc")&&mdList(cfg.add).some(x=>x.toLowerCase()===tv.toLowerCase());
    items.push({k:"add",v:known?mdList(cfg.add).find(x=>x.toLowerCase()===tv.toLowerCase()):tv,t:known?`＋ Link “${tv}” to ${[cx.bu,cfg.add==="L_Proc"?cx.cf:""].filter(Boolean).join(" · ")||"this project"} (new org combination)`:`＋ Add “${tv}” as new ${ADDABLE[cfg.add]}`})}
  if(!cfg.strict&&el.value.trim()&&!exact&&!cfg.add)items.push({k:"free",v:el.value.trim(),t:`Use “${el.value.trim()}”`});
  if(CB.hi<0){const ci=items.findIndex(it=>String(it.v)===String(el.dataset.prev));CB.hi=ci>=0?ci:0}
  CB.items=items;if(CB.hi>=items.length)CB.hi=Math.max(0,items.length-1);
  const cur=el.dataset.prev;
  pop.innerHTML=items.length?items.map((it,i)=>`<div class="cbi ${it.k}${i===CB.hi?" hi":""}${it.k==="opt"&&String(it.v)===cur?" sel":""}" data-i="${i}">${esc(it.t)}</div>`).join(""):`<div class="cbi none">No match${cfg.strict?" — pick from the list":""}</div>`;
  pop.style.display="block";cbPlace();
  const h=pop.querySelector(".hi");if(h)h.scrollIntoView({block:"nearest"})}
/* keep the list inside the window: open upwards when there is no room below; follow the box when the page scrolls */
function cbPlace(){const el=CB.el,pop=document.getElementById("cbpop");if(!el||!pop||pop.style.display==="none")return;const b=el.getBoundingClientRect();
  if(b.bottom<0||b.top>innerHeight){cbClose();return}const below=innerHeight-b.bottom-10,above=b.top-10;const up=below<220&&above>below;
  const mh=Math.max(120,Math.min(340,up?above:below));Object.assign(pop.style,{left:Math.min(b.left,innerWidth-Math.max(b.width,240)-8)+"px",width:Math.max(b.width,240)+"px",maxHeight:mh+"px",top:up?"auto":(b.bottom+2)+"px",bottom:up?(innerHeight-b.top+2)+"px":"auto"})}
window.addEventListener("scroll",()=>{if(CB.el)cbPlace()},true);window.addEventListener("resize",()=>{if(CB.el)cbPlace()});
function cbPick(i){const el=CB.el,it=CB.items[i];if(!el||!it)return;CB_PICKED=Date.now();const cfg=COMBO[el.dataset.combo];let v=it.v;
  if(it.k==="add"){v=addMaster(cfg.add,v,cfg.ctx?cfg.ctx():{});if(!v)return}
  el.value=v;el.dataset.prev=v;cbClose();el.dataset.ok="1";el.dispatchEvent(new Event("change",{bubbles:true}));delete el.dataset.ok;
  setTimeout(()=>{const a=document.activeElement;if(a&&a.dataset&&a.dataset.combo&&a.select)a.select()},0)/* typing next replaces the value instead of appending */}
document.addEventListener("focusin",e=>{if(e.target.dataset&&e.target.dataset.combo){cbOpen(e.target);e.target.select()}});
document.addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.combo){if(CB.el!==e.target)CB.el=e.target;CB.hi=0;cbRender(false)}});
document.addEventListener("keydown",e=>{const el=e.target;if(!(el.dataset&&el.dataset.combo))return;
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!CB.el)cbOpen(el);CB.hi=Math.max(0,Math.min(CB.items.length-1,CB.hi+(e.key==="ArrowDown"?1:-1)));cbRender(el.value===el.dataset.prev)}
  else if(e.key==="Enter"){e.preventDefault();const pop=document.getElementById("cbpop");if(CB.el===el&&pop&&pop.style.display!=="none"&&CB.items.length)cbPick(CB.hi)}else if(e.key==="Escape"){el.value=el.dataset.prev;cbClose()}});
/* clicking a combo that already has focus re-opens its list */
document.addEventListener("mousedown",e=>{const el=e.target;if(!(el.dataset&&el.dataset.combo)||document.activeElement!==el)return;const pop=document.getElementById("cbpop");if(!pop||pop.style.display==="none"){CB_PICKED=0;cbOpen(el)}});
document.addEventListener("mousedown",e=>{const inPop=e.target.closest&&e.target.closest("#cbpop");if(!inPop)return;e.preventDefault();/* clicks and scrollbar drags inside the list keep the box focused */const it=e.target.closest("#cbpop .cbi[data-i]");if(it)cbPick(+it.dataset.i)});
document.addEventListener("focusout",e=>{const el=e.target;if(!(el.dataset&&el.dataset.combo))return;setTimeout(()=>{if(document.activeElement===el)return;
  const cfg=COMBO[el.dataset.combo];if(!cfg)return;const t=el.value.trim();const opts=typeof cfg.opts==="function"?cfg.opts():cfg.opts;
  if(t!==el.dataset.prev){const m=opts.find(o=>String(o.v).toLowerCase()===t.toLowerCase());
    if(t===""||m||!cfg.strict){el.value=t===""?"":m?m.v:t;el.dataset.prev=el.value;el.dataset.ok="1";el.dispatchEvent(new Event("change",{bubbles:true}));delete el.dataset.ok}
    else{el.value=el.dataset.prev;toast(cfg.add?"Not in the list — choose “＋ Add …” to create it":"Please pick a value from the list")}}
  if(CB.el===el)cbClose()},120)});
// native change events from typing are ignored — combos commit only through pick / blur above
document.addEventListener("change",e=>{const el=e.target;if(el.dataset&&el.dataset.combo&&!el.dataset.ok)e.stopImmediatePropagation()},true);
/* (scrolling no longer re-renders the list — that reset its scroll position) */

/* ---------------- Settings ---------------- */
function usedCount(col,v){return rowsOf("Projects").filter(r=>String(gv("Projects",col,r))===v).length}
function setNamed(nm,v){const n=nameRef(nm);if(n)setCell(n.sh,n.col,n.r1,v)}
function vSettings(m){
  const tab=UI.stab||"lists";const y=window.scrollY;
  const head=`<div class="banner" style="background:#F3EEFC;border:1px solid #D9CCF5;color:#3B2A6B"><b>⚙ SETTINGS</b><span>Maintain the dropdown lists and the status / delay rules. Changes write to the <b>Master_Data</b> and <b>Lists</b> sheets when you click <b>Save to Excel</b>, and everything in this app recalculates straight away.</span></div>
   <div class="toolbar"><span class="seg">${[["lists","Master lists"],["rules","Status & delay rules"],["today","Excel ‘today’ & time zone"]].map(([k,t])=>`<button data-st="${k}" class="${tab===k?"on":""}">${t}</button>`).join("")}</span></div>`;
  let body="";
  if(tab==="lists"){if(!hasMD()){body=`<div class="note">This workbook has no Master_Data sheet. Open the latest SGA_Reduction_Initiative_Tracker.xlsx.</div>`}else{
    const t=(title,sub,cols,rows,addId)=>`<div class="card pad stcard"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">${title}</h2><span class="muted">${sub}</span><span style="flex:1"></span><input type="search" class="stq" data-q="${addId}" placeholder="Filter…" value="${esc((UI.stq||{})[addId]||"")}"><button class="btn small new" data-add="${addId}">+ Add</button></div>
      <div class="tablewrap" style="max-height:420px;margin-top:8px"><table class="data sttab"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}<th></th></tr></thead><tbody>${rows||`<tr><td colspan="${cols.length+1}" class="muted">No entries</td></tr>`}</tbody></table></div></div>`;
    const q=k=>((UI.stq||{})[k]||"").toLowerCase();const inp=(r,c,w)=>`<input data-md="${c}${r}" value="${esc(mg(c,r))}" style="width:${w}px">`;
    const used=(n)=>n?`<span class="usedn">${n} project${n>1?"s":""}</span>`:`<span class="muted">—</span>`;
    const init=mdRows(["B","C"]).filter(r=>!q("init")||(mg("B",r)+mg("C",r)).toLowerCase().includes(q("init"))).map(r=>`<tr><td>${inp(r,"B",280)}</td><td>${inp(r,"C",70)}</td><td>${used(usedCount(FP.init,mg("B",r)))}</td><td><button class="btn small danger" data-mdel="init:${r}">Delete</button></td></tr>`).join("");
    const org=mdRows(ORGC).filter(r=>!q("org")||ORGC.map(c=>mg(c,r)).join(" ").toLowerCase().includes(q("org"))).map(r=>{const n=rowsOf("Projects").filter(p=>(!mg("F",r)||gv("Projects",FP.bu,p)===mg("F",r))&&(!mg("H",r)||gv("Projects",FP.cf,p)===mg("H",r))&&(!mg("J",r)||gv("Projects",FP.proc,p)===mg("J",r))).length;
      return `<tr><td>${inp(r,"F",160)}</td><td>${inp(r,"G",60)}</td><td>${inp(r,"H",190)}</td><td>${inp(r,"I",60)}</td><td>${inp(r,"J",110)}</td><td>${used(n)}</td><td><button class="btn small danger" data-mdel="org:${r}">Delete</button></td></tr>`}).join("");
    const one=(k,c,col)=>mdRows([c]).filter(r=>!q(k)||mg(c,r).toLowerCase().includes(q(k))).map(r=>`<tr><td>${inp(r,c,260)}</td><td>${used(usedCount(col,mg(c,r))+(k==="lead"?usedCount(FP.wsl,mg(c,r)):0))}</td><td><button class="btn small danger" data-mdel="${k}:${r}">Delete</button></td></tr>`).join("");
    const pr=nameRef("L_People");const ppl=[];if(pr)for(let r=pr.r1;r<=pr.r2;r++){const v=gv(pr.sh,pr.col,r);if(v!==""&&(!q("ppl")||String(v).toLowerCase().includes(q("ppl"))))ppl.push(`<tr><td><input data-lp="${r}" value="${esc(v)}" style="width:260px"></td><td>${used(rowsOf("Activities").filter(x=>gv("Activities",FA.pic,x)===v).length).replace("project","task")}</td><td><button class="btn small danger" data-mdel="ppl:${r}">Delete</button></td></tr>`)}
    body=`<div class="stgrid">${t("Initiatives","name + 3-letter code used in new Project IDs",["Initiative","Code","Used by"],init,"init")}
      ${t("Regions","",["Region","Used by"],one("region","O",FP.region),"region")}</div>
      ${t("Org structure — BU · Corporate Function · Process Area","one row per valid combination · blank BU / CF = applies to all · codes feed new Project IDs",["BU","BU code","Corporate Function","CF code","Process Area","Matching projects"],org,"org")}
      <div class="stgrid">${t("Workstream leaders & project leads","",["Name","Used by"],one("lead","R",FP.lead),"lead")}${t("People (task PIC list)","Lists sheet",["Person","Used by"],ppl.join(""),"ppl")}</div>
      <p class="muted" style="font-size:12px">Renaming a value offers to update the projects that use it. Deleting only removes it from the dropdown — projects keep their current value. Changing a BU / CF code only affects Project IDs created from now on (saved IDs never change).</p>`}}
  else if(tab==="rules"){const tol=setting("S_Tol"),pt=setting("S_PredTol");
    const cnt=(arr)=>{const o={};arr.forEach(s=>o[s]=(o[s]||0)+1);return o};const tS=cnt(rowsOf("Activities").map(tStat)),pS=cnt(rowsOf("Projects").map(pStat)),fS=cnt(rowsOf("Activities").map(r=>tLive(r).fc).filter(Boolean));
    UI.rulesBase=UI.rulesBase||{tS,pS,fS};const B=UI.rulesBase;
    const cmp=(cur,base,keys)=>keys.map(k=>{const a=cur[k]||0,b=base[k]||0;return `<div class="kp"><span>${k}</span><b>${a}</b>${a!==b?`<em class="${a>b?"up":"dn"}">${a>b?"+":""}${a-b}</em>`:""}</div>`}).join("");
    const wt=(nm,stg)=>{const n=nameRef(nm);const names=listFromName(stg);if(!n)return "";let sum=0;
      const rows=names.map((s,i)=>{const v=+gv(n.sh,n.col,n.r1+i)||0;sum+=v;return `<tr><td>${esc(s)}</td><td><input type="number" step="1" min="0" max="100" data-wt="${n.sh}!${n.col}${n.r1+i}" value="${Math.round(v*1000)/10}" style="width:70px"> %</td></tr>`}).join("");
      return `<table class="data sttab"><thead><tr><th>Stage</th><th>Std weight (time &amp; effort)</th></tr></thead><tbody>${rows}<tr><td><b>Total</b></td><td><b style="color:${Math.abs(sum-1)<1e-6?"#1E6B24":"#B42318"}">${Math.round(sum*1000)/10}%</b>${Math.abs(sum-1)<1e-6?"":" — must be 100%"}</td></tr></tbody></table>`};
    body=`<div class="stgrid"><div class="card pad stcard"><h2 style="margin-top:0">Delay thresholds</h2>
      <div class="fgrid"><div class="field"><label>Slip tolerance (days) — slip above this = <b>Delayed</b> (S_Tol)</label><input type="number" min="0" step="1" id="sTol" value="${esc(tol)}"></div>
      <div class="field"><label>Forecast “at risk” threshold — % done may trail % of time elapsed by up to (S_PredTol)</label><input type="number" min="0" max="100" step="1" id="sPred" value="${pt===""?15:Math.round(+pt*100)}"></div></div>
      <h4 style="margin:16px 0 6px">Effect (live, vs. when you opened Settings)</h4>
      <div class="kprow"><div class="kpgrp"><div class="muted">Tasks — status</div>${cmp(tS,B.tS,["Delayed","At Risk","In Progress","Not Started","Completed"])}</div>
      <div class="kpgrp"><div class="muted">Projects — status</div>${cmp(pS,B.pS,["Delayed","At Risk","On Track","Not Started","Completed"])}</div>
      <div class="kpgrp"><div class="muted">Tasks — forecast</div>${cmp(fS,B.fS,["Late","At risk of delay","On time","Done"])}</div></div></div>
      <div class="card pad stcard"><h2 style="margin-top:0">How status is decided (first rule that matches)</h2><ol class="rules">
       <li><b>Status Override</b> on the task (On-Hold / Cancelled) wins; a project override applies to all its tasks.</li>
       <li><b>Completed</b> — Actual End entered or Completion = 100%.</li>
       <li><b>Not Started</b> — no plan dates yet.</li>
       <li><b>Delayed</b> — today is past the (effective) Plan End, or the forecast end slips more than <b>${esc(tol)} days</b> beyond it.</li>
       <li><b>At Risk</b> — any slip (1–${esc(tol)} days), an overdue open RAIDD item on the task, or not started although Plan Start has passed.</li>
       <li><b>In Progress</b> — started (Actual Start or % done &gt; 0); otherwise <b>Not Started</b>.</li></ol>
       <p class="muted" style="font-size:12px;margin:6px 0">Forecast dates: start = later of plan start, RAIDD “Blocks Start” due date and today (if not started); end = plan end + start shift, at least the RAIDD “Blocks End” due date and today (if unfinished). Approved RAIDD <b>Re-plan</b> moves the effective plan.<br>
       Project: Delayed if any task is Delayed → At Risk if any task At Risk → On Track once work started → Completed when all done.<br>
       Forecast column / Gantt hatching: in-progress task is <b>At risk of delay</b> when % done trails % of plan time elapsed by more than ${pt===""?15:Math.round(+pt*100)} points; a not-started task is at risk when an earlier stage is forecast to finish after its own plan end and after this task should start.</p></div></div>
      <div class="card pad stcard"><h2 style="margin-top:0">Standard stage weights</h2><p class="muted" style="margin-top:0">Used for project completion % (stage weighting) and the standard stage time windows (new task dates, “Add standard task per stage”).</p>
      <div class="stgrid"><div><h4>Waterfall</h4>${wt("L_WWF","L_StageWF")}</div><div><h4>Agile</h4>${wt("L_WAG","L_StageAG")}</div></div></div>`}
  else{const tz=setting("S_TZ"),pc=setting("S_PCTZ"),ao=setting("S_AsOf");
    body=`<div class="card pad stcard" style="max-width:820px"><h2 style="margin-top:0">Excel ‘today’ (Lists → S_Today)</h2>
      <div class="fgrid"><div class="field"><label>Report time zone (UTC offset, hours) — Bangkok = 7</label><input type="number" step="0.5" id="sTZ" value="${esc(tz)}"></div>
      <div class="field"><label>Time zone of the PC clock running Excel (UTC offset)</label><input type="number" step="0.5" id="sPC" value="${esc(pc)}"></div>
      <div class="field"><label>Freeze ‘today’ at a fixed as-of date (blank = live clock)</label><input type="date" id="sAsOf" value="${ao?isoFromSerial(ao):""}"></div></div>
      <p class="muted" style="font-size:12px">This app uses the time zone chosen in the header (TODAY box). If an as-of date is set here, the app uses it too, so both show the same statuses.</p></div>`}
  m.innerHTML=head+body;window.scrollTo(0,y);
  m.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{UI.stab=b.dataset.st;if(b.dataset.st!=="rules")UI.rulesBase=null;vSettings(m)});
  const re=()=>{liveCalc();renderTabs();vSettings(m)};
  m.querySelectorAll(".stq").forEach(el=>el.oninput=()=>{UI.stq=UI.stq||{};UI.stq[el.dataset.q]=el.value;const p=el.selectionStart;vSettings(m);const n=m.querySelector(`[data-q="${el.dataset.q}"]`);n.focus();n.setSelectionRange(p,p)});
  m.querySelectorAll("[data-md]").forEach(el=>el.onchange=()=>{const ref=el.dataset.md,c=ref.replace(/\d+/,""),r=+ref.replace(/[A-Z]+/,"");const ov=mg(c,r),nv=el.value.trim();if(nv===ov)return;
    setCell("Master_Data",c,r,nv);
    const pcol={B:FP.init,O:FP.region,R:FP.lead,F:FP.bu,H:FP.cf,J:FP.proc}[c];
    if(pcol&&ov&&nv){const n=usedCount(pcol,ov)+(c==="R"?usedCount(FP.wsl,ov):0);const sib=["F","H","J"].includes(c)?mdRows(ORGC).filter(x=>x!==r&&mg(c,x)===ov):[];
      if((n||sib.length)&&confirm(`Rename “${ov}” to “${nv}” everywhere?\n\n• ${n} project(s) use “${ov}”${sib.length?`\n• ${sib.length} other org-structure row(s)`:""}\n\nOK = update them too · Cancel = only this row`)){
        rowsOf("Projects").forEach(p=>{if(String(gv("Projects",pcol,p))===ov)setCell("Projects",pcol,p,nv);if(c==="R"&&String(gv("Projects",FP.wsl,p))===ov)setCell("Projects",FP.wsl,p,nv)});
        if(c==="R"){const ts=rowsOf("Activities").filter(x=>gv("Activities",FA.pic,x)===ov);if(ts.length&&confirm(`Also rename “${ov}” to “${nv}” as PIC on ${ts.length} task(s)?`))ts.forEach(x=>setCell("Activities",FA.pic,x,nv))}sib.forEach(x=>setCell("Master_Data",c,x,nv))}}
    if(c==="G"||c==="I"){const k=c==="G"?"F":"H";mdRows(ORGC).filter(x=>x!==r&&mg(k,x)!==""&&mg(k,x)===mg(k,r)&&mg(c,x)!==nv).forEach(x=>setCell("Master_Data",c,x,nv))}
    re()});
  m.querySelectorAll("[data-lp]").forEach(el=>el.onchange=()=>{const pr=nameRef("L_People");const r=+el.dataset.lp;const ov=String(gv(pr.sh,pr.col,r)),nv=el.value.trim();if(nv===ov)return;setCell(pr.sh,pr.col,r,nv);
    const ts=rowsOf("Activities").filter(x=>gv("Activities",FA.pic,x)===ov);if(ts.length&&nv&&confirm(`Also rename “${ov}” to “${nv}” as PIC on ${ts.length} task(s)?`))ts.forEach(x=>setCell("Activities",FA.pic,x,nv));re()});
  m.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>{const [k,rs]=b.dataset.mdel.split(":");const r=+rs;
    if(k==="ppl"){const pr=nameRef("L_People");if(confirm(`Remove “${gv(pr.sh,pr.col,r)}” from the People list? Tasks keep their PIC.`)){setCell(pr.sh,pr.col,r,"");re()}return}
    const cols={init:["B","C"],org:ORGC,region:["O"],lead:["R"]}[k];const lbl=cols.map(c=>mg(c,r)).filter(Boolean).join(" · ");
    const pcol={init:FP.init,region:FP.region,lead:FP.lead}[k];const n=pcol?usedCount(pcol,mg(cols[0],r))+(k==="lead"?usedCount(FP.wsl,mg(cols[0],r)):0):0;
    if(!confirm(`Delete “${lbl}” from the list?${n?`\n\n${n} project(s) use it — they keep their value, but it will no longer be offered in the dropdown.`:""}`))return;
    cols.forEach(c=>{if(mg(c,r)!=="")setCell("Master_Data",c,r,"")});re()});
  m.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const k=b.dataset.add;
    if(k==="ppl"){const v=prompt("New person (PIC):");if(v){addMaster("L_People",v);re()}return}
    const lbl={init:"New initiative name:",region:"New region:",lead:"New workstream leader / project lead:",org:"New org row — BU (leave blank for a CF / process that applies to every BU):"}[k];const v=prompt(lbl);if(v===null)return;
    if(k==="org"){const cf=prompt("Corporate Function for this row (optional):")||"";const pa=prompt("Process Area for this row (optional):")||"";const r=mdFree(ORGC);if(!r){toast("Table full");return}
      const bu=v.trim();if(!bu&&!cf.trim()&&!pa.trim())return;
      const o={F:bu,G:bu?(codeFor("L_BU","L_BUCode",bu,"")||suggestCode(bu,mdList("L_BUCode"))):"",H:cf.trim(),I:cf.trim()?(codeFor("L_CF","L_CFCode",cf.trim(),"")||suggestCode(cf.trim(),mdList("L_CFCode"))):"",J:pa.trim()};
      for(const[c,x] of Object.entries(o))if(x)setCell("Master_Data",c,r,x);re();return}
    if(v.trim()){addMaster({init:"L_Init",region:"L_Region",lead:"L_Leader"}[k],v);re()}});
  const num=(id,nm,f)=>{const el=$(id);if(el)el.onchange=()=>{const v=el.value===""?"":f(+el.value);setNamed(nm,v);if(nm==="S_AsOf"||nm==="S_TZ"||nm==="S_PCTZ")tickToday(false);re()}};
  num("#sTol","S_Tol",v=>Math.max(0,Math.round(v)));num("#sPred","S_PredTol",v=>Math.max(0,Math.min(100,v))/100);num("#sTZ","S_TZ",v=>v);num("#sPC","S_PCTZ",v=>v);
  if($("#sAsOf"))$("#sAsOf").onchange=e=>{setNamed("S_AsOf",e.target.value?serialFromIso(e.target.value):"");tickToday(true);re()};
  m.querySelectorAll("[data-wt]").forEach(el=>el.onchange=()=>{const [sh,ref]=el.dataset.wt.split("!");setCell(sh,ref.replace(/\d+/,""),+ref.replace(/[A-Z]+/,""),Math.max(0,Math.min(100,+el.value||0))/100);re()});
}

/* ---- changes ---- */
function vChanges(m){
  const all=netChanges();const rpK=c=>rowProject(c.sheet,+c.ref.replace(/[A-Z]+/g,""))||"(no project)";const rows=all.filter(c=>c.sheet!==E2EF&&c.sheet!==E2EM).sort((a,b)=>rpK(a).localeCompare(rpK(b))||a.sheet.localeCompare(b.sheet));const fl=e2eChangeLines(all);const mapOnly=!fl.length&&all.some(c=>c.sheet===E2EM);const tot=rows.length+fl.length+(mapOnly?1:0);
  m.innerHTML=`<div class="banner" style="background:#EAF6EC;border:1px solid #BFE3C6;color:#1E5B23"><b>SAVE</b><span>Review what will be written into the Excel file, then save. Only the listed input cells change; formulas, charts and formatting are untouched.</span></div><div class="card pad"><h2>Unsaved changes (${tot})</h2>
  ${tot?`${fl.length||mapOnly?`<h3 style="margin:6px 0">Process flows (E2E)</h3><div class="tablewrap" style="margin-bottom:12px"><table class="data"><tr><th>Flow</th><th>Version</th><th>What changed</th></tr>${fl.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.ver}</td><td>${esc(x.text)}</td></tr>`).join("")}${mapOnly?`<tr><td colspan="3">E2E_Map refreshed from the diagrams</td></tr>`:""}</table></div>`:""}${rows.length?`<h3 style="margin:6px 0">Cells</h3>`:""}<p class="muted">These changes will be written into the workbook when you click <b>Save to Excel</b>. Nothing else in the file is touched.</p>
  <div class="tablewrap" ${rows.length?"":'hidden'}><table class="data"><tr><th>Project</th><th>Sheet</th><th>Cell</th><th>Column</th><th>Old</th><th>New</th></tr>${rows.map((c,ix)=>{const kk=rpK(c);const hd=ix===0||kk!==rpK(rows[ix-1])?`<tr class="grph"><td colspan="6"><b>${esc(kk)}</b> <span class="muted">— ${rows.filter(x=>rpK(x)===kk).length} change(s)${rows.some(x=>rpK(x)===kk&&x.sheet==="Activities"&&x.ref.replace(/\d+/g,"")===FA.act)?" · progress spread across the project's tasks by stage weight":""}</span></td></tr>`:"";const col=(CFG[c.sheet]?CFG[c.sheet].cols:[]).find(x=>x.col===c.ref.replace(/\d+/,""));
   const f=v=>{const x=col&&col.type==="date"?fmtDate(v):col&&col.type==="pct"?fmtPct(v):v;const t=String(x??"");return t.length>140?t.slice(0,140)+"… ("+t.length.toLocaleString()+" characters)":x};const first={old:c.orig};const rw=+c.ref.replace(/[A-Z]+/g,"");
   return hd+`<tr><td><span class="clip">${esc(rowProject(c.sheet,rw))}</span></td><td>${c.sheet}</td><td>${c.ref}</td><td>${esc(col?col.h:"")}</td><td class="muted">${esc(f(first.old))}</td><td><b>${esc(f(c.val))}</b></td></tr>`}).join("")}</table></div>
  <p style="margin-top:12px"><button class="btn primary" id="saveNow">Save to Excel</button> <button class="btn" id="discard">Discard all changes</button></p>`:`<p class="muted">No unsaved changes.</p>`}</div>`;
  if($("#saveNow"))$("#saveNow").onclick=()=>save(false);
  if($("#discard"))$("#discard").onclick=async()=>{if(await choose("Discard all unsaved changes?",`<p>${tot} unsaved change(s) will be lost. The file is not touched.</p>`,[["c","Keep them"],["ok","Discard all","danger"]])!=="ok")return;
    const blob=await writeZip(S.zip,{});const buf=await blob.arrayBuffer();S.changes=[];await loadWorkbook(buf,S.fileName,S.handle,S.lastMod);updateBadge();render()};
}

