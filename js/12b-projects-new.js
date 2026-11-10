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
  m.querySelector("#plSt").onchange=e=>{F.st1=e.target.value;F.pg=1;re()};
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
  if(!w){const s=document.createElement("div");s.id="pdscrim";s.onclick=()=>pdClose();document.body.appendChild(s);w=document.createElement("aside");w.id="pdw";w.setAttribute("role","dialog");w.setAttribute("aria-label","Project details");document.body.appendChild(w);document.body.classList.add("pdon")}
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
  return `<div class="pdtop"><span class="eyb">PROJECT DETAILS</span><button type="button" class="pdx" aria-label="Close details">✕</button></div>
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
    ${sec("raidd","RAIDD",open.length?`${open.length} open · ${Object.entries(byT).map(([t,n])=>n+" "+t.toLowerCase()).join(", ")}`:"nothing open",`${open.slice(0,6).map(x=>`<div class="pdrd"><span class="t">${esc(gv("RAIDD",FD.type,x))}</span><span class="d">${esc(String(gv("RAIDD",FD.desc,x)||"").slice(0,120))}</span>${+gv("RAIDD",FD.due,x)?`<span class="muted">due ${fmtDate(gv("RAIDD",FD.due,x))}</span>`:""}</div>`).join("")}<button type="button" class="btn small" data-rd="${esc(pid)}">⚑ Open RAIDD (${rd.length})</button>`)}
    ${sec("tasks","Tasks",ts.length?`${ts.filter(t=>tStat(t)==="Completed").length}/${ts.length} done${lateT?" · "+lateT+" late":""}`:"none yet",quTasksHtml(r))}
    <div class="pde2e"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 13v2"/></svg></span><div><b>E2E flow map</b><span>${flows.length?esc(flows.map(f=>f.name).join(", "))+(x.lanes.length?" · "+esc(x.lanes.join(", ")):""):"Not mapped yet"}</span></div><span class="sp"></span>${flows.length?`<button type="button" class="btn small" data-pdmap="${esc(flows[0].id)}">View map</button>`:`<button type="button" class="btn small" data-pdfull>Link project</button>`}</div>
  </div>
  <div class="pdfoot"><nav class="pdnav" aria-label="Step through projects"><button type="button" data-pdgo="${ix-1}" ${ix<=0?"disabled":""} aria-label="Previous project">‹</button><span>${ix>=0?ix+1:"–"} / ${cur.length}</span><button type="button" data-pdgo="${ix+1}" ${ix<0||ix>=cur.length-1?"disabled":""} aria-label="Next project">›</button></nav><span class="sp"></span><button type="button" class="btn primary" data-pdfull>Open full project ›</button></div>`}
function pdBind(w,r){const pid=pId(r);w.querySelector(".pdx").onclick=()=>pdClose();
  w.onkeydown=e=>{if(e.key==="Escape"&&!/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||"")){e.preventDefault();pdClose()}};
  w.querySelectorAll("details.pdsec").forEach(d=>d.ontoggle=()=>{UI.qu.pdOpen=UI.qu.pdOpen||new Set();if(d.open)UI.qu.pdOpen.add(d.dataset.sec);else UI.qu.pdOpen.delete(d.dataset.sec)});
  quBindRow(document,w);
  w.querySelectorAll("[data-pdst]").forEach(el=>el.onchange=async()=>{const [kind,val]=el.value.split(/:(.*)/);if(!kind)return;const ov=gv("Projects",FP.ovr,r);let ok=false;
    if(kind==="ovr")ok=await quSet(r,"ovr",val);else if(ov)ok=await quSet(r,"ovr","");if(ok){liveCalc();UI.qu.edited.add(r)}
    UI.qu.pdOpen=UI.qu.pdOpen||new Set();UI.qu.pdOpen.add("tasks");UI.qu.tkMsg=r;UI.qu.tkWant=kind==="calc"?val:"";pdRender();const t=document.querySelector('#pdw [data-sec="tasks"]');if(t)t.scrollIntoView({block:"start",behavior:"smooth"});pdListRow(r)});
  w.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>raiddPanel(b.dataset.rd));
  w.querySelectorAll("[data-pdmap]").forEach(b=>b.onclick=()=>{pdClose();UI.e2e.home=false;UI.e2e.flow=b.dataset.pdmap;UI.e2e.ver="TO-BE";UI.e2e.focus=pid;view="E2E";render()});
  w.querySelectorAll("[data-pdfull]").forEach(b=>b.onclick=()=>{pdClose();openProject(r)});
  w.querySelectorAll("[data-pdgo]").forEach(b=>b.onclick=()=>{const {cur}=plFiltered();const n=cur[+b.dataset.pdgo];if(n!=null){const pg=Math.floor(+b.dataset.pdgo/PL_PAGE)+1;if(pg!==UI.qu.pg){UI.qu.pg=pg;UI.qu.pd=n;vPList($("#main"))}else pdOpen(n)}})}
/* keep the list row in step with edits made in the panel */
function pdListRow(r){const tr=document.querySelector(`tr[data-prow="${r}"]`);if(!tr)return;const st=pStat(r),L=pLive(r),pe=+gv("Projects",FP.pe,r)||0,late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(st);
  tr.children[0].innerHTML=`<b class="pnm">${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}</small>`;tr.children[1].innerHTML=plPill(st);tr.children[2].innerHTML=plBar((L.comp||0)*100,st);tr.children[3].textContent=plOwner(r);tr.children[4].textContent=plDate(pe);tr.children[4].className=late?"late":""}
