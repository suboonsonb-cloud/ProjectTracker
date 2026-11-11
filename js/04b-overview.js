/* 04b-overview.js — Overview organised around E2E workflow ▸ swimlane ▸ process (step) ▸ project,
   plus KPI cards, a clear "unmapped projects" action and two plain status / stage summaries. */
"use strict";
/* every flow with its lanes ▸ steps that carry projects, limited to the projects in view (pids) */
function ovFlows(pids){if(typeof hasE2E!=="function"||!hasE2E())return [];const out=[];
  for(const f of e2eFlows()){const ver=f.v["TO-BE"]&&f.v["TO-BE"].doc?"TO-BE":f.v["AS-IS"]&&f.v["AS-IS"].doc?"AS-IS":"";if(!ver)continue;
    const doc=f.v[ver].doc,flat=e2eFlat(doc);const lanes=(flat.lanes||[]).map(l=>({name:l.name,procs:[],pids:new Set()}));
    let steps=[];try{steps=stepOrder(doc)}catch(e){steps=(flat.shapes||[]).filter(isStep)}
    for(const sh of steps){const ps=(sh.proj||[]).filter(p=>pids.has(p));if(!ps.length)continue;const ln=laneOfShape(flat,sh)||"(no lane)";
      let L=lanes.find(x=>x.name===ln);if(!L){L={name:ln,procs:[],pids:new Set()};lanes.push(L)}L.procs.push({id:sh.id,title:stepTitle(sh),pids:ps});ps.forEach(p=>L.pids.add(p))}
    const all=new Set(lanes.flatMap(L=>[...L.pids]));out.push({f,ver,lanes,pids:all})}
  return out}
function ovStatusOf(rows){if(!rows.length)return ["Not mapped","nm"];const st=rows.map(pStat);if(st.every(s=>s==="Completed"||s==="Cancelled"))return ["Completed","ok"];
  if(st.every(s=>s==="Not Started"))return ["Not started","ns"];return ["In progress","ip"]}
function ovNewHtml(P,Bl){const pids=new Set(P.map(pId));const byId=new Map(P.map(r=>[pId(r),r]));const D=UI.dash;D.ovLane=D.ovLane||{};
  const ben=pid=>{const b=Bl.filter(x=>x.pid===pid&&!x.drop);return {yr:b.filter(x=>!x.one).reduce((a,x)=>a+x.gross,0),hrs:b.reduce((a,x)=>a+x.hrs,0)}};
  const FL=ovFlows(pids);const mapped=new Set(FL.flatMap(F=>[...F.pids]));const unm=P.filter(r=>!mapped.has(pId(r)));
  const delayed=P.filter(r=>pStat(r)==="Delayed").length;const mappedYr=[...mapped].reduce((a,p)=>a+ben(p).yr,0);
  const q=String(D.ovQ||"").trim().toLowerCase();const hit=s=>!q||String(s).toLowerCase().includes(q);
  const projHit=pid=>{const r=byId.get(pid);return r&&hit(pid+" "+gv("Projects",FP.name,r))};
  const FLs=FL.filter(F=>F.pids.size&&(hit(F.f.name)||F.lanes.some(L=>hit(L.name)||L.procs.some(p=>hit(p.title)))||[...F.pids].some(projHit)));
  if(D.ovOpen===undefined&&FLs.length)D.ovOpen=FLs[0].f.id;
  const kpi=(lab,val,sub,cls="")=>`<div class="card ovk2 ${cls}"><div class="lab">${lab}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  const pct=v=>Math.round(v*100);const bar=(v,cls="")=>`<span class="ovbar ${cls}"><b style="width:${Math.min(100,pct(v))}%"></b></span>`;
  const pill=s=>`<span class="ovst st-${esc(s).replace(/\W/g,"")}">${esc(s)}</span>`;
  const flowCard=F=>{const rows=[...F.pids].map(p=>byId.get(p)).filter(Boolean);const open=D.ovOpen===F.f.id;const [stT,stC]=ovStatusOf(rows);
    const prog=rows.length?rows.reduce((a,r)=>a+(pLive(r).comp||0),0)/rows.length:0;const yr=rows.reduce((a,r)=>a+ben(pId(r)).yr,0),hr=rows.reduce((a,r)=>a+ben(pId(r)).hrs,0);
    const nDel=rows.filter(r=>pStat(r)==="Delayed").length;const lanes=F.lanes.filter(L=>L.procs.length);
    let selL=D.ovLane[F.f.id];if(!lanes.some(L=>L.name===selL))selL=(lanes.find(L=>q&&(hit(L.name)||L.procs.some(p=>hit(p.title)||p.pids.some(projHit))))||lanes[0]||{}).name;
    const L=lanes.find(x=>x.name===selL);
    const projRow=pid=>{const r=byId.get(pid);if(!r)return "";const other=F.lanes.filter(x=>x.name!==selL&&x.pids.has(pid)).length;const c=pLive(r).comp||0;
      return `<button type="button" class="ovpr" data-ovopen="${r}"><span class="k">Project</span><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${esc(pid)}${gv("Projects","AB",r)?" · "+esc(gv("Projects","AB",r)):""}${other?` · Also supports ${other} lane${other>1?"s":""}`:""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span><span class="cv">›</span></button>`};
    return `<div class="card ovflow${open?" open":""}"><button type="button" class="ovfh" data-ovflow="${esc(F.f.id)}" aria-expanded="${open}">
      <span class="chev">${open?"⌄":"›"}</span><span class="nm"><b>${esc(F.f.name)}</b><small>${lanes.length} swimlane${lanes.length!==1?"s":""} · ${F.pids.size} unique project${F.pids.size!==1?"s":""}${F.ver==="AS-IS"?" · AS-IS map":""}</small></span>
      <span class="ovfst ${stC}">${stT}</span>${nDel?`<span class="ovfdl">${nDel} delayed</span>`:""}
      <span class="m pg"><small>Project progress</small><b>${pct(prog)}%</b>${bar(prog,stC==="ok"?"ok":"")}</span><span class="m"><small>Planned / year</small><b>${yr?"THB "+fmtShort(yr):"—"}</b></span><span class="m"><small>Planned time saved</small><b>${hr?fmtNum(Math.round(hr))+" h/mo":"—"}</b></span></button>
      ${open?`<div class="ovfb"><div class="ovlanes"><div class="cap">Swimlanes</div>${lanes.map(x=>`<button type="button" class="ovl${x.name===selL?" on":""}" data-ovlane="${esc(x.name)}" data-ovf="${esc(F.f.id)}"><span>${esc(x.name)}</span><b>${x.pids.size}</b><i>›</i></button>`).join("")||'<span class="muted">No steps linked yet</span>'}</div>
        <div class="ovproc">${L?`<div class="ovph"><b>${esc(L.name)}</b><span class="muted">${L.procs.length} process${L.procs.length!==1?"es":""} / ${L.pids.size} project${L.pids.size!==1?"s":""}</span><span class="sp"></span><span class="crumb">Workflow › Swimlane › Process › Project</span></div>
          ${L.procs.map((p,i)=>`<div class="ovpc${q&&(hit(p.title)||p.pids.some(projHit))?" hit":""}"><div class="ovpch"><div><small>Process ${String(i+1).padStart(2,"0")}</small><b>${esc(p.title)}</b></div><span class="muted">${p.pids.length} project${p.pids.length!==1?"s":""}</span></div>${p.pids.map(projRow).join("")}</div>`).join("")}`:""}</div></div>
        <div class="ovff"><span class="muted">Projects can support several swimlanes; workflow totals count each project once.</span><button type="button" class="ovlink" data-ovmap="${esc(F.f.id)}">View workflow details →</button></div>`:""}</div>`};
  /* project health */
  const tot=P.length||1;const stRows=STL.map(s=>({s,n:P.filter(r=>pStat(r)===s).length}));
  const openP=P.filter(r=>!["Completed","Cancelled"].includes(pStat(r)));const stg=[...listFromName("L_StageWF"),...listFromName("L_StageAG"),"(no tasks)","All complete"];
  const sg=uniqOrder(stg).map(s=>({s,n:openP.filter(r=>curStage(r)===s).length})).filter(x=>x.n);const smax=Math.max(1,...sg.map(x=>x.n));
  const top2=[...sg].sort((a,b)=>b.n-a.n).slice(0,2);
  return `  <div class="ovsec"><div><h2>E2E workflows</h2><p>Explore the business process first. Find projects where the work happens.</p></div><span class="sp"></span><label class="ovsrch"><input type="search" id="ovQ" placeholder="Search workflows or projects…" value="${esc(D.ovQ||"")}"></label></div>
  ${FLs.map(flowCard).join("")||`<div class="card pad muted">${FL.length?"Nothing matches the search.":"No E2E workflow is mapped yet — draw one under E2E flow maps and link its steps to projects."}</div>`}
  ${unm.length?(()=>{const SO={"Delayed":0,"At Risk":1,"On Track":2,"Not Started":3,"On-Hold":4,"Completed":5,"Cancelled":6};
    const fl=D.unmSt||"";const lst=unm.filter(r=>!fl||pStat(r)===fl).sort((a,b)=>(SO[pStat(a)]??9)-(SO[pStat(b)]??9)||String(gv("Projects",FP.name,a)).localeCompare(String(gv("Projects",FP.name,b))));
    const lim=D.unmAll?lst.length:10;const stc=STL.map(s=>[s,unm.filter(r=>pStat(r)===s).length]).filter(x=>x[1]);
    return `<div class="ovunm${D.unmOpen?" open":""}"><button type="button" class="ovunmh" id="ovUnmT" aria-expanded="${!!D.unmOpen}"><span class="chev">${D.unmOpen?"⌄":"›"}</span><div><b>${unm.length} project${unm.length>1?"s are":" is"} not mapped to a process yet</b><span>Assign them to an E2E workflow, swimlane and process to see their business impact.</span></div><span class="ovunmb">${D.unmOpen?"Hide list":"Show projects"}</span></button>
    ${D.unmOpen?`<div class="ovunmb2"><div class="ovunmf"><button type="button" data-unmst="" class="${fl?"":"on"}">All <b>${unm.length}</b></button>${stc.map(([s,n])=>`<button type="button" data-unmst="${esc(s)}" class="${fl===s?"on":""}"><i style="background:${SCOL[s]||"#888"}"></i>${esc(s)} <b>${n}</b></button>`).join("")}<span class="sp"></span><button type="button" class="ovlink" id="ovUnm">Open in Projects →</button></div>
      <div class="ovunml"><div class="ovunmhd"><span>Project</span><span>Status</span><span>Progress</span><span>Owner</span><span>Plan end</span><span></span></div>
      ${lst.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
        return `<button type="button" class="ovur" data-ovopen="${r}"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}${gv("Projects",FP.proc,r)?" · "+esc(gv("Projects",FP.proc,r)):""}${gv("Projects","AB",r)?" · "+esc(gv("Projects","AB",r)):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span><span class="ow">${esc(gv("Projects",FP.lead,r)||"—")}</span><span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")}</div>
      ${lst.length>10?`<button type="button" class="ovlink ovunmm" id="ovUnmAll">${D.unmAll?"Show fewer":`Show all ${lst.length}`}</button>`:""}</div>`:""}</div>`})():""}
  <div class="ovsec"><div><h2>Project health at a glance</h2><p>Portfolio-wide · includes mapped and unmapped projects</p></div></div>
  <div class="ovhl"><div class="card ovhc"><div class="hh"><b>Where projects stand</b><span class="muted">${P.length} total projects</span></div>
      ${stRows.map(x=>`<button type="button" class="ovhr" data-ovst="${esc(x.s)}" title="Show these projects"><span>${esc(x.s)}</span><span class="ovbar"><b style="width:${x.n/tot*100}%;background:${SCOL[x.s]||"#888"}"></b></span><b>${x.n}</b><small>${Math.round(x.n/tot*100)}%</small></button>`).join("")}
      ${delayed?`<p class="ft bad">${delayed} delayed project${delayed>1?"s":""} need${delayed>1?"":"s"} attention.</p>`:`<p class="ft">No delayed projects.</p>`}</div>
    <div class="card ovhc"><div class="hh"><b>Where open work is concentrated</b><span class="muted">${openP.length} open projects</span></div>
      ${sg.map(x=>`<div class="ovhr st"><span>${esc(x.s)}</span><span class="ovbar"><b style="width:${x.n/smax*100}%"></b></span><b>${x.n}</b><small></small></div>`).join("")||'<p class="muted">No open projects.</p>'}
      ${top2.length?`<p class="ft acc">${top2.reduce((a,x)=>a+x.n,0)} of ${openP.length} open projects are in ${top2.map(x=>esc(x.s)).join(" or ")}.</p>`:""}</div></div>
  <div class="ovnote"><span>Process groupings come from the E2E flow maps; project data follows the tracker.</span><span>Planned benefits are estimates, not realised savings.</span></div>`}
function ovNewBind(m){const D=UI.dash;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-ovflow]").forEach(b=>b.onclick=()=>{D.ovOpen=D.ovOpen===b.dataset.ovflow?"":b.dataset.ovflow;re()});
  m.querySelectorAll("[data-ovlane]").forEach(b=>b.onclick=()=>{D.ovLane[b.dataset.ovf]=b.dataset.ovlane;re()});
  const q=m.querySelector("#ovQ");if(q)q.oninput=()=>{clearTimeout(ovNewBind._t);ovNewBind._t=setTimeout(()=>{D.ovQ=q.value;D.ovOpen=undefined;re();const n=m.querySelector("#ovQ");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},300)};
  const ut=m.querySelector("#ovUnmT");if(ut)ut.onclick=()=>{D.unmOpen=!D.unmOpen;re()};
  m.querySelectorAll("[data-unmst]").forEach(b=>b.onclick=()=>{D.unmSt=b.dataset.unmst;D.unmAll=false;re()});
  const ua=m.querySelector("#ovUnmAll");if(ua)ua.onclick=()=>{D.unmAll=!D.unmAll;re()};
  m.querySelectorAll(".ovunm [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen));
  const u=m.querySelector("#ovUnm");if(u)u.onclick=()=>{UI.qu.flow="none";UI.qu.lane="";view="Projects";UI.pview="projects";render();window.scrollTo(0,0)};
  m.querySelectorAll("[data-ovst]").forEach(b=>b.onclick=()=>{UI.qu.stOff=STL.filter(s=>s!==b.dataset.ovst);UI.qu.flow="";view="Projects";UI.pview="projects";render();window.scrollTo(0,0)});
  const ps=m.querySelector("#ovProcSel");if(ps)ps.onchange=e=>{D.proc=e.target.value;D.init="";D.cell=null;D.zoom=null;vDash(m,true)}}
