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
    /* lane health: worst status of its projects → colour; progress ring = average % done */
    const tone=Lx=>{const st=[...Lx.pids].map(p=>byId.get(p)).filter(Boolean).map(pStat);return st.includes("Delayed")?"bad":st.includes("At Risk")?"risk":st.length&&st.every(x=>x==="Completed"||x==="Cancelled")?"ok":st.every(x=>x==="Not Started")?"ns":"ip"};
    const lprog=Lx=>{const rs=[...Lx.pids].map(p=>byId.get(p)).filter(Boolean);return rs.length?rs.reduce((a,r)=>a+(pLive(r).comp||0),0)/rs.length:0};
    const ring=(v,t)=>`<span class="ovring ${t}" style="--p:${Math.round(v*100)}"><b>${Math.round(v*100)}</b></span>`;
    const strip=`<div class="ovstrip" role="list" aria-label="Swimlanes of this workflow">${lanes.map((x,i)=>`${i?'<span class="ovarr" aria-hidden="true"><svg viewBox="0 0 24 10"><path d="M0 5h20m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':""}<button type="button" role="listitem" class="ovnode ${tone(x)}${open&&x.name===selL?" on":""}" data-ovnode="${esc(x.name)}" data-ovf="${esc(F.f.id)}" title="${esc(x.name)} · ${x.procs.length} process(es) · ${x.pids.size} project(s) · ${Math.round(lprog(x)*100)}% done"><i></i><span>${esc(x.name)}</span><b>${x.pids.size}</b></button>`).join("")}</div>`;
    const ICON=`<span class="ovficon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="3" width="6" height="5" rx="1.5"/><rect x="15.5" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="16" width="6" height="5" rx="1.5"/><path d="M8.5 5.5h7M18.5 8v3.5H12V16M5.5 8v3.5H12" fill="none"/></svg></span>`;
    return `<div class="card ovflow${open?" open":""}"><button type="button" class="ovfh" data-ovflow="${esc(F.f.id)}" aria-expanded="${open}">
      <span class="chev">${open?"⌄":"›"}</span>${ICON}<span class="nm"><b>${esc(F.f.name)}</b><small>${lanes.length} swimlane${lanes.length!==1?"s":""} · ${F.pids.size} unique project${F.pids.size!==1?"s":""}${F.ver==="AS-IS"?" · AS-IS map":""}</small></span>
      <span class="ovfst ${stC}">${stT}</span>${nDel?`<span class="ovfdl">${nDel} delayed</span>`:""}
      <span class="m pg"><small>Project progress</small><b>${pct(prog)}%</b>${bar(prog,stC==="ok"?"ok":"")}</span><span class="m"><small>Planned / year</small><b>${yr?"THB "+fmtShort(yr):"—"}</b></span><span class="m"><small>Planned time saved</small><b>${hr?fmtNum(Math.round(hr))+" h/mo":"—"}</b></span></button>${strip}
      ${open?`<div class="ovfb"><div class="ovlanes"><div class="cap">Swimlanes</div>${lanes.map(x=>`<button type="button" class="ovl${x.name===selL?" on":""}" data-ovlane="${esc(x.name)}" data-ovf="${esc(F.f.id)}">${ring(lprog(x),tone(x))}<span>${esc(x.name)}</span><b>${x.pids.size}</b><i>›</i></button>`).join("")||'<span class="muted">No steps linked yet</span>'}</div>
        <div class="ovproc">${L?`<div class="ovph"><b>${esc(L.name)}</b><span class="muted">${L.procs.length} process${L.procs.length!==1?"es":""} / ${L.pids.size} project${L.pids.size!==1?"s":""}</span><span class="sp"></span><span class="crumb">Workflow › Swimlane › Process › Project</span></div>
          ${L.procs.map((p,i)=>`<div class="ovpc${q&&(hit(p.title)||p.pids.some(projHit))?" hit":""}${i===L.procs.length-1?" last":""}"><span class="ovnum" aria-hidden="true">${i+1}</span><div class="ovpch"><div><small>Process ${String(i+1).padStart(2,"0")}</small><b>${esc(p.title)}</b></div><span class="muted">${p.pids.length} project${p.pids.length!==1?"s":""}</span></div>${p.pids.map(projRow).join("")}</div>`).join("")}`:""}</div></div>
        <div class="ovff"><span class="muted">Projects can support several swimlanes; workflow totals count each project once.</span><button type="button" class="ovlink" data-ovmap="${esc(F.f.id)}">View workflow details →</button></div>`:""}</div>`};
  /* project health */
  const SO={"Delayed":0,"At Risk":1,"On Track":2,"Not Started":3,"On-Hold":4,"Completed":5,"Cancelled":6};
  const drill=(rows,key)=>{const lim=D.hlAll===key?rows.length:8;const srt=[...rows].sort((a,b)=>(SO[pStat(a)]??9)-(SO[pStat(b)]??9)||(pLive(b).comp||0)-(pLive(a).comp||0));
    return `<div class="ovdrill">${srt.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
      return `<button type="button" class="ovdr" data-ovopen="${r}" title="Open project"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}${gv("Projects",FP.lead,r)?" · "+esc(gv("Projects",FP.lead,r)):""}${typeof curStage==="function"&&!["Completed","Cancelled"].includes(pStat(r))?" · "+esc(curStage(r)):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span><span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")||'<p class="muted" style="margin:6px 4px">No projects.</p>'}
      ${rows.length>8?`<button type="button" class="ovlink" data-hlall="${esc(key)}">${D.hlAll===key?"Show fewer":`Show all ${rows.length}`}</button>`:""}</div>`};
  const tot=P.length||1;const stRows=STL.map(s=>({s,n:P.filter(r=>pStat(r)===s).length}));
  const openP=P.filter(r=>!["Completed","Cancelled"].includes(pStat(r)));const stg=[...listFromName("L_StageWF"),...listFromName("L_StageAG"),"(no tasks)","All complete"];
  const sg=uniqOrder(stg).map(s=>({s,n:openP.filter(r=>curStage(r)===s).length})).filter(x=>x.n);const smax=Math.max(1,...sg.map(x=>x.n));
  const top2=[...sg].sort((a,b)=>b.n-a.n).slice(0,2);
  return `  <section class="ove2e" aria-label="E2E workflows"><div class="ovsec"><span class="ove2eic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="3" width="6" height="5" rx="1.5"/><rect x="15.5" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="16" width="6" height="5" rx="1.5"/><path d="M8.5 5.5h7M18.5 8v3.5H12V16M5.5 8v3.5H12" fill="none"/></svg></span><div><span class="ove2etag">E2E workflow</span><h2>E2E workflows</h2><p>Explore the business process first — workflow › swimlane › process › project. Find projects where the work happens.</p></div><span class="sp"></span><label class="ovsrch"><input type="search" id="ovQ" placeholder="Search workflows or projects…" value="${esc(D.ovQ||"")}"></label></div>
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
function ovPRows(rows,key,extra){const D=UI.dash;const lim=D.kAll===key?rows.length:10;const pct=v=>Math.round(v*100);
  const bar=(v,c)=>`<span class="ovbar ${c}"><b style="width:${Math.min(100,pct(v))}%"></b></span>`;const pill=s=>`<span class="ovst st-${esc(s).replace(/\W/g,"")}">${esc(s)}</span>`;
  return `<div class="ovdrill flat">${rows.slice(0,lim).map(r=>{const c=pLive(r).comp||0;const pe=+gv("Projects",FP.pe,r)||0;const late=pe&&pe<TODAY&&!["Completed","Cancelled"].includes(pStat(r));
    return `<button type="button" class="ovdr" data-ovopen="${r}" title="Open project"><span class="n"><b>${esc(gv("Projects",FP.name,r))}</b><small>${esc(pId(r))}${gv("Projects",FP.lead,r)?" · "+esc(gv("Projects",FP.lead,r)):""}${extra?" · "+extra(r):""}</small></span>${pill(pStat(r))}<span class="pc">${pct(c)}%${bar(c,pStat(r)==="Completed"?"ok":pStat(r)==="Delayed"?"bad":"")}</span><span class="dt${late?" bad":""}">${pe?fmtDate(pe):"—"}</span><span class="cv">›</span></button>`}).join("")||'<p class="muted" style="margin:6px 4px">Nothing here.</p>'}
    ${rows.length>10?`<button type="button" class="ovlink" data-kall="${esc(key)}">${D.kAll===key?"Show fewer":`Show all ${rows.length}`}</button>`:""}</div>`}
function ovChips(items,key){const D=UI.dash;const cur=D.kSt&&D.kSt[key]||"";return `<div class="ovkchips">${items.map(([v,l,n,c])=>`<button type="button" data-kst="${esc(v)}" data-kkey="${esc(key)}" class="${cur===v?"on":""}">${c?`<i style="background:${c}"></i>`:""}${esc(l)} <b>${n}</b></button>`).join("")}</div>`}
function ovKpiPanel(k,P,A,D,Bl){const U=UI.dash;U.kSt=U.kSt||{};const done=s=>s==="Completed"||s==="Cancelled";const tot=P.length;const sel=U.kSt[k]||"";
  const srt=rs=>[...rs].sort((a,b)=>(OV_SO[pStat(a)]??9)-(OV_SO[pStat(b)]??9)||String(gv("Projects",FP.name,a)).localeCompare(String(gv("Projects",FP.name,b))));
  const byPid=new Map(P.map(r=>[pId(r),r]));const box=(title,sub,body)=>`<div class="card ovkp" id="ovKp"><div class="ovkph"><div><b>${title}</b><span>${sub}</span></div><button type="button" class="ovkx" data-ovk="${k}" title="Close">✕</button></div>${body}</div>`;
  const eq=(parts)=>`<div class="ovkeq">${parts.map(([n,l,c,cls])=>`<div class="${cls||""}"><b style="${c?`color:${c}`:""}">${n}</b><span>${l}</span></div>`).join('<em>+</em>').replace(/<em>\+<\/em>(<div class="tot)/,'<em>=</em>$1')}</div>`;
  if(k==="active"){const act=P.filter(r=>!done(pStat(r))),cmp=P.filter(r=>pStat(r)==="Completed"),can=P.filter(r=>pStat(r)==="Cancelled");
    const sts=["Delayed","At Risk","On Track","Not Started","On-Hold"].map(s=>[s,s,act.filter(r=>pStat(r)===s).length,SCOL[s]]).filter(x=>x[2]);
    const rows=srt(sel==="Completed"?cmp:sel==="Cancelled"?can:act.filter(r=>!sel||pStat(r)===sel));
    return box("Active projects","Active = every project that is not Completed or Cancelled (On-Hold still counts as active).",
      eq([[act.length,"active","var(--accent)"],[cmp.length,"completed",SCOL.Completed],[can.length,"cancelled","#98A2B3"],[tot,"projects in the current filter","", "tot"]])+
      ovChips([["","All active",act.length,""],...sts,["Completed","Completed",cmp.length,SCOL.Completed],["Cancelled","Cancelled",can.length,"#98A2B3"]],k)+ovPRows(rows,k,r=>curStage(r)))}
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
  if(k==="rp"){const rows=srt(P.filter(r=>pLive(r).rpdays>0));return box("Re-planned","Projects whose dates moved through an approved Re-plan in the RAIDD log.",ovPRows(rows,k,r=>`re-planned +${pLive(r).rpdays}d`))}
  return ""}
function ovKpiBind(m){const U=UI.dash;const re=()=>vDash(m,true);
  m.querySelectorAll("[data-ovk]").forEach(c=>{const f=()=>{const k=c.dataset.ovk;U.kOpen=U.kOpen===k?"":k;U.kAll="";re();if(U.kOpen){const p=m.querySelector("#ovKp");if(p)p.scrollIntoView({block:"nearest",behavior:"smooth"})}};c.onclick=f;c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
  m.querySelectorAll(`.ovk2 [data-ovk="${CSS.escape(U.kOpen||"-")}"]`).forEach(c=>c.classList.add("on"));
  m.querySelectorAll("[data-kst]").forEach(b=>b.onclick=()=>{U.kSt=U.kSt||{};U.kSt[b.dataset.kkey]=b.dataset.kst;U.kAll="";re()});
  m.querySelectorAll("[data-kall]").forEach(b=>b.onclick=()=>{U.kAll=U.kAll===b.dataset.kall?"":b.dataset.kall;re()});
  m.querySelectorAll("#ovKp [data-ovopen]").forEach(b=>b.onclick=()=>openProject(+b.dataset.ovopen))}
