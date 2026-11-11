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
      return `<button type="button" class="ovpr" data-ovopen="${r}" style="--bc:${buColor(gv("Projects",FP.bu,r))}"><span class="k">Project</span><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${buChip(gv("Projects",FP.bu,r))}${esc(pid)}${gv("Projects","AB",r)?" · "+esc(gv("Projects","AB",r)):""}${other?` · Also supports ${other} lane${other>1?"s":""}`:""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span>${ovSavCells(r)}<span class="ow">${esc(gv("Projects",FP.lead,r)||"—")}</span>${(()=>{const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));return `<span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span>`})()}<span class="cv">›</span></button>`};
    /* lane health: worst status of its projects → colour; progress ring = average % done */
    const tone=Lx=>{const st=[...Lx.pids].map(p=>byId.get(p)).filter(Boolean).map(pStat);return st.includes("Delayed")?"bad":st.includes("At Risk")?"risk":st.length&&st.every(x=>x==="Completed"||x==="Cancelled")?"ok":st.every(x=>x==="Not Started")?"ns":"ip"};
    const lprog=Lx=>{const rs=[...Lx.pids].map(p=>byId.get(p)).filter(Boolean);return rs.length?rs.reduce((a,r)=>a+(pLive(r).comp||0),0)/rs.length:0};
    const ring=(v,t)=>`<span class="ovring ${t}" style="--p:${Math.round(v*100)}"><b>${Math.round(v*100)}</b></span>`;
    const strip=`<div class="ovstrip" role="list" aria-label="Swimlanes of this workflow">${lanes.map((x,i)=>`${i?'<span class="ovarr" aria-hidden="true"><svg viewBox="0 0 24 10"><path d="M0 5h20m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':""}<button type="button" role="listitem" class="ovnode ${tone(x)}${open&&x.name===selL?" on":""}" data-ovnode="${esc(x.name)}" data-ovf="${esc(F.f.id)}" title="${esc(x.name)} · ${x.procs.length} process(es) · ${x.pids.size} project(s) · ${Math.round(lprog(x)*100)}% done"><i></i><span>${esc(x.name)}</span><b>${x.pids.size}</b></button>`).join("")}</div>`;
    const ICON=`<span class="ovficon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="3" width="6" height="5" rx="1.5"/><rect x="15.5" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="16" width="6" height="5" rx="1.5"/><path d="M8.5 5.5h7M18.5 8v3.5H12V16M5.5 8v3.5H12" fill="none"/></svg></span>`;
    return `<div class="card ovflow${open?" open":""}" style="--fc:${buColor(flowBU(F.f))}"><button type="button" class="ovfh" data-ovflow="${esc(F.f.id)}" aria-expanded="${open}">
      <span class="chev">${open?"⌄":"›"}</span>${ICON}<span class="nm"><b>${esc(F.f.name)}</b><small>${flowBU(F.f)?buChip(flowBU(F.f)):""}${lanes.length} swimlane${lanes.length!==1?"s":""} · ${F.pids.size} unique project${F.pids.size!==1?"s":""}${F.ver==="AS-IS"?" · AS-IS map":""}</small></span>
      <span class="ovfst ${stC}">${stT}</span>${nDel?`<span class="ovfdl">${nDel} delayed</span>`:""}
      <span class="m pg"><small>Project progress</small><b>${pct(prog)}%</b>${bar(prog,stC==="ok"?"ok":"")}</span><span class="m"><small>Planned / year</small><b>${yr?"THB "+fmtShort(yr):"—"}</b></span><span class="m"><small>Planned time saved</small><b>${hr?fmtNum(Math.round(hr))+" h/mo":"—"}</b></span></button>${strip}
      ${open?`<div class="ovfb"><div class="ovlanes"><div class="cap">Swimlanes</div>${lanes.map(x=>`<button type="button" class="ovl${x.name===selL?" on":""}" data-ovlane="${esc(x.name)}" data-ovf="${esc(F.f.id)}">${ring(lprog(x),tone(x))}<span>${esc(x.name)}</span><b>${x.pids.size}</b><i>›</i></button>`).join("")||'<span class="muted">No steps linked yet</span>'}</div>
        <div class="ovproc">${L?`<div class="ovph"><b>${esc(L.name)}</b><span class="muted">${L.procs.length} process${L.procs.length!==1?"es":""} / ${L.pids.size} project${L.pids.size!==1?"s":""}</span><span class="sp"></span><span class="crumb">Workflow › Swimlane › Process › Project</span></div>
          ${L.procs.map((p,i)=>`<div class="ovpc${q&&(hit(p.title)||p.pids.some(projHit))?" hit":""}${i===L.procs.length-1?" last":""}"><span class="ovnum" aria-hidden="true">${i+1}</span><div class="ovpch"><div><small>Process ${String(i+1).padStart(2,"0")}</small><b>${esc(p.title)}</b></div><span class="muted">${p.pids.length} project${p.pids.length!==1?"s":""}</span></div>${p.pids.length?`<div class="ovprh"><span></span><span>Project</span><span>Status</span><span>Progress</span><span>Plan saving</span><span>Actual saving</span><span>Owner</span><span>Plan end</span><span></span></div>`:""}${p.pids.map(projRow).join("")}</div>`).join("")}`:""}</div></div>
        <div class="ovff"><span class="muted">Projects can support several swimlanes; workflow totals count each project once.</span><button type="button" class="ovlink" data-ovmap="${esc(F.f.id)}">View workflow details →</button></div>`:""}</div>`};
  /* project health */
  const SO={"Delayed":0,"At Risk":1,"On Track":2,"Not Started":3,"On-Hold":4,"Completed":5,"Cancelled":6};
  const drill=(rows,key)=>{const lim=D.hlAll===key?rows.length:8;const srt=[...rows].sort((a,b)=>(SO[pStat(a)]??9)-(SO[pStat(b)]??9)||(pLive(b).comp||0)-(pLive(a).comp||0));
    return `<div class="ovdrill">${rows.length?OV_DRH:""}${srt.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
      return `<button type="button" class="ovdr" data-ovopen="${r}" style="--bc:${buColor(gv("Projects",FP.bu,r))}" title="Open project"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${buChip(gv("Projects",FP.bu,r))}${esc(pId(r))}${gv("Projects",FP.lead,r)?" · "+esc(gv("Projects",FP.lead,r)):""}${typeof curStage==="function"&&!["Completed","Cancelled"].includes(pStat(r))?" · "+esc(curStage(r)):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span>${ovSavCells(r)}<span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")||'<p class="muted" style="margin:6px 4px">No projects.</p>'}
      ${rows.length>8?`<button type="button" class="ovlink" data-hlall="${esc(key)}">${D.hlAll===key?"Show fewer":`Show all ${rows.length}`}</button>`:""}</div>`};
  const tot=P.length||1;const stRows=STL.map(s=>({s,n:P.filter(r=>pStat(r)===s).length}));
  const openP=P.filter(r=>!["Completed","Cancelled"].includes(pStat(r)));const stg=[...listFromName("L_StageWF"),...listFromName("L_StageAG"),"(no tasks)","All complete"];
  const sg=uniqOrder(stg).map(s=>({s,n:openP.filter(r=>curStage(r)===s).length})).filter(x=>x.n);const smax=Math.max(1,...sg.map(x=>x.n));
  const top2=[...sg].sort((a,b)=>b.n-a.n).slice(0,2);
  return `  <section class="ove2e" aria-label="E2E workflows"><div class="ovsec"><span class="ove2eic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="3" width="6" height="5" rx="1.5"/><rect x="15.5" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="16" width="6" height="5" rx="1.5"/><path d="M8.5 5.5h7M18.5 8v3.5H12V16M5.5 8v3.5H12" fill="none"/></svg></span><div><span class="ove2etag">E2E workflow</span><h2>E2E workflows</h2><p>Explore the business process first — workflow › swimlane › process › project. Find projects where the work happens.</p></div><span class="sp"></span><label class="ovsrch"><input type="search" id="ovQ" placeholder="Search workflows or projects…" value="${esc(D.ovQ||"")}"></label></div>
  ${FLs.map(flowCard).join("")}${(()=>{/* drafts: flows not finished yet — no project linked to any step (any version), or nothing drawn */
    if(typeof hasE2E!=="function"||!hasE2E())return "";const linked=f=>["TO-BE","AS-IS"].some(v=>f.v[v]&&f.v[v].doc&&(f.v[v].doc.shapes||[]).some(sh=>(sh.proj||[]).length));
    const DR=e2eFlows().filter(f=>!linked(f)&&hit(f.name));if(!DR.length)return "";
    return `<div class="ovdrafts"><div class="ovdh"><b>Draft flows</b><span class="muted">${DR.length} flow${DR.length>1?"s":""} still being mapped — no project linked to a step yet</span></div>${DR.map(f=>{const vs=["AS-IS","TO-BE"].filter(v=>f.v[v]&&f.v[v].doc);const d=vs.length?f.v[vs.includes("TO-BE")?"TO-BE":"AS-IS"].doc:null;const fl=d?e2eFlat(d):{lanes:[],shapes:[]};
      let steps=[];try{steps=d?stepOrder(d):[]}catch(e){steps=(fl.shapes||[]).filter(isStep)}const lanes=(fl.lanes||[]).map(l=>({name:l.name,n:steps.filter(sh=>laneOfShape(fl,sh)===l.name).length}));
      const todo=[!vs.length?"nothing drawn yet":"",vs.length&&!vs.includes("TO-BE")?"TO-BE not drawn":"",vs.length&&!vs.includes("AS-IS")?"AS-IS not drawn":"","no projects linked"].filter(Boolean);
      return `<div class="card ovflow ovdraft"><div class="ovfh"><span class="chev"></span><span class="ovficon dr" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="3" width="6" height="5" rx="1.5"/><rect x="15.5" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="16" width="6" height="5" rx="1.5"/><path d="M8.5 5.5h7M18.5 8v3.5H12V16M5.5 8v3.5H12" fill="none"/></svg></span>
        <span class="nm"><b>${esc(f.name)}</b><small>${lanes.length} swimlane${lanes.length!==1?"s":""} · ${steps.length} step${steps.length!==1?"s":""}${vs.length?" · "+vs.join(" + "):""}${f.owner?" · owner "+esc(f.owner):""}</small></span>
        <span class="ovfst dr">Draft</span><span class="ovdtodo">${todo.map(t=>`<span>${esc(t)}</span>`).join("")}</span><span class="m"></span><span class="m"></span><button type="button" class="ovlink" data-ovmap="${esc(f.id)}">Open in E2E flow maps →</button></div>
        ${lanes.length?`<div class="ovstrip">${lanes.map((x,i)=>`${i?'<span class="ovarr" aria-hidden="true"><svg viewBox="0 0 24 10"><path d="M0 5h20m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':""}<span class="ovnode dr" title="${x.n} step(s)"><i></i><span>${esc(x.name)}</span><b>${x.n}</b></span>`).join("")}</div>`:""}</div>`}).join("")}</div>`})()}${FLs.length?"":`<div class="card pad muted">${FL.length?"Nothing matches the search.":"No E2E workflow is mapped yet — draw one under E2E flow maps and link its steps to projects."}</div>`}
  ${unm.length?(()=>{const SO={"Delayed":0,"At Risk":1,"On Track":2,"Not Started":3,"On-Hold":4,"Completed":5,"Cancelled":6};
    const fl=D.unmSt||"";const lst=unm.filter(r=>!fl||pStat(r)===fl).sort((a,b)=>(SO[pStat(a)]??9)-(SO[pStat(b)]??9)||String(gv("Projects",FP.name,a)).localeCompare(String(gv("Projects",FP.name,b))));
    const lim=D.unmAll?lst.length:10;const stc=STL.map(s=>[s,unm.filter(r=>pStat(r)===s).length]).filter(x=>x[1]);
    return `<div class="ovunm${D.unmOpen?" open":""}"><button type="button" class="ovunmh" id="ovUnmT" aria-expanded="${!!D.unmOpen}"><span class="chev">${D.unmOpen?"⌄":"›"}</span><div><b>${unm.length} project${unm.length>1?"s are":" is"} not mapped to a process yet</b><span>Assign them to an E2E workflow, swimlane and process to see their business impact.</span></div><span class="ovunmb">${D.unmOpen?"Hide list":"Show projects"}</span></button>
    ${D.unmOpen?`<div class="ovunmb2"><div class="ovunmf"><button type="button" data-unmst="" class="${fl?"":"on"}">All <b>${unm.length}</b></button>${stc.map(([s,n])=>`<button type="button" data-unmst="${esc(s)}" class="${fl===s?"on":""}"><i style="background:${SCOL[s]||"#888"}"></i>${esc(s)} <b>${n}</b></button>`).join("")}<span class="sp"></span><button type="button" class="ovlink" id="ovUnm">Open in Projects →</button></div>
      <div class="ovunml"><div class="ovunmhd"><span>Project</span><span>Status</span><span>Progress</span><span>Plan saving</span><span>Actual saving</span><span>Owner</span><span>Plan end</span><span></span></div>
      ${lst.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
        return `<button type="button" class="ovur" data-ovopen="${r}" style="--bc:${buColor(gv("Projects",FP.bu,r))}"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${buChip(gv("Projects",FP.bu,r))}${esc(pId(r))}${gv("Projects",FP.proc,r)?" · "+esc(gv("Projects",FP.proc,r)):""}${gv("Projects","AB",r)?" · "+esc(gv("Projects","AB",r)):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span>${ovSavCells(r)}<span class="ow">${esc(gv("Projects",FP.lead,r)||"—")}</span><span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")}</div>
      ${lst.length>10?`<button type="button" class="ovlink ovunmm" id="ovUnmAll">${D.unmAll?"Show fewer":`Show all ${lst.length}`}</button>`:""}</div>`:""}</div>`})():""}
  </section>
  <div class="ovsec"><div><h2>Project health at a glance</h2><p>Portfolio-wide · includes mapped and unmapped projects</p></div></div>
  <div class="ovhl"><div class="card ovhc"><div class="hh"><b>Where projects stand</b><span class="muted">${P.length} total projects</span></div>
      ${stRows.map(x=>{const k="st:"+x.s,o=D.hlOpen===k;return `<button type="button" class="ovhr${o?" on":""}" data-hlk="${esc(k)}" ${x.n?"":"disabled"} aria-expanded="${o}" title="Show these projects"><span><i class="cv2">${o?"⌄":"›"}</i>${esc(x.s)}</span><span class="ovbar"><b style="width:${x.n/tot*100}%;background:${SCOL[x.s]||"#888"}"></b></span><b>${x.n}</b><small>${Math.round(x.n/tot*100)}%</small></button>${o?drill(P.filter(r=>pStat(r)===x.s),k):""}`}).join("")}
      ${delayed?`<p class="ft bad">${delayed} delayed project${delayed>1?"s":""} need${delayed>1?"":"s"} attention.</p>`:`<p class="ft">No delayed projects.</p>`}</div>
    <div class="card ovhc"><div class="hh"><b>Where open work is concentrated</b><span class="muted">${openP.length} open projects</span></div>
      ${sg.map(x=>{const k="sg:"+x.s,o=D.hlOpen===k;return `<button type="button" class="ovhr st${o?" on":""}" data-hlk="${esc(k)}" aria-expanded="${o}" title="Show these projects"><span><i class="cv2">${o?"⌄":"›"}</i>${esc(x.s)}</span><span class="ovbar"><b style="width:${x.n/smax*100}%"></b></span><b>${x.n}</b><small></small></button>${o?drill(openP.filter(r=>curStage(r)===x.s),k):""}`}).join("")||'<p class="muted">No open projects.</p>'}
      ${top2.length?`<p class="ft acc">${top2.reduce((a,x)=>a+x.n,0)} of ${openP.length} open projects are in ${top2.map(x=>esc(x.s)).join(" or ")}.</p>`:""}</div></div>
  <div class="ovnote"><span>Process groupings come from the E2E flow maps; project data follows the tracker.</span><span>Planned benefits are estimates, not realised savings.</span></div>`}
function ovNewBind(m){const D=UI.dash;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-ovflow]").forEach(b=>b.onclick=()=>{D.ovOpen=D.ovOpen===b.dataset.ovflow?"":b.dataset.ovflow;re()});
  m.querySelectorAll("[data-ovnode]").forEach(b=>b.onclick=()=>{D.ovOpen=b.dataset.ovf;D.ovLane[b.dataset.ovf]=b.dataset.ovnode;re()});
  m.querySelectorAll("[data-ovlane]").forEach(b=>b.onclick=()=>{D.ovLane[b.dataset.ovf]=b.dataset.ovlane;re()});
  const q=m.querySelector("#ovQ");if(q)q.oninput=()=>{clearTimeout(ovNewBind._t);ovNewBind._t=setTimeout(()=>{D.ovQ=q.value;D.ovOpen=undefined;re();const n=m.querySelector("#ovQ");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},300)};
  const ut=m.querySelector("#ovUnmT");if(ut)ut.onclick=()=>{D.unmOpen=!D.unmOpen;re()};
  m.querySelectorAll("[data-unmst]").forEach(b=>b.onclick=()=>{D.unmSt=b.dataset.unmst;D.unmAll=false;re()});
  const ua=m.querySelector("#ovUnmAll");if(ua)ua.onclick=()=>{D.unmAll=!D.unmAll;re()};
  m.querySelectorAll(".ovunm [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen));
  const u=m.querySelector("#ovUnm");if(u)u.onclick=()=>{UI.qu.flow="none";UI.qu.lane="";view="Projects";UI.pview="projects";render();window.scrollTo(0,0)};
  m.querySelectorAll("[data-hlk]").forEach(b=>b.onclick=()=>{D.hlOpen=D.hlOpen===b.dataset.hlk?"":b.dataset.hlk;D.hlAll="";re()});
  m.querySelectorAll("[data-hlall]").forEach(b=>b.onclick=()=>{D.hlAll=D.hlAll===b.dataset.hlall?"":b.dataset.hlall;re()});
  m.querySelectorAll(".ovdrill [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen));
  const ps=m.querySelector("#ovProcSel");if(ps)ps.onchange=e=>{D.proc=e.target.value;D.init="";D.cell=null;D.zoom=null;vDash(m,true)}}
/* ---- KPI cards: click → breakdown panel right under the KPI rows (stays on the page) ---- */
const OV_SO={"Delayed":0,"At Risk":1,"On Track":2,"Not Started":3,"On-Hold":4,"Completed":5,"Cancelled":6};
/* r87 — per-project saving: plan (estimate = recurring/yr + one-off) and actual realised to date */
let OV_SV={k:null,by:null};
function ovSav(pid){const k=(S.changes||[]).length+"|"+(S.fileName||"")+"|"+TODAY;if(OV_SV.k!==k){const B=benefitSeries();const ms=(B.months||[]).map(mm=>mm.s<=TODAY);const by={};
    (B.list||[]).filter(b=>!b.drop).forEach(b=>{const o=by[b.pid]=by[b.pid]||{est:0,plan:0,act:0};o.est+=b.gross||0;o.plan+=(b.plan||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0);o.act+=(b.act||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0)});OV_SV={k,by}}
  return OV_SV.by[pid]||{est:0,plan:0,act:0}}
function ovSavCells(r){const o=ovSav(pId(r));const pc=o.plan?Math.round(o.act/o.plan*100):0;
  return `<span class="sv"><b>${o.est?fmtShort(o.est):"—"}</b><small>${o.plan?"to date "+fmtShort(o.plan):o.est?"not due yet":"no benefit"}</small></span><span class="sv a"><b class="${o.act?"ok":""}">${o.act?fmtShort(o.act):"0"}</b><small>${o.plan?pc+"% of plan":"&nbsp;"}</small></span>`}
const OV_DRH=`<div class="ovdrh"><span>Project</span><span>Status</span><span>Progress</span><span>Plan saving</span><span>Actual saving</span><span>Plan end</span><span></span></div>`;
function ovPRows(rows,key,extra){const D=UI.dash;const lim=D.kAll===key?rows.length:10;const pct=v=>Math.round(v*100);
  const bar=(v,c)=>`<span class="ovbar ${c}"><b style="width:${Math.min(100,pct(v))}%"></b></span>`;const pill=s=>`<span class="ovst st-${esc(s).replace(/\W/g,"")}">${esc(s)}</span>`;
  return `<div class="ovdrill flat">${rows.length?OV_DRH:""}${rows.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
    return `<button type="button" class="ovdr" data-ovopen="${r}" style="--bc:${buColor(gv("Projects",FP.bu,r))}" title="Open project"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${buChip(gv("Projects",FP.bu,r))}${esc(pId(r))}${gv("Projects",FP.lead,r)?" · "+esc(gv("Projects",FP.lead,r)):""}${extra?" · "+extra(r):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span>${ovSavCells(r)}<span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")||'<p class="muted" style="margin:6px 4px">Nothing here.</p>'}
    ${rows.length>10?`<button type="button" class="ovlink" data-kall="${esc(key)}">${D.kAll===key?"Show fewer":`Show all ${rows.length}`}</button>`:""}</div>`}
function ovChips(items,key){const D=UI.dash;const cur=D.kSt&&D.kSt[key]||"";return `<div class="ovkchips">${items.map(([v,l,n,c])=>`<button type="button" data-kst="${esc(v)}" data-kkey="${esc(key)}" class="${cur===v?"on":""}">${c?`<i style="background:${c}"></i>`:""}${esc(l)} <b>${n}</b></button>`).join("")}</div>`}
function ovKpiPanel(k,P,A,D,Bl){const U=UI.dash;U.kSt=U.kSt||{};const done=s=>s==="Completed"||s==="Cancelled";const tot=P.length;const sel=U.kSt[k]||"";
  const srt=rs=>[...rs].sort((a,b)=>(OV_SO[pStat(a)]??9)-(OV_SO[pStat(b)]??9)||String(gv("Projects",FP.name,a)).localeCompare(String(gv("Projects",FP.name,b))));
  const byPid=new Map(P.map(r=>[pId(r),r]));const box=(title,sub,body)=>`<div class="card ovkp" id="ovKp"><div class="ovkph"><div><b>${title}</b><span>${sub}</span></div><button type="button" class="ovkx" data-ovk="${k}" title="Close">✕</button></div>${body}</div>`;
  const eq=(parts)=>`<div class="ovkeq">${parts.map(([n,l,c,cls])=>`<div class="${cls||""}"><b style="${c?`color:${c}`:""}">${n}</b><span>${l}</span></div>`).join('<em>+</em>').replace(/<em>\+<\/em>(<div class="tot)/,'<em>=</em>$1')}</div>`;
  if(k==="active"){const act=P.filter(r=>!done(pStat(r))),cmp=P.filter(r=>pStat(r)==="Completed"),can=P.filter(r=>pStat(r)==="Cancelled");const actB=act.filter(r=>hasBenefit(pId(r))),actN=act.filter(r=>!hasBenefit(pId(r)));
    const sts=["Delayed","At Risk","On Track","Not Started","On-Hold"].map(s=>[s,s,act.filter(r=>pStat(r)===s).length,SCOL[s]]).filter(x=>x[2]);
    const rows=srt(sel==="Completed"?cmp:sel==="Cancelled"?can:sel==="ben"?actB:sel==="noben"?actN:act.filter(r=>!sel||pStat(r)===sel));
    return box("Active projects","Active = every project that is not Completed or Cancelled (On-Hold still counts as active).",
      eq([[act.length,"active","var(--accent)"],[cmp.length,"completed",SCOL.Completed],[can.length,"cancelled","#98A2B3"],[tot,"projects in the current filter","", "tot"]])+
      `<div class="ovbcov"><div><b>${actB.length}</b> of ${act.length} active projects have a benefit line</div><span class="ovbar ${actN.length?"":"ok"}"><b style="width:${act.length?actB.length/act.length*100:0}%"></b></span><span class="${actN.length?"warn":"ok"}">${actN.length?`${actN.length} still need a benefit`:"all covered"}</span></div>`+
      ovChips([["","All active",act.length,""],["ben","💰 With benefit",actB.length,"#12B76A"],["noben","No benefit yet",actN.length,"#F79009"],...sts,["Completed","Completed",cmp.length,SCOL.Completed],["Cancelled","Cancelled",can.length,"#98A2B3"]],k)+ovPRows(rows,k,r=>`${esc(curStage(r))} · ${hasBenefit(pId(r))?'<span class="ovhb">💰 benefit</span>':'<span class="ovnb">no benefit yet</span>'}`))}
  if(k==="attn"){const del=P.filter(r=>pStat(r)==="Delayed"),risk=P.filter(r=>pStat(r)==="At Risk");const rows=srt(sel==="At Risk"?risk:sel==="Delayed"?del:[...del,...risk]);
    return box("Needs attention","Delayed + at-risk projects. Delayed = a task is past its plan end or forecast late; At risk = slipping or an overdue RAIDD.",
      ovChips([["","All",del.length+risk.length,""],["Delayed","Delayed",del.length,SCOL.Delayed],["At Risk","At risk",risk.length,SCOL["At Risk"]]],k)+ovPRows(rows,k,r=>{const L=pLive(r);return L.slip>0?`forecast +${L.slip}d late`:curStage(r)}))}
  if(k==="tasks"||k==="ontime"){const comp=A.filter(t=>tStat(t)==="Completed");const fe=t=>+tLive(t).fe||0,pe=t=>+tLive(t).pe||+gv("Activities",FA.pe,t)||0;
    const withPlan=comp.filter(t=>pe(t));const late=withPlan.filter(t=>fe(t)>pe(t)),ontime=withPlan.filter(t=>fe(t)<=pe(t));
    const list=(k==="ontime"?(sel==="late"?late:sel==="on"?ontime:withPlan):comp).sort((a,b)=>fe(b)-fe(a));const lim=U.kAll===k?list.length:12;
    const rowsT=list.slice(0,lim).map(t=>{const pr=byPid.get(gv("Activities",FA.pid,t));const d=pe(t)?fe(t)-pe(t):0;return `<button type="button" class="ovdr t" ${pr!=null?`data-ovopen="${pr}"`:""}><span class="n"><b>${esc(gv("Activities",FA.task,t))}</b><small>${esc(gv("Activities",FA.stage,t))} · ${esc(pr!=null?gv("Projects",FP.name,pr):gv("Activities",FA.pid,t))}</small></span><span class="ovst ${d>0?"st-Delayed":"st-Completed"}">${d>0?`+${d}d late`:"on time"}</span><span class="dt">done ${fe(t)?fmtDate(fe(t)):"—"}</span><span class="dt">plan ${pe(t)?fmtDate(pe(t)):"—"}</span><span class="cv">›</span></button>`}).join("");
    const open=A.length-comp.length;
    return box(k==="tasks"?"Tasks completed":"On-time delivery",k==="tasks"?`Tasks marked 100 % done, newest first. ${comp.length} of ${A.length} tasks done · ${open} still open.`:"Completed tasks that finished on or before their plan end (only tasks with a plan end count).",
      (k==="ontime"?eq([[ontime.length,"on time",SCOL.Completed],[late.length,"late",SCOL.Delayed],[withPlan.length,"completed with a plan end","","tot"]])+ovChips([["","All",withPlan.length,""],["on","On time",ontime.length,SCOL.Completed],["late","Late",late.length,SCOL.Delayed]],k)
        :eq([[comp.length,"completed",SCOL.Completed],[open,"open","var(--accent)"],[A.length,"tasks in the current filter","","tot"]]))+`<div class="ovdrill flat">${rowsT||'<p class="muted" style="margin:6px 4px">Nothing here.</p>'}${list.length>12?`<button type="button" class="ovlink" data-kall="${k}">${U.kAll===k?"Show fewer":`Show all ${list.length}`}</button>`:""}</div>`)}
  if(k==="rec"||k==="one"||k==="hrs"||k==="real"){const by={};const ms=k==="real"?(benefitSeries().months||[]).map(mm=>mm.s<=TODAY):[];Bl.filter(b=>!b.drop).forEach(b=>{const o=by[b.pid]=by[b.pid]||{rec:0,one:0,hrs:0,real:0,plan:0};if(b.one)o.one+=b.gross;else o.rec+=b.gross;o.hrs+=b.hrs;
      o.real+=(b.act||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0);o.plan+=(b.plan||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0)});
    const val=pid=>(by[pid]||{})[k]||0;const rows=P.filter(r=>val(pId(r))>0).sort((a,b)=>val(pId(b))-val(pId(a)));const none=P.length-rows.length;
    const unit=k==="hrs"?" h/mo":" THB";const f=v=>k==="hrs"?fmtNum(Math.round(v)):fmtShort(v);
    const T={rec:["Recurring value","Gross recurring benefit per year, from the projects' benefit lines (largest first)."],one:["One-off value","One-off benefit from the benefit lines (largest first)."],hrs:["Hours saved / month","Time saved per month on the benefit lines (largest first). 1 FTE ≈ "+(+setting("S_FTEh")||176)+" h."],real:["Realised to date","Actual benefit logged so far vs the plan to date (largest first)."]}[k];
    return box(T[0],T[1]+` ${rows.length} project${rows.length!==1?"s":""} with a value · ${none} without.`,ovPRows(rows,k,r=>{const o=by[pId(r)]||{};return k==="real"?`<b class="ovkv">${fmtShort(o.real)}</b> of ${fmtShort(o.plan)} plan`:`<b class="ovkv">${f(val(pId(r)))}${unit}</b>`}))}
  if(k==="raidd"){const open=D.filter(x=>gv("RAIDD",FD.status,x)!=="Closed"&&gv("RAIDD",FD.type,x)!=="Re-plan");const types=uniqOrder(open.map(x=>gv("RAIDD",FD.type,x)||"Item"));
    const list=open.filter(x=>!sel||(gv("RAIDD",FD.type,x)||"Item")===sel).sort((a,b)=>(+gv("RAIDD",FD.due,a)||9e9)-(+gv("RAIDD",FD.due,b)||9e9));
    return box("Open RAIDD items","Risks, assumptions, issues, dependencies and decisions that are not closed (re-plans not counted). Earliest due first.",
      ovChips([["","All",open.length,""],...types.map(t=>[t,t,open.filter(x=>(gv("RAIDD",FD.type,x)||"Item")===t).length,""])],k)+
      `<div class="ovdrill flat">${list.map(x=>{const pr=byPid.get(gv("RAIDD",FD.pid,x));const due=+gv("RAIDD",FD.due,x)||0;const od=due&&due<TODAY;return `<button type="button" class="ovdr t" data-rd="${esc(gv("RAIDD",FD.pid,x))}"><span class="n"><b>${esc(String(gv("RAIDD",FD.desc,x)||"").slice(0,140))}</b><small>${esc(pr!=null?gv("Projects",FP.name,pr):gv("RAIDD",FD.pid,x))}${gv("RAIDD",FD.prio,x)?" · "+esc(gv("RAIDD",FD.prio,x))+" priority":""}</small></span><span class="ovst">${esc(gv("RAIDD",FD.type,x)||"Item")}</span><span class="dt${od?" bad":""}">${due?"due "+fmtDate(due):"no due date"}</span><span class="dt">${esc(gv("RAIDD",FD.status,x)||"")}</span><span class="cv">›</span></button>`}).join("")||'<p class="muted" style="margin:6px 4px">Nothing open.</p>'}</div>`)}
  if(k==="mapped"){const FL=ovFlows(new Set(P.map(pId)));const m=new Set(FL.flatMap(F=>[...F.pids]));const yes=P.filter(r=>m.has(pId(r))),no=P.filter(r=>!m.has(pId(r)));
    const rows=srt(sel==="no"?no:yes);return box("Mapped to E2E","Projects linked to at least one step of an E2E flow map.",eq([[yes.length,"mapped","var(--accent)"],[no.length,"not mapped yet","#98A2B3"],[P.length,"projects","","tot"]])+ovChips([["","Mapped",yes.length,"#7C5CFC"],["no","Not mapped",no.length,"#98A2B3"]],k)+ovPRows(rows,k,r=>{const x=projE2E(pId(r));return x.flows.length?esc(x.flows.map(f=>f.name).join(", ")):"no E2E flow"}))}
  if(k==="save"){const ms=(benefitSeries().months||[]).map(mm=>mm.s<=TODAY);const by={};Bl.filter(b=>!b.drop).forEach(b=>{const o=by[b.pid]=by[b.pid]||{rec:0,one:0,plan:0,act:0};if(b.one)o.one+=b.gross;else o.rec+=b.gross;
      o.plan+=(b.plan||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0);o.act+=(b.act||[]).reduce((a,v,i)=>a+(ms[i]?v:0),0)});
    const T=Object.values(by).reduce((a,o)=>({rec:a.rec+o.rec,one:a.one+o.one,plan:a.plan+o.plan,act:a.act+o.act}),{rec:0,one:0,plan:0,act:0});
    const est=pid=>{const o=by[pid]||{};return (o.rec||0)+(o.one||0)};const withV=P.filter(r=>est(pId(r))>0),withA=withV.filter(r=>(by[pId(r)]||{}).act>0),noA=withV.filter(r=>!((by[pId(r)]||{}).act>0)),noV=P.filter(r=>!(est(pId(r))>0)&&!["Completed","Cancelled"].includes(pStat(r)));
    const rows=(sel==="act"?withA:sel==="noact"?noA:sel==="nov"?noV:withV).sort((a,b)=>est(pId(b))-est(pId(a)));const pc=T.plan?Math.round(T.act/T.plan*100):0;
    return box("Saving — estimate vs actual","Estimated saving = recurring benefit per year + one-off write-off, from the benefit lines (planned, not realised). Actual = benefit logged as realised so far.",
      `<div class="ovsv"><div class="e"><em class="tg est">ESTIMATE</em><div class="row"><span>Recurring / yr</span><b>THB ${fmtNum(Math.round(T.rec))}</b></div><div class="row"><span>One-off write-off</span><b>THB ${fmtNum(Math.round(T.one))}</b></div><div class="row tot"><span>Estimated saving</span><b>THB ${fmtNum(Math.round(T.rec+T.one))}</b></div></div>
        <div class="a"><em class="tg act">ACTUAL</em><div class="row"><span>Planned to date</span><b>THB ${fmtNum(Math.round(T.plan))}</b></div><div class="row"><span>Actual to date</span><b class="ok">THB ${fmtNum(Math.round(T.act))}</b></div><div class="row tot"><span>Achieved</span><b>${pc}%</b></div><span class="ovbar ok"><b style="width:${Math.min(100,pc)}%"></b></span>${T.act?"":'<small class="muted">No realised benefit logged yet — enter actuals under Projects ▸ Actuals.</small>'}</div></div>`+
      ovChips([["","With an estimate",withV.length,"#7C5CFC"],["act","Actual logged",withA.length,"#12B76A"],["noact","No actual yet",noA.length,"#F79009"],["nov","Active, no benefit yet",noV.length,"#98A2B3"]],k)+
      ovPRows(rows,k))}
  if(k==="rp"){const rows=srt(P.filter(r=>pLive(r).rpdays>0));return box("Re-planned","Projects whose dates moved through an approved Re-plan in the RAIDD log.",ovPRows(rows,k,r=>`re-planned +${pLive(r).rpdays}d`))}
  return ""}
function ovKpiBind(m){const U=UI.dash;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-ovk]").forEach(c=>{const f=()=>{const k=c.dataset.ovk;U.kOpen=U.kOpen===k?"":k;U.kAll="";re();if(U.kOpen){const p=m.querySelector("#ovKp");if(p)p.scrollIntoView({block:"nearest",behavior:"smooth"})}};c.onclick=f;c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
  m.querySelectorAll(`.ovk2 [data-ovk="${CSS.escape(U.kOpen||"-")}"]`).forEach(c=>c.classList.add("on"));
  m.querySelectorAll("[data-kst]").forEach(b=>b.onclick=()=>{U.kSt=U.kSt||{};U.kSt[b.dataset.kkey]=b.dataset.kst;U.kAll="";re()});
  m.querySelectorAll("[data-kall]").forEach(b=>b.onclick=()=>{U.kAll=U.kAll===b.dataset.kall?"":b.dataset.kall;re()});
  m.querySelectorAll("#ovKp [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen))}
/* ---- bottom of the dashboard: benefit realisation + simple ranked breakdowns ---- */
function ovAnalysisHtml(P,Bl,months,scope){const U=UI.dash;const BlA=Bl.filter(b=>!b.drop);
  /* ranked lists */
  const tot=P.length||1;const rank=(key,title,sub,fn,opts={})=>{const by={};P.forEach(r=>{const k=fn(r)||opts.none||"(blank)";(by[k]=by[k]||[]).push(r)});
    const ks=Object.keys(by).sort((a,b)=>(a===opts.none)-(b===opts.none)||by[b].length-by[a].length);const mxn=Math.max(1,...ks.map(k=>by[k].length));
    const rows=ks.map((k,i)=>{const id=key+":"+k,o=U.anOpen===id,nn=by[k].length;return `<button type="button" class="ovrk${o?" on":""}${k===opts.none?" none":""}${i<2&&k!==opts.none?" top":""}" data-anr="${esc(id)}" aria-expanded="${o}"><span class="nm"><i>${o?"⌄":"›"}</i>${esc(k)}</span><span class="ovbar"><b style="width:${nn/mxn*100}%"></b></span><b>${nn}</b><small>${Math.round(nn/tot*100)}%</small></button>${o?ovPRows(srtP(by[k]),id,opts.extra):""}`}).join("");
    return {html:`<div class="card ovan ovrkc"><div class="ovanh"><div><h3>${title}</h3><p>${P.length} projects · ${sub}</p></div></div><div class="ovrkhd"><span></span><span></span><span>Projects</span><span>Share</span></div>${rows}${opts.foot?opts.foot(by,ks):""}</div>`,by,ks}};
  const srtP=rs=>[...rs].sort((a,b)=>(OV_SO[pStat(a)]??9)-(OV_SO[pStat(b)]??9));
  const proc=rank("proc","Projects by process area","ranked by project count",r=>gv("Projects",FP.proc,r),{foot:(by,ks)=>{const t=ks.slice(0,2);const s=t.reduce((a,k)=>a+by[k].length,0);return t.length>1?`<p class="ovins">${t.map(esc).join(" + ")} account for ${s} of ${P.length} projects (${Math.round(s/tot*100)}%).</p>`:""},extra:r=>esc(curStage(r))});
  const NA="Not assigned";const wsl=rank("wsl","Projects by workstream leader","assignment coverage",r=>gv("Projects",FP.wsl,r),{none:NA,foot:by=>by[NA]?`<p class="ovins warn">${by[NA].length} project${by[NA].length>1?"s have":" has"} no workstream leader assigned.</p>`:`<p class="ovins">Every project has a workstream leader.</p>`,extra:r=>esc(gv("Projects",FP.proc,r)||"")});
  const bus=uniq(P.map(r=>gv("Projects",FP.bu,r)||"(blank)"));
  const bu=rank(bus.length>1?"bu":"cf",bus.length>1?"Projects by business unit":"Projects by corporate function",bus.length>1?"ranked by project count":`one business unit in this view (${esc(bus[0]||"—")}) · split by CF`,r=>gv("Projects",bus.length>1?FP.bu:FP.cf,r),{extra:r=>esc(gv("Projects",FP.proc,r)||"")});
  return `<section class="ovansec"><div class="ovsec"><div><h2>Benefit &amp; portfolio analysis</h2><p>A clearer view of expected value, project distribution and ownership.</p></div></div>
    ${ovBenCard(Bl,months,scope)}<div class="ovang"><div>${proc.html}</div><div class="ovangr">${wsl.html}${bu.html}</div></div></section>`}
function ovAnalysisBind(m){const U=UI.dash;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-anr]").forEach(b=>b.onclick=()=>{U.anOpen=U.anOpen===b.dataset.anr?"":b.dataset.anr;U.kAll="";re()});
  m.querySelectorAll(".ovansec [data-kall]").forEach(b=>b.onclick=()=>{U.kAll=U.kAll===b.dataset.kall?"":b.dataset.kall;re()});
  m.querySelectorAll(".ovansec [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen));
  ovBenBind(m);const sv=m.querySelector(".ovbsv");if(sv&&!sv.dataset.sc){sv.dataset.sc=1;const td=sv.querySelector("line.td");if(td)sv.scrollLeft=Math.max(0,+td.getAttribute("x1")-sv.clientWidth*0.55)}}

/* ---- Monthly benefit realisation card with clean filters: view · split · E2E flow · range, plus a breakdown table ---- */
const OVB_PAL=["#7C5CFC","#2E90FA","#12B76A","#F79009","#EE46BC","#06AED4","#875BF7","#F04438","#66C61C","#0E9384"];
function ovBenCard(Bl,months,scope){const U=UI.dash;const o=U.bf=U.bf||{view:"m",split:"",flow:"",range:"all",iso:""};
  const FL=benFlowIndex();const flows=uniq(Bl.flatMap(b=>(FL[b.pid]||[]).length?FL[b.pid]:["(no E2E flow yet)"]));if(o.flow&&!flows.includes(o.flow))o.flow="";
  const teamOf=pid=>{const r=projRowById(pid);return (r&&gv("Projects","AB",r))||"(no team)"},typeOf=pid=>{const r=projRowById(pid);return (r&&gv("Projects",FP.init,r))||"(no type)"};
  let L=Bl.filter(b=>!b.drop&&(!o.flow||(o.flow==="(no E2E flow yet)"?!(FL[b.pid]||[]).length:(FL[b.pid]||[]).includes(o.flow))));
  if(o.split==="driver"){const out=[];for(const b of L){const tot=Object.values(b.drv||{}).reduce((a,v)=>a+v,0);if(!tot){out.push({...b,seg:"(no driver value)"});continue}
    for(const [k,v] of Object.entries(b.drv)){if(!v)continue;const f=v/tot;out.push({...b,seg:k,gross:b.gross*f,hrs:k.startsWith("Time")?b.hrs:0,plan:b.plan.map(x=>x*f),act:b.act.map(x=>x*f)})}}L=out}
  const SPL={"":"No split",bu:"Business unit",cf:"Corporate function",proc:"Process area",team:"Team",flow:"E2E flow",type:"Project type",driver:"Benefit driver",project:"Project"};
  const segOf=b=>({bu:b.bu,cf:b.cf,proc:b.proc,team:teamOf(b.pid),flow:((FL[b.pid]||[])[0])||"(no E2E flow yet)",type:typeOf(b.pid),driver:b.seg,project:b.pid+" · "+(b.pname||"")})[o.split]||"All benefit lines";
  /* months in range */
  const yr=serialToDate(TODAY).getUTCFullYear();const idx=months.map((mm,i)=>i).filter(i=>{const s=months[i].s,d=serialToDate(s);
    return o.range==="all"?true:o.range==="ytd"?d.getUTCFullYear()===yr:o.range==="n12"?s>TODAY-31&&s<=TODAY+335:o.range==="l12"?s<=TODAY&&s>TODAY-366:String(d.getUTCFullYear())===o.range});
  const yrs=uniq(months.map(mm=>String(serialToDate(mm.s).getUTCFullYear())));
  /* segments: biggest first, fold the rest into Other */
  const tot=b=>b.plan.reduce((a,v)=>a+v,0)+b.act.reduce((a,v)=>a+v,0)+(b.gross||0)/1e6;
  const by={};L.forEach(b=>{const k=segOf(b);(by[k]=by[k]||[]).push(b)});let keys=Object.keys(by).sort((a,b)=>by[b].reduce((x,y)=>x+tot(y),0)-by[a].reduce((x,y)=>x+tot(y),0));
  if(keys.length>9){const rest=keys.slice(8);by.Other=rest.flatMap(k=>by[k]);rest.forEach(k=>delete by[k]);keys=[...keys.slice(0,8),"Other"]}
  if(o.iso&&!keys.includes(o.iso))o.iso="";const show=o.iso?[o.iso]:keys;const col=k=>k==="Other"?"#A3ACB8":OVB_PAL[keys.indexOf(k)%OVB_PAL.length];
  const sumM=(bs,key,i)=>bs.reduce((a,b)=>a+(b[key][i]||0),0);
  const td=i=>months[i].s<=TODAY;const lab=i=>{const d=serialToDate(months[i].s);return {m:MON[d.getUTCMonth()],y:d.getUTCFullYear()}};
  const Ls=show.flatMap(k=>by[k]);const pTD=months.reduce((a,_,i)=>a+(td(i)?sumM(Ls,"plan",i):0),0),aTD=months.reduce((a,_,i)=>a+(td(i)?sumM(Ls,"act",i):0),0);
  /* series per month (stacked by segment) */
  const cum=o.view==="c";const runP={},runA=[];let ra=0;
  const seg=show.map(k=>{let r=0;return {k,v:months.map((_,i)=>{const v=sumM(by[k],"plan",i);if(cum){r+=v;return r}return v})}});
  const actM=months.map((_,i)=>{const v=sumM(Ls,"act",i);if(cum){ra+=v;return ra}return v});
  let chart='<p class="muted">No benefit plan for this selection.</p>';
  if(idx.length&&Ls.length){const n=idx.length,bw=Math.max(22,Math.min(50,Math.floor(1500/n))),pl=64,pr=16,pt=34,ph=250,W=pl+n*bw+pr,H=pt+ph+64;
    const totAt=i=>seg.reduce((a,s)=>a+s.v[i],0);const mx0=Math.max(1,...idx.map(i=>Math.max(totAt(i),actM[i])));
    const step=(()=>{const raw=mx0/4,p=Math.pow(10,Math.floor(Math.log10(raw)));return [1,2,2.5,5,10].map(k=>k*p).find(k=>k>=raw)})();const mx=step*4;const Y=v=>pt+ph-v/mx*ph;
    let g="";for(let k=0;k<=4;k++){const v=step*k;g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${pl-10}" y="${Y(v)+4}" text-anchor="end" class="ax">${fmtShort(v)}</text>`}
    let bars="",xl="",yl="",y0=null,ys=0,tl="",line="";const single=show.length===1&&!o.split;
    idx.forEach((i,j)=>{const x=pl+j*bw;const L_=lab(i);let acc=0;const fut=!td(i);
      const tip=`${L_.m} ${L_.y}${cum?" (cumulative)":""}\n`+seg.map(s=>`${s.k}: ${fmtNum(Math.round(s.v[i]))}`).join("\n")+`\nActual: ${fmtNum(Math.round(actM[i]))} THB`;
      bars+=`<g><title>${esc(tip)}</title>`+seg.map(s=>{const v=s.v[i];if(!v)return "";const y1=Y(acc+v),h=Y(acc)-y1;acc+=v;return `<rect x="${x+bw*0.18}" y="${y1}" width="${bw*0.64}" height="${Math.max(0,h)}" ${single?`class="${fut?"bf":"bp"}"`:`fill="${col(s.k)}" opacity="${fut?0.38:0.95}"`}/>`}).join("")+
        (!cum&&actM[i]?`<rect x="${x+bw*0.34}" y="${Y(actM[i])}" width="${bw*0.32}" height="${pt+ph-Y(actM[i])}" rx="2" class="ba"/>`:"")+`</g>`;
      if(cum&&td(i))line+=`${line?"L":"M"}${x+bw/2} ${Y(actM[i])} `;
      xl+=`<text x="${x+bw/2}" y="${pt+ph+20}" text-anchor="middle" class="ax">${bw<30?L_.m[0]:L_.m}</text>`;
      if(L_.y!==y0){if(y0!==null)yl+=`<text x="${pl+(ys+j)/2*bw}" y="${pt+ph+52}" text-anchor="middle" class="yr">${y0}</text><line x1="${x}" x2="${x}" y1="${pt-6}" y2="${pt+ph+34}" class="ys"/>`;y0=L_.y;ys=j}
      if(td(i)&&(j===n-1||!td(idx[j+1]))&&idx[j+1]!==undefined){const tx=x+bw;tl=`<line x1="${tx}" x2="${tx}" y1="${pt-6}" y2="${pt+ph}" class="td"/><g transform="translate(${tx-62},${pt-30})"><rect width="124" height="22" rx="6" class="tdb"/><text x="62" y="15" text-anchor="middle" class="tdt">Today · ${L_.m} ${L_.y}</text></g>`}});
    yl+=`<text x="${pl+(ys+n)/2*bw}" y="${pt+ph+52}" text-anchor="middle" class="yr">${y0}</text>`;
    chart=`<div class="ovbch"><span class="ovbu">THB / month${cum?" · cumulative":""}</span><div class="ovbsv"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Benefit plan and actual by month">${g}${bars}${line?`<path d="${line}" class="bal"/>`:""}${tl}${xl}${yl}</svg></div></div>`}
  /* breakdown table */
  const rowsT=keys.map(k=>{const bs=by[k];const p=months.reduce((a,_,i)=>a+(td(i)?sumM(bs,"plan",i):0),0),a=months.reduce((x,_,i)=>x+(td(i)?sumM(bs,"act",i):0),0);
    const yrv=bs.filter(b=>!b.one).reduce((x,b)=>x+b.gross,0),h=bs.reduce((x,b)=>x+(b.hrs||0),0),pc=p?Math.round(a/p*100):null;
    return `<button type="button" class="ovbt${o.iso===k?" on":""}${o.iso&&o.iso!==k?" dim":""}" data-bfiso="${esc(k)}" title="${o.iso===k?"Show all again":"Show only this in the chart"}"><span class="nm"><i style="background:${col(k)}"></i>${esc(k)}</span><span>${new Set(bs.map(b=>b.id)).size}</span><span>${fmtShort(yrv)}</span><span>${h?fmtNum(Math.round(h)):"—"}</span><span>${fmtShort(p)}</span><span class="ok">${fmtShort(a)}</span><span class="${pc==null?"":pc>=90?"ok":pc>=60?"wa":"bad"}">${pc==null?"—":pc+"%"}</span></button>`}).join("");
  const sel=(id,v,opts)=>`<select id="${id}" class="gx-sel${v&&v!=="all"?" act":""}">${opts.map(([a,b])=>`<option value="${esc(a)}" ${a===v?"selected":""}>${esc(b)}</option>`).join("")}</select>`;
  const rngTxt=idx.length?`${lab(idx[0]).m} ${lab(idx[0]).y} – ${lab(idx[idx.length-1]).m} ${lab(idx[idx.length-1]).y}`:"—";
  return `<div class="card ovan ovbcard"><div class="ovanh"><div><h3>Monthly benefit realisation</h3><p>${esc(scope)} · ${L.length} benefit line${L.length!==1?"s":""}${o.flow?" · "+esc(o.flow):""}</p></div><span class="sp"></span><span class="ovrng">${cum?"Cumulative":"Monthly"} · ${rngTxt}</span></div>
    <div class="ovbf"><span class="seg gx-unit"><button type="button" data-bfv="m" class="${cum?"":"on"}">Monthly</button><button type="button" data-bfv="c" class="${cum?"on":""}">Cumulative</button></span>
      <label>Split by ${sel("bfSplit",o.split,Object.entries(SPL))}</label>
      <label>E2E flow ${sel("bfFlow",o.flow,[["","All flows"],...flows.map(f=>[f,f])])}</label>
      <label>Period ${sel("bfRange",o.range,[["all","All months"],["ytd","This year"],["n12","Next 12 months"],["l12","Last 12 months"],...yrs.map(y=>[y,y])])}</label>
      ${o.split||o.flow||o.range!=="all"||o.iso||cum?'<button type="button" class="gx-link" id="bfReset">Reset</button>':""}</div>
    <div class="ovsum"><div><small>Planned to date</small><b>THB ${fmtNum(Math.round(pTD))}</b></div><div><small>Actual to date</small><b class="ok">THB ${fmtNum(Math.round(aTD))}</b><span>${aTD?"Realised benefits logged":"No realised benefits recorded"}</span></div><div><small>Plan achieved</small><b>${pTD?Math.round(aTD/pTD*100):0}%</b><span>Actual ÷ planned to date</span></div></div>
    ${o.iso?`<div class="ovbiso">Showing only <b>${esc(o.iso)}</b> <button type="button" class="gx-link" data-bfiso="${esc(o.iso)}">Show all</button></div>`:""}
    ${chart}<div class="ovleg">${o.split?keys.map(k=>`<span><i style="background:${col(k)}"></i>${esc(k)}</span>`).join("")+'<span><i class="bf" style="opacity:.6"></i>lighter = future</span>':'<span><i class="bp"></i>Planned (to date)</span><span><i class="bf"></i>Planned (future)</span>'}<span><i class="ba"></i>Actual</span><span><i class="td"></i>Today</span></div>
    <div class="ovbtw"><div class="ovbth"><span>${esc(SPL[o.split]||"Breakdown")}</span><span>Lines</span><span>Run-rate / yr</span><span>Hours / mo</span><span>Plan to date</span><span>Actual to date</span><span>Achieved</span></div>${rowsT||'<p class="muted" style="margin:8px">No benefit lines.</p>'}</div></div>`}
function ovBenBind(m){const U=UI.dash;const o=U.bf;if(!o)return;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-bfv]").forEach(b=>b.onclick=()=>{o.view=b.dataset.bfv;re()});
  [["bfSplit","split"],["bfFlow","flow"],["bfRange","range"]].forEach(([id,k])=>{const el=m.querySelector("#"+id);if(el)el.onchange=()=>{o[k]=el.value;if(k==="split")o.iso="";re()}});
  m.querySelectorAll("[data-bfiso]").forEach(b=>b.onclick=()=>{o.iso=o.iso===b.dataset.bfiso?"":b.dataset.bfiso;re()});
  const r=m.querySelector("#bfReset");if(r)r.onclick=()=>{U.bf={view:"m",split:"",flow:"",range:"all",iso:""};re()}}
