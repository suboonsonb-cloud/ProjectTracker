/* 06-list-editor.js — delete, generic list view, editor drawer */
"use strict";
/* ---- delete ---- */
function inputCols(sheet){return CFG[sheet].cols.filter(c=>c.kind==="in").map(c=>c.col)}
function clearRow(sheet,r){for(const c of inputCols(sheet)){if(gv(sheet,c,r)!=="")setCell(sheet,c,r,"")}if(S.newRows[sheet])S.newRows[sheet].delete(r)}
function dependents(sheet,r){
  const d={Activities:[],Benefits:[],RAIDD:[],Realisation:[],Benefit_Plan:[]};
  /* a record without an ID yet (fresh "+ New") has no dependents — never match blank IDs */
  const ownId=sheet==="Projects"?pId(r):sheet==="Activities"?tId(r):sheet==="Benefits"?bId(r):"x";if(!ownId)return d;
  if(sheet==="Projects"){const id=pId(r);d.Activities=rowsOf("Activities").filter(x=>gv("Activities",FA.pid,x)===id);d.Benefits=rowsOf("Benefits").filter(x=>gv("Benefits",FB.pid,x)===id);
    d.RAIDD=rowsOf("RAIDD").filter(x=>gv("RAIDD",FD.pid,x)===id);const bids=new Set(d.Benefits.map(bId));d.Realisation=rowsOf("Realisation").filter(x=>bids.has(gv("Realisation",FR.bid,x)));if(hasBP())d.Benefit_Plan=rowsOf("Benefit_Plan").filter(x=>bids.has(gv("Benefit_Plan","B",x)))}
  if(sheet==="Activities"){const id=tId(r);d.RAIDD=rowsOf("RAIDD").filter(x=>gv("RAIDD",FD.tid,x)===id)}
  if(sheet==="Benefits"){const id=bId(r);d.Realisation=rowsOf("Realisation").filter(x=>gv("Realisation",FR.bid,x)===id);d.Benefit_Plan=bpRows(id)}
  return d;
}
function labelOf(sheet,r){return ({Projects:()=>pId(r)+" — "+gv("Projects",FP.name,r),Activities:()=>tId(r)+" — "+gv("Activities",FA.task,r),Benefits:()=>bId(r)+" — "+gv("Benefits",FB.desc,r),
  RAIDD:()=>gv("RAIDD",FD.id,r)+" — "+gv("RAIDD",FD.desc,r),Realisation:()=>"actuals row for "+gv("Realisation",FR.bid,r)})[sheet]()}
function askDelete(sheet,r){
  const d=dependents(sheet,r);const n=Object.values(d).reduce((a,x)=>a+x.length,0);
  const lines=Object.entries(d).filter(([,v])=>v.length).map(([k,v])=>`<li>${v.length} ${k==="Activities"?"task(s)":k==="Benefits"?"benefit line(s)":k==="RAIDD"?"RAIDD item(s)":k==="Benefit_Plan"?"custom monthly plan row(s)":"realisation (actuals) row(s)"}</li>`).join("");
  const box=$("#confirm");box.querySelector(".box").innerHTML=`<h2>Delete ${sheet==="Activities"?"task":sheet==="Projects"?"project":sheet==="Benefits"?"benefit line":sheet==="RAIDD"?"RAIDD item":"actuals row"}?</h2>
   <p><b>${esc(labelOf(sheet,r))}</b></p>
   <p class="muted">This clears the row's input cells in the ${sheet} sheet (the row becomes free for new entries). Nothing is written until you click Save to database, and you can still discard it on the Review changes page.</p>
   ${n?`<div class="warnbox">Linked records: <ul style="margin:6px 0 0 18px">${lines}</ul>
     <label style="display:flex;gap:8px;margin-top:8px"><input type="checkbox" id="casc" checked> ${sheet==="Activities"?"Also delete the linked RAIDD items (untick to keep them and just remove the task link)":"Also delete all linked records (recommended — otherwise they point to a record that no longer exists)"}</label></div>`:""}
   ${sheet==="Projects"?`<p class="note">Tip: to keep the history instead, set <b>Status Override = Cancelled</b> on the project.</p>`:""}
   <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" id="cNo">Cancel</button><button class="btn danger" id="cYes">Delete</button></div>`;
  box.classList.add("on");$("#cNo").onclick=()=>box.classList.remove("on");
  $("#cYes").onclick=()=>{const casc=$("#casc")?$("#casc").checked:false;
    if(casc){for(const [k,v] of Object.entries(d))for(const x of v)clearRow(k,x)}
    else if(sheet==="Activities"){for(const x of d.RAIDD)setCell("RAIDD",FD.tid,x,"")}
    const back=sheet==="RAIDD"&&UI.rdPid;clearRow(sheet,r);box.classList.remove("on");if(back){liveCalc();renderUnder();raiddPanel(back);toast("Deleted — click Save to database to write it to the file",4000);return}closeEditor(true);toast("Deleted — click Save to database to write it to the file",4000);render()};
}

function matrix(dim,rows,keyFn,opt){
  const groups={};rows.forEach(r=>{const k=keyFn(r)||"(blank)";(groups[k]=groups[k]||[]).push(r)});
  const keys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length);if(!keys.length)return `<p class="muted">No projects</p>`;
  const cell=(k,st,n)=>n?`<td class="num" data-cell='${esc(JSON.stringify({dim,k,st}))}' style="cursor:pointer;font-weight:700;color:var(--navy);background:#EAF1FB">${n}</td>`:`<td class="num muted">·</td>`;
  const tot=STL.map(st=>rows.filter(r=>pStat(r)===st).length);
  return `<div class="tablewrap" style="max-height:420px"><table class="data"><thead><tr><th>${esc(dim)}</th>${STL.map(s=>`<th class="num">${s}</th>`).join("")}<th class="num">Total</th><th class="num">Value (THB/yr)</th></tr></thead><tbody>
  ${keys.map(k=>{const g=groups[k];return `<tr ${opt.rowClick?`data-bu="${esc(k)}"`:""} style="${opt.sel===k?"outline:2px solid var(--blue)":""}"><td><b>${esc(k)}</b>${opt.rowClick?` <span class="muted">${opt.sel===k?"▾":"▸"}</span>`:""}</td>
    ${STL.map(st=>cell(k,st,g.filter(r=>pStat(r)===st).length)).join("")}${cell(k,"",g.length)}<td class="num">${fmtShort(g.reduce((a,r)=>a+(+gv("Projects",FP.value,r)||0),0))}</td></tr>`}).join("")}
  <tr><td><b>Total</b></td>${tot.map(n=>`<td class="num"><b>${n||"·"}</b></td>`).join("")}<td class="num"><b>${rows.length}</b></td><td class="num"><b>${fmtShort(rows.reduce((a,r)=>a+(+gv("Projects",FP.value,r)||0),0))}</b></td></tr></tbody></table></div>`;
}
const DIMF={"BU":FP.bu,"CF":FP.cf,"Process Area":FP.proc,"Workstream Leader":FP.wsl,"Project Lead":FP.lead};
function projTable(rows){
  return `<div class="tablewrap" style="max-height:420px"><table class="data"><thead><tr><th>Project ID</th><th>Project</th><th>BU</th><th>CF</th><th>Process Area</th><th>Workstream Leader</th><th>Project Lead</th><th>Status</th><th class="num">Complete</th><th class="num">Slip (days)</th><th>Forecast end</th><th class="num">Delayed tasks</th></tr></thead><tbody>
  ${rows.map(r=>{const L=pLive(r);return `<tr data-r="${r}"><td>${esc(pId(r))}</td><td><span class="clip">${esc(gv("Projects",FP.name,r))}</span></td><td>${esc(gv("Projects",FP.bu,r))}</td><td>${esc(gv("Projects",FP.cf,r))}</td><td>${esc(gv("Projects",FP.proc,r))}</td><td>${esc(gv("Projects",FP.wsl,r))}</td><td>${esc(gv("Projects",FP.lead,r))}</td><td>${pill(pStat(r))}${rpTag(L.rpdays,L.rpref)}</td><td class="num">${fmtPct(L.comp)}</td><td class="num">${L.slip===""||L.slip==null?"":L.slip}</td><td>${fmtDate(L.fend)}</td><td class="num">${L.ndel??""}</td></tr>`}).join("")||`<tr><td colspan="12" class="muted">None</td></tr>`}</tbody></table></div>`;
}
function riskList(rows){
  const rs=rows.filter(r=>["Delayed","At Risk"].includes(pStat(r))).sort((a,b)=>(+pLive(b).slip||0)-(+pLive(a).slip||0));
  return projTable(rs);
}
function showCell(inBU,P){
  const c=UI.dash.cell;if(!c)return;const f=DIMF[c.dim];const src=c.dim==="BU"?P:inBU;
  const rows=src.filter(r=>(gv("Projects",f,r)||"(blank)")===c.k&&(!c.st||pStat(r)===c.st));
  const box=$("#cellList");box.innerHTML=`<div class="card pad" style="margin-top:14px"><h2>${esc(c.dim)}: ${esc(c.k)}${c.st?" · "+esc(c.st):""} — ${rows.length} project(s) <button class="btn small" id="cellClose" style="float:right">Close</button></h2>${projTable(rows)}</div>`;
  $("#cellClose").onclick=()=>{UI.dash.cell=null;box.innerHTML=""};
  box.querySelectorAll("tr[data-r]").forEach(tr=>tr.onclick=()=>openProject(+tr.dataset.r));
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function realMonths(){const c=CFG.Realisation.cols.filter(x=>x.kind==="in"&&/^[A-Z][a-z]{2}-\d{4}$/.test(x.h));
  return c.map(x=>{const [mo,y]=x.h.split("-");return {col:x.col,h:x.h,s:dateToSerial(new Date(Date.UTC(+y,MON.indexOf(mo),1)))}})}
function barsPlanActual(months,plan,act){
  if(!plan.some(v=>v)&&!act.some(v=>v))return `<p class="muted">No plan or actual realisation yet. Plan appears once benefit lines have a <b>Realisation Start Month</b> (Benefits tab) and the file has been recalculated in Excel; actuals appear as you enter them on the Realisation tab.</p>`;
  const W=640,H=230,pl=48,pb=34,pt=10,n=months.length,max=Math.max(1,...plan,...act);const bw=(W-pl-10)/n;
  const y=v=>pt+(H-pt-pb)*(1-v/max);let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Plan vs actual by month">`;
  for(let g=0;g<=4;g++){const v=max*g/4,yy=y(v);s+=`<line x1="${pl}" x2="${W-10}" y1="${yy}" y2="${yy}" stroke="#EEF1F5"/><text x="${pl-6}" y="${yy+4}" font-size="10" text-anchor="end" fill="#5B6573">${fmtShort(v)}</text>`}
  months.forEach((mm,i)=>{const x=pl+i*bw;
    s+=`<rect x="${x+1}" y="${y(plan[i])}" width="${bw/2-1.5}" height="${H-pb-y(plan[i])}" fill="#9DC3E6"><title>${mm.h} plan ${fmtNum(plan[i])}</title></rect>`;
    s+=`<rect x="${x+bw/2}" y="${y(act[i])}" width="${bw/2-1.5}" height="${H-pb-y(act[i])}" fill="#1F3864"><title>${mm.h} actual ${fmtNum(act[i])}</title></rect>`;
    if(i%3===0)s+=`<text x="${x+bw/2}" y="${H-pb+14}" font-size="10" text-anchor="middle" fill="#5B6573">${mm.h.replace("-20","-")}</text>`;
    if(mm.s<=TODAY&&(i===n-1||months[i+1].s>TODAY))s+=`<line x1="${x+bw}" x2="${x+bw}" y1="${pt}" y2="${H-pb}" stroke="#C00000" stroke-dasharray="3 3"/>`});
  s+=`</svg><div class="legend"><span><i style="background:#9DC3E6"></i>Plan (last Excel calc)</span><span><i style="background:#1F3864"></i>Actual (live)</span><span><i style="background:#C00000"></i>Today</span><span><span class="rptag" style="margin:0">⟳ Re-planned +Nd</span> timeline adjusted by an approved RAIDD re-plan</span></div>`;return s;
}
function hbars(obj,isStatus){
  const e=Object.entries(obj).sort((a,b)=>b[1]-a[1]);if(!e.length)return `<p class="muted">No data</p>`;const max=Math.max(1,...e.map(x=>x[1]));
  const col={"Completed":"#2E7D32","On Track":"#2E7D32","Delayed":"#B42318","At Risk":"#B26A00","On-Hold":"#8A93A0","Cancelled":"#B8BEC7","Not Started":"#A6B4C8"};
  return e.map(([k,v])=>`<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:13px"><span style="width:120px" class="clip">${esc(k)}</span>
   <span style="flex:1;background:#F1F4F8;border-radius:4px;height:14px"><span style="display:block;height:100%;border-radius:4px;width:${v/max*100}%;background:${isStatus?(col[k]||"#2E75B6"):"#2E75B6"}"></span></span>
   <span style="width:70px;text-align:right" class="num">${isStatus?v:fmtShort(v)}</span></div>`).join("");
}
/* ---- generic list view ---- */
function listView(m,sheet,opts){
  const q=opts.noSearch?"":(UI.q[sheet]||"").toLowerCase();const f=opts.filters.length?(UI.f[sheet]||{}):{};const chg=changedRows(sheet);
  let rows=rowsOf(sheet);if(opts.rowFilter)rows=rows.filter(opts.rowFilter);
  const fvs=(k,r)=>opts.filterAll&&opts.filterAll(k,r)||[opts.filterVal(k,r)];
  for(const [k,v] of Object.entries(f)){if(k==="stOff"||!v)continue;rows=rows.filter(r=>fvs(k,r).some(x=>String(x)===v))}
  const chipK=(opts.filters.find(fl=>fl.k==="status"||fl.k==="bstat")||{}).k;const hasSt=!!chipK;const stOffL=new Set(hasSt&&Array.isArray(f.stOff)?f.stOff:[]);const stBase=rows;
  if(stOffL.size)rows=rows.filter(r=>!stOffL.has(String(opts.filterVal(chipK,r))));
  if(q)rows=rows.filter(r=>opts.cols.some(c=>String(c.v(r)).toLowerCase().includes(q)));
  const CF=UI.cf[sheet]=UI.cf[sheet]||{};const cv=(i,r)=>String(opts.cols[i].v(r)??"");const preCF=rows;
  for(const [i,set] of Object.entries(CF))rows=rows.filter(r=>set.has(cv(i,r)));
  if(opts.order)rows=opts.order(rows);
  const so=UI.sort[sheet];if(so&&opts.cols[so.i]){rows=[...rows].sort((a,b)=>{const x=cv(so.i,a),y=cv(so.i,b);if(x===""&&y!=="")return 1;if(y===""&&x!=="")return -1;return cfCmp(x,y)*so.dir})}
  const nCF=Object.keys(CF).length;
  const stVals=hasSt?(()=>{const u=uniq(rowsOf(sheet).map(r=>String(opts.filterVal(chipK,r))));const o=uniqOrder(["Not Started","In Progress","On Track","At Risk","Delayed","On-Hold","Completed","Cancelled",...listFromName("L_RStatus"),...listFromName("L_BStat")]);return [...o.filter(x=>u.includes(x)||stOffL.has(x)),...u.filter(x=>!o.includes(x))]})():[];
  const filters=opts.filters.filter(fl=>fl.k!==chipK||stVals.length>1||stOffL.size).map(fl=>fl.k===chipK?stChips(stVals,stOffL,v=>stBase.filter(r=>String(opts.filterVal(chipK,r))===v).length,"l"+sheet):sel("f_"+fl.k,fl.label,uniq(rowsOf(sheet).flatMap(r=>fvs(fl.k,r).map(String))),f[fl.k]||"")).join("");
  const TBL=`<div class="card tablewrap"><table class="data"><thead><tr>${opts.cols.map((c,i)=>`<th class="${c.num?"num":""}"><span class="thf">${c.h}<button class="cfbtn${CF[i]?" on":""}${so&&so.i===i?" so":""}" data-cf="${i}" title="Filter / sort this column">${CF[i]?"⏷":so&&so.i===i?(so.dir>0?"▲":"▼"):"▾"}</button></span></th>`).join("")}<th>Actions</th></tr></thead>
   <tbody>${rows.map(r=>`<tr data-r="${r}" class="${chg.has(r)?"changed":""}">${opts.cols.map(c=>`<td class="${c.num?"num":""}">${c.html?c.html(r):`<span class="clip">${esc(c.v(r))}</span>`}</td>`).join("")}<td><span class="rowact"><button class="btn" data-edit="${r}">Edit</button><button class="btn danger" data-del="${r}">Delete</button></span></td></tr>`).join("")||`<tr><td colspan="${opts.cols.length+1}" class="muted">No rows</td></tr>`}</tbody></table></div>`;
  const LVF=`<div class="filterbar card dfilt lvfilt"><b>Filter</b>${opts.noSearch?"":`<input type="search" id="q" class="bq" placeholder="Search…" value="${esc(UI.q[sheet]||"")}">`}${filters}${nCF||so?`<button class="btn small" id="cfClear">✕ Clear column filters${nCF?` (${nCF})`:""}${so?" & sort":""}</button>`:""}<span class="muted" style="margin-left:auto">${rows.length} ${opts.noun}${rows.length===1?"":"s"}</span></div>`;
  m.innerHTML=opts.top?`${opts.top}${opts.panel&&!opts.panelBelow?opts.panel():""}${opts.noSearch&&!opts.filters.length?(nCF||so?`<div class="toolbar"><button class="btn small" id="cfClear">✕ Clear column filters${nCF?` (${nCF})`:""}${so?" & sort":""}</button></div>`:""):LVF}${opts.panel&&opts.panelBelow?opts.panel():""}`+TBL:`${banner("input",sheet)}${opts.panel&&!opts.panelBelow?opts.panel():""}<div class="toolbar">${opts.pre||""}${opts.noSearch?"":`<input type="search" id="q" placeholder="Search…" value="${esc(UI.q[sheet]||"")}">`}${filters}
   ${nCF||so?`<button class="btn small" id="cfClear">✕ Clear column filters${nCF?` (${nCF})`:""}${so?" & sort":""}</button>`:""}<span class="spacer" style="flex:1"></span><span class="muted">${rows.length} rows</span><button class="btn new" id="addNew">+ New ${opts.noun}</button></div>${opts.panel&&opts.panelBelow?opts.panel():""}`+TBL;
  if($("#q"))$("#q").oninput=e=>{UI.q[sheet]=e.target.value;const pos=e.target.selectionStart;listView(m,sheet,opts);const qi=$("#q");qi.focus();qi.setSelectionRange(pos,pos)};
  opts.filters.forEach(fl=>{if(fl.k===chipK){UI.f[sheet]=UI.f[sheet]||{};bindStChips(m,"l"+sheet,UI.f[sheet],()=>listView(m,sheet,opts));return}$("#f_"+fl.k).onchange=e=>{UI.f[sheet]={...(UI.f[sheet]||{}),[fl.k]:e.target.value};if(fl.k==="flow")delete UI.f[sheet].lane;listView(m,sheet,opts)}});
  m.querySelectorAll("tbody tr[data-r]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("[data-del]")||e.target.closest("[data-openp]"))return;opts.onOpen?opts.onOpen(+tr.dataset.r):openEditor(sheet,+tr.dataset.r)});
  m.querySelectorAll("[data-openp]").forEach(b=>b.onclick=e=>{e.stopPropagation();const pr=projRowById(b.dataset.openp);if(pr)openProject(pr)});bindPview(m);
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=e=>{e.stopPropagation();askDelete(sheet,+b.dataset.del)});
  if($("#addNew"))$("#addNew").onclick=()=>opts.onNew?opts.onNew():addNew(sheet,opts.prefill);if(opts.top&&$("#quNew"))$("#quNew").onclick=()=>opts.onNew?opts.onNew():addNew(sheet,opts.prefill);if(opts.bind)opts.bind(m);
  if($("#cfClear"))$("#cfClear").onclick=()=>{UI.cf[sheet]={};delete UI.sort[sheet];listView(m,sheet,opts)};
  m.querySelectorAll("[data-cf]").forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.cf;
    // values offered = rows passing every OTHER filter (like Excel)
    let base=preCF;for(const [k,set] of Object.entries(CF))if(+k!==i)base=base.filter(r=>set.has(cv(k,r)));
    const cnt={};base.forEach(r=>{const v=cv(i,r);cnt[v]=(cnt[v]||0)+1});const vals=Object.keys(cnt).sort(cfCmp);
    const cur=CF[i];openCfPop(b,opts.cols[i].h.replace(/<[^>]+>/g,""),vals,cnt,cur,
      sel=>{if(sel===null||sel.size===vals.length)delete CF[i];else CF[i]=sel;listView(m,sheet,opts)},
      dir=>{if(dir)UI.sort[sheet]={i,dir};else delete UI.sort[sheet];listView(m,sheet,opts)},so&&so.i===i?so.dir:0)});
}
function cfKey(v){const m=/^(\d{2})-([A-Z][a-z]{2})-(\d{2})/.exec(v);if(m)return {n:Date.UTC(2000+ +m[3],MON.indexOf(m[2]),+m[1])};const x=v.replace(/[,%]/g,"");if(x!==""&&!isNaN(+x))return {n:+x};return {t:v.toLowerCase()}}
function cfCmp(a,b){if(a===""&&b!=="")return 1;if(b===""&&a!=="")return -1;const A=cfKey(a),B=cfKey(b);if(A.n!=null&&B.n!=null)return A.n-B.n;if(A.n!=null)return -1;if(B.n!=null)return 1;return A.t<B.t?-1:A.t>B.t?1:0}
function openCfPop(btn,title,vals,cnt,cur,onApply,onSort,sortDir){
  document.getElementById("cfpop")?.remove();const pop=document.createElement("div");pop.id="cfpop";pop.className="cfpop";
  pop.innerHTML=`<div class="cfh">${esc(title)}</div><div class="cfsort"><button class="btn small${sortDir>0?" primary":""}" data-s="1">Sort A → Z</button><button class="btn small${sortDir<0?" primary":""}" data-s="-1">Sort Z → A</button>${sortDir?'<button class="btn small" data-s="0">No sort</button>':""}</div>
    <input type="search" class="cfq" placeholder="Search values…"><label class="cfall"><input type="checkbox" data-all> (Select all)</label>
    <div class="cflist">${vals.map((v,k)=>`<label data-v="${esc(v.toLowerCase())}"><input type="checkbox" data-k="${k}" ${!cur||cur.has(v)?"checked":""}> <span>${v===""?"<i>(Blanks)</i>":esc(v)}</span><em>${cnt[v]}</em></label>`).join("")}</div>
    <div class="cfbtns"><button class="btn small" data-clear>Clear filter</button><span style="flex:1"></span><button class="btn small" data-cancel>Cancel</button><button class="btn small primary" data-ok>OK</button></div>`;
  document.body.appendChild(pop);const r=btn.getBoundingClientRect();pop.style.top=(r.bottom+window.scrollY+4)+"px";pop.style.left=Math.max(8,Math.min(window.innerWidth-pop.offsetWidth-8,r.left+window.scrollX-8))+"px";
  const boxes=[...pop.querySelectorAll("[data-k]")],all=pop.querySelector("[data-all]");
  const vis=()=>boxes.filter(b=>b.closest("label").style.display!=="none");
  const sync=()=>{const v=vis();all.checked=v.length&&v.every(b=>b.checked);all.indeterminate=!all.checked&&v.some(b=>b.checked)};sync();
  boxes.forEach(b=>b.onchange=sync);all.onchange=()=>{vis().forEach(b=>b.checked=all.checked);sync()};
  pop.querySelector(".cfq").oninput=e=>{const q=e.target.value.toLowerCase();boxes.forEach(b=>{const l=b.closest("label");const on=!q||l.dataset.v.includes(q);l.style.display=on?"":"none";if(q)b.checked=on});sync()};
  const close=()=>{pop.remove();document.removeEventListener("mousedown",outside,true)};const outside=e=>{if(!pop.contains(e.target)&&e.target!==btn)close()};
  setTimeout(()=>document.addEventListener("mousedown",outside,true),0);
  pop.querySelector("[data-cancel]").onclick=close;pop.querySelector("[data-clear]").onclick=()=>{close();onApply(null)};
  pop.querySelector("[data-ok]").onclick=()=>{const sel=new Set(boxes.filter(b=>b.checked).map(b=>vals[+b.dataset.k]));close();onApply(sel)};
  pop.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{close();onSort(+b.dataset.s)});
  pop.querySelector(".cfq").focus();
}
function vProjects(m){if(UI.f.Projects){delete UI.f.Projects.flow;delete UI.f.Projects.lane}if(UI.plist!=="table")return vQuick(m,true);listView(m,"Projects",{noun:"project",pre:pviewToggle()+plistToggle(),onOpen:openProject,onNew:newProject,
  order:rows=>{const nw=S.newRows.Projects||new Set();return [...rows].sort((a,b)=>(nw.has(b)-nw.has(a))||(b-a))},
  panelBelow:true,noSearch:true,top:projHead(false),panel:()=>quFilterBar(),rowFilter:(()=>{const keep=new Set(quRows().rows);const nw=S.newRows.Projects||new Set();return r=>keep.has(r)||nw.has(r)})(),bind:m=>{quFilterBind(m,()=>{const y=scrollY;vProjects(m);window.scrollTo(0,y)})},
  filters:[],
  filterAll:(k,r)=>{if(k!=="lane"&&k!=="flow")return null;const x=projE2E(pId(r));if(k==="flow")return x.flows.length?x.flows.map(f=>f.name):[NOFLOW];const fl=(UI.f.Projects||{}).flow;
    if(fl&&fl!==NOFLOW){const F=e2eFlows().find(q=>q.name===fl);const d=F&&F.v["TO-BE"]&&F.v["TO-BE"].doc;return d?uniq((d.shapes||[]).filter(sh=>(sh.proj||[]).includes(pId(r))).map(sh=>laneOfShape(d,sh))):[]}return x.lanes.length?x.lanes:["(no lane)"]},
  filterVal:(k,r)=>k==="status"?pStat(r):k==="team"?gv("Projects","AB",r):k==="lane"?(projE2E(pId(r)).lanes[0]||"(no lane)"):k==="flow"?((projE2E(pId(r)).flows[0]||{}).name||NOFLOW):gv("Projects",FP[k],r),
  cols:[{h:"Project ID",v:r=>pId(r)},{h:"Project name",v:r=>gv("Projects",FP.name,r),html:r=>`<span class="clip">${esc(gv("Projects",FP.name,r)||"(no name yet)")}</span>${S.newRows.Projects&&S.newRows.Projects.has(r)?' <span class="badge-new">new</span>':""}`},{h:"Status",v:r=>pStat(r),html:r=>pill(pStat(r))+rpTag(pLive(r).rpdays,pLive(r).rpref)},{h:"RAIDD (open)",v:r=>{const rs=raiddOf(pId(r));return rs.length?rs.filter(x=>gv("RAIDD",FD.status,x)!=="Closed").length+" / "+rs.length:""},html:r=>raiddBtn(pId(r))},{h:"Latest open RAIDD",v:r=>{const o=raiddOf(pId(r)).filter(x=>gv("RAIDD",FD.status,x)!=="Closed").sort((a,b)=>(+gv("RAIDD",FD.raised,b)||0)-(+gv("RAIDD",FD.raised,a)||0))[0];return o?gv("RAIDD",FD.type,o)+": "+gv("RAIDD",FD.desc,o):""},html:r=>{const o=raiddOf(pId(r)).filter(x=>gv("RAIDD",FD.status,x)!=="Closed").sort((a,b)=>(+gv("RAIDD",FD.raised,b)||0)-(+gv("RAIDD",FD.raised,a)||0))[0];return o?`<span class="clip" style="max-width:240px;display:inline-block" title="${esc(gv("RAIDD",FD.desc,o))}"><b>${esc(gv("RAIDD",FD.type,o))}</b> ${esc(gv("RAIDD",FD.desc,o))}</span>`:'<span class="muted">—</span>'}},{h:"BU",v:r=>gv("Projects",FP.bu,r)},{h:"CF",v:r=>gv("Projects",FP.cf,r)},{h:"Process",v:r=>gv("Projects",FP.proc,r)},{h:"Division / team",v:r=>gv("Projects","AB",r)},{h:"E2E flow",v:r=>projE2E(pId(r)).flows.map(f=>f.name).join(", "),html:r=>e2eChip(pId(r))||'<span class="muted">—</span>'},
    {h:"Workstream leader",v:r=>gv("Projects",FP.wsl,r)},{h:"Project lead",v:r=>gv("Projects",FP.lead,r)},
    {h:"Complete",num:1,v:r=>fmtPct(pLive(r).comp??gv("Projects",FP.comp,r))},{h:"Value (THB/yr)",num:1,v:r=>fmtNum(projBen(pId(r)).rec)},{h:"Benefit plan",v:r=>{const f=projBen(pId(r)).flag;return f?BFLAG[f]:"✓ Planned"},html:r=>benFlag(pId(r))||'<span class="bok">✓ Planned</span>'},
    {h:"Plan end",v:r=>fmtDate(gv("Projects",FP.pe,r))},{h:"Forecast end",v:r=>fmtDate(pLive(r).fend??gv("Projects",FP.fe,r))},
    {h:"E2E lanes",v:r=>projE2E(pId(r)).lanes.join(", ")},
    {h:"TO-BE steps",num:1,v:r=>projE2E(pId(r)).steps||""}]})}
function vActivities(m){listView(m,"Activities",{noun:"task",top:hubHead("tasks"),prefill:()=>{const p=(UI.f.Activities||{}).pid;return p?{[FA.pid]:p}:{}},
  filters:[{k:"pid",label:"Project"},{k:"flow",label:"E2E flow"},{k:"stage",label:"Stage"},{k:"status",label:"Status"}],
  filterVal:(k,r)=>k==="status"?tStat(r):k==="flow"?((projE2E(gv("Activities",FA.pid,r)).flows[0]||{}).name||NOFLOW):gv("Activities",FA[k],r),
  cols:[{h:"Task ID",v:r=>tId(r)},{h:"Project",v:r=>gv("Activities",FA.pid,r),html:r=>{const p=gv("Activities",FA.pid,r);return p?`<a href="#" class="plink" data-openp="${esc(p)}" title="Open project workspace">${esc(p)}</a>`:""}},{h:"Stage",v:r=>gv("Activities",FA.stage,r)},{h:"Task",v:r=>gv("Activities",FA.task,r)},
    {h:"PIC",v:r=>gv("Activities",FA.picc,r)||gv("Activities",FA.pic,r)},{h:"Status",v:r=>tStat(r),html:r=>pill(tStat(r))+rpTag(tLive(r).rpdays,tLive(r).rpref)},
    {h:"Plan start",v:r=>fmtDate(gv("Activities",FA.ps,r))},{h:"Plan end",v:r=>fmtDate(gv("Activities",FA.pe,r))+(tLive(r).rpdays?" → "+fmtDate(tLive(r).epe):"")},{h:"Forecast end",v:r=>fmtDate(tLive(r).fe??gv("Activities",FA.fe,r))},
    {h:"Done",num:1,v:r=>fmtPct(gv("Activities",FA.act,r))},{h:"Forecast",v:r=>tLive(r).fc||"",html:r=>{const f=tLive(r).fc||"";const c={"On time":"#1E6B24","At risk of delay":"#B54708","Late":"#B42318","Done":"#1E6B24"}[f];return `<span style="font-weight:600;${c?"color:"+c:"color:var(--muted)"}">${esc(f)}</span>`}}]})}
function vBenefits(m){listView(m,"Benefits",{noun:"benefit line",top:hubHead("benefits"),panelBelow:true,panel:()=>typeof hasE2E==="function"&&hasE2E()?`<div class="card pad bsec" style="margin-bottom:12px"><div class="chead"><h2>Benefits by end-to-end process</h2><span class="muted" style="font-size:12px">All benefit lines (the list filters below don't apply) · flow ▸ click for swimlanes ▸ projects (click to open)</span></div>${e2eTreeHtml(new Set(rowsOf("Projects").map(pId).filter(Boolean)),"benefit",benefitSeries())}</div>`:"",prefill:()=>({[FB.nature]:"Recurring"}),
  filters:[{k:"pid",label:"Project"},{k:"flow",label:"E2E flow"},{k:"nature",label:"Nature"},{k:"bstat",label:"Status"}],
  filterVal:(k,r)=>k==="flow"?((projE2E(gv("Benefits",FB.pid,r)).flows[0]||{}).name||NOFLOW):gv("Benefits",FB[k],r),
  cols:[{h:"Benefit ID",v:r=>bId(r)},{h:"Project",v:r=>gv("Benefits",FB.pid,r),html:r=>{const p=gv("Benefits",FB.pid,r);return p?`<a href="#" class="plink" data-openp="${esc(p)}" title="Open project workspace">${esc(p)}</a>`:""}},{h:"Description",v:r=>gv("Benefits",FB.desc,r)},{h:"Nature",v:r=>gv("Benefits",FB.nature,r)||"Recurring"},
    {h:"Hours/month",num:1,v:r=>fmtNum(gv("Benefits",FB.trh,r),1)},{h:"Value type",v:r=>benLive(r).vtype,html:r=>{const t=benLive(r).vtype;return `<span class="vtype ${t.startsWith("THB")?"vt-h":t==="Time saving only"?"vt-t":"vt-n"}">${t==="Time saving only"?"⏱ ":""}${esc(t)}</span>`}},{h:"Phasing",v:r=>gv("Benefits",FB.phase,r)==="Custom"?"Custom":"Standard"},{h:"Gross value (THB)",num:1,v:r=>fmtNum(benLive(r).gross)},
    {h:"Start",v:r=>fmtDate(gv("Benefits",FB.start,r))},{h:"Confidence",v:r=>gv("Benefits",FB.conf,r)},{h:"Status",v:r=>gv("Benefits",FB.bstat,r),html:r=>pill(gv("Benefits",FB.bstat,r))}]})}
/* last update of a RAIDD row: unsaved edit = today, else newest activity-log line for that row, else raised date */
let RDU={t:0,m:null};
function raiddUpd(r){const now=Date.now();if(!RDU.m||now-RDU.t>500){const m={};try{for(const x of logRows()){const c=String(gv(LOG_SHEET,"H",x)||"");if(!c.startsWith("RAIDD!"))continue;const rr=+c.replace(/^RAIDD!/,"").replace(/[A-Z]+/g,"");const w=String(gv(LOG_SHEET,"A",x)||"").slice(0,10);const sv=/^\d{4}-\d\d-\d\d$/.test(w)?serialFromIso(w):0;if(sv>(m[rr]||0))m[rr]=sv}}catch(e){}
    for(const c of S.changes||[])if(c.sheet==="RAIDD")m[+String(c.ref).replace(/[A-Z]+/g,"")]=TODAY;RDU={t:now,m}}
  return RDU.m[r]||(+gv("RAIDD",FD.raised,r)||"")}
function vRaidd(m){if(view==="RAIDD"){view="Projects";UI.pview="raidd";renderTabs()}UI.sort=UI.sort||{};if(!UI.sort.RAIDD)UI.sort.RAIDD={i:0,dir:-1};listView(m,"RAIDD",{noun:"RAIDD item",top:hubHead("raidd"),prefill:()=>({[FD.status]:"Open",[FD.raised]:TODAY}),
  filters:[{k:"type",label:"Type"},{k:"status",label:"Status"},{k:"pid",label:"Project"},{k:"flow",label:"E2E flow"}],
  filterVal:(k,r)=>k==="flow"?((projE2E(gv("RAIDD",FD.pid,r)).flows[0]||{}).name||NOFLOW):gv("RAIDD",FD[k],r),
  cols:[{h:"Updated",v:r=>raiddUpd(r),html:r=>{const u=raiddUpd(r);return u?`<span class="nowrap" title="Last change (activity log), else raised date">${fmtDate(u)}</span>`:`<span class="muted" title="No change saved since the activity log started, and no raised date">—</span>`}},{h:"Type",v:r=>gv("RAIDD",FD.type,r)},{h:"Project",v:r=>gv("RAIDD",FD.pid,r),html:r=>{const id=gv("RAIDD",FD.pid,r);const pr=id?projRowById(id):null;return `<span class="clip" title="${esc(id)}">${esc(pr?gv("Projects",FP.name,pr):id)}</span><div class="zid">${esc(id)}</div>`}},
    {h:"E2E flow",v:r=>Object.values(projE2E(gv("RAIDD",FD.pid,r)).by||{}).map(b=>b.name).join(", "),html:r=>{const b=Object.values(projE2E(gv("RAIDD",FD.pid,r)).by||{});return b.length?b.map(x=>`<div class="rdfl">⇄ ${esc(x.name)}</div>`).join(""):`<span class="muted">—</span>`}},
    {h:"Lane",v:r=>[...new Set(Object.values(projE2E(gv("RAIDD",FD.pid,r)).by||{}).flatMap(b=>b.lanes))].join(", "),html:r=>{const l=[...new Set(Object.values(projE2E(gv("RAIDD",FD.pid,r)).by||{}).flatMap(b=>b.lanes))].filter(Boolean);return l.length?l.map(x=>`<div class="rdln">${esc(x)}</div>`).join(""):`<span class="muted">—</span>`}},{h:"Task",v:r=>gv("RAIDD",FD.tid,r)},
    {h:"Description",v:r=>gv("RAIDD",FD.desc,r)},{h:"PIC",v:r=>gv("RAIDD",FD.re,r)||gv("RAIDD",FD.pic,r)},{h:"Due",v:r=>fmtDate(gv("RAIDD",FD.due,r))},
    {h:"Status",v:r=>gv("RAIDD",FD.status,r),html:r=>pill(gv("RAIDD",FD.status,r))},{h:"Priority",v:r=>gv("RAIDD",FD.prio,r)}]})}

/* ---- editor drawer ---- */
function addNew(sheet,prefill){
  const r=firstFree(sheet);if(!r){toast("No free rows left in the "+sheet+" table — insert more rows in Excel first",6000);return}
  S.newRows[sheet]=S.newRows[sheet]||new Set();S.newRows[sheet].add(r);
  const pf=prefill?prefill():{};for(const [c,v] of Object.entries(pf))if(v!==""&&v!=null)setCell(sheet,c,r,v);
  if(sheet==="Projects"){setCell("Projects",FP.meth,r,"Waterfall")}
  if(sheet==="Benefits")refreshNewId("Benefits",r);
  openEditor(sheet,r,true);
}
function optionsFor(sheet,col,r){
  const L=col.list;if(!L)return null;
  if(L==="@projects")return projects().filter(p=>p.id).map(p=>({v:p.id,t:p.id+" — "+p.name}));
  if(L==="@benefits")return rowsOf("Benefits").map(x=>({v:bId(x),t:bId(x)+" — "+gv("Benefits",FB.desc,x)})).filter(o=>o.v);
  if(L==="@tasks"){const pid=gv(sheet,FD.pid,r);return rowsOf("Activities").filter(x=>!pid||gv("Activities",FA.pid,x)===pid).map(x=>({v:tId(x),t:tId(x)+" — "+gv("Activities",FA.task,x)})).filter(o=>o.v)}
  if(sheet==="Projects"&&L==="L_CF")return orgCF(gv("Projects",FP.bu,r)).map(v=>({v,t:v}));
  if(sheet==="Projects"&&L==="L_Proc")return orgProc(gv("Projects",FP.bu,r),gv("Projects",FP.cf,r)).map(v=>({v,t:v}));
  if(sheet==="Projects"&&(col.col===FP.lead||col.col===FP.wsl))return uniq([...listFromName("L_Leader"),...rowsOf("Projects").map(x=>gv("Projects",col.col,x))].filter(Boolean)).map(v=>({v,t:v}));
  if(L==="@stage"){const pid=gv("Activities",FA.pid,r);return listFromName(pid&&projMeth(pid)==="Agile"?"L_StageAG":"L_StageWF").map(v=>({v,t:v}))}
  return listFromName(L).map(v=>({v:String(v),t:String(v)}));
}
function fieldHtml(sheet,col,r,dirty){
  const id="fld_"+col.col,val=gv(sheet,col.col,r);const lab=esc(col.h);const wide=LONG.test(col.h)?" wide":"";
  const cls=`field${wide}${dirty?" dirty":""}`;
  if(/ID Lock/.test(col.h))return `<div class="${cls}"><label>${lab}</label><input id="${id}" value="${esc(val)}" readonly title="Saved automatically"></div>`;
  const opts=optionsFor(sheet,col,r);
  if(opts){
    const lead=sheet==="Projects"&&(col.col===FP.lead||col.col===FP.wsl);const addL=lead?"L_Leader":(sheet==="Projects"&&ADDABLE[col.list])?col.list:(col.list==="L_People"?"L_People":"");
    const strict=!(col.strict===false||col.list==="L_People"||lead);
    return `<div class="${cls}"><label>${lab}${addL?' <span class="addhint">＋ new allowed</span>':""}</label>${comboHtml(id,val,opts,{strict,add:addL,ctx:()=>sheet==="Projects"?{bu:gv("Projects",FP.bu,r),cf:gv("Projects",FP.cf,r)}:{}})}</div>`;
  }
  if(col.type==="date")return `<div class="${cls}"><label>${lab}</label><input id="${id}" type="date" value="${typeof val==="number"?isoFromSerial(val):""}"></div>`;
  if(col.type==="pct")return `<div class="${cls}"><label>${lab} (%)</label><input id="${id}" type="number" min="0" max="100" step="1" value="${val===""?"":Math.round(+val*1000)/10}"></div>`;
  if(col.type==="num")return `<div class="${cls}"><label>${lab}</label><input id="${id}" type="number" step="any" value="${esc(val)}"></div>`;
  if(wide)return `<div class="${cls}"><label>${lab}</label><textarea id="${id}">${esc(val)}</textarea></div>`;
  return `<div class="${cls}"><label>${lab}</label><input id="${id}" value="${esc(val)}"></div>`;
}
function readField(col,el){
  const v=el.value;if(v===""||v==null)return "";
  if(col.type==="date")return serialFromIso(v);
  if(col.type==="pct")return Math.max(0,Math.min(100,+v))/100;
  if(col.type==="num")return +v;
  return v.trim();
}
function openEditor(sheet,r,isNew){
  UI.sel={sheet,r};const cfg=CFG[sheet];
  const rpHint=sheet==="RAIDD"&&gv("RAIDD",FD.type,r)==="Re-plan"?`<div class="note" style="margin-bottom:12px;border-color:#C9B6F2;background:#F6F1FE"><b>Re-plan:</b> enter <b>Re-plan: New Plan End</b> and set <b>Approved = Y</b> once agreed. With a Task ID, that task's plan end moves to the new date; with only a Project ID, every unfinished task of the project shifts out by the extension. The original plan stays as the dotted baseline and the Gantt shows a <span class="rptag" style="margin:0">⟳ Re-planned</span> tag. Close the item when done — it never counts as an overdue RAIDD.</div>`:"";const chg=new Set(S.changes.filter(c=>c.sheet===sheet&&+c.ref.replace(/[A-Z]+/,"")===r).map(c=>c.ref.replace(/\d+/,"")));
  const ins=cfg.cols.filter(c=>c.kind==="in"&&!(sheet==="Realisation"&&/^[A-Z][a-z]{2}-\d{4}$/.test(c.h)));
  const calc=cfg.cols.filter(c=>c.kind==="f");
  const title={Projects:pId(r)||"New project",Activities:tId(r)||"New task",Benefits:bId(r)||"New benefit",RAIDD:gv("RAIDD",FD.id,r)||"New RAIDD item",Realisation:gv("Realisation",FR.bid,r)}[sheet];
  $("#dTitle").textContent=`${sheet} · ${title}`;
  $("#dBody").innerHTML=`${rpHint}${isNew?`<div class="note" style="margin-bottom:12px">New row (Excel row ${r}). Fill in the fields; the ID is assigned automatically.</div>`:""}
   <div class="fgrid">${ins.map(c=>fieldHtml(sheet,c,r,chg.has(c.col))).join("")}</div>
   ${liveBox(sheet,r)}<div class="calc"><h4>Calculated in Excel (last calculation — refreshes when Excel recalculates)</h4><dl>${calc.map(c=>{const v=gv(sheet,c.col,r);
     const t=c.type==="date"?fmtDate(v):c.type==="pct"?fmtPct(v):c.type==="num"?fmtNum(v,Math.abs(+v)<10&&v%1?2:0):v;return `<div><dt>${esc(c.h)}</dt><dd>${esc(t)||"—"}</dd></div>`}).join("")}</dl></div>`;
  const rdBack=sheet==="RAIDD"&&UI.rdPid;
  $("#dFoot").innerHTML=`${rdBack?`<button class="btn" id="dRdBack">‹ All RAIDD of ${esc(UI.rdPid)}</button>`:""}<button class="btn danger" id="dDel">Delete</button>${sheet==="Activities"?`<button class="btn" id="dDup">Duplicate as new task</button>`:""}${(sheet==="Activities"||sheet==="Projects")?`<button class="btn" id="dRp" title="Log an approved timeline change in RAIDD">⟳ Request re-plan</button>`:""}<span style="flex:1"></span><button class="btn primary" id="dDone">Done</button>`;
  $("#dDel").onclick=()=>askDelete(sheet,r);if(rdBack){$("#dRdBack").onclick=()=>{liveCalc();renderUnder();raiddPanel(UI.rdPid)};$("#dDone").onclick=null}
  if($("#dRp"))$("#dRp").onclick=()=>{const pid=sheet==="Projects"?pId(r):gv("Activities",FA.pid,r),tid=sheet==="Activities"?tId(r):"";
    const what=sheet==="Projects"?"project timeline":gv("Activities",FA.task,r);closeEditor(true);
    addNew("RAIDD",()=>({[FD.type]:"Re-plan",[FD.pid]:pid,[FD.tid]:tid,[FD.desc]:"Re-plan: extend "+what+" — reason: ",[FD.status]:"Open",[FD.rpok]:"N",[FD.raised]:TODAY}))};
  $("#dDone").onclick=rdBack?()=>{liveCalc();renderUnder();raiddPanel(UI.rdPid)}:closeEditor;if($("#dDup"))$("#dDup").onclick=()=>{const pid=gv("Activities",FA.pid,r),st=gv("Activities",FA.stage,r);closeEditor();addNew("Activities",()=>({[FA.pid]:pid,[FA.stage]:st,[FA.pic]:gv("Activities",FA.pic,r)}))};
  for(const c of ins){const el=document.getElementById("fld_"+c.col);if(!el||el.readOnly)continue;
    el.addEventListener("change",()=>{const nv=readField(c,el);const ov=gv(sheet,c.col,r);if(String(nv)===String(ov))return;
      try{setCell(sheet,c.col,r,nv)}catch(e){toast(e.message,5000);return}
      if(sheet==="Projects"&&[FP.init,FP.bu,FP.cf,FP.name,"AE"].includes(c.col))refreshNewId(sheet,r);
      if(sheet==="Activities"&&[FA.pid,FA.stage].includes(c.col))refreshNewId(sheet,r);
      openEditor(sheet,r,isNew);renderUnder()})}
  $("#drawer").classList.add("on");$("#scrim").classList.add("on");
}
function liveBox(sheet,r){
  let items=[];
  if(sheet==="Activities"){const t=tLive(r);if(!t.tid&&!gv("Activities",FA.pid,r))return "";items=[["Status",pill(t.status)],["Start (forecast)",fmtDate(t.fs)],["End (forecast)",fmtDate(t.fe)],["Slip vs plan (days)",t.slip===""?"—":t.slip]]}
  else if(sheet==="Projects"){const p=pLive(r);if(!p.status)return "";items=[["Status",pill(p.status)],["Completion",fmtPct(p.comp)],["Forecast start",fmtDate(p.fstart)],["Forecast end",fmtDate(p.fend)],["Delayed / at-risk tasks",p.ndel+" / "+p.nrisk]]}
  else return "";
  return `<div class="calc" style="border-top:1px solid var(--line)"><h4 style="color:var(--blue)">Live (recalculated in this app as you edit)</h4><dl>${items.map(([k,v])=>`<div><dt>${k}</dt><dd>${v||"—"}</dd></div>`).join("")}</dl></div>`;
}
function closeEditor(silent){UI.rdPid=null;if(UI.sel&&UI.sel.sheet==="RAIDD")dropEmptyRaidd();$("#drawer").classList.remove("on");$("#scrim").classList.remove("on");UI.sel=null;S._todayPending=false;render()}
function renderUnder(){liveCalc();const m=$("#main");const y=m.querySelector(".tablewrap")?.scrollTop;renderTabs();if(view!=="Realisation"){({Dashboard:vDash,Projects:vProjHub,Benefits:vBenefits,RAIDD:vRaidd,Gantt:vGantt,Changes:vChanges,Settings:vSettings})[view]?.(m)}const tw=m.querySelector(".tablewrap");if(tw&&y)tw.scrollTop=y}
$("#dClose").onclick=closeEditor;$("#scrim").onclick=closeEditor;
document.addEventListener("pointerdown",()=>{if(view==="E2E"&&typeof e2ePost==="function")e2ePost({type:"closePop"})},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&view==="E2E"&&UI.e2e&&UI.e2e.link&&!$("#confirm").classList.contains("on")){UI.e2e.link=null;e2ePost({type:"link",project:null});e2eSidePanel()}if(e.key==="Escape"){if($("#drawer").classList.contains("on"))closeEditor();$("#help").classList.remove("on")}});

