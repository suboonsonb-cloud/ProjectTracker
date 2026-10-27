/* 12-projects-list.js — Projects list (simple/table), filters, E2E bar, RAIDD panel, leaders */
"use strict";
/* =====================================================================================
   QUICK UPDATE — update many projects on one screen: progress %, phase, status override,
   plan dates, Done / Next steps / Issues. Edits are written into the input cells (tracked
   in Review changes) and stamp "Last Updated" with today. The table is NOT rebuilt after an
   edit — only the edited row's status / bar / planned % refresh — so focus, Tab order and
   scroll position are kept.
   ===================================================================================== */
UI.qu=UI.qu||{q:"",cf:"",proc:"",stOff:[],chg:false,edited:new Set(),open:new Set()};
const QU_PH=["A = Not Started","B = Get Requirement","C = Design","D = Develop and Test","E = Go Live"];
const quYearOK=s=>{if(!s)return true;const y=serialToDate(+s).getUTCFullYear();return y>=2000&&y<=2100};
function quStamp(pr){if(String(gv("Projects","AN",pr))!==String(TODAY))setCell("Projects","AN",pr,TODAY)}
/* planned % to date (same idea as Excel col AX): stage weights × elapsed share of each task's plan window */
function quPlanned(pr){const pid=pId(pr);const ts=tasksOfProject(pid);if(!ts.length)return "";const st=stagesOf(pr);const cus=["T","U","V","W","X","Y"].map(c=>+gv("Projects",c,pr)||0);const anyC=cus.some(x=>x>0);
  const live=t=>gv("Activities",FA.ovr,t)!=="Cancelled";const basis=st.names.map((sn,k)=>ts.some(t=>gv("Activities",FA.stage,t)===sn&&live(t))?(anyC?cus[k]:(st.w[k]||0)):0);const bs=basis.reduce((a,b)=>a+b,0);if(!bs)return "";
  let dated=false,p=0;st.names.forEach((sn,k)=>{if(!basis[k])return;const xs=ts.filter(t=>gv("Activities",FA.stage,t)===sn&&live(t));let s=0;
    for(const t of xs){const L=LIVE.task[t]||{};if(L.eps!==""&&L.epe!==""&&L.eps!=null)dated=true;s+=(L.el||0)/xs.length}p+=basis[k]/bs*s});return dated?p:""}
function quRespread(pr){const st=stagesOf(pr);for(const t of tasksOfProject(pId(pr))){const k=st.names.indexOf(gv("Activities",FA.stage,t));const w=k>=0?stdWindow(pr,k):null;if(!w)continue;
  if(+gv("Activities",FA.ps,t)!==w.s)setCell("Activities",FA.ps,t,w.s);if(+gv("Activities",FA.pe,t)!==w.e)setCell("Activities",FA.pe,t,w.e)}}
async function quSet(pr,k,v,el){
  if(k==="prog"){let p=parseFloat(String(v).replace("%",""));if(isNaN(p)){toast("Progress must be a number 0–100");return false}p=Math.max(0,Math.min(100,p))/100;
    const cur=Math.round(((LIVE.proj[pId(pr)]||{}).comp||0)*1000)/1000;if(Math.abs(cur-p)<0.0005)return false;
    if(!tasksOfProject(pId(pr)).length&&(!gv("Projects",FP.ps,pr)||!gv("Projects",FP.pe,pr)))toast("No plan dates yet — add Plan start / end so the status can be calculated.",6000);
    setProjectProgress(pr,p);quStamp(pr);return true}
  const col={ph:"AJ",ovr:FP.ovr,ps:FP.ps,pe:FP.pe,done:"AK",next:"AL",iss:"AM",q:"AI",wsl:FP.wsl,lead:FP.lead}[k];if(!col)return false;let val=k==="wsl"||k==="lead"?String(v||"").trim():v;
  if(k==="ps"||k==="pe"){
    if(el&&el.validity&&el.validity.badInput){toast("That date is incomplete — the plan date was not changed",5000);return false}
    val=v?serialFromIso(v):"";if(val!==""&&!quYearOK(val)){toast("Please enter a year between 2000 and 2100 — not changed",5000);return false}
    const ps=k==="ps"?val:(+gv("Projects",FP.ps,pr)||""),pe=k==="pe"?val:(+gv("Projects",FP.pe,pr)||"");
    if(ps!==""&&pe!==""&&pe<ps){toast("Plan end is before plan start — not changed",5000);return false}
    if(val===""&&gv("Projects",col,pr)!==""){const a=await choose("Clear this plan date?",`<p>Remove the plan ${k==="ps"?"start":"end"} of <b>${esc(gv("Projects",FP.name,pr))}</b>?</p>`,[["no","Keep it"],["yes","Clear","danger"]]);if(a!=="yes")return false}}
  if(String(gv("Projects",col,pr))===String(val??""))return false;setCell("Projects",col,pr,val);renderTabs();
  if(k==="pe"||k==="ps"){const ps=+gv("Projects",FP.ps,pr)||0,pe=+gv("Projects",FP.pe,pr)||0;const ts=tasksOfProject(pId(pr));
    if(ps&&pe&&ts.length){const undated=ts.every(t=>gv("Activities",FA.ps,t)===""&&gv("Activities",FA.pe,t)==="");
      if(undated)quRespread(pr);
      else{const a=await choose("Move the task plan too?",`<p>Status is calculated from the <b>task</b> dates. Spread the ${ts.length} tasks of <b>${esc(gv("Projects",FP.name,pr))}</b> over the new plan ${fmtDate(ps)} → ${fmtDate(pe)} (standard stage windows)?</p><p class="muted">Choose “Keep task dates” if the tasks already have a real plan.</p>`,[["keep","Keep task dates"],["yes","Re-spread tasks","primary"]]);
        if(a==="yes")quRespread(pr);else toast("Task dates kept — the status still follows the task dates",5000)}}}
  quStamp(pr);return true}
/* E2E index per project (cached for one render pass) */
let PE2E={t:0,v:null};
function projE2E(pid){const now=Date.now();if(!PE2E.v||now-PE2E.t>400){const o={};if(typeof hasE2E==="function"&&hasE2E())for(const f of e2eFlows())for(const ver of ["TO-BE","AS-IS"]){const d=f.v[ver]&&f.v[ver].doc;if(!d)continue;
    for(const sh of d.shapes||[])for(const id of sh.proj||[]){const x=o[id]=o[id]||{flows:[],lanes:[],steps:0,asis:0};if(!x.flows.some(q=>q.id===f.id))x.flows.push({id:f.id,name:f.name});const ln=laneOfShape(d,sh);if(ver==="TO-BE"){x.steps++;if(!x.lanes.includes(ln))x.lanes.push(ln)}else x.asis++}}
  PE2E={t:now,v:o}}return PE2E.v[pid]||{flows:[],lanes:[],steps:0,asis:0}}
const NOFLOW="(not mapped to an E2E flow)";
function e2eChip(pid,showNone){const x=projE2E(pid);if(!x.flows.length)return showNone?`<span class="pe2e none" title="Not linked to any E2E process step yet — link it on the E2E flows page">○ no E2E flow</span>`:"";
  return `<span class="pe2e" title="E2E: ${esc(x.flows.map(f=>f.name).join(", "))}${x.lanes.length?" · lanes: "+esc(x.lanes.join(", ")):""} · ${x.steps} TO-BE step(s)">⇄ ${esc(x.flows.map(f=>f.name).join(", "))}${x.steps?` · ${x.steps} step${x.steps>1?"s":""}`:""}</span>`}
function e2eFilterOpts(rows){const fl=new Map();let none=0;for(const r of rows){const x=projE2E(pId(r));if(!x.flows.length)none++;for(const f of x.flows)fl.set(f.id,f.name)}return {flows:[...fl].sort((a,b)=>a[1].localeCompare(b[1])),none}}
function passE2E(r,flow,lane){if(!flow)return true;const x=projE2E(pId(r));if(flow==="none")return !x.flows.length;if(!x.flows.some(f=>f.id===flow))return false;if(!lane)return true;
  const f=e2eFlows().find(q=>q.id===flow);const d=f&&f.v["TO-BE"]&&f.v["TO-BE"].doc;return !!d&&(d.shapes||[]).some(sh=>(sh.proj||[]).includes(pId(r))&&laneOfShape(d,sh)===lane)}
function laneOpts(flow){if(!flow||flow==="none")return [];const f=e2eFlows().find(q=>q.id===flow);const d=f&&f.v["TO-BE"]&&f.v["TO-BE"].doc;return d?(d.lanes||[]).map(l=>l.name):[]}
/* E2E process bar on the Projects page — one selection shared by the Simple and Table views */
function e2eBar(rows){const F=UI.qu;const EO=e2eFilterOpts(rows);if(F.flow&&F.flow!=="none"&&!EO.flows.some(([id])=>id===F.flow)){F.flow="";F.lane=""}const lanes=laneOpts(F.flow);if(F.lane&&!lanes.includes(F.lane))F.lane="";
  const cnt=id=>rows.filter(r=>passE2E(r,id,"")).length;const ch=(id,label,n,t)=>`<button type="button" class="e2ech${(F.flow||"")===id?" on":""}" data-e2ef="${esc(id)}" title="${esc(t||label)}">${esc(label)} <b>${n}</b></button>`;
  return `<div class="card e2ebar" role="group" aria-label="Filter by end-to-end process"><span class="e2ebl">⇄ E2E process</span>${ch("","All projects",rows.length)}${EO.flows.map(([id,n])=>ch(id,n,cnt(id),"Projects linked to steps of "+n)).join("")}${ch("none","Not mapped yet",EO.none,"Projects not linked to any E2E step")}
    ${lanes.length?`<span class="e2elrow"><span class="e2ebl2">Lane</span><span class="e2elanes">${["",...lanes].map(l=>`<button type="button" class="e2eln${(F.lane||"")===l?" on":""}" data-e2el="${esc(l)}">${esc(l||"All lanes")} <b>${rows.filter(r=>passE2E(r,F.flow,l)).length}</b></button>`).join("")}</span></span>`:""}</div>`}
function e2eBarBind(m,re){m.querySelectorAll("[data-e2ef]").forEach(b=>b.onclick=()=>{UI.qu.flow=b.dataset.e2ef;UI.qu.lane="";re()});m.querySelectorAll("[data-e2el]").forEach(b=>b.onclick=()=>{UI.qu.lane=b.dataset.e2el;re()})}
/* RAIDD lives inside the project now: count + side panel */
function raiddOf(pid){return rowsOf("RAIDD").filter(x=>gv("RAIDD",FD.pid,x)===pid&&(gv("RAIDD",FD.desc,x)!==""||gv("RAIDD",FD.type,x)!==""))}
function raiddBtn(pid){if(!pid)return "";const rs=raiddOf(pid);const open=rs.filter(x=>gv("RAIDD",FD.status,x)!=="Closed");const od=open.filter(x=>+gv("RAIDD",FD.due,x)&&+gv("RAIDD",FD.due,x)<TODAY&&gv("RAIDD",FD.type,x)!=="Re-plan").length;
  return `<button type="button" class="rdbtn${od?" od":open.length?" op":""}" data-rd="${esc(pid)}" title="Risks, assumptions, issues, dependencies, decisions & re-plans — ${open.length} open of ${rs.length}${od?" · "+od+" overdue":""}">⚑ ${rs.length?`${open.length} open${od?` · ${od} late`:""}`:"＋ RAIDD"}</button>`}
function dropEmptyRaidd(){/* an Add that was never filled in leaves nothing behind */
  for(const r of [...(S.newRows.RAIDD||[])]){if(gv("RAIDD",FD.desc,r)===""&&gv("RAIDD",FD.due,r)===""&&gv("RAIDD",FD.tid,r)===""&&gv("RAIDD","T",r)===""){clearRow("RAIDD",r);try{updateBadge();renderTabs()}catch(e){}}}}
function raiddPanel(pid){dropEmptyRaidd();const pr=projRowById(pid);UI.rdPid=pid;UI.sel=null;const rs=raiddOf(pid);const st=x=>gv("RAIDD",FD.status,x)||"Open";
  const ord=[...rs].sort((a,b)=>(st(a)==="Closed")-(st(b)==="Closed")||(+gv("RAIDD",FD.due,a)||9e9)-(+gv("RAIDD",FD.due,b)||9e9));
  const types=uniqOrder([...listFromName("L_RType"),"Risk","Issue","Action","Decision","Dependency","Re-plan"]).filter(Boolean);
  const card=x=>{const due=+gv("RAIDD",FD.due,x)||0;const late=due&&due<TODAY&&st(x)!=="Closed"&&gv("RAIDD",FD.type,x)!=="Re-plan";const ty=gv("RAIDD",FD.type,x)||"—";
    return `<button type="button" class="rdcard${st(x)==="Closed"?" closed":""}${late?" late":""}" data-rde="${x}"><span class="rdtop"><span class="rdty t-${esc(ty.replace(/[^A-Za-z]/g,""))}">${esc(ty)}</span><span class="muted mono">${esc(gv("RAIDD",FD.id,x)||"new")}</span><span style="flex:1"></span>${pill(st(x))}</span>
      <span class="rddesc">${esc(gv("RAIDD",FD.desc,x)||"(no description yet)")}</span>
      <span class="rdmeta">${gv("RAIDD",FD.tid,x)?`<span>Task ${esc(gv("RAIDD",FD.tid,x))}</span>`:""}<span>PIC ${esc(gv("RAIDD",FD.re,x)||(()=>{const t=gv("RAIDD",FD.tid,x);const a=t&&rowsOf("Activities").find(y=>tId(y)===t);return a?gv("Activities",FA.pic,a):""})()||gv("RAIDD",FD.pic,x)||"—")}</span><span class="${late?"rdlate":""}">Due ${due?fmtDate(due):"—"}${late?" · overdue":""}</span>${gv("RAIDD",FD.impact,x)?`<span>Impact ${esc(gv("RAIDD",FD.impact,x))}</span>`:""}${gv("RAIDD",FD.prio,x)?`<span>${esc(gv("RAIDD",FD.prio,x))}</span>`:""}</span></button>`};
  $("#dTitle").textContent=`RAIDD · ${pid}`;
  $("#dBody").innerHTML=`<div class="rdhead"><b>${esc(pr?gv("Projects",FP.name,pr):pid)}</b><div class="muted" style="font-size:12px">Risks · Assumptions · Issues · Dependencies · Decisions · Re-plans for this project. Pick the <b>Task</b> an item affects: an open item with a due date then moves that task's forecast (and the Gantt). An approved <b>Re-plan</b> moves the plan.</div></div>
    <div class="rdadd"><span class="muted">Add</span>${types.map(t=>`<button type="button" class="btn small" data-rdn="${esc(t)}">＋ ${esc(t)}</button>`).join("")}</div>
    <div class="rdlist">${ord.map(card).join("")||`<p class="muted">No RAIDD items yet — add one above.</p>`}</div>`;
  $("#dFoot").innerHTML=`${pr?`<button class="btn" id="rdOpenP">Open project ›</button>`:""}<span style="flex:1"></span><button class="btn primary" id="dDone">Done</button>`;
  $("#dDone").onclick=()=>{UI.rdPid=null;closeEditor()};if($("#rdOpenP"))$("#rdOpenP").onclick=()=>{UI.rdPid=null;openProject(pr)};
  $("#dBody").querySelectorAll("[data-rde]").forEach(b=>b.onclick=()=>openEditor("RAIDD",+b.dataset.rde));
  $("#dBody").querySelectorAll("[data-rdn]").forEach(b=>b.onclick=()=>{const t=b.dataset.rdn;addNew("RAIDD",()=>t==="Re-plan"?{[FD.type]:"Re-plan",[FD.pid]:pid,[FD.desc]:"Re-plan: extend project timeline — reason: ",[FD.status]:"Open",[FD.rpok]:"N",[FD.raised]:TODAY}:{[FD.type]:t,[FD.pid]:pid,[FD.status]:"Open",[FD.raised]:TODAY})});
  $("#drawer").classList.add("on");$("#scrim").classList.add("on")}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-rd]");if(!b)return;e.preventDefault();e.stopPropagation();raiddPanel(b.dataset.rd)},true);
/* who runs it: workstream leader › project lead (+ dev / BA team on hover) */
function leadLine(r){const w=gv("Projects",FP.wsl,r),l=gv("Projects",FP.lead,r),t=gv("Projects","AG",r);
  return `${w?`<span class="ppl" title="Workstream leader"><i>WS</i>${esc(w)}</span>`:""}<span class="ppl" title="Project lead${t?" · project team (dev / BA): "+esc(t):""}"><i>Lead</i>${esc(l||"not set")}${t?` <em>· team</em>`:""}</span>`}
function defaultWsl(r){return progCode(r)==="SIMP"&&gv("Projects",FP.cf,r)==="Shared Service Center"?"P Oh":""}
/* Projects tab (simple view): the important fields in one row; ▸ opens the rest under it */
/* benefit plan vs actual per project (cached for one render pass) */
let QBEN={t:0,v:null};
function benAgg(pid){const now=Date.now();if(!QBEN.v||now-QBEN.t>400){const BS=benefitSeries();const o={};const ms=BS.months;
    for(const b of BS.list){if(b.drop)continue;const x=o[b.pid]=o[b.pid]||{rec:0,one:0,ptd:0,atd:0,p12:0,n:0};x.n++;if(b.one)x.one+=b.gross;else x.rec+=b.gross;
      ms.forEach((mm,i)=>{if(mm.s<=TODAY){x.ptd+=+b.plan[i]||0;x.atd+=+b.act[i]||0}else if(mm.s<=TODAY+366)x.p12+=+b.plan[i]||0})}
    QBEN={t:now,v:o}}return QBEN.v[pid]||null}
/* quick "log actual" right in the row: pick one-off / every month, a month, drag the bar or type the amount */
function quLogLines(pid){const BS=benefitSeries();return {BS,lines:BS.list.filter(b=>b.pid===pid&&!b.drop)}}
function quLogHtml(r){const pid=pId(r);const st=UI.qu.log&&UI.qu.log[r];if(!st)return "";const {BS,lines}=quLogLines(pid);if(!lines.length)return "";
  const ln=lines.find(b=>b.id===st.line)||lines[0];st.line=ln.id;const ms=BS.months;const cur=ms.reduce((k,mm,i)=>mm.s<=TODAY?i:k,0);
  const from=Math.max(0,cur-17);if(st.mi==null||st.mi>cur)st.mi=cur;const mi=st.mi;
  const planM=+ln.plan[mi]||0,actM=+ln.act[mi]||0,refPlan=ln.one?Math.max(...ln.plan):Math.max(planM,...ln.plan.slice(0,cur+1));
  const amt=st.amt!=null?st.amt:(actM||Math.round(planM));const mx=Math.max(1000,Math.round((Math.max(refPlan,amt,actM)*2)/100)*100);
  const nMon=st.type==="mon"?cur-mi+1:1;
  return `<div class="qlog" data-qlog="${r}">
    ${lines.length>1?`<label class="qlrow"><span>Line</span><select data-ql="line">${lines.map(b=>`<option value="${esc(b.id)}" ${b.id===ln.id?"selected":""}>${esc(b.id)} · ${esc(String(b.desc||"").slice(0,28))}</option>`).join("")}</select></label>`:""}
    <div class="qlseg" role="radiogroup" aria-label="How the actual is realised"><button type="button" data-qlt="one" class="${st.type!=="mon"?"on":""}" aria-pressed="${st.type!=="mon"}">One-off</button><button type="button" data-qlt="mon" class="${st.type==="mon"?"on":""}" aria-pressed="${st.type==="mon"}">Every month</button></div>
    <label class="qlrow"><span>${st.type==="mon"?"From":"Month"}</span><select data-ql="mi">${ms.slice(from,cur+1).map((mm,j)=>`<option value="${from+j}" ${from+j===mi?"selected":""}>${mm.h}</option>`).reverse().join("")}</select>${st.type==="mon"?`<span class="muted">→ ${ms[cur].h} (${nMon} month${nMon>1?"s":""})</span>`:""}</label>
    <div class="qlamt"><input type="range" data-ql="rng" min="0" max="${mx}" step="${mx>20000?500:100}" value="${amt}" aria-label="Actual THB${st.type==="mon"?" per month":""}"><input type="number" data-ql="amt" min="0" step="any" value="${amt}" aria-label="Actual THB"><span class="muted">THB${st.type==="mon"?"/m":""}</span></div>
    <div class="qlvs"><span class="qlbar"><span class="pl" style="width:${Math.min(100,planM/mx*100)}%"></span><span class="ac" style="width:${Math.min(100,amt/mx*100)}%"></span></span><span class="muted">plan ${fmtShort(planM)} · now ${fmtShort(actM)}${ms[mi]?" in "+ms[mi].h:""}</span></div>
    <div class="qlbtns"><button type="button" class="btn small" data-qlx="${r}">Close</button><button type="button" class="btn small primary" data-qls="${r}">Save actual${nMon>1?` × ${nMon}`:""}</button></div></div>`}
function quLogSave(r){const pid=pId(r);const st=UI.qu.log[r];const {BS,lines}=quLogLines(pid);const ln=lines.find(b=>b.id===st.line)||lines[0];if(!ln)return 0;
  const ms=BS.months;const cur=ms.reduce((k,mm,i)=>mm.s<=TODAY?i:k,0);const v=Math.max(0,+st.amt||0);const idx=st.type==="mon"?Array.from({length:cur-st.mi+1},(_,j)=>st.mi+j):[st.mi];
  let rr=realRow(ln.id);if(!rr){rr=firstFree("Realisation");if(!rr){toast("Realisation table is full — insert rows in Excel",5000);return 0}S.newRows.Realisation=S.newRows.Realisation||new Set();S.newRows.Realisation.add(rr);setCell("Realisation",FR.bid,rr,ln.id)}
  let n=0;for(const i of idx){const col=ms[i].col;if(String(gv("Realisation",col,rr))!==String(v)){setCell("Realisation",col,rr,v||"");n++}}QBEN.v=null;return n}
function quBenCell(r){const pid=pId(r);const b=pid?benAgg(pid):null;if(!b)return `${benFlag(pid)||'<span class="muted">no benefit plan</span>'}<div><a href="#" data-qben="${r}" class="qbenadd">＋ add benefit</a></div>`;
  const pct=b.ptd?b.atd/b.ptd:null;const mx=Math.max(b.ptd,b.atd,1);
  return `<a href="#" data-qben="${r}" class="qbenlink" title="Open the project's benefit plan (plan vs actual by month)"><div class="qbplan"><span class="vtag plan">PLAN</span><b>${fmtShort(b.rec)}</b><span class="muted">/yr</span>${b.one?` <span class="muted">+ ${fmtShort(b.one)} one-off</span>`:""}</div>
    <div class="qbbar" aria-hidden="true"><span class="p" style="width:${b.ptd/mx*100}%"></span><span class="a" style="width:${b.atd/mx*100}%"></span></div>
    <div class="qbact"><span class="vtag act">ACTUAL</span>${b.ptd||b.atd?`<b>${fmtShort(b.atd)}</b> <span class="muted">of ${fmtShort(b.ptd)} to date</span> ${pct==null?"":`<b class="${pct>=.9?"good":pct>=.6?"mid":"bad"}">${Math.round(pct*100)}%</b>`}`:`<span class="muted">starts ${b.p12?"within 12 m":"later"}</span>`}</div></a>
    ${UI.qu.log&&UI.qu.log[r]?quLogHtml(r):(typeof canEdit!=="function"||canEdit()?`<button type="button" class="btn small qlogbtn" data-qlo="${r}">＋ Log actual</button>`:"")}`}
function quRowSimple(r){const L=pLive(r);const pc=Math.round((L.comp||0)*1000)/10;const pl=quPlanned(r);const F=UI.qu;const open=F.open.has(r);
  const inp=(k,v,type,extra="")=>`<input data-qu="${r}" data-k="q${r}_${k}" data-f="${k}" type="${type}" value="${esc(v)}" ${extra}>`;
  const behind=pl!==""&&(L.comp||0)+0.005<pl;const proc=gv("Projects",FP.proc,r);
  return `<tr data-row="${r}" class="${F.edited.has(r)?"changed":""} ${open?"qopen":""}">
    <td class="qx"><button type="button" class="qxb" data-qx="${r}" aria-expanded="${open}" aria-label="${open?"Hide":"Show"} details">${open?"▾":"▸"}</button></td>
    <td class="qn"><a href="#" data-op="${r}" title="Open the full project (tasks, benefits, risks)"><b>${esc(gv("Projects",FP.name,r)||"(no name yet)")}</b></a><div class="zid">${progChip(pId(r))}${proc?`<span class="parea">${esc(proc)}</span> `:""}${gv("Projects","AB",r)?`<span class="pteam" title="Division / team">${esc(gv("Projects","AB",r))}</span> `:""}${esc(pId(r))}${gv("Projects","Z",r)?` · old #${esc(gv("Projects","Z",r))}`:""}</div><div class="zppl">${e2eChip(pId(r))}</div>${F.edited.has(r)?`<span class="qed">edited</span>`:""}</td>
    <td class="qppl"><label><span title="Workstream leader">WS</span>${inp("wsl",gv("Projects",FP.wsl,r),"text",'list="quPeople" placeholder="—" aria-label="Workstream leader"')}</label><label><span title="Project lead (PIC)">Lead</span>${inp("lead",gv("Projects",FP.lead,r),"text",'list="quPeople" placeholder="—" aria-label="Project lead"')}</label>${gv("Projects","AG",r)?`<div class="qteam" title="Project team (developers / analysts)">Team: ${esc(gv("Projects","AG",r))}</div>`:""}</td>
    <td data-cell="st">${pill(pStat(r))}<div style="margin-top:4px">${raiddBtn(pId(r))}</div></td>
    <td class="num"><div class="qprog">${inp("prog",pc,"number",'min="0" max="100" step="5" inputmode="decimal" aria-label="Progress %"')}<span class="qbar"><span style="width:${Math.min(100,pc)}%"></span>${pl!==""?`<i style="left:${Math.min(100,pl*100)}%" title="planned to date"></i>`:""}</span></div>
      <div class="qbtn">${[0,25,50,75,100].map(x=>`<button type="button" class="btn small" data-qp="${r}" data-v="${x}" data-k="q${r}_b${x}">${x}</button>`).join("")}</div>
      <div class="qpl ${behind?"bad":""}">${pl===""?"no task dates":`plan ${Math.round(pl*100)}% today`}</div></td>
    <td class="qdates"><label><span>Start</span>${inp("ps",isoFromSerial(gv("Projects",FP.ps,r)),"date",'min="2000-01-01" max="2100-12-31" aria-label="Plan start"')}</label><label><span>End</span>${inp("pe",isoFromSerial(gv("Projects",FP.pe,r)),"date",'min="2000-01-01" max="2100-12-31" aria-label="Plan end"')}</label>
      <div class="dhint">${(()=>{const fe=+L.fend||0,pe=+gv("Projects",FP.pe,r)||0;if(!fe)return pe?"":"no dates";const d=pe?fe-pe:0;return `Forecast end <b class="${d>0?"late":""}">${fmtDate(fe)}</b>${d>0?` (+${d}d)`:""}`})()}</div></td>
    <td class="qben">${quBenCell(r)}</td>
    <td><textarea data-qu="${r}" data-k="q${r}_next" data-f="next" rows="2" aria-label="Next steps" placeholder="Next steps…">${esc(gv("Projects","AL",r))}</textarea></td>
    <td class="muted" data-cell="upd" style="white-space:nowrap">${fmtDate(gv("Projects","AN",r))}</td></tr>`}
function quDetHtml(r){const ovrs=listFromName("L_POvr");const phs=uniqOrder([...QU_PH,gv("Projects","AJ",r)].filter(Boolean));
  const inp=(k,v,type,extra="")=>`<input data-qu="${r}" data-k="q${r}_${k}" data-f="${k}" type="${type}" value="${esc(v)}" ${extra}>`;
  const ta=(k,v,ph)=>`<textarea data-qu="${r}" data-k="q${r}_${k}" data-f="${k}" rows="2" placeholder="${ph}">${esc(v)}</textarea>`;
  const nE2E=typeof hasE2E==="function"&&hasE2E()?e2eLinksOf(pId(r)).filter(x=>x.ver==="TO-BE").length:0;
  return `<tr class="qdet" data-det="${r}"><td></td><td colspan="8"><div class="qdgrid">
    <label>Target quarter${inp("q",gv("Projects","AI",r),"text",'placeholder="e.g. Q1 2027"')}</label>
    ${gv("Projects","AJ",r)?"":"<!--"}<label>Phase (legacy)<select data-qu="${r}" data-k="q${r}_ph" data-f="ph"><option value=""></option>${phs.map(x=>`<option ${x===gv("Projects","AJ",r)?"selected":""}>${esc(x)}</option>`).join("")}</select></label>${gv("Projects","AJ",r)?"":"-->"}
    <label>Status override<select data-qu="${r}" data-k="q${r}_ovr" data-f="ovr"><option value="">— (calculated)</option>${ovrs.map(x=>`<option ${x===gv("Projects",FP.ovr,r)?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
    <label class="w2">Last update — done${ta("done",gv("Projects","AK",r),"What was done…")}</label>
    <label class="w2">Issues / blockers${ta("iss",gv("Projects","AM",r),"Anything blocking?")}</label>
    <div class="qdfoot"><span class="muted">${esc(gv("Projects",FP.cf,r)||"")}${gv("Projects","AB",r)?" · team "+esc(gv("Projects","AB",r)):""} · ${nE2E?`${nE2E} TO-BE process step(s)`:"no E2E steps linked"}</span><span style="flex:1"></span><button class="btn small" data-op="${r}">Open full project ›</button></div>
  </div></td></tr>`}
function quRowHtml(r){if(UI.qu.simple)return quRowSimple(r);const L=pLive(r);const pc=Math.round((L.comp||0)*1000)/10;const pl=quPlanned(r);const ovrs=listFromName("L_POvr");const F=UI.qu;
  const phs=uniqOrder([...QU_PH,gv("Projects","AJ",r)].filter(Boolean));
  const inp=(k,v,type,extra="")=>`<input data-qu="${r}" data-k="q${r}_${k}" data-f="${k}" type="${type}" value="${esc(v)}" ${extra}>`;
  const ta=(k,v)=>`<textarea data-qu="${r}" data-k="q${r}_${k}" data-f="${k}" rows="2">${esc(v)}</textarea>`;
  const behind=pl!==""&&(L.comp||0)+0.005<pl;
  return `<tr data-row="${r}" class="${F.edited.has(r)?"changed":""}">
    <td class="qn"><a href="#" data-op="${r}"><b>${esc(gv("Projects",FP.name,r))}</b></a><div class="zid">${esc(pId(r))} · ${esc(gv("Projects",FP.proc,r)||"")}</div><div class="zppl">${leadLine(r)}${e2eChip(pId(r))}</div>${F.edited.has(r)?`<span class="qed">edited</span>`:""}</td>
    <td data-cell="st">${pill(pStat(r))}<div style="margin-top:4px">${raiddBtn(pId(r))}</div></td>
    <td class="num"><div class="qprog">${inp("prog",pc,"number",'min="0" max="100" step="5" inputmode="decimal"')}<span class="qbar"><span style="width:${Math.min(100,pc)}%"></span>${pl!==""?`<i style="left:${Math.min(100,pl*100)}%" title="planned to date"></i>`:""}</span></div>
      <div class="qbtn">${[0,25,50,75,100].map(x=>`<button type="button" class="btn small" data-qp="${r}" data-v="${x}" data-k="q${r}_b${x}">${x}</button>`).join("")}</div>
      <div class="qpl ${behind?"bad":""}">${pl===""?"no task dates":`planned ${Math.round(pl*100)}% to date`}</div></td>
    <td><select data-qu="${r}" data-k="q${r}_ph" data-f="ph"><option value=""></option>${phs.map(x=>`<option ${x===gv("Projects","AJ",r)?"selected":""}>${esc(x)}</option>`).join("")}</select></td>
    <td><select data-qu="${r}" data-k="q${r}_ovr" data-f="ovr"><option value="">— (calculated)</option>${ovrs.map(x=>`<option ${x===gv("Projects",FP.ovr,r)?"selected":""}>${esc(x)}</option>`).join("")}</select></td>
    <td>${inp("ps",isoFromSerial(gv("Projects",FP.ps,r)),"date",'min="2000-01-01" max="2100-12-31"')}</td><td>${inp("pe",isoFromSerial(gv("Projects",FP.pe,r)),"date",'min="2000-01-01" max="2100-12-31"')}</td>
    <td>${inp("q",gv("Projects","AI",r),"text",'style="width:80px"')}</td>
    <td>${ta("done",gv("Projects","AK",r))}</td><td>${ta("next",gv("Projects","AL",r))}</td><td>${ta("iss",gv("Projects","AM",r))}</td>
    <td class="muted" data-cell="upd" style="white-space:nowrap">${fmtDate(gv("Projects","AN",r))}</td></tr>`}
function quBindRow(m,tr){
  // value + validity are captured at the moment the box is left, so the edit survives even if the row refreshes meanwhile
  const commit=async(el,v,bad)=>{const r=+el.dataset.qu,f=el.dataset.f;if(el._busy)return;el._busy=true;let ok=false;
    try{ok=await quSet(r,f,v===undefined?el.value:v,{validity:{badInput:bad===undefined?!!(el.validity&&el.validity.badInput):bad}})}catch(e){toast(e.message,6000)}el._busy=false;quAfter(m,r,ok)};
  tr.querySelectorAll("[data-qu]").forEach(el=>{const f=el.dataset.f;
    if(el.tagName==="SELECT")el.onchange=()=>commit(el);
    else{el.onblur=()=>{const v=el.value,bad=!!(el.validity&&el.validity.badInput);const job={run:()=>{if(job.done)return;job.done=true;QU_BLUR.delete(job);return commit(el,v,bad)},r:+el.dataset.qu};QU_BLUR.add(job);setTimeout(job.run,0)};el.onkeydown=e=>{if(e.key==="Enter"&&el.tagName==="INPUT"){e.preventDefault();el.blur()}if(e.key==="Escape"){quReset(el);el.blur()}}}});
  tr.querySelectorAll("[data-qp]").forEach(b=>b.onclick=async()=>{const r=+b.dataset.qp;for(const j of [...QU_BLUR])await j.run();const ok=await quSet(r,"prog",b.dataset.v);const o=QU_PEND.get(r);QU_PEND.delete(r);QU_PTR=false;quAfter(m,r,ok||(o&&o.changed),b.dataset.k)});
  tr.querySelectorAll("[data-op]").forEach(a=>a.onclick=e=>{e.preventDefault();openProject(+a.dataset.op)});
  const reRow=r=>{const tr2=m.querySelector(`tr[data-row="${r}"]`);if(!tr2)return;const cell=tr2.querySelector("td.qben");if(cell){cell.innerHTML=quBenCell(r);quBindRow(m,tr2)}};
  tr.querySelectorAll("[data-qlo]").forEach(b=>b.onclick=()=>{const r=+b.dataset.qlo;UI.qu.log=UI.qu.log||{};UI.qu.log[r]={type:"one"};reRow(r)});
  tr.querySelectorAll("[data-qlog]").forEach(box=>{const r=+box.dataset.qlog,st=UI.qu.log[r];
    box.querySelectorAll("[data-qlt]").forEach(b=>b.onclick=()=>{st.type=b.dataset.qlt;reRow(r)});
    const q=k=>box.querySelector(`[data-ql="${k}"]`);
    if(q("line"))q("line").onchange=e=>{st.line=e.target.value;st.amt=null;reRow(r)};
    q("mi").onchange=e=>{st.mi=+e.target.value;st.amt=null;reRow(r)};
    const sync=(v,from)=>{st.amt=Math.max(0,+v||0);if(from!=="amt")q("amt").value=st.amt;if(from!=="rng")q("rng").value=st.amt;const bar=box.querySelector(".qlbar .ac");if(bar)bar.style.width=Math.min(100,st.amt/(+q("rng").max||1)*100)+"%"};
    q("rng").oninput=e=>sync(e.target.value,"rng");q("amt").oninput=e=>sync(e.target.value,"amt");q("amt").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();box.querySelector("[data-qls]").click()}};
    box.querySelector("[data-qlx]").onclick=()=>{delete UI.qu.log[r];reRow(r)};
    box.querySelector("[data-qls]").onclick=()=>{let n=0;try{n=quLogSave(r)}catch(e){toast(e.message,5000);return}delete UI.qu.log[r];quStamp(r);
      toast(n?`Actual saved — ${fmtNum(st.amt)} THB${st.type==="mon"?` in ${n} month(s)`:""}. Save to database to keep it.`:"Nothing changed",4500);quAfter(m,r,!!n)}});
  tr.querySelectorAll("[data-qx]").forEach(b=>b.onclick=async()=>{for(const j of [...QU_BLUR])await j.run();const r=+b.dataset.qx,F=UI.qu;if(F.open.has(r))F.open.delete(r);else F.open.add(r);const y=scrollY;vQuick($("#main"),true);window.scrollTo(0,y);const nb=document.querySelector(`[data-qx="${r}"]`);if(nb)nb.focus({preventScroll:true})})}
function quReset(el){const r=+el.dataset.qu,f=el.dataset.f;const v={prog:Math.round(((pLive(r).comp)||0)*1000)/10,ph:gv("Projects","AJ",r),ovr:gv("Projects",FP.ovr,r),ps:isoFromSerial(gv("Projects",FP.ps,r)),pe:isoFromSerial(gv("Projects",FP.pe,r)),done:gv("Projects","AK",r),next:gv("Projects","AL",r),iss:gv("Projects","AM",r),q:gv("Projects","AI",r),wsl:gv("Projects",FP.wsl,r),lead:gv("Projects",FP.lead,r)}[f];el.value=v??""}
let QU_PTR=false;const QU_PEND=new Map();const QU_BLUR=new Set();document.addEventListener("pointerdown",()=>{QU_PTR=true},true);
document.addEventListener("pointerup",()=>{setTimeout(()=>{QU_PTR=false;const p=[...QU_PEND];QU_PEND.clear();p.forEach(([r,o])=>quAfter(o.m,r,o.changed,o.focusKey))},40)},true);
function quAfter(m,r,changed,focusKey){if(changed)UI.qu.edited.add(r);
  // a button in this row may be mid-click: replacing the row now would swallow that click → wait for the click to finish
  if(QU_PTR){const o=QU_PEND.get(r);QU_PEND.set(r,{m,changed:changed||(o&&o.changed),focusKey:focusKey||(o&&o.focusKey)});return}
  liveCalc();
  const tr=m.querySelector(`tr[data-row="${r}"]`);if(!tr)return;
  // refresh this row only; keep whichever element now has focus (it may be in this row)
  const ae=document.activeElement;const k=focusKey||(ae&&ae.dataset?ae.dataset.k:null);const sel=ae&&ae.selectionStart!=null?[ae.selectionStart,ae.selectionEnd]:null;
  const wrap=m.querySelector(".tablewrap");const st=wrap?[wrap.scrollTop,wrap.scrollLeft]:null;
  if(!changed){tr.querySelectorAll("[data-qu]").forEach(el=>{if(el!==ae)quReset(el)});return}
  // update the row cell by cell; a cell holding the box the user is typing in is never replaced
  const tmp=document.createElement("tbody");tmp.innerHTML=quRowHtml(r);const nr=tmp.firstElementChild;
  tr.className=nr.className;const oc=[...tr.children],nc=[...nr.children];
  oc.forEach((td,i)=>{const keep=ae&&td.contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    if(!keep){td.replaceWith(nc[i]);return}
    // focused cell: refresh only the read-only bits (progress bar / planned text)
    for(const sel_ of [".qbar",".qpl"]){const a=td.querySelector(sel_),b=nc[i].querySelector(sel_);if(a&&b)a.replaceWith(b)}});
  quBindRow(m,tr);
  if(k&&!(ae&&tr.contains(ae)&&document.activeElement===ae)){const el=m.querySelector(`[data-k="${k}"]`);if(el&&document.activeElement!==el){el.focus({preventScroll:true});if(sel&&el.setSelectionRange)try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}
  if(wrap&&st){wrap.scrollTop=st[0];wrap.scrollLeft=st[1]}
  const c=m.querySelector("#quCount");if(c)c.textContent=quCountText();renderTabs()}
function quRows(){const F=UI.qu;const all=rowsOf("Projects").filter(r=>gv("Projects",FP.name,r)!=="");const fv=(r,c)=>gv("Projects",c,r)||"(blank)";
  const P1=all.filter(r=>!F.cf||fv(r,FP.cf)===F.cf);if(F.proc&&!P1.some(r=>fv(r,FP.proc)===F.proc))F.proc="";const P2a=P1.filter(r=>!F.proc||fv(r,FP.proc)===F.proc);if(F.team&&!P2a.some(r=>fv(r,"AB")===F.team))F.team="";const P2b=P2a.filter(r=>!F.team||fv(r,"AB")===F.team);if(F.flow&&F.flow!=="none"&&!e2eFlows().some(f=>f.id===F.flow)){F.flow="";F.lane=""}const P2=P2b.filter(r=>passE2E(r,F.flow,F.lane));const off=new Set(F.stOff||[]);const q=(F.q||"").toLowerCase();
  // rows edited in this session stay visible even if their status is now filtered out
  const rows=P2.filter(r=>(F.edited.has(r)||!off.has(pStat(r)))&&(!q||(pId(r)+" "+gv("Projects",FP.name,r)+" "+gv("Projects",FP.lead,r)+" "+gv("Projects",FP.wsl,r)+" "+gv("Projects","AG",r)+" "+gv("Projects","AB",r)+" "+gv("Projects","Z",r)).toLowerCase().includes(q))&&(!F.chg||F.edited.has(r)));
  return {all,P1,P2,P2a,P2b,rows,off}}
function quCountText(){const {all,rows}=quRows();return `${rows.length} of ${all.length} projects · ${UI.qu.edited.size} edited · ${netChanges().length} unsaved cell(s)`}
/* one filter card for the Projects page — Simple and Table views share it (and its state, UI.qu) */
function quFilterBar(){const F=UI.qu;const {all,P1,P2,P2a,P2b,off}=quRows();const fv=(r,c)=>gv("Projects",c,r)||"(blank)";
  const cfs=uniq(all.map(r=>fv(r,FP.cf)));const procs=uniq(P1.map(r=>fv(r,FP.proc)));const sts=off.size?STL.slice():STL.filter(s=>P2.some(r=>pStat(r)===s));
  return e2eBar(P2b)+`<div class="filterbar card dfilt rfilt"><b>Filter</b><input type="search" id="quQ" class="bq" placeholder="Search project / ID / leader…" value="${esc(F.q||"")}">
   <label>CF <select id="quCF"><option value="">All</option>${cfs.map(x=>`<option ${x===F.cf?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
   <label>Process area <select id="quProc"><option value="">All</option>${procs.map(x=>`<option ${x===F.proc?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
   <label>Division / team <select id="quTeam"><option value="">All</option>${uniq(P2a.map(r=>fv(r,"AB"))).map(x=>`<option ${x===F.team?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
   ${stChips(sts,off,s=>P2.filter(r=>pStat(r)===s).length,"qst")}
   <label><input type="checkbox" id="quChg" ${F.chg?"checked":""}> only edited</label>
   <span class="muted" id="quCount" style="margin-left:auto">${quCountText()}</span></div>`}
function quFilterBind(m,re){const F=UI.qu;const qi=$("#quQ");qi.oninput=()=>{F.q=qi.value;clearTimeout(quFilterBind._t);quFilterBind._t=setTimeout(()=>{re();const e2=$("#quQ");if(e2){e2.focus();e2.setSelectionRange(e2.value.length,e2.value.length)}},300)};
  $("#quCF").onchange=e=>{F.cf=e.target.value;F.proc="";F.team="";re()};$("#quProc").onchange=e=>{F.proc=e.target.value;F.team="";re()};$("#quTeam").onchange=e=>{F.team=e.target.value;re()};e2eBarBind(m,re);$("#quChg").onchange=e=>{F.chg=e.target.checked;re()};
  bindStChips(m,"qst",F,re)}
function vQuick(m,simple){const F=UI.qu;F.simple=!!simple;liveCalc();const {all,P1,P2,P2a,P2b,rows,off}=quRows();const EO=e2eFilterOpts(P2b);const lanes=laneOpts(F.flow);if(F.lane&&!lanes.includes(F.lane))F.lane="";const fv=(r,c)=>gv("Projects",c,r)||"(blank)";
  const cfs=uniq(all.map(r=>fv(r,FP.cf)));const procs=uniq(P1.map(r=>fv(r,FP.proc)));if(F.proc&&!procs.includes(F.proc))F.proc="";
  const sts=off.size?STL.slice():STL.filter(s=>P2.some(r=>pStat(r)===s));const re=()=>{const y=scrollY;vQuick(m,simple);window.scrollTo(0,y)};
  const head=simple?projHead(true)
   :`<div class="banner inp"><b>⚡ QUICK UPDATE</b><span>Update many projects on one screen. Type a new <b>Progress %</b> (or click 0 / 25 / 50 / 75 / 100) and the project's tasks are filled stage by stage. A box is saved into the workbook when you leave it (Tab / Enter / click elsewhere); <b>Esc</b> undoes the box you are in. Each change stamps <b>Last Updated</b> = today — check them in <b>Review changes</b>, then <b>Save to database</b>.</span></div>`;
  const thead=simple?`<tr><th class="qx"><button type="button" class="qxb" id="quAll" title="Open / close all">${F.open.size?"▾":"▸"}</button></th><th class="qn">Project</th><th>People</th><th>Status</th><th class="num">Progress %</th><th>Plan start → end</th><th>Benefit · plan vs actual</th><th>Next steps</th><th>Updated</th></tr>`
   :`<tr><th class="qn">Project</th><th>Status</th><th class="num">Progress %</th><th>Phase (legacy)</th><th>Override</th><th>Plan start</th><th>Plan end</th><th>Target Q</th><th>Last update — Done</th><th>Next steps</th><th>Issues / blockers</th><th>Updated</th></tr>`;
  m.innerHTML=head+quFilterBar()+`
  <div class="card tablewrap qwrap ${simple?"qsimple":""}"><table class="data qu"><thead>${thead}</thead><tbody>
  ${rows.map(r=>quRowHtml(r)+(simple&&F.open.has(r)?quDetHtml(r):"")).join("")||`<tr><td colspan="12" class="muted">No projects match the filters</td></tr>`}</tbody></table></div><datalist id="quPeople">${uniq([...listFromName("L_Leader"),..._rowsOf0Safe("Projects").flatMap(x=>[gv("Projects",FP.lead,x),gv("Projects",FP.wsl,x)])].filter(Boolean)).sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
  <p class="muted" style="font-size:12px">The blue bar is actual progress; the thin dark mark is where the plan says the project should be today. Status follows the <b>task</b> dates — when you change plan dates you are asked whether to move the task plan too.</p>`;
  quFilterBind(m,re);m.querySelectorAll("tr[data-row],tr.qdet").forEach(tr=>quBindRow(m,tr));
  if(simple){bindPview(m);$("#quNew").onclick=newProject;
    const qa=$("#quAll");if(qa)qa.onclick=()=>{if(F.open.size)F.open.clear();else rows.forEach(r=>F.open.add(r));re()}}}


document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("[data-qben]");if(!a)return;e.preventDefault();const r=+a.dataset.qben;openProject(r);setTimeout(()=>{const b=document.getElementById("wsBen");if(b)b.scrollIntoView({block:"start"})},60)});
