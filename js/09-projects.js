/* 09-projects.js — Projects hub, project workspace + task Gantt, benefit plan & plan-vs-actual */
"use strict";
/* ---------------- Projects hub: project list ⇄ task list, and the project workspace ---------------- */
const STD_TASKS={Waterfall:["Kick-off, scope & charter","Get requirement & solution design","Develop / configure","Test & UAT","Go-live & deployment","Hypercare, hand-over & benefit tracking"],
  Agile:["Discovery & inception workshop","Build backlog & release plan","Sprint delivery (build–test)","Hardening & UAT","Release / go-live","Review, hand-over & benefit tracking"]};
function pviewToggle(){return `<span class="seg" title="Switch between the project list, the task list, benefits and RAIDD"><button data-pv="projects" class="${!UI.pview||UI.pview==="projects"?"on":""}">▦ Projects</button><button data-pv="tasks" class="${UI.pview==="tasks"?"on":""}">☰ Tasks (activities)</button><button data-pv="benefits" class="${UI.pview==="benefits"?"on":""}">◈ Benefits</button><button data-pv="real" class="${UI.pview==="real"?"on":""}" title="Enter actuals for many benefit lines at once (also inside each project's Business benefit plan)">✓ Actuals</button><button data-pv="raidd" class="${UI.pview==="raidd"?"on":""}" title="Every RAIDD item across projects (add / edit them per project with the ⚑ button)">⚑ RAIDD</button></span>`}
const HUB={tasks:["＋ New task","Every task of every project · click a row to edit · ▾ on a column header = filter / sort · the task Gantt is inside each project · then <b>Save to database</b>."],
  benefits:["＋ New benefit line","Every benefit line · click a row to edit · plan vs actual for each line is inside its project (Business benefit plan) or under ✓ Actuals · then <b>Save to database</b>."],
  real:["","Actuals for every benefit line, month by month, next to the plan · the same panel is inside each project (Business benefit plan) · then <b>Save to database</b>."],
  raidd:["＋ New RAIDD item","Every RAIDD item across projects · click a row to edit · add items per project with the <b>⚑</b> button on the Projects list or project page · then <b>Save to database</b>."]};
function hubHead(k){const [nb,help]=HUB[k];return `<div class="card pad ptop"><div class="ptoprow">${pviewToggle()}<span style="flex:1"></span>${nb?`<button class="btn new" id="quNew">${nb}</button>`:""}</div><p class="muted" style="margin:6px 0 0;font-size:12px">${help}</p></div>`}
function projHead(simple){return `<div class="card pad ptop"><div class="ptoprow">${pviewToggle()}${plistToggle()}<span style="flex:1"></span><button class="btn new" id="quNew">＋ New project</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:12px">${simple?"Type progress / plan end / next steps right in the row · <b>▸</b> more fields · project name = full project with task Gantt · then <b>Save to database</b>."
      :"Every column of the Projects sheet · click a row = full project with task Gantt · <b>⚑</b> = RAIDD · <b>▾</b> on a column header = filter / sort · then <b>Save to database</b>."}</p></div>`}
function plistToggle(){return `<span class="pvwrap"><span class="pvlab">Project view</span><span class="seg" title="Summary = update view (important fields first, ▸ for more). Table = every column."><button data-pl="simple" class="${UI.plist!=="table"?"on":""}">Summary</button><button data-pl="table" class="${UI.plist==="table"?"on":""}">Table</button></span></span>`}
function bindPview(m){m.querySelectorAll("[data-pv]").forEach(b=>b.onclick=()=>{UI.pview=b.dataset.pv;UI.proj=null;render()});m.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>{UI.plist=b.dataset.pl;render()})}
function openProject(r){UI.wsOpen=false;$("#drawer").classList.remove("on");$("#scrim").classList.remove("on");UI.sel=null;view="Projects";UI.proj=r;render();window.scrollTo(0,0)}
function vProjHub(m){if(UI.proj!=null&&!rowsOf("Projects").includes(UI.proj))UI.proj=null;
  if(UI.proj!=null)return vProjectWS(m,UI.proj);return UI.pview==="tasks"?vActivities(m):UI.pview==="benefits"?vBenefits(m):UI.pview==="raidd"?vRaidd(m):UI.pview==="real"?vReal(m):vProjects(m)}
function newProject(){const r=nextProjectRow();if(!r){toast("No free rows left in the Projects table — insert more rows in Excel first",6000);return}
  S.newRows.Projects=S.newRows.Projects||new Set();S.newRows.Projects.add(r);openProject(r);UI.wsOpen=true;render()}/* methodology is filled when the project gets a name — an abandoned "+ New" leaves nothing behind */
function stagesOf(r){const ag=gv("Projects",FP.meth,r)==="Agile";return {ag,names:listFromName(ag?"L_StageAG":"L_StageWF"),codes:listFromName(ag?"L_CodeAG":"L_CodeWF"),w:listFromName(ag?"L_WAG":"L_WWF").map(Number),std:STD_TASKS[ag?"Agile":"Waterfall"]}}
function stdWindow(r,k){const ps=+gv("Projects",FP.ps,r)||0,pe=+gv("Projects",FP.pe,r)||0;if(!ps||!pe||pe<ps)return null;const W=stagesOf(r).w,tot=W.reduce((a,b)=>a+b,0)||1;
  const dd=pe-ps+1;let c0=0;for(let i=0;i<k;i++)c0+=W[i]/tot;const c1=c0+W[k]/tot;return {s:ps+Math.round(c0*dd),e:ps+Math.round(c1*dd)-1}}
function nextProjectRow(){const c=CFG.Projects;const used=r=>gv("Projects",KEY.Projects,r)!==""||gv("Projects",FP.lock,r)!==""||(S.newRows.Projects&&S.newRows.Projects.has(r));
  let last=c.first-1;for(let r=c.first;r<=c.last;r++)if(used(r))last=r;return last<c.last?last+1:firstFree("Projects")}
function tasksOfProject(pid){return rowsOf("Activities").filter(x=>gv("Activities",FA.pid,x)===pid)}
function addTask(pr,stage,o={}){const pid=pId(pr);if(!pid){toast("Enter the project name first so the Project ID can be generated");return null}
  const r=firstFree("Activities");if(!r){toast("No free rows left in the Activities table — insert more rows in Excel first",6000);return null}
  S.newRows.Activities=S.newRows.Activities||new Set();S.newRows.Activities.add(r);
  const st=stagesOf(pr);const k=st.names.indexOf(stage);const same=tasksOfProject(pid).filter(x=>gv("Activities",FA.stage,x)===stage);
  let ps=o.ps,pe=o.pe;if(ps===undefined){const lastE=Math.max(0,...same.map(x=>+gv("Activities",FA.pe,x)||0));const w=k>=0?stdWindow(pr,k):null;
    if(lastE){ps=lastE+1;pe=w&&w.e>ps?w.e:ps+13}else if(w){ps=w.s;pe=w.e}else{ps="";pe=""}}
  setCell("Activities",FA.pid,r,pid);setCell("Activities",FA.stage,r,stage);setCell("Activities",FA.task,r,o.name||"New task");
  const lead=gv("Projects",FP.lead,pr);if(o.pic||lead)setCell("Activities",FA.pic,r,o.pic||lead);
  if(ps!=="")setCell("Activities",FA.ps,r,ps);if(pe!=="")setCell("Activities",FA.pe,r,pe);
  refreshNewId("Activities",r);return r}
function genStdPlan(pr){const st=stagesOf(pr);if(!gv("Projects",FP.ps,pr)||!gv("Projects",FP.pe,pr))toast("Tip: set Plan Start and Plan End first — task dates are spread over the standard stage windows",6000);
  st.names.forEach((n,k)=>{const w=stdWindow(pr,k);addTask(pr,n,{name:st.std[k]||n,ps:w?w.s:"",pe:w?w.e:""})});liveCalc()}
function cascadePid(oldId,newId){if(!oldId||oldId===newId)return;
  if(typeof hasE2E==="function"&&hasE2E()){let ch=false;for(const f of e2eFlows())for(const v of VERS){const x=f.v[v];if(!x||!x.doc)continue;let hit=false;
      for(const sh of x.doc.shapes||[])if((sh.proj||[]).includes(oldId)){sh.proj=sh.proj.map(p=>p===oldId?newId:p);hit=true}if(hit){e2eWriteDoc(f,v,x.doc);ch=true}}
    if(ch){E2E_CACHE=null;E2E_SHORTDUP=null;e2eRebuildMap();if(view==="E2E")e2eSync()}}
  for(const x of rowsOf("Activities"))if(gv("Activities",FA.pid,x)===oldId){setCell("Activities",FA.pid,x,newId);refreshNewId("Activities",x)}
  for(const [sh,c] of [["Benefits",FB.pid],["RAIDD",FD.pid]])for(const x of rowsOf(sh))if(gv(sh,c,x)===oldId)setCell(sh,c,x,newId)}
function remapStages(pr,wasAgile){const pid=pId(pr);const from=listFromName(wasAgile?"L_StageAG":"L_StageWF"),to=stagesOf(pr).names;
  for(const x of tasksOfProject(pid)){const i=from.indexOf(gv("Activities",FA.stage,x));if(i>=0&&to[i]){setCell("Activities",FA.stage,x,to[i]);refreshNewId("Activities",x)}}}
function wsRerender(){const ae=document.activeElement;const k=ae&&ae.dataset?ae.dataset.k:null;const y=window.scrollY;liveCalc();renderTabs();vProjectWS($("#main"),UI.proj);window.scrollTo(0,y);
  if(k){const el=document.querySelector(`[data-k="${k}"]`);if(el)el.focus()}}
const TCOLS=[{c:"task",h:"Task name",t:"text",w:220},{c:"pic",h:"PIC",t:"pic",w:110},{c:"ps",h:"Plan start",t:"date"},{c:"pe",h:"Plan end",t:"date"},{c:"act",h:"% done",t:"pct",w:64},{c:"as",h:"Actual start",t:"date"},{c:"ae",h:"Actual end",t:"date"},{c:"ovr",h:"Override",t:"ovr",w:96}];
function tInput(r,col){const c=FA[col.c],v=gv("Activities",c,r),k=`t${r}_${c}`;
  if(col.t==="date")return `<input type="date" data-k="${k}" data-r="${r}" data-c="${c}" data-t="date" value="${typeof v==="number"?isoFromSerial(v):""}">`;
  if(col.t==="pct")return `<input type="number" min="0" max="100" step="5" data-k="${k}" data-r="${r}" data-c="${c}" data-t="pct" value="${v===""?"":Math.round(+v*1000)/10}" style="width:${col.w}px">`;
  if(col.t==="ovr")return `<select data-k="${k}" data-r="${r}" data-c="${c}" data-t="text" style="width:${col.w}px"><option value=""></option>${listFromName("L_TOvr").map(o=>`<option ${o===v?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
  return `<input data-k="${k}" data-r="${r}" data-c="${c}" data-t="text" ${col.t==="pic"?'list="dlPeople"':""} value="${esc(v)}" style="width:${col.w}px">`}

/* ---------------- project workspace: interactive task Gantt ----------------
   grey outline = plan · blue fill = % done · red = delay (forecast end after plan end) · green tick line = actual
   drag a bar to move it, drag an end to change start/end; click a task name for all fields */
UI.wsTV=UI.wsTV||"gantt";UI.wsZoom=UI.wsZoom||"fit";
function wsGanttHtml(r,ts,st){const n=v=>+v||0;const days=[];
  for(const x of ts){[FA.ps,FA.pe,FA.as,FA.ae].forEach(c=>{const v=n(gv("Activities",c,x));if(v)days.push(v)});const t=tLive(x);if(n(t.fs))days.push(n(t.fs));if(n(t.fe))days.push(n(t.fe))}
  [n(gv("Projects",FP.ps,r)),n(gv("Projects",FP.pe,r)),TODAY].forEach(v=>{if(v)days.push(v)});
  let d0=Math.min(...days)-7,d1=Math.max(...days)+14;const d0d=serialToDate(d0);d0-=d0d.getUTCDate()-1;/* start on the 1st */
  const N=d1-d0+1;const dw=UI.wsZoom==="week"?14:UI.wsZoom==="month"?4:0;/* 0 = fit to width */
  const W=dw?N*dw:0;const X=v=>dw?((v-d0)*dw)+"px":((v-d0)/N*100)+"%";const Wd=(a,b)=>dw?(Math.max(1,b-a+1)*dw)+"px":(Math.max(1,b-a+1)/N*100)+"%";
  let months="";for(let s=d0;s<=d1;){const dt=serialToDate(s);const y=dt.getUTCFullYear(),mo=dt.getUTCMonth();const nx=dateToSerial(new Date(Date.UTC(y,mo+1,1)));const e=Math.min(nx-1,d1);
    months+=`<div class="gm" style="left:${X(s)};width:${Wd(s,e)}">${MON[mo]} ${String(y).slice(2)}</div>`;s=nx}
  if(UI.wsZoom==="week"){for(let s=d0;s<=d1;s++){const dt=serialToDate(s);if(dt.getUTCDay()===1)months+=`<div class="gwk" style="left:${X(s)}">${dt.getUTCDate()}</div>`}}
  const today=TODAY>=d0&&TODAY<=d1?`<div class="gtoday" style="left:${X(TODAY)}" title="Today ${fmtDate(TODAY)}"></div>`:"";
  const row=x=>{const t=tLive(x);const ps=n(gv("Activities",FA.ps,x)),pe=n(gv("Activities",FA.pe,x)),as=n(gv("Activities",FA.as,x)),ae=n(gv("Activities",FA.ae,x));
    const pct=Math.round((t.eact??n(gv("Activities",FA.act,x)))*100);const fe=n(t.fe);const late=pe&&fe>pe;const stt=tStat(x);
    const bar=ps&&pe?`<div class="gbar ${stt==="Completed"?"done":""} ${(pe-ps+1)/N<0.045&&!dw||dw&&(pe-ps+1)*dw<44?"short":""}" data-gb="${x}" style="left:${X(ps)};width:${Wd(ps,pe)}" title="${esc(gv("Activities",FA.task,x))}: plan ${fmtDate(ps)} → ${fmtDate(pe)} · ${pct}% done — drag to move, drag an end to resize">
        <span class="gfill" style="width:${Math.min(100,pct)}%"></span><span class="gh l" data-gh="l"></span><span class="gh r" data-gh="r"></span><span class="glbl ${pct<20?"out":""}">${pct}%</span></div>`
      :`<button class="btn small gset" data-gset="${x}">Set dates</button>`;
    const delay=late?`<div class="gdelay" style="left:${X(pe+1)};width:${Wd(pe+1,fe)}" title="Forecast end ${fmtDate(fe)} — ${fe-pe} day(s) after plan end"><span>+${fe-pe}d</span></div>`:"";
    const act=as?`<div class="gact" style="left:${X(as)};width:${Wd(as,ae||Math.min(TODAY,d1))}" title="Actual ${fmtDate(as)} → ${ae?fmtDate(ae):"ongoing"}"></div>`:"";
    return `<div class="grow" data-gr="${x}"><div class="gname"><button class="glink" data-more="${x}" title="All fields">${esc(gv("Activities",FA.task,x)||"(task)")}</button>
        <input class="gpic" list="dlPeople" value="${esc(gv("Activities",FA.pic,x)||"")}" data-gpic="${x}" placeholder="PIC" aria-label="PIC (person in charge)" title="PIC — type or pick a name"><input class="gpct" type="number" min="0" max="100" step="5" value="${pct}" data-gpct="${x}" aria-label="% done"><span class="gst">${pill(stt)}</span></div>
      <div class="gtrack">${act}${bar}${delay}</div></div>`};
  const body=st.names.map((sn,k)=>{const rs=ts.filter(x=>gv("Activities",FA.stage,x)===sn).sort((a,b)=>(n(gv("Activities",FA.ps,a))||9e9)-(n(gv("Activities",FA.ps,b))||9e9));const w=stdWindow(r,k);
    return `<div class="grow gstage"><div class="gname"><span class="code">${esc(st.codes[k]||"")}</span><b>${esc(sn)}</b><span class="muted">${rs.length}</span><span style="flex:1"></span><button class="btn small new" data-addt="${esc(sn)}" title="Add a task to ${esc(sn)}">＋</button></div>
      <div class="gtrack">${w?`<div class="gwin" style="left:${X(w.s)};width:${Wd(w.s,w.e)}" title="Standard window ${fmtDate(w.s)} → ${fmtDate(w.e)}"></div>`:""}</div></div>${rs.map(row).join("")}`}).join("");
  return `<div class="gwrap"><div class="gscroll"><div class="gin" style="${W?`width:${W+430}px`:""}">
     <div class="grow ghead"><div class="gname"><b style="flex:1">Task</b><b class="gh-pic">PIC</b><b class="gh-pct">% done</b><b class="gh-st">Status</b></div><div class="gtrack">${months}</div></div>
     <div class="gbody">${body}<div class="glines">${today}</div></div></div></div>
     <div class="glegend"><span><i class="lg win"></i>Standard stage window</span><span><i class="lg plan"></i>Plan</span><span><i class="lg fill"></i>% done</span><span><i class="lg late"></i>Delay (forecast after plan end)</span><span><i class="lg act"></i>Actual</span><span><i class="lg tdy"></i>Today</span><span class="muted">Drag a bar to move it · drag its ends to change dates · click a task for all fields</span></div></div>`}
function wsGanttBind(m,r){const g=m.querySelector(".gwrap");if(!g)return;
  const u=document.getElementById("gUndo");if(u)u.onclick=()=>{const w=UI.wsUndo;UI.wsUndo=null;try{setCell("Activities",FA.ps,w.x,w.ps);setCell("Activities",FA.pe,w.x,w.pe)}catch(e){toast(e.message)}updateBadge();renderTabs();wsRerender()};
  if(UI.wsZoom!=="fit"){const sc=g.querySelector(".gscroll"),t=g.querySelector(".gtoday");if(sc&&t&&!UI.wsScrolled){sc.scrollLeft=Math.max(0,t.offsetLeft+430-sc.clientWidth/2);UI.wsScrolled=true}}
  g.querySelectorAll("[data-gpic]").forEach(el=>{el.addEventListener("keydown",e=>{if(e.key==="Enter")el.blur()});el.addEventListener("change",()=>{const x=+el.dataset.gpic;const v=el.value.trim();if(v===String(gv("Activities",FA.pic,x)||""))return;try{setCell("Activities",FA.pic,x,v)}catch(e){toast(e.message);return}toast("PIC updated");updateBadge()})});
  g.querySelectorAll("[data-gpct]").forEach(el=>el.addEventListener("change",()=>{const x=+el.dataset.gpct;let v=Math.max(0,Math.min(100,+el.value||0))/100;try{setCell("Activities",FA.act,x,v)}catch(e){toast(e.message);return}setTimeout(wsRerender,0)}));
  g.querySelectorAll("[data-gset]").forEach(b=>b.onclick=()=>openEditor("Activities",+b.dataset.gset));
  g.querySelectorAll("[data-gb]").forEach(bar=>bar.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();const x=+bar.dataset.gb;const track=bar.parentElement;
    const tr=track.getBoundingClientRect();const all=g.querySelector(".gtrack");const days=(()=>{const L=parseFloat(bar.style.left),Wp=parseFloat(bar.style.width);return null})();
    const ps0=+gv("Activities",FA.ps,x),pe0=+gv("Activities",FA.pe,x);const pxPerDay=bar.getBoundingClientRect().width/Math.max(1,pe0-ps0+1);
    const mode=e.target.dataset.gh||"move";const x0=e.clientX;let ps=ps0,pe=pe0;bar.setPointerCapture(e.pointerId);bar.classList.add("drag");
    const tip=document.createElement("div");tip.className="gtip";document.body.appendChild(tip);
    const mv=ev=>{const dd=Math.round((ev.clientX-x0)/pxPerDay);ps=ps0;pe=pe0;if(mode==="move"){ps+=dd;pe+=dd}else if(mode==="l")ps=Math.min(pe0,ps0+dd);else pe=Math.max(ps0,pe0+dd);
      const a=parseFloat(bar.dataset.l0??(bar.dataset.l0=bar.style.left)),u=bar.style.left.endsWith("%")?"%":"px";
      const k=u==="%"?(100/tr.width):1;bar.style.transform=`translateX(${(mode==="r"?0:(ps-ps0))*pxPerDay}px)`;bar.style.width=`${(pe-ps+1)*pxPerDay}px`;
      tip.textContent=`${fmtDate(ps)} → ${fmtDate(pe)} (${pe-ps+1} days)`;tip.style.left=(ev.clientX+12)+"px";tip.style.top=(ev.clientY+14)+"px"};
    const up=()=>{bar.removeEventListener("pointermove",mv);bar.removeEventListener("pointerup",up);bar.removeEventListener("pointercancel",up);tip.remove();bar.classList.remove("drag");
      if(ps===ps0&&pe===pe0){wsRerender();return}try{if(ps!==ps0)setCell("Activities",FA.ps,x,ps);if(pe!==pe0)setCell("Activities",FA.pe,x,pe)}catch(err){toast(err.message,5000)}
      UI.wsUndo={r,x,ps:ps0,pe:pe0};toast(`Plan moved to ${fmtDate(ps)} → ${fmtDate(pe)} — “↶ Undo last move” in the toolbar above reverts it`,3500);setTimeout(wsRerender,0)};
    bar.addEventListener("pointermove",mv);bar.addEventListener("pointerup",up);bar.addEventListener("pointercancel",up)}))}

/* project details: grouped so the important fields are easy to find and fill */
const PD_SECTIONS=[["What","📌",["G","AE","B","AD","AF"]],["Who","👥",["D","E","AA","AB","BO","H","AG","AH","C"]],["When & status","🗓",["N","O","P","Q","AC","AI","R"]],["Latest update","📝",["AK","AL","AM","M"]]];
const PD_COLS=PD_SECTIONS.flatMap(s=>s[2]);
function projDetailsHtml(r,ins,pchg){const byCol=Object.fromEntries(ins.map(c=>[c.col,c]));
  const fld=col=>{const c=byCol[col];if(!c)return "";const dirty=pchg.has(col)?" dirty":"";const v=gv("Projects",col,r);
    if(col==="AE"){const o=uniqOrder(["2T","Simplification","O2C Deep Dive","P2P Deep Dive","R2R Deep Dive",v].filter(Boolean));
      return `<div class="field${dirty}"><label>Programme ${S.newRows.Projects&&S.newRows.Projects.has(r)?`<span class="addhint">2T → ID starts 2T- · others → SIMP-</span>`:`<span class="addhint" title="The ID is locked once saved">ID stays ${esc(pId(r).split("-")[0])}-</span>`}</label><select id="fld_AE"><option value=""></option>${o.map(x=>`<option ${x===v?"selected":""}>${esc(x)}</option>`).join("")}</select></div>`}
    if(col==="AB"){const o=uniq(rowsOf("Projects").map(x=>gv("Projects","AB",x)).filter(Boolean)).map(x=>({v:x,t:x}));
      return `<div class="field${dirty}"><label>Division / Team <span class="addhint">＋ new allowed</span></label>${comboHtml("fld_AB",v,o,{strict:false})}</div>`}
    if(["AD","AK","AL","AM","M"].includes(col))return `<div class="field wide2${dirty}"><label>${esc(c.h)}</label><textarea id="fld_${col}" rows="3">${esc(v)}</textarea></div>`;
    const h=fieldHtml("Projects",c,r,!!dirty);return col==="G"?h.replace('class="field','class="field wide2'):h};
  return `<div class="pdgrid">${PD_SECTIONS.map(([t,ic,cols])=>`<section class="pdsec"><h3><span>${ic}</span>${t}</h3><div class="pdfields">${cols.map(fld).join("")}</div></section>`).join("")}</div>`}
function vProjectWS(m,r){
  const pid=pId(r),L=pLive(r),isNew=!!(S.newRows.Projects&&S.newRows.Projects.has(r));const st=stagesOf(r);const chg=changedRows("Activities");
  const ins=CFG.Projects.cols.filter(c=>c.kind==="in");const pchg=new Set(S.changes.filter(c=>c.sheet==="Projects"&&+c.ref.replace(/[A-Z]+/,"")===r).map(c=>c.ref.replace(/\d+/,"")));
  const ts=pid?tasksOfProject(pid):[];const open=UI.wsOpen||isNew||!pid;
  const CORE=[FP.name,FP.init,FP.region,FP.bu,FP.cf,FP.proc,FP.lead,FP.meth,FP.ps,FP.pe,FP.ovr,FP.lock];
  const stCards=st.names.map((sn,k)=>{const rs=ts.filter(x=>gv("Activities",FA.stage,x)===sn).sort((a,b)=>(+gv("Activities",FA.ps,a)||9e9)-(+gv("Activities",FA.ps,b)||9e9));
    const w=stdWindow(r,k);const lv=rs.map(tLive);const fs=lv.map(t=>+t.fs).filter(Boolean),fe=lv.map(t=>+t.fe).filter(Boolean);
    return `<div class="stg"><div class="stgh"><span class="code">${esc(st.codes[k]||"")}</span><b>${esc(sn)}</b><span class="muted">std weight ${Math.round((st.w[k]||0)*100)}%${w?` · std window ${fmtDate(w.s)} → ${fmtDate(w.e)}`:""}</span><span style="flex:1"></span>
      <span class="muted">${rs.length} task${rs.length===1?"":"s"}${fs.length?` · forecast ${fmtDate(Math.min(...fs))} → ${fmtDate(Math.max(...fe))}`:""}</span><button class="btn small new" data-addt="${esc(sn)}">+ Add task</button></div>
      ${rs.length?`<div class="tablewrap" style="max-height:none"><table class="data ttab"><thead><tr><th title="Full ID = Project ID + this code">Task</th>${TCOLS.map(c=>`<th>${c.h}</th>`).join("")}<th>Status</th><th>Forecast end</th><th>Forecast</th><th></th></tr></thead><tbody>
      ${rs.map(x=>{const t=tLive(x);const fcC={"On time":"#1E6B24","At risk of delay":"#B54708","Late":"#B42318","Done":"#1E6B24"}[t.fc];
        return `<tr class="${chg.has(x)?"changed":""}"><td class="mono nowrap" title="${esc(tId(x))}">${esc(tId(x)?tId(x).split("-").pop():"(set stage)")}${S.newRows.Activities&&S.newRows.Activities.has(x)?' <span class="badge-new">new</span>':""}</td>${TCOLS.map(c=>`<td>${tInput(x,c)}</td>`).join("")}
        <td>${pill(t.status)}${rpTag(t.rpdays,t.rpref)}</td><td>${fmtDate(t.fe)}</td><td style="font-weight:600;color:${fcC||"var(--muted)"}">${esc(t.fc||"")}</td>
        <td class="nowrap"><button class="btn small" data-more="${x}" title="All fields, move to another stage, re-plan">⋯</button><button class="btn small danger" data-delt="${x}" title="Delete task">🗑</button></td></tr>`}).join("")}</tbody></table></div>`
      :`<div class="muted" style="padding:8px 12px">No tasks in this stage.</div>`}</div>`}).join("");
  m.innerHTML=`${banner("input","Projects")}
   <div class="toolbar">${pviewToggle()}<button class="btn" id="wsBack">← All projects</button><span style="flex:1"></span>
     <button class="btn" id="wsGantt">View in Gantt</button>${pid?raiddBtn(pid).replace('class="rdbtn','class="rdbtn big'):""}${pid?`<button class="btn" id="wsRp">⟳ Request re-plan</button>`:""}</div>
   <div class="card pad wshead"><div><div class="muted mono">${pid?progChip(pid):""}${esc(pid||"Project ID is generated when you enter the project name")}</div>
     <h2 style="margin:2px 0 6px">${esc(gv("Projects",FP.name,r)||"New project")}</h2>
     <div style="margin-bottom:4px">${pid?e2eChip(pid,true):""}</div><div class="muted">${[gv("Projects",FP.bu,r),gv("Projects",FP.cf,r),gv("Projects",FP.proc,r),gv("Projects","AB",r)&&("Team "+gv("Projects","AB",r)),gv("Projects",FP.wsl,r)&&("Workstream leader "+gv("Projects",FP.wsl,r)),gv("Projects",FP.lead,r)&&("Project lead "+gv("Projects",FP.lead,r))].filter(Boolean).map(esc).join(" · ")||"Fill in the project details below"}</div></div>
     <div class="wskpi"><div><span>Status</span>${pill(L.status||"Not Started")}${rpTag(L.rpdays,L.rpref)}</div><div><span>Completion</span><b>${fmtPct(L.comp||0)}</b></div>
       <div><span>Forecast</span><b>${fmtDate(L.fstart)||"—"} → ${fmtDate(L.fend)||"—"}</b></div><div><span>Benefit plan</span>${pid?(projBen(pid).flag?benFlag(pid):`<b>${fmtNum(projBen(pid).rec)}</b><small class="muted"> THB/yr</small>`):"—"}</div><div><span>Tasks</span><b>${ts.length}</b>${L.ndel?` <span style="color:#B42318">${L.ndel} delayed</span>`:""}</div></div></div>
   <div class="card pad" style="margin-top:14px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h2 style="margin:0">Activities &amp; tasks</h2>
     <span class="muted">${st.ag?"Agile":"Waterfall"} stages${UI.wsTV==="table"?" · edit cells directly":" · drag bars to re-plan"}</span><span style="flex:1"></span>
     ${pid?`<span class="seg"><button data-tv="gantt" class="${UI.wsTV!=="table"?"on":""}">▤ Gantt</button><button data-tv="table" class="${UI.wsTV==="table"?"on":""}">☰ Table</button></span>
       ${UI.wsTV!=="table"?`<span class="seg" title="Zoom"><button data-gz="fit" class="${UI.wsZoom==="fit"?"on":""}">Fit</button><button data-gz="month" class="${UI.wsZoom==="month"?"on":""}">Months</button><button data-gz="week" class="${UI.wsZoom==="week"?"on":""}">Weeks</button></span>`:""}
       ${UI.wsUndo&&UI.wsUndo.r===r&&UI.wsTV!=="table"?`<button class="btn small" id="gUndo">↶ Undo last move</button>`:""}<button class="btn" id="wsStd" title="Adds one standard task per stage, dated across the standard stage windows of Plan Start → Plan End">＋ Standard task per stage</button>`:""}</div>
     ${pid?(UI.wsTV==="table"?stCards:(ts.length?wsGanttHtml(r,ts,st):`<div class="note">No tasks yet — click <b>＋ Standard task per stage</b> to create a plan from the project dates, then drag the bars to adjust.</div>`+stCards)):`<div class="note">Enter at least the <b>Project name</b> (and ideally Initiative, BU and CF) above — the Project ID is then generated and you can add stages and tasks here.</div>`}
   </div>
   <div class="card pad pdcard" id="wsDet" style="margin-top:14px"><div class="pdhead"><h2 style="margin:0">Project details</h2><span class="muted">Changes are kept when you leave a box · blue = written to the Projects sheet on Save to database</span></div>
     ${projDetailsHtml(r,ins,pchg)}
     <details class="pdadv" ${UI.wsMore?"open":""} id="wsMore"><summary>Advanced — custom stage weights, IDs, legacy fields</summary>
     <div class="fgrid fg3" style="margin-top:10px">${ins.filter(c=>!PD_COLS.includes(c.col)).map(c=>fieldHtml("Projects",c,r,pchg.has(c.col))).join("")}</div></details></div>
   ${benSection(r,pid)}${e2eProjectSection(pid)}<p style="text-align:right;margin:14px 0"><button class="linkdanger" id="wsDel">Delete this project…</button></p><datalist id="dlPeople">${listFromName("L_People").map(o=>`<option value="${esc(o)}">`).join("")}</datalist>`;
  bindPview(m);$("#wsBack").onclick=()=>{UI.proj=null;UI.wsOpen=false;render()};
  $("#wsDet").ontoggle=e=>{if(e.target.id==="wsDet")UI.wsOpen=e.target.open};$("#wsMore").ontoggle=e=>{e.stopPropagation();UI.wsMore=e.target.open};
  $("#wsGantt").onclick=()=>{if(pid){UI.gantt.proj=pid;UI.gantt.open.add(pid);UI.gantt.level="tasks";UI.gantt.bu=UI.gantt.cf=UI.gantt.proc=""}view="Gantt";UI.gantt._scrolled=false;render()};
  $("#wsDel").onclick=()=>askDelete("Projects",r);
  if($("#wsRp"))$("#wsRp").onclick=()=>addNew("RAIDD",()=>({[FD.type]:"Re-plan",[FD.pid]:pid,[FD.desc]:"Re-plan: extend project timeline — reason: ",[FD.status]:"Open",[FD.rpok]:"N",[FD.raised]:TODAY}));
  if($("#wsStd"))$("#wsStd").onclick=()=>{genStdPlan(r);wsRerender();toast("Standard tasks added — rename them and adjust dates as needed")};
  for(const c of ins){const el=document.getElementById("fld_"+c.col);if(!el||el.readOnly)continue;el.dataset.k="p_"+c.col;
    el.addEventListener("change",()=>{const nv=readField(c,el);const ov=gv("Projects",c.col,r);if(String(nv)===String(ov))return;const oldId=pId(r),wasAg=gv("Projects",FP.meth,r)==="Agile";
      try{setCell("Projects",c.col,r,nv)}catch(e){toast(e.message,5000);return}
      if([FP.init,FP.bu,FP.cf,FP.name,"AE"].includes(c.col)){refreshNewId("Projects",r);cascadePid(oldId,pId(r))}
      if(c.col===FP.meth&&(gv("Projects",FP.meth,r)==="Agile")!==wasAg)remapStages(r,wasAg);
      setTimeout(wsRerender,0)})}
  m.querySelectorAll("[data-addt]").forEach(b=>b.onclick=()=>{const x=addTask(r,b.dataset.addt);if(x==null)return;wsRerender();const el=document.querySelector(`[data-k="t${x}_${FA.task}"]`);if(el){el.focus();el.select()}});
  m.querySelectorAll(".ttab [data-r]").forEach(el=>el.addEventListener("change",()=>{const x=+el.dataset.r,c=el.dataset.c,t=el.dataset.t;let v=el.value;
    v=v===""?"":t==="date"?serialFromIso(v):t==="pct"?Math.max(0,Math.min(100,+v))/100:v.trim();if(c===FA.task&&v===""){toast("Task name can't be empty — use 🗑 to delete the task");el.value=gv("Activities",c,x);return}
    if(String(v)===String(gv("Activities",c,x)))return;try{setCell("Activities",c,x,v)}catch(e){toast(e.message,5000);return}setTimeout(wsRerender,0)}));
  m.querySelectorAll("[data-delt]").forEach(b=>b.onclick=()=>askDelete("Activities",+b.dataset.delt));bindBen(m,r);
  m.querySelectorAll("[data-more]").forEach(b=>b.onclick=()=>openEditor("Activities",+b.dataset.more));e2eBindProjectSection(m,pid);
  m.querySelectorAll("[data-tv]").forEach(b=>b.onclick=()=>{UI.wsTV=b.dataset.tv;wsRerender()});m.querySelectorAll("[data-gz]").forEach(b=>b.onclick=()=>{UI.wsZoom=b.dataset.gz;UI.wsScrolled=false;wsRerender()});
  wsGanttBind(m,r);
}

/* ---------------- benefits inside the project workspace ---------------- */
function benOf(pid){return rowsOf("Benefits").filter(x=>gv("Benefits",FB.pid,x)===pid)}
function benLive(r){const rate=+setting("S_Rate")||0;const n=c=>+gv("Benefits",c,r)||0;const one=gv("Benefits",FB.nature,r)==="One-off";
  const annual=!one&&gv("Benefits",FB.basis,r)==="Annual";const hard=n(FB.ca)+n(FB.cr)+n(FB.rg);
  const trv=n(FB.trh)*(gv("Benefits",FB.rate,r)===""?rate:n(FB.rate));const gm=hard/(annual?12:1)+trv;const vtype=hard>0?(n(FB.trh)>0?"THB + time saving":"THB (hard)"):n(FB.trh)>0?"Time saving only":"No value yet";const gross=one?gm:gm*12;const net=gross-n("T");
const ccf=(()=>{const a=listFromName("L_Conf"),b=listFromName("L_ConfF");const i=a.indexOf(gv("Benefits",FB.conf,r));return i>=0&&b[i]!==undefined?+b[i]:1})();
  return {one,annual,trv,gross,net,radj:gv("Benefits",FB.conf,r)===""?null:net*ccf,vtype,custom:gv("Benefits",FB.phase,r)==="Custom",drop:gv("Benefits",FB.bstat,r)==="Dropped"}}
function projBen(pid){const rs=benOf(pid);let rec=0,one=0,hard=0;rs.forEach(r=>{const b=benLive(r);if(b.drop)return;if(b.one)one+=b.gross;else rec+=b.gross;if(b.vtype.startsWith("THB"))hard++});
  return {n:rs.length,rec,one,hard,flag:!rs.length?"none":(rec+one)<=0?"zero":!hard?"time":""}}
const BFLAG={none:"⚑ No benefit plan",zero:"⚑ Benefit value = 0",time:"⏱ Time saving only (no THB driver)"};
function benFlag(pid,small){const b=projBen(pid);if(!b.flag)return "";const tt={none:"No business benefit line linked to this project yet",zero:"Benefit lines exist but their value is 0",time:"Value comes only from hours saved × hourly rate — no Cost Avoidance / Cost Reduction / Revenue Growth in THB yet"}[b.flag];
  return `<span class="bflag ${b.flag==="time"?"tflag":""}" title="${tt}">${BFLAG[b.flag]}</span>`}
const BCOLS1=[{c:"desc",h:"Benefit description",t:"text",w:300},{c:"nature",h:"Nature",t:"list",l:"L_Nature",w:110},{c:"basis",h:"Driver input",t:"list",l:"L_Basis",w:100},{c:"phase",h:"Plan phasing",t:"list",l:"L_Phase",w:105},{c:"line",h:"SG&A cost line",t:"list",l:"L_Line",w:170},{c:"conf",h:"Confidence",t:"list",l:"L_Conf",w:100},{c:"bstat",h:"Benefit status",t:"list",l:"L_BStat",w:120},{c:"start",h:"Realisation start",t:"date"},{c:"ramp",h:"Ramp-up (months)",t:"num",w:80}];
const BCOLS2=[{c:"ca",h:"Cost avoidance",t:"num",w:110},{c:"cr",h:"Cost reduction",t:"num",w:110},{c:"rg",h:"Revenue growth",t:"num",w:110},{c:"trh",h:"Time saved (hrs/mo)",t:"num",w:90},{c:"rate",h:"Rate (THB/hr)",t:"num",w:90},{c:"run",h:"Run cost (yr)",t:"num",w:100},{c:"oneoff",h:"One-off cost",t:"num",w:100}];
function bInput(r,col){const c=col.c==="run"?"T":col.c==="oneoff"?"V":FB[col.c],v=gv("Benefits",c,r),id=`b${r}_${c}`;
  if(col.t==="list")return `<div style="width:${col.w}px">${comboHtml(id,v,listFromName(col.l).map(x=>({v:String(x),t:String(x)})),{strict:true})}</div>`.replace(`data-combo="${id}"`,`data-combo="${id}" data-bc="${c}" data-r="${r}" data-t="text" data-k="${id}"`);
  if(col.t==="date")return `<input type="date" data-bc="${c}" data-r="${r}" data-t="date" data-k="${id}" value="${typeof v==="number"?isoFromSerial(v):""}">`;
  if(col.t==="num")return `<input type="number" step="any" data-bc="${c}" data-r="${r}" data-t="num" data-k="${id}" value="${esc(v)}" style="width:${col.w}px"${col.c==="rate"?` placeholder="def. ${esc(setting("S_Rate"))}" title="Blank = default rate from Lists (S_Rate)"`:""}>`;
  return `<input data-bc="${c}" data-r="${r}" data-t="text" data-k="${id}" value="${esc(v)}" style="width:${col.w}px">`}
function benSection(pr,pid){if(!pid)return "";const rs=benOf(pid);const pb=projBen(pid);const chg=changedRows("Benefits");
  const BS=benefitSeries();const mths=BS.months;
  const cards=rs.map(r=>{const b=benLive(r);const isN=S.newRows.Benefits&&S.newRows.Benefits.has(r);const ser=BS.list.find(x=>x.r===r)||{};
    const autoM=(()=>{const fe=+((LIVE.proj[pid]||{}).fend)||0;if(!fe)return "";const d=serialToDate(fe);const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));return MON[n.getUTCMonth()]+"-"+String(n.getUTCFullYear()).slice(2)})();
    const vt={"THB (hard)":"vt-h","THB + time saving":"vt-h","Time saving only":"vt-t","No value yet":"vt-n"}[b.vtype];
    const cols1=BCOLS1.filter(c=>c.c!=="basis"||!b.one);
    const plan12=(ser.plan||[]).reduce((a,v)=>a+v,0);
    return `<div class="bcard${chg.has(r)?" changed":""}"><div class="bch"><span class="mono">${esc(bId(r))}</span>${isN?' <span class="badge-new">new</span>':""}
      <span class="vtype ${vt}" title="${b.vtype==="Time saving only"?"Value comes only from hours saved × hourly rate — not yet a THB cost/revenue driver":""}">${b.vtype==="Time saving only"?"⏱ ":b.vtype==="No value yet"?"⚑ ":""}${esc(b.vtype)}</span>
      ${b.custom?'<span class="estchip cust">✎ custom monthly plan</span>':gv("Benefits",FB.start,r)===""?`<span class="estchip auto" title="Standard: realisation starts the month after the project's forecast end and follows the project if it slips. Set a Realisation start to go faster.">◷ auto start${autoM?": "+autoM:" (needs project dates)"}</span>`:'<span class="estchip man">▶ start set manually</span>'}
      <span style="flex:1"></span>
      <span class="bval">Gross ${b.one?"one-off":"/ yr"} <b>${fmtNum(b.gross)}</b></span><span class="bval">Net <b>${fmtNum(b.net)}</b></span><span class="bval">Risk-adj. <b>${b.radj==null?"— (set confidence)":fmtNum(b.radj)}</b></span>
      <button class="btn small" data-bmore="${r}" title="All benefit fields (frequency, evidence…)">⋯</button><button class="btn small danger" data-bdel="${r}" title="Delete benefit line">🗑</button></div>
      <div class="bgrid">${cols1.map(c=>`<label><span>${c.c==="start"?`Realisation start <i class="muted">(blank = auto${autoM?" "+autoM:""})</i>`:c.h}</span>${bInput(r,c)}</label>`).join("")}</div>
      <div class="bgrid drv"><span class="muted drvh">Drivers → THB: ${b.one?"one-time total":b.annual?"per YEAR (divided equally by 12)":"per month"} · Time saved: hours per month, valued at the hourly rate</span>${BCOLS2.map(c=>`<label><span>${c.h}${b.annual&&["ca","cr","rg"].includes(c.c)?" / yr":""}</span>${bInput(r,c)}</label>`).join("")}</div>
      ${benCalcLine(r,b)}
      ${b.custom?customGrid(r,bId(r),mths,ser,b):""}
      ${trackGrid(r,bId(r),mths,ser)}</div>`}).join("");
  return `<div class="card pad" style="margin-top:14px" id="wsBen"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h2 style="margin:0">Business benefit plan</h2>
     ${pb.flag?benFlag(pid):`<span class="muted">${pb.n} line${pb.n>1?"s":""} · recurring <b>${fmtNum(pb.rec)}</b> THB/yr${pb.one?` · one-off <b>${fmtNum(pb.one)}</b> THB`:""}</span>`}
     ${(()=>{const L=BS.list.filter(x=>x.pid===pid&&!x.drop);const td=a=>mths.reduce((s,mm,i)=>s+(mm.s<=TODAY?(+a[i]||0):0),0);const P=L.reduce((s,x)=>s+td(x.plan),0),A=L.reduce((s,x)=>s+td(x.act),0);return L.length?`<span class="bpa">Realised to date <b>${fmtNum(A)}</b> of plan <b>${fmtNum(P)}</b> THB${P?` · <b>${Math.round(A/P*100)}%</b>`:""}</span>`:""})()}
     <span style="flex:1"></span><button class="btn new" id="wsAddBen">+ Add benefit line</button></div>
     ${rs.length?cards:`<div class="note warnnote">No business benefit planned yet — add at least one line (Cost Avoidance, Cost Reduction, Revenue Growth or Time Reduction). Until then the project is flagged <b>⚑ No benefit plan</b> in the project list.</div>`}
     <p class="muted" style="font-size:12px;margin:8px 0 0">Recurring = drivers per month (gross = ×12, plan ramps up from the start month). One-off = one-time total booked in the start month. Track the <b>actual</b> THB under each line's plan (Plan vs actual).</p></div>`}
function benCalcLine(r,b){const n=c=>+gv("Benefits",c,r)||0;const rateSet=gv("Benefits",FB.rate,r)!=="";const rate=rateSet?n(FB.rate):(+setting("S_Rate")||0);
  const hard=n(FB.ca)+n(FB.cr)+n(FB.rg);const hm=b.annual?hard/12:hard;const tv=n(FB.trh)*rate;const run=n("T");
  const confs=listFromName("L_Conf"),cf=listFromName("L_ConfF");const ci=confs.indexOf(gv("Benefits",FB.conf,r));const f=ci>=0&&cf[ci]!==undefined?+cf[ci]:1;
  const per=b.one?"":" × 12";
  return `<div class="bcalc"><b>How the value is calculated</b>
    <span>THB drivers ${b.one?"(one-time)":b.annual?"per month (annual ÷ 12)":"per month"}: <b>${fmtNum(hm)}</b>${hard?` <i class="muted">(CA ${fmtNum(n(FB.ca))} + CR ${fmtNum(n(FB.cr))} + RG ${fmtNum(n(FB.rg))}${b.annual?" ÷ 12":""})</i>`:""}</span>
    <span>+ Time saving: <b>${fmtNum(n(FB.trh))} h</b> × <b>${fmtNum(rate)}</b> THB/h${rateSet?"":` <i class="muted">(default rate, Lists → S_Rate)</i>`} = <b>${fmtNum(tv)}</b> THB${b.one?"":"/month"}</span>
    <span>= Gross ${b.one?"one-off":"/ yr"}: (${fmtNum(hm)} + ${fmtNum(tv)})${per} = <b>${fmtNum(b.gross)}</b></span>
    <span>Net = gross − run cost ${fmtNum(run)} = <b>${fmtNum(b.net)}</b></span>
    <span>Risk-adj. = ${ci<0?`<i class="muted">not calculated — set Confidence (no factor is assumed)</i>`:`net × confidence factor ${Math.round(f*100)}% = <b>${fmtNum(b.radj)}</b>`}</span>
    ${hm===0&&tv===0?`<span class="muted" style="width:100%">No value entered — plan is 0 (nothing assumed). ${esc(String(gv("Benefits","AJ",r)||""))}</span>`:""}</div>`}
/* plan (from the benefit plan) and actual (Realisation sheet) side by side, month by month */
function bindTrack(m,rer){
  m.querySelectorAll("[data-ra]").forEach(el=>el.addEventListener("change",()=>{if(el.readOnly)return;const bid=el.dataset.bid;let rr=realRow(bid);const v=el.value===""?"":+el.value;
    if(!rr){if(v==="")return;rr=firstFree("Realisation");if(!rr){toast("Realisation table is full — insert rows in Excel",5000);return}S.newRows.Realisation=S.newRows.Realisation||new Set();S.newRows.Realisation.add(rr);setCell("Realisation",FR.bid,rr,bid)}
    if(String(v)===String(gv("Realisation",el.dataset.ra,rr)))return;setCell("Realisation",el.dataset.ra,rr,v);renderTabs();setTimeout(rer,0)}));
  m.querySelectorAll("details[data-trk]").forEach(d=>d.addEventListener("toggle",()=>{UI.trkClosed=UI.trkClosed||new Set();d.open?UI.trkClosed.delete(d.dataset.trk):UI.trkClosed.add(d.dataset.trk)}));
  m.querySelectorAll("[data-trkall]").forEach(a=>a.onclick=e=>{e.preventDefault();UI.trkAll=UI.trkAll||new Set();const k=a.dataset.trkall;UI.trkAll.has(k)?UI.trkAll.delete(k):UI.trkAll.add(k);rer()});
  m.querySelectorAll("[data-radel]").forEach(b=>b.onclick=()=>askDelete("Realisation",+b.dataset.radel))}
function kTHB(v){const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(2)+"m":a>=1e4?(v/1e3).toFixed(1)+"k":fmtNum(Math.round(v))}
function realRow(bid){return rowsOf("Realisation").find(x=>gv("Realisation",FR.bid,x)===bid)}
function trackGrid(r,bid,months,ser){const rr=realRow(bid);const plan=ser.plan||months.map(()=>0);const act=j=>rr?gv("Realisation",months[j].col,rr):"";
  const pTD=months.reduce((a,mm,j)=>a+(mm.s<=TODAY?(+plan[j]||0):0),0),aTD=months.reduce((a,mm,j)=>a+(mm.s<=TODAY?(+act(j)||0):0),0);const pct=pTD?aTD/pTD:null;
  const curI=months.findIndex((mm,j)=>mm.s<=TODAY&&(j===months.length-1||months[j+1].s>TODAY));
  const first=plan.findIndex(v=>v);const firstA=months.findIndex((mm,j)=>act(j)!=="");const st=Math.max(0,Math.min(...[first,firstA,curI].filter(x=>x>=0)));
  const showAll=UI.trkAll&&UI.trkAll.has(bid);const from=showAll?0:Math.max(0,st-1);const to=showAll?months.length:Math.min(months.length,Math.max(curI+4,(first>=0?first:0)+13));
  const vis=months.map((mm,j)=>j).filter(j=>j>=from&&j<to);const yrs=[...new Set(vis.map(j=>months[j].h.slice(-4)))];
  const open=!UI.trkClosed||!UI.trkClosed.has(bid);
  return `<details class="trk"${open?" open":""} data-trk="${esc(bid)}"><summary><b>Plan vs actual</b> <span class="vtag plan">PLAN</span><span class="vtag act">ACTUAL</span>
    <span class="trks">To date: plan <b>${fmtNum(pTD)}</b> · actual <b>${fmtNum(aTD)}</b> THB · <b style="color:${pct==null?"#5B6573":pct>=.9?"#1E6B24":pct>=.6?"#B54708":"#B42318"}">${pct==null?"—":Math.round(pct*100)+"% of plan"}</b>${pTD-aTD>0?` · gap <b style="color:#B42318">${fmtNum(pTD-aTD)}</b>`:""}</span></summary>
    <p class="muted" style="font-size:12px;margin:4px 0 6px">Type the <b>actual THB realised</b> each month (not cumulative) under the plan. Saved to the Realisation sheet. ${showAll?`<a href="#" data-trkall="${esc(bid)}">Show fewer months</a>`:`<a href="#" data-trkall="${esc(bid)}">Show all ${months.length} months</a>`}</p>
    ${yrs.map(y=>{const js=vis.filter(j=>months[j].h.endsWith(y));const pad=js.length?MON.indexOf(months[js[0]].h.slice(0,3)):0;return `<div class="tky"><span class="cgyl">${y}</span>${'<span class="tkpad"></span>'.repeat(Math.max(0,pad))}${js.map(j=>{const mm=months[j];const a=act(j),pl=+plan[j]||0;const fut=mm.s>TODAY;const cls=a===""?"":pl&&(+a)<pl*0.9?"low":"ok";const ro=fut&&a==="";
      return `<label class="tkc${j===curI?" cur":""}${fut?" fut":""}"><span class="tkm">${mm.h.slice(0,3)}${j===curI?' <i>now</i>':""}</span><span class="tkp" title="Plan ${mm.h}: ${fmtNum(pl)} THB">${pl?kTHB(pl):"–"}</span><input type="number" step="any" data-ra="${mm.col}" data-bid="${esc(bid)}" data-k="ra${r}_${mm.col}" value="${esc(a)}" placeholder="${ro?"future":"actual"}" ${ro?'readonly title="Future month — actuals can be entered once the month starts"':""} class="${cls}" aria-label="Actual ${mm.h}"></label>`}).join("")}</div>`}).join("")}
    ${rr&&months.some((mm,j)=>act(j)!=="")?`<p style="text-align:right;margin:4px 0 0"><button type="button" class="linkdanger" data-radel="${rr}">Clear all actuals of this line…</button></p>`:""}</details>`}
function customGrid(r,bid,months,ser,b){if(!hasBP())return `<div class="note warnnote" style="margin-top:8px">This workbook has no Benefit_Plan sheet — open the latest tracker version to use a custom monthly plan.</div>`;
  const rs=bpRows(bid);const val=mm=>rs.reduce((a,x)=>a+(+gv("Benefit_Plan",mm.col,x)||0),0);const tot=months.reduce((a,mm)=>a+val(mm),0);
  const yrs=[...new Set(months.map(mm=>mm.h.slice(-4)))];
  return `<div class="cgrid"><div class="cgh"><b>Custom monthly plan (THB)</b><span class="muted">total <b>${fmtNum(tot)}</b> · standard gross ${b.one?"one-off":"per year"} ${fmtNum(b.gross)}${!b.one&&tot&&Math.abs(tot-b.gross)>1?` <span class="muted">(custom ≠ 12 × monthly — fine if intended)</span>`:""}</span><span style="flex:1"></span>
    <button class="btn small" data-cpstd="${r}" title="Fill the months with the standard phasing (net ÷ 12 with ramp-up from the start month)">Copy standard phasing</button><button class="btn small" data-cpeven="${r}" title="Spread the gross annual value equally over 12 months from the start month">Spread evenly (12 months)</button><button class="btn small" data-cpclr="${r}">Clear</button></div>
    ${yrs.map(y=>`<div class="cgy"><span class="cgyl">${y}</span>${months.filter(mm=>mm.h.endsWith(y)).map(mm=>`<label><span>${mm.h.slice(0,3)}</span><input type="number" step="any" data-cp="${mm.col}" data-bid="${esc(bid)}" data-k="cp${r}_${mm.col}" value="${val(mm)||""}"></label>`).join("")}</div>`).join("")}</div>`}
function bpRowFor(bid,create){let rs=bpRows(bid);if(rs.length)return rs[0];if(!create)return null;const r=firstFree("Benefit_Plan");if(!r){toast("No free rows left in the Benefit_Plan table",6000);return null}
  S.newRows.Benefit_Plan=S.newRows.Benefit_Plan||new Set();S.newRows.Benefit_Plan.add(r);setCell("Benefit_Plan","B",r,bid);return r}
function setCustomPlan(bid,months,vals){const x=bpRowFor(bid,true);if(!x)return;bpRows(bid).slice(1).forEach(y=>months.forEach(mm=>{if(gv("Benefit_Plan",mm.col,y)!=="")setCell("Benefit_Plan",mm.col,y,"")}));
  months.forEach((mm,i)=>{const v=vals[i]?Math.round(vals[i]*100)/100:"";if(String(gv("Benefit_Plan",mm.col,x))!==String(v))setCell("Benefit_Plan",mm.col,x,v)})}
function stdPhasing(r,months){const b=benLive(r);const pid=gv("Benefits",FB.pid,r);let st=+gv("Benefits",FB.start,r)||0;
  if(!st){const fe=+((LIVE.proj[pid]||{}).fend)||0;if(fe){const d=serialToDate(fe);st=dateToSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)))}}
  if(!st)return null;const d0=serialToDate(st);const sm=dateToSerial(new Date(Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth(),1)));const ramp=Math.max(1,+gv("Benefits",FB.ramp,r)||0);
  return {sm,vals:months.map(mm=>{if(b.one)return mm.s===sm?b.net:0;if(mm.s<sm)return 0;const a=serialToDate(mm.s),c=serialToDate(sm);const k=(a.getUTCFullYear()-c.getUTCFullYear())*12+a.getUTCMonth()-c.getUTCMonth()+1;return b.net/12*Math.min(1,k/ramp)})}}
function addBenefit(pr){const pid=pId(pr);if(!pid){toast("Enter the project name first");return null}const r=firstFree("Benefits");if(!r){toast("No free rows left in the Benefits table — insert more rows in Excel first",6000);return null}
  S.newRows.Benefits=S.newRows.Benefits||new Set();S.newRows.Benefits.add(r);setCell("Benefits",FB.pid,r,pid);setCell("Benefits",FB.desc,r,"New benefit");setCell("Benefits",FB.nature,r,"Recurring");
  if(listFromName("L_BStat").includes("Identified"))setCell("Benefits",FB.bstat,r,"Identified");refreshNewId("Benefits",r);return r}
function bindBen(m,pr){if($("#wsAddBen"))$("#wsAddBen").onclick=()=>{const x=addBenefit(pr);if(x==null)return;wsRerender();const el=document.querySelector(`[data-k="b${x}_${FB.desc}"]`);if(el){el.focus();el.select()}};
  m.querySelectorAll("[data-bc]").forEach(el=>el.addEventListener("change",()=>{const x=+el.dataset.r,c=el.dataset.bc,t=el.dataset.t;let v=el.value;
    v=v===""?"":t==="date"?serialFromIso(v):t==="num"?+v:v.trim();if(c===FB.desc&&v===""){toast("Description can't be empty — use 🗑 to delete the line");el.value=gv("Benefits",c,x);return}
    if(String(v)===String(gv("Benefits",c,x)))return;try{setCell("Benefits",c,x,v)}catch(e){toast(e.message,5000);return}setTimeout(wsRerender,0)}));
  m.querySelectorAll("[data-bdel]").forEach(b=>b.onclick=()=>askDelete("Benefits",+b.dataset.bdel));
  const months=realMonths();
  bindTrack(m,wsRerender);
  m.querySelectorAll("[data-cp]").forEach(el=>el.addEventListener("change",()=>{const bid=el.dataset.bid;const x=bpRowFor(bid,true);if(!x)return;const v=el.value===""?"":+el.value;
    bpRows(bid).slice(1).forEach(y=>{if(gv("Benefit_Plan",el.dataset.cp,y)!=="")setCell("Benefit_Plan",el.dataset.cp,y,"")});setCell("Benefit_Plan",el.dataset.cp,x,v);setTimeout(wsRerender,0)}));
  m.querySelectorAll("[data-cpstd]").forEach(b=>b.onclick=()=>{const r=+b.dataset.cpstd;const sp=stdPhasing(r,months);if(!sp){toast("Set a Realisation start month or project plan dates first");return}setCustomPlan(bId(r),months,sp.vals);wsRerender()});
  m.querySelectorAll("[data-cpeven]").forEach(b=>b.onclick=()=>{const r=+b.dataset.cpeven;const sp=stdPhasing(r,months);if(!sp){toast("Set a Realisation start month or project plan dates first");return}const bl=benLive(r);
    const i0=months.findIndex(mm=>mm.s===sp.sm);setCustomPlan(bId(r),months,months.map((mm,i)=>bl.one?(i===i0?bl.net:0):(i>=i0&&i<i0+12?bl.net/12:0)));wsRerender()});
  m.querySelectorAll("[data-cpclr]").forEach(b=>b.onclick=()=>{const r=+b.dataset.cpclr;if(!confirm("Clear the custom monthly plan for this line?"))return;setCustomPlan(bId(r),months,months.map(()=>0));wsRerender()});
  m.querySelectorAll("[data-bmore]").forEach(b=>b.onclick=()=>openEditor("Benefits",+b.dataset.bmore))}

