/* ===================== Projects — "New view": clean list + Project details side panel (r52) ===================== */
const PL_PAGE=10;
function plFiltered(){const F=UI.qu;const {all,P2,rows,off}=quRows();const T=F.ptab||"all";
  const attn=r=>["Delayed","At Risk"].includes(pStat(r));
  const st=F.st1||"";const base=rows.filter(r=>!st||pStat(r)===st);
  const tabs=[["all","All projects",base],["active","Active",base.filter(r=>!["Completed","Cancelled"].includes(pStat(r)))],["attn","Needs attention",base.filter(attn)],["done","Completed",base.filter(r=>pStat(r)==="Completed")]];
  const cur=(tabs.find(t=>t[0]===T)||tabs[0])[2];return {all,P2,tabs,cur,T}}
function plOwner(r){return gv("Projects",FP.lead,r)||gv("Projects",FP.wsl,r)||"—"}
function plDate(v){v=+v||0;if(!v)return "—";const d=new Date(isoFromSerial(v)+"T00:00:00");return d.toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}
function plPill(st){const c=SCOL[st]||"#98A2B3";const fg=st==="Not Started"||st==="Cancelled"?"#667085":c;return `<span class="spill" style="background:${c}1F;color:${fg}">${esc(st)}</span>`}
function plBar(pc,st){const col=st==="Completed"?"#5FA77A":st==="Delayed"?"#E0A15A":"#9D86F7";return `<span class="plbar"><i><b style="width:${Math.max(0,Math.min(100,pc))}%;background:${col}"></b></i><span>${Math.round(pc)}%</span></span>`}
function vPList(m){const F=UI.qu;liveCalc();const {all,tabs,cur,T}=plFiltered();const n=cur.length,pages=Math.max(1,Math.ceil(n/PL_PAGE));F.pg=Math.min(Math.max(1,F.pg||1),pages);
  const ro=typeof canEdit==="function"&&!canEdit();const from=(F.pg-1)*PL_PAGE,list=cur.slice(from,from+PL_PAGE);
  const sts=STL.filter(s=>all.some(r=>pStat(r)===s));const nf=[F.cf,F.proc,F.team,F.rd,F.flow].filter(Boolean).length;
  const fv=c=>uniq(all.map(r=>gv("Projects",c,r)).filter(Boolean)).sort();
  const pgBtns=(()=>{const out=[];const add=p=>out.push(`<button type="button" class="${p===F.pg?"on":""}" data-plpg="${p}" ${p===F.pg?'aria-current="page"':""}>${p}</button>`);
    const sh=new Set([1,pages,F.pg-1,F.pg,F.pg+1].filter(p=>p>=1&&p<=pages));let last=0;[...sh].sort((a,b)=>a-b).forEach(p=>{if(p-last>1)out.push('<span class="dots">…</span>');add(p);last=p});return out.join("")})();
  const flows=typeof hasE2E==="function"&&hasE2E()?e2eFlows():[];
  m.innerHTML=`<div class="plh"><div><h1>Projects</h1><p>The essentials up front. The details when you need them.</p></div><span class="sp"></span>${ro?"":`<button class="btn new big" id="quNew"><span aria-hidden="true">＋</span> New project</button>`}</div>
  <div class="plsw">${pviewToggle()}${plistToggle()}</div>
  ${flows.length?`<div class="plcon"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 13v2"/></svg></span><div><b>See how your projects connect</b><span>Explore end-to-end processes, lanes, and linked projects.</span></div><span class="sp"></span><button class="btn plcbtn" id="plE2E">Open E2E flow map</button></div>`:""}
  <div class="card pllist">
    <div class="pltool"><label class="plsearch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="plQ" placeholder="Search projects or project ID" value="${esc(F.q||"")}" aria-label="Search projects"></label>
      <label class="plsel"><span class="sr">Status</span><select id="plSt" aria-label="Status"><option value="">Status: All</option>${sts.map(s=>`<option value="${esc(s)}" ${F.st1===s?"selected":""}>${esc(s)}</option>`).join("")}</select></label>
      <label class="plsel"><span class="sr">Programme</span><select id="plProg" aria-label="Programme (project code)"${F.prog?' class="act"':""}><option value="">Programme: All</option>${PROGS.map(p=>`<option value="${esc(p)}" ${F.prog===p?"selected":""}>${esc(p==="SIMP"?"SIMP- Simplification":p==="2T"?"2T- 2T Club":"CR- Complexity Reduction")}</option>`).join("")}</select></label>
      <button type="button" class="btn plmore ${F.more?"on":""}" id="plMore" aria-expanded="${!!F.more}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg> More filters${nf?` <span class="nfb">${nf}</span>`:""}</button>
      ${nf||F.q||F.st1?`<button type="button" class="btn small" id="plClr">Clear</button>`:""}<span class="sp"></span><span class="muted plcnt">${n} project${n===1?"":"s"}</span></div>
    ${F.more?`<div class="plmorebox">
      <label>CF <select data-plf="cf"><option value="">All</option>${fv(FP.cf).map(x=>`<option ${x===F.cf?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
      <label>Process area <select data-plf="proc"><option value="">All</option>${fv(FP.proc).map(x=>`<option ${x===F.proc?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
      <label>Division / team <select data-plf="team"><option value="">All</option>${fv("AB").map(x=>`<option ${x===F.team?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
      <label>⚑ RAIDD <select data-plf="rd">${QU_RD.map(([k,t])=>`<option value="${k}" ${k===(F.rd||"")?"selected":""}>${esc(t)}</option>`).join("")}</select></label>
      ${flows.length?`<label>E2E flow <select data-plf="flow"><option value="">All</option><option value="none" ${F.flow==="none"?"selected":""}>Not mapped yet</option>${flows.map(f=>`<option value="${esc(f.id)}" ${F.flow===f.id?"selected":""}>${esc(f.name)}</option>`).join("")}</select></label>
        ${F.flow&&F.flow!=="none"?`<label>Lane <select data-plf="lane"><option value="">All</option>${laneOpts(F.flow).map(l=>`<option ${l===F.lane?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`:""}`:""}</div>`:""}
    <div class="pltabs" role="tablist">${tabs.map(([k,t,a])=>`<button type="button" role="tab" aria-selected="${k===T}" class="${k===T?"on":""}" data-pltab="${k}">${t} <span class="c">${a.length}</span></button>`).join("")}</div>
    <div class="pltw"><table class="pltbl"><thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Owner</th><th>Plan end</th><th aria-label="Open"></th></tr></thead>
    <tbody>${list.map(r=>{const st=pStat(r),L=pLive(r),pc=(L.comp||0)*100,pe=+gv("Projects",FP.pe,r)||0,late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(st);
      return `<tr data-prow="${r}" tabindex="0" class="${UI.qu.pd===r?"sel":""}"><td><b class="pnm">${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}</small></td><td>${plPill(st)}</td><td>${plBar(pc,st)}</td><td class="own">${esc(plOwner(r))}</td><td class="${late?"late":""}">${plDate(pe)}</td><td class="chv" aria-hidden="true">›</td></tr>`}).join("")||`<tr><td colspan="6" class="muted" style="text-align:center;padding:32px">No projects match.</td></tr>`}</tbody></table></div>
    <datalist id="quTeams">${uniq(_rowsOf0Safe("Projects").map(r=>String(gv("Projects","AB",r)||"").trim()).filter(Boolean)).sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="quPeople">${uniq([...listFromName("L_Leader"),..._rowsOf0Safe("Projects").flatMap(x=>[gv("Projects",FP.lead,x),gv("Projects",FP.wsl,x)])].filter(Boolean)).sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
    <div class="plfoot"><span class="muted">Showing ${n?from+1:0}–${Math.min(n,from+PL_PAGE)} of ${n} projects</span><span class="sp"></span><nav class="plpg" aria-label="Pages"><button type="button" data-plpg="${F.pg-1}" ${F.pg<=1?"disabled":""} aria-label="Previous page">‹</button>${pgBtns}<button type="button" data-plpg="${F.pg+1}" ${F.pg>=pages?"disabled":""} aria-label="Next page">›</button></nav></div>
  </div>`;
  bindPview(m);const re=()=>{vPList(m)};
  const nb=m.querySelector("#quNew");if(nb)nb.onclick=newProject;const e2=m.querySelector("#plE2E");if(e2)e2.onclick=()=>{UI.e2e.home=true;view="E2E";render()};
  const q=m.querySelector("#plQ");let tq;q.oninput=()=>{clearTimeout(tq);tq=setTimeout(()=>{F.q=q.value;F.pg=1;const p=q.selectionStart;re();const q2=m.querySelector("#plQ");q2.focus();try{q2.setSelectionRange(p,p)}catch(e){}},220)};
  m.querySelector("#plSt").onchange=e=>{F.st1=e.target.value;F.pg=1;re()};{const pp=m.querySelector("#plProg");if(pp)pp.onchange=e=>{F.prog=e.target.value;F.pg=1;re()}}
  m.querySelector("#plMore").onclick=()=>{F.more=!F.more;re()};const cl=m.querySelector("#plClr");if(cl)cl.onclick=()=>{F.cf=F.proc=F.team=F.rd=F.flow=F.lane=F.q=F.st1="";F.pg=1;re()};
  m.querySelectorAll("[data-plf]").forEach(s=>s.onchange=()=>{F[s.dataset.plf]=s.value;if(s.dataset.plf==="flow")F.lane="";F.pg=1;re()});
  m.querySelectorAll("[data-pltab]").forEach(b=>b.onclick=()=>{F.ptab=b.dataset.pltab;F.pg=1;re()});
  m.querySelectorAll("[data-plpg]").forEach(b=>b.onclick=()=>{F.pg=+b.dataset.plpg;re();m.querySelector(".pllist").scrollIntoView({block:"start",behavior:"smooth"})});
  m.querySelectorAll("[data-prow]").forEach(tr=>{const o=()=>pdOpen(+tr.dataset.prow);tr.onclick=o;tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();o()}}});
  if(F.pd!=null&&rowsOf("Projects").includes(F.pd))pdRender();else pdClose(true)}
/* ---------- Project details side panel ---------- */
function pdOpen(r){UI.qu.pd=r;document.querySelectorAll("tr[data-prow]").forEach(t=>t.classList.toggle("sel",+t.dataset.prow===r));pdRender(true)}
function pdClose(silent){UI.qu.pd=null;const w=document.getElementById("pdw"),s=document.getElementById("pdscrim");if(w)w.remove();if(s)s.remove();document.body.classList.remove("pdon");if(!silent)document.querySelectorAll("tr[data-prow].sel").forEach(t=>t.classList.remove("sel"))}
function pdRender(fresh){const r=UI.qu.pd;if(r==null)return;liveCalc();let w=document.getElementById("pdw");const keep=w?w.querySelector(".pdbody").scrollTop:0;
  const ae=document.activeElement,k=ae&&ae.dataset?ae.dataset.k:null;const sel=ae&&ae.selectionStart!=null?[ae.selectionStart,ae.selectionEnd]:null;
  if(!w){const s=document.createElement("div");s.id="pdscrim";s.onclick=()=>{if(!$("#drawer").classList.contains("on"))pdClose()};document.body.appendChild(s);w=document.createElement("aside");w.id="pdw";w.setAttribute("role","dialog");w.setAttribute("aria-label","Project details");document.body.appendChild(w);document.body.classList.add("pdon")}
  w.dataset.row=r;w.innerHTML=pdHtml(r);pdBind(w,r);const b=w.querySelector(".pdbody");if(!fresh)b.scrollTop=keep;
  if(k){const el=w.querySelector(`[data-k="${k}"]`);if(el){el.focus({preventScroll:true});if(sel&&el.setSelectionRange)try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}else if(fresh){const c=w.querySelector(".pdx");if(c)c.focus({preventScroll:true})}}
function pdHtml(r){const pid=pId(r),st=pStat(r),L=pLive(r),pc=(L.comp||0)*100,pl=quPlanned(r),pe=+gv("Projects",FP.pe,r)||0,ps=+gv("Projects",FP.ps,r)||0,fe=+L.fe||0;
  const ro=typeof canEdit==="function"&&!canEdit();const inp=(f,v,type,extra="")=>`<input data-qu="${r}" data-k="pd${r}_${f}" data-f="${f}" type="${type}" value="${esc(v)}" ${ro?"disabled":""} ${extra}>`;
  const ta=(f,v,ph)=>`<textarea data-qu="${r}" data-k="pd${r}_${f}" data-f="${f}" rows="3" placeholder="${esc(ph)}" ${ro?"disabled":""}>${esc(v)}</textarea>`;
  const {cur}=plFiltered();const ix=cur.indexOf(r);
  const rd=raiddOf(pid),open=rd.filter(x=>gv("RAIDD",FD.status,x)!=="Closed"&&gv("RAIDD",FD.type,x)!=="Re-plan");const byT={};open.forEach(x=>{const t=gv("RAIDD",FD.type,x)||"Item";byT[t]=(byT[t]||0)+1});
  const x=projE2E(pid),flows=x.flows;const B=quLogLines(pid).lines;const bPlan=B.reduce((a,b)=>a+(b.drop?0:b.gross||0),0);
  const ts=tasksOfProject(pid),lateT=ts.filter(t=>tStat(t)==="Delayed").length;
  const sec=(id,title,meta,body)=>`<details class="pdsec" data-sec="${id}" ${UI.qu.pdOpen&&UI.qu.pdOpen.has(id)?"open":""}><summary><span class="t">${title}</span><span class="m">${meta}</span><span class="cv" aria-hidden="true">⌄</span></summary><div class="pdin">${body}</div></details>`;
  const slip=fe&&pe?fe-pe:0;
  return `<div class="pdtop"><span class="eyb">PROJECT DETAILS · ${esc(pid||"")}</span>${CG_BTN}<button type="button" class="pdx" aria-label="Close details">✕</button></div>
  <div class="pdbody">
    <h2 class="pdt">${esc(gv("Projects",FP.name,r)||"(no name yet)")}</h2><div class="pdid">${esc(pid)}</div>
    <div class="pdtags">${ro?plPill(st):quStatSel(r).replace('data-qst=','data-pdst=')}<span class="ty">${esc(gv("Projects",FP.init,r)||"")}</span>${gv("Projects",FP.proc,r)?`<span class="ty">${esc(gv("Projects",FP.proc,r))}</span>`:""}</div>
    <div class="pdprog"><div class="row"><span>Progress</span>${ro?`<b>${Math.round(pc)}%</b>`:`<span class="pin"><input data-qu="${r}" data-k="pd${r}_prog" data-f="prog" type="number" min="0" max="100" step="1" value="${Math.round(pc*10)/10}" aria-label="Progress %"><b>%</b></span>`}</div>
      <i class="bar"><b style="width:${Math.min(100,pc)}%"></b><em style="left:${Math.min(100,pl||0)}%" title="Planned by today"></em></i>
      <div class="row2"><span class="muted">Planned by today: ${pl==null?"—":Math.round(pl)+"%"}</span>${ro?"":`<span class="qq">${[0,25,50,75,100].map(v=>`<button type="button" data-qp="${r}" data-v="${v}" data-k="pd${r}_p${v}">${v}</button>`).join("")}</span>`}</div></div>
    <div class="pdgrid"><div><span class="lb">Owner</span><b>${esc(plOwner(r))}</b></div><div><span class="lb">Plan end</span>${ro?`<b>${plDate(pe)}</b>`:inp("pe",pe?isoFromSerial(pe):"","date",'min="2000-01-01" max="2100-12-31" aria-label="Plan end"')}</div>
      <div><span class="lb">Plan start</span>${ro?`<b>${plDate(ps)}</b>`:inp("ps",ps?isoFromSerial(ps):"","date",'min="2000-01-01" max="2100-12-31" aria-label="Plan start"')}</div><div><span class="lb">Tasks</span><b>${ts.length}${lateT?` <small class="bad">· ${lateT} late</small>`:""}</b></div></div>
    ${fe?`<div class="pdfc ${slip>0?"late":""}">Forecast ${plDate(fe)}${slip>0?` · ${slip} days after plan`:slip<0?` · ${-slip} days early`:" · on plan"}</div>`:""}
    <div class="pdns"><div class="h"><b>Next steps</b><span class="muted">${+gv("Projects","AI",r)?"updated "+fmtDate(gv("Projects","AI",r)):""}</span></div>${ro?`<p>${esc(gv("Projects","AL",r)||"—")}</p>`:ta("next",gv("Projects","AL",r),"What happens next?")}</div>
    ${sec("upd","Update notes",gv("Projects","AM",r)?"⚠ issue noted":"done · issues",`<label class="pdl">Last update — done</label>${ta("done",gv("Projects","AK",r),"What was done…")}<label class="pdl">Issues / blockers</label>${ta("iss",gv("Projects","AM",r),"Anything blocking?")}`)}
    ${sec("ppl","People &amp; team",esc(gv("Projects","AB",r)||gv("Projects",FP.team,r)||""),`<div class="pdform"><label>Workstream leader ${inp("wsl",gv("Projects",FP.wsl,r),"text",'list="quPeople"')}</label><label>Project lead ${inp("lead",gv("Projects",FP.lead,r),"text",'list="quPeople"')}</label><label>Division / team ${inp("team",gv("Projects","AB",r),"text",'list="quTeams"')}</label><label>Project type <select data-qu="${r}" data-k="pd${r}_init" data-f="init" ${ro?"disabled":""}><option value="">—</option>${uniqOrder([...listFromName("L_Init"),gv("Projects",FP.init,r)].filter(Boolean)).map(v=>`<option ${v===gv("Projects",FP.init,r)?"selected":""}>${esc(v)}</option>`).join("")}</select></label></div>${gv("Projects",FP.team,r)?`<p class="muted" style="margin:6px 0 0;font-size:12px">Team: ${esc(gv("Projects",FP.team,r))}</p>`:""}`)}
    ${sec("ben","Benefits",B.length?fmtShort(bPlan)+" planned":"no benefit plan",`<div class="qben pdben">${quBenCell(r)}</div>`)}
    ${sec("raidd","RAIDD",open.length?`${open.length} open · ${Object.entries(byT).map(([t,n])=>n+" "+t.toLowerCase()).join(", ")}`:"nothing open",pdRaiddHtml(r,pid))}
    ${sec("tasks","Tasks",ts.length?`${ts.filter(t=>tStat(t)==="Completed").length}/${ts.length} done${lateT?" · "+lateT+" late":""}`:"none yet",pdTasksHtml(r))}
    <div class="pde2e"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 13v2"/></svg></span><div><b>E2E flow map</b><span>${flows.length?esc(flows.map(f=>f.name).join(", "))+(x.lanes.length?" · "+esc(x.lanes.join(", ")):""):"Not mapped yet"}</span></div><span class="sp"></span>${flows.length?`<button type="button" class="btn small" data-pdmap="${esc(flows[0].id)}">View map</button>`:`<button type="button" class="btn small" data-pdfull>Link project</button>`}</div>
  </div>
  <div class="pdfoot"><nav class="pdnav" aria-label="Step through projects"><button type="button" data-pdgo="${ix-1}" ${ix<=0?"disabled":""} aria-label="Previous project">‹</button><span>${ix>=0?ix+1:"–"} / ${cur.length}</span><button type="button" data-pdgo="${ix+1}" ${ix<0||ix>=cur.length-1?"disabled":""} aria-label="Next project">›</button></nav><span class="sp"></span><button type="button" class="btn primary" data-pdfull>Open full project ›</button></div>`}
function pdBind(w,r){const pid=pId(r);w.querySelector(".pdx").onclick=()=>pdClose();
  w.onkeydown=e=>{if(e.key==="Escape"&&!$("#drawer").classList.contains("on")&&!/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||"")){e.preventDefault();pdClose()}};
  w.querySelectorAll("details.pdsec").forEach(d=>d.ontoggle=()=>{UI.qu.pdOpen=UI.qu.pdOpen||new Set();if(d.open)UI.qu.pdOpen.add(d.dataset.sec);else UI.qu.pdOpen.delete(d.dataset.sec)});
  quBindRow(document,w);
  pdRaiddBind(w,r,pid);
  w.querySelectorAll("[data-pdst]").forEach(el=>el.onchange=async()=>{const [kind,val]=el.value.split(/:(.*)/);if(!kind)return;const ov=gv("Projects",FP.ovr,r);let ok=false;
    if(kind==="ovr")ok=await quSet(r,"ovr",val);else if(ov)ok=await quSet(r,"ovr","");if(ok){liveCalc();UI.qu.edited.add(r)}
    UI.qu.pdOpen=UI.qu.pdOpen||new Set();UI.qu.pdOpen.add("tasks");UI.qu.tkMsg=r;UI.qu.tkWant=kind==="calc"?val:"";pdRender();const t=document.querySelector('#pdw [data-sec="tasks"]');if(t)t.scrollIntoView({block:"start",behavior:"smooth"});pdListRow(r)});
  w.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>raiddPanel(b.dataset.rd));
  /* the details panel has its own Escape; let the RAIDD / edit drawer on top close first */
  w.querySelectorAll("[data-pdmap]").forEach(b=>b.onclick=()=>{pdClose();UI.e2e.home=false;UI.e2e.flow=b.dataset.pdmap;UI.e2e.ver="TO-BE";UI.e2e.focus=pid;view="E2E";render()});
  w.querySelectorAll("[data-pdfull]").forEach(b=>b.onclick=()=>{pdClose();openProject(r)});
  w.querySelectorAll("[data-pdgo]").forEach(b=>b.onclick=()=>{const {cur}=plFiltered();const n=cur[+b.dataset.pdgo];if(n!=null){const pg=Math.floor(+b.dataset.pdgo/PL_PAGE)+1;if(pg!==UI.qu.pg){UI.qu.pg=pg;UI.qu.pd=n;vPList($("#main"))}else pdOpen(n)}})}
/* keep the list row in step with edits made in the panel */
function pdListRow(r){const tr=document.querySelector(`tr[data-prow="${r}"]`);if(!tr)return;const st=pStat(r),L=pLive(r),pe=+gv("Projects",FP.pe,r)||0,late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(st);
  tr.children[0].innerHTML=`<b class="pnm">${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}</small>`;tr.children[1].innerHTML=plPill(st);tr.children[2].innerHTML=plBar((L.comp||0)*100,st);tr.children[3].textContent=plOwner(r);tr.children[4].textContent=plDate(pe);tr.children[4].className=late?"late":""}
/* r57 — Tasks in the details panel: one card per stage/task with Plan vs Actual (forecast) bars and a % done slider that saves right away */
function pdTasksHtml(r){const pid=pId(r);const ts=tasksOfProject(pid);if(!ts.length)return quTasksHtml(r);
  const msg=(quTasksHtml(r).match(/^<div class="qtk">(<div class="qtkmsg">[\s\S]*?<\/div>)/)||[])[1]||"";
  const tovr=listFromName("L_TOvr");
  const D=ts.map(t=>{const L=tLive(t)||{};return {t,ps:+gv("Activities",FA.ps,t)||0,pe:+gv("Activities",FA.pe,t)||0,fs:+L.fs||0,fe:+L.fe||0}});
  const all=D.flatMap(d=>[d.ps,d.pe,d.fs,d.fe]).filter(x=>x>0);let a=all.length?Math.min(...all):TODAY-30,b=all.length?Math.max(...all):TODAY+30;a=Math.min(a,TODAY);b=Math.max(b,TODAY)+1;const span=Math.max(1,b-a);
  const P=s=>((s-a)/span*100).toFixed(2)+"%",Wd=(s,e)=>(Math.max(0.6,(e+1-s)/span*100)).toFixed(2)+"%";
  const tdy=`<i class="pdtk-today" style="left:${P(TODAY)}"></i>`;
  return `<div class="qtk pdtks">${msg}<div class="pdtk-leg"><span><i class="pl"></i>Plan</span><span><i class="ac"></i>Actual / forecast (dark = % done)</span><span><i class="lt"></i>Late</span><span><i class="td"></i>Today</span><span class="pdtk-rng-l">${fmtDate(a)} – ${fmtDate(b-1)}</span></div>
  ${D.map(({t,ps,pe,fs,fe})=>{const pc=Math.round((+gv("Activities",FA.act,t)||0)*100);const st=tStat(t);const late=fe&&pe&&fe>pe?fe-pe:0;const done=st==="Completed"||pc>=100;
    const n=rowsOf("RAIDD").filter(x=>gv("RAIDD",FD.tid,x)===tId(t)&&gv("RAIDD",FD.type,x)!=="Re-plan"&&gv("RAIDD",FD.status,x)!=="Closed").length;
    return `<div class="pdtk${late&&!done?" late":""}${done?" done":""}">
      <div class="pdtk-h"><span class="pdtk-st">${esc(gv("Activities",FA.stage,t)||"Task")}</span><span class="pdtk-pic" title="PIC">${esc(gv("Activities",FA.pic,t)||"—")}</span>
        <select class="qts pdtk-sel st-${esc(st).replace(/\W/g,"")}" data-qts="${t}" data-r="${r}" aria-label="Task status"><option value="">${esc(gv("Activities",FA.ovr,t)?"Auto":st)}</option>${tovr.map(o=>`<option ${o===gv("Activities",FA.ovr,t)?"selected":""}>${esc(o)}</option>`).join("")}</select></div>
      <div class="pdtk-n">${esc(gv("Activities",FA.task,t))}</div>
      <div class="pdtk-row"><span class="lb">Plan</span><div class="trk">${ps&&pe?`<i class="pl" style="left:${P(ps)};width:${Wd(ps,pe)}"></i>`:""}${tdy}</div><span class="dt">${ps?fmtDate(ps):"—"} → ${pe?fmtDate(pe):"—"}</span></div>
      <div class="pdtk-row"><span class="lb">Actual</span><div class="trk">${fs&&fe?`<i class="ac" style="left:${P(fs)};width:${Wd(fs,fe)}"><b style="width:${pc}%"></b></i>`:""}${tdy}</div><span class="dt${late&&!done?" bad":""}">${fs?fmtDate(fs):"—"} → ${fe?fmtDate(fe):"—"}${late&&!done?` <em>+${late}d</em>`:""}</span></div>
      <div class="pdtk-p"><input type="range" class="pdtk-r" data-qtk="${t}" data-r="${r}" min="0" max="100" step="5" value="${pc}" style="--v:${pc}%" aria-label="% done"><output>${pc}%</output>
        <span class="pdtk-q">${[0,50,100].map(v=>`<button type="button" data-pdq="${v}" class="${pc===v?"on":""}">${v}</button>`).join("")}</span>
        <button type="button" class="btn small qdly${n?" on":""}" data-qdly="${t}" title="Say why this task is late and when it will be done — the forecast and the Gantt move">⚑ ${n?n+" open":"Late?"}</button></div>
    </div>`}).join("")}</div>`}
/* slider: show the value while dragging; quick buttons set it and save */
document.addEventListener("input",e=>{const el=e.target;if(!el.classList||!el.classList.contains("pdtk-r"))return;el.style.setProperty("--v",el.value+"%");const o=el.nextElementSibling;if(o)o.textContent=el.value+"%";
  const b=el.closest(".pdtk")&&el.closest(".pdtk").querySelector(".ac b");if(b)b.style.width=el.value+"%"});
document.addEventListener("click",e=>{const q=e.target.closest&&e.target.closest("[data-pdq]");if(!q)return;const el=q.closest(".pdtk-p").querySelector(".pdtk-r");if(!el)return;el.value=q.dataset.pdq;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))});
/* r57 — RAIDD filled in right here in the details panel (no second pop-up): edit open items in place, add new ones, Late? on a task pre-fills the form */
function pdRaiddHtml(r,pid){const ro=typeof canEdit==="function"&&!canEdit();const rd=raiddOf(pid);
  const lst=(n,fb)=>{const v=listFromName(n);return v&&v.length?v.map(String):fb};
  const TY=uniqOrder([...lst("L_RType",[]),"Risk","Issue","Action","Decision","Dependency","Re-plan"]).filter(Boolean),ST=lst("L_RStatus",["Open","In Progress","Closed"]),PR=lst("L_Priority",["High","Medium","Low"]),IM=lst("L_Impact",[]);
  const ts=tasksOfProject(pid);const stg=uniqOrder(ts.map(t=>gv("Activities",FA.stage,t)).filter(Boolean));
  /* attach to: whole project · a whole stage · one task */
  const tOpt=(v,sv)=>`<option value="">Whole project</option>${stg.map(st=>`<optgroup label="${esc(st)}"><option value="stg:${esc(st)}" ${sv===st?"selected":""}>▣ Whole ${esc(st)} stage</option>${ts.filter(t=>gv("Activities",FA.stage,t)===st).map(t=>`<option value="${esc(tId(t))}" ${!sv&&tId(t)===v?"selected":""}>↳ ${esc(gv("Activities",FA.task,t))}</option>`).join("")}</optgroup>`).join("")}`;
  const so=(a,v,blank)=>`${blank?`<option value="">${blank}</option>`:""}${a.map(o=>`<option ${o===String(v)?"selected":""}>${esc(o)}</option>`).join("")}`;
  const iso=v=>+v?isoFromSerial(+v):"";
  const open=rd.filter(x=>gv("RAIDD",FD.status,x)!=="Closed"),closed=rd.filter(x=>gv("RAIDD",FD.status,x)==="Closed");
  const item=x=>{const ty=gv("RAIDD",FD.type,x),due=+gv("RAIDD",FD.due,x)||0,od=due&&due<TODAY&&gv("RAIDD",FD.status,x)!=="Closed";const tid=gv("RAIDD",FD.tid,x);const tk=tid&&ts.find(t=>tId(t)===tid);
    if(ro)return `<div class="pdri"><div class="pdri-h"><span class="pdri-t t-${esc(ty).replace(/\W/g,"")}">${esc(ty||"Item")}</span><span class="muted">${pdStageOf(gv("RAIDD",FD.desc,x))?esc(pdStageOf(gv("RAIDD",FD.desc,x)))+" stage":tk?esc(gv("Activities",FA.task,tk)):"Whole project"}</span><span class="sp"></span>${due?`<span class="${od?"bad":"muted"}">due ${fmtDate(due)}</span>`:""}</div><div class="pdri-d">${esc(pdStageStrip(gv("RAIDD",FD.desc,x)))}</div></div>`;
    return `<div class="pdri${od?" od":""}" data-rdr="${x}"><div class="pdri-h"><select class="pdri-t t-${esc(ty).replace(/\W/g,"")}" data-rdf="${FD.type}" aria-label="Type">${so(TY,ty)}</select><select data-rdatt class="pdri-tk" aria-label="Attached to">${tOpt(tid,pdStageOf(gv("RAIDD",FD.desc,x)))}</select><span class="sp"></span><span class="pdri-id muted">${esc(gv("RAIDD",FD.id,x)||"new")}</span></div>
      <textarea data-rdf="${FD.desc}" rows="2" aria-label="Description">${esc(pdStageStrip(gv("RAIDD",FD.desc,x)))}</textarea>
      <div class="pdri-g"><label>Due<input type="date" data-rdf="${FD.due}" data-dt value="${iso(due)}"></label><label>Status<select data-rdf="${FD.status}">${so(ST,gv("RAIDD",FD.status,x))}</select></label><label>Priority<select data-rdf="${FD.prio}">${so(PR,gv("RAIDD",FD.prio,x),"—")}</select></label>${IM.length?`<label>Impact<select data-rdf="${FD.impact}">${so(IM,gv("RAIDD",FD.impact,x),"Blocks end")}</select></label>`:""}
      ${ty==="Re-plan"?`<label>New plan end<input type="date" data-rdf="${FD.rpend}" data-dt value="${iso(gv("RAIDD",FD.rpend,x))}"></label><label>Approved<select data-rdf="${FD.rpok}">${so(["N","Y"],gv("RAIDD",FD.rpok,x)||"N")}</select></label>`:""}
      <label class="w">Action / remark<input type="text" data-rdf="T" value="${esc(gv("RAIDD","T",x))}"></label></div>
      ${od?`<div class="pdri-od">Overdue ${TODAY-due}d — move the due date or close it</div>`:""}</div>`};
  const F=UI.qu.rdForm&&UI.qu.rdForm.r===r?UI.qu.rdForm:null;
  const form=ro?"":F?`<div class="pdrf"><div class="pdrf-h"><b>New RAIDD item</b><span class="sp"></span><button type="button" class="gx-link" data-rdcancel>Cancel</button></div>
      <div class="pdri-g"><label>Type<select id="rfT">${so(TY,F.type||"Issue")}</select></label><label class="w2">Attach to<select id="rfK">${tOpt(F.tid||"",F.stg||"")}</select></label></div>
      <label class="pdrf-l">Description<textarea id="rfD" rows="3" placeholder="What is the risk / issue / action? For a delay: the reason">${esc(F.desc||"")}</textarea></label>
      <div class="pdri-g"><label>Due date<input type="date" id="rfU" value="${F.due?isoFromSerial(F.due):""}"></label><label>Priority<select id="rfP">${so(PR,F.prio||"Medium","—")}</select></label><label>Owner / PIC<input type="text" id="rfO" placeholder="optional" value="${esc(F.pic||"")}"></label></div>
      ${F.tid?`<p class="pdrf-n">Tip: for a late task, the <b>Due date</b> = when it will now be done — the task forecast and the Gantt move to it.</p>`:""}
      <div class="pdrf-f"><button type="button" class="btn new" data-rdadd>＋ Add to RAIDD</button></div></div>`
    :`<button type="button" class="btn small pdr-new" data-rdnew>＋ Add RAIDD item</button>`;
  return `<div class="pdr">${form}${open.length?open.map(item).join(""):`<p class="muted" style="margin:6px 0">Nothing open.</p>`}
    ${closed.length?`<details class="pdr-cl"><summary>${closed.length} closed</summary>${closed.map(item).join("")}</details>`:""}
    <div class="pdr-f"><button type="button" class="gx-link" data-rd="${esc(pid)}">Open full RAIDD log ›</button></div></div>`}
function pdRaiddBind(w,r,pid){const keepOpen=()=>{UI.qu.pdOpen=UI.qu.pdOpen||new Set();UI.qu.pdOpen.add("raidd")};
  const done=()=>{quStamp(r);liveCalc();UI.qu.edited.add(r);keepOpen();pdRender();pdListRow(r)};
  w.querySelectorAll("[data-rdr] [data-rdf]").forEach(el=>el.onchange=()=>{const x=+el.closest("[data-rdr]").dataset.rdr,c=el.dataset.rdf;let v=el.value;if(el.hasAttribute("data-dt"))v=v?serialFromIso(v):"";
    if(c===FD.desc){if(!String(v).trim()){toast("Description can't be empty",4000);el.value=pdStageStrip(gv("RAIDD",FD.desc,x));return}const sg=pdStageOf(gv("RAIDD",FD.desc,x));if(sg)v=`[${sg} stage] `+v}
    if(String(v)===String(gv("RAIDD",c,x)))return;try{setCell("RAIDD",c,x,v)}catch(e){toast(e.message,5000);return}done()});
  w.querySelectorAll("[data-rdatt]").forEach(el=>el.onchange=()=>{const x=+el.closest("[data-rdr]").dataset.rdr;const a=pdAttach(pid,el.value);const d=pdStageStrip(gv("RAIDD",FD.desc,x));
    try{setCell("RAIDD",FD.tid,x,a.tid);setCell("RAIDD",FD.desc,x,(a.stg?`[${a.stg} stage] `:"")+d)}catch(e){toast(e.message,5000);return}done()});
  const nb=w.querySelector("[data-rdnew]");if(nb)nb.onclick=()=>{UI.qu.rdForm={r,type:"Issue"};keepOpen();pdRender();setTimeout(()=>{const d=document.querySelector("#pdw #rfD");if(d)d.focus()},50)};
  const cb=w.querySelector("[data-rdcancel]");if(cb)cb.onclick=()=>{UI.qu.rdForm=null;keepOpen();pdRender()};
  const ab=w.querySelector("[data-rdadd]");if(ab)ab.onclick=()=>{const v=id=>(w.querySelector(id)||{}).value||"";const desc=v("#rfD").trim();if(!desc){toast("Write a description first",4000);w.querySelector("#rfD").focus();return}
    const x=firstFree("RAIDD");if(!x){toast("No free rows left in the RAIDD table — insert more rows in Excel first",6000);return}
    S.newRows.RAIDD=S.newRows.RAIDD||new Set();S.newRows.RAIDD.add(x);
    const put=(c,val)=>{if(val!==""&&val!=null)setCell("RAIDD",c,x,val)};
    try{put(FD.type,v("#rfT"));put(FD.pid,pid);const at=pdAttach(pid,v("#rfK"));put(FD.tid,at.tid);put(FD.desc,(at.stg?`[${at.stg} stage] `:"")+desc);put(FD.status,"Open");put(FD.raised,TODAY);put(FD.due,v("#rfU")?serialFromIso(v("#rfU")):"");put(FD.prio,v("#rfP"));put(FD.re,v("#rfO").trim());if(v("#rfT")==="Re-plan")put(FD.rpok,"N")}catch(e){toast(e.message,5000);return}
    UI.qu.rdForm=null;toast("RAIDD item added — Save to database when you're done",4000);done()};
  /* Late? on a task: open the form here, pre-filled, instead of another pop-up */
  w.querySelectorAll("[data-qdly]").forEach(b=>b.onclick=e=>{e.stopPropagation();const t=+b.dataset.qdly;const tid=tId(t);
    const openIt=rowsOf("RAIDD").find(x=>gv("RAIDD",FD.tid,x)===tid&&gv("RAIDD",FD.type,x)!=="Re-plan"&&gv("RAIDD",FD.status,x)!=="Closed");keepOpen();
    if(openIt){UI.qu.rdForm=null;pdRender();const el=document.querySelector(`#pdw [data-rdr="${openIt}"]`);if(el){el.scrollIntoView({block:"center",behavior:"smooth"});el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),2000)}return}
    UI.qu.rdForm={r,type:"Issue",tid,desc:"Delay — reason: ",prio:"High"};pdRender();setTimeout(()=>{const d=document.querySelector("#pdw #rfD");if(d){d.closest(".pdrf").scrollIntoView({block:"center",behavior:"smooth"});d.focus();d.setSelectionRange(d.value.length,d.value.length)}},60)})}

/* a RAIDD item on a whole stage: Task ID = the stage's last-ending task (so its forecast moves the stage end) + "[Stage stage] " at the start of the description */
function pdStageOf(d){const m=/^\[(.+?) stage\] /.exec(String(d||""));return m?m[1]:""}
function pdStageStrip(d){return String(d||"").replace(/^\[(.+?) stage\] /,"")}
function pdAttach(pid,v){if(!v)return {tid:"",stg:""};if(!v.startsWith("stg:"))return {tid:v,stg:""};const st=v.slice(4);
  const ts=tasksOfProject(pid).filter(t=>gv("Activities",FA.stage,t)===st);const end=t=>+(tLive(t)||{}).fe||+gv("Activities",FA.pe,t)||0;
  const last=ts.sort((a,b)=>end(b)-end(a))[0];return {tid:last?tId(last):"",stg:st}}
