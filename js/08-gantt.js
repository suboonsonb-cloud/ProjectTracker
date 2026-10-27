/* 08-gantt.js — Gantt report */
"use strict";
/* ---- gantt ---- */
function gPpl(v,t,none){const a=Array.isArray(v)?v:(v?[v]:[]);let txt=a.length>2?a.slice(0,2).join(", ")+" +"+(a.length-2):a.join(", ");
  return `<span class="g-ppl" title="${esc(t)}: ${esc(a.join(", ")||"—")}${none?` · ${none} project(s) not assigned`:""}">${txt?esc(txt):'<span class="muted">—</span>'}${none&&a.length?` <span class="muted">· ${none} n/a</span>`:""}</span>`}
/* re-drawing the Gantt (expand a project, highlight a row …) must not jump the page back to the top:
   remember the page scroll and every inner scroll box, then put them back after the redraw */
function vGantt(m){
  const again=m.dataset.v==="gantt";const keep=again?{y:window.scrollY,x:window.scrollX,els:[...m.querySelectorAll("*")].filter(e=>e.scrollTop||e.scrollLeft).map(e=>({sel:scrollKey(e,m),t:e.scrollTop,l:e.scrollLeft}))}:null;
  const h0=m.offsetHeight;if(again)m.style.minHeight=h0+"px";   /* keep the page height while it re-draws, so the browser does not scroll up */
  vGantt0(m);m.dataset.v="gantt";
  if(keep){const put=()=>{for(const k of keep.els){const e=k.sel&&m.querySelector(k.sel);if(e){e.scrollTop=k.t;e.scrollLeft=k.l}}if(Math.abs(window.scrollY-keep.y)>2)window.scrollTo(keep.x,keep.y)};put();
    /* swimlane pictures in the Gantt are re-drawn in the background; hold the page height until they are back, then let go */
    const t0=Date.now(),wait=()=>{const busy=typeof E2E_SNAPQ!=="undefined"&&Object.keys(E2E_SNAPQ).length>0;put();if(busy&&Date.now()-t0<2500){setTimeout(wait,80);return}
      requestAnimationFrame(()=>{m.style.minHeight="";put()})};requestAnimationFrame(wait)}
}
function scrollKey(e,root){const p=[];for(let n=e;n&&n!==root;n=n.parentElement){if(n.id){p.unshift("#"+CSS.escape(n.id));break}const c=[...n.parentElement.children].indexOf(n)+1;p.unshift(`${n.tagName.toLowerCase()}:nth-child(${c})`)}return p.length?(p[0].startsWith("#")?"":":scope > ")+p.join(" > "):null}
function vGantt0(m){
  const g=UI.gantt;const P=projects().filter(p=>p.id);
  const fv=(p,f)=>gv("Projects",f,p.r)||"(blank)";
  const bus=uniq(P.map(p=>fv(p,FP.bu)));const P1=P.filter(p=>!g.bu||fv(p,FP.bu)===g.bu);
  const cfs=uniq(P1.map(p=>fv(p,FP.cf)));if(g.cf&&!cfs.includes(g.cf))g.cf="";const P2=P1.filter(p=>!g.cf||fv(p,FP.cf)===g.cf);
  const procs=uniq(P2.map(p=>fv(p,FP.proc)));if(g.proc&&!procs.includes(g.proc))g.proc="";const P2b=P2.filter(p=>!g.proc||fv(p,FP.proc)===g.proc);
  const teams=uniq(P2b.map(p=>fv(p,"AB")));if(g.team&&!teams.includes(g.team))g.team="";const P3=P2b.filter(p=>!g.team||fv(p,"AB")===g.team);
  if(g.proj&&!P3.some(p=>p.id===g.proj))g.proj="";
  let PR=P3.filter(p=>!g.proj||p.id===g.proj);
  if(g.hideDone)PR=PR.filter(p=>!["Completed","Cancelled"].includes(pStat(p.r)));
  const tasksBy={};rowsOf("Activities").forEach(r=>{const pid=gv("Activities",FA.pid,r);(tasksBy[pid]=tasksBy[pid]||[]).push(r)});
  const chg=changedRows("Activities");
  const tDates=r=>{const t=tLive(r);return {s:+t.fs||0,e:+t.fe||0,ps:+gv("Activities",FA.ps,r)||0,pe:+gv("Activities",FA.pe,r)||0}};
  const pDates=p=>{const L=pLive(p.r);return {s:+L.fstart||0,e:+L.fend||0,ps:+gv("Projects",FP.ps,p.r)||0,pe:+gv("Projects",FP.pe,p.r)||0}};
  const lines=[];
  const segOf=r=>({...tDates(r),status:tStat(r),fc:tLive(r).fc||"",name:gv("Activities",FA.task,r)});
  const pushP=(p,ind)=>{const d=pDates(p);lines.push({lvl:0,ind,p,d,rp:pLive(p.r).rpdays||0,rpref:pLive(p.r).rpref,segs:(tasksBy[p.id]||[]).map(segOf),label:p.name,id:p.id,status:pStat(p.r),pct:pLive(p.r).comp??(+gv("Projects",FP.comp,p.r)||0),team:gv("Projects","AB",p.r),wsl:gv("Projects",FP.wsl,p.r),lead:gv("Projects",FP.lead,p.r),meta:[gv("Projects",FP.proc,p.r),gv("Projects","AB",p.r),gv("Projects",FP.cf,p.r),gv("Projects",FP.lead,p.r)].filter(Boolean).join(" · ")});
    if(g.level!=="projects"&&g.open.has(p.id)){const ts=(tasksBy[p.id]||[]);const byStage={};ts.forEach(r=>{const st=gv("Activities",FA.stage,r);(byStage[st]=byStage[st]||[]).push(r)});
      for(const st of Object.keys(byStage)){const rs=byStage[st];const ds=rs.map(tDates);const s=Math.min(...ds.map(x=>x.s).filter(Boolean)),e=Math.max(...ds.map(x=>x.e).filter(Boolean));
        const fin=x=>isFinite(x)?x:0;lines.push({lvl:1,ind,label:st,id:"",rp:Math.max(0,...rs.map(r=>tLive(r).rpdays||0)),segs:rs.map(segOf),d:{s:fin(s),e:fin(e),ps:fin(Math.min(...ds.map(x=>x.ps).filter(Boolean))),pe:fin(Math.max(...ds.map(x=>x.pe).filter(Boolean)))},status:"",pct:0});
        if(g.level==="tasks")for(const r of rs)lines.push({lvl:2,ind,pic:gv("Activities",FA.pic,r),fc:tLive(r).fc,label:gv("Activities",FA.task,r),id:tId(r),rp:tLive(r).rpdays||0,rpref:tLive(r).rpref,d:tDates(r),status:tStat(r),pct:tLive(r).eact??(+gv("Activities",FA.act,r)||0),pending:chg.has(r)})}}};
  /* group rows: E2E flow ▸ swimlane (left lane first) ▸ project — or a flat project list */
  const agg=(label,kind,key,ps,ind)=>{const ds=ps.map(pDates);const mn=a=>{const v=a.filter(Boolean);return v.length?Math.min(...v):0},mx=a=>{const v=a.filter(Boolean);return v.length?Math.max(...v):0};
    const fcOf=p=>{const st=pStat(p.r);return st==="Completed"?"Done":st==="Delayed"?"Late":st==="On-Hold"||st==="Cancelled"?st:st==="At Risk"?"At risk of delay":"On time"};
    return {lvl:-1,kind,key,ind,label,id:"",d:{s:mn(ds.map(x=>x.s)),e:mx(ds.map(x=>x.e)),ps:mn(ds.map(x=>x.ps)),pe:mx(ds.map(x=>x.pe))},segs:ps.map(p=>({...pDates(p),fc:fcOf(p),status:pStat(p.r),name:p.name})),status:"",pct:ps.length?ps.reduce((a,p)=>a+(pLive(p.r).comp||0),0)/ps.length:0,n:ps.length,wsl:uniq(ps.map(p=>gv("Projects",FP.wsl,p.r)).filter(Boolean)),wslNone:ps.filter(p=>!gv("Projects",FP.wsl,p.r)).length,lead:uniq(ps.map(p=>gv("Projects",FP.lead,p.r)).filter(Boolean)),leadNone:ps.filter(p=>!gv("Projects",FP.lead,p.r)).length}};
  const GRP=g.grp!=="flat"&&typeof hasE2E==="function"&&hasE2E();let FLOWS=[];
  const noE2E=g.grp!=="flat"&&!(typeof hasE2E==="function"&&hasE2E());
  if(GRP){const inPR=new Set(PR.map(p=>p.id));const used=new Set();
    for(const f of e2eFlows()){const doc=(f.v["TO-BE"]&&f.v["TO-BE"].doc)||(f.v["AS-IS"]&&f.v["AS-IS"].doc);if(!doc)continue;
      const lanes=(doc.lanes||[]).map(l=>({name:l.name,ids:new Set()}));
      for(const ver of ["TO-BE","AS-IS"]){const dd=f.v[ver]&&f.v[ver].doc;if(!dd)continue;for(const sh of dd.shapes||[])for(const pid of sh.proj||[]){if(!inPR.has(pid))continue;const ln=laneOfShape(dd,sh);let L=lanes.find(x=>x.name===ln);if(!L){L={name:ln,ids:new Set()};lanes.push(L)}if(ver==="TO-BE"||![...lanes].some(x=>x.ids.has(pid)))L.ids.add(pid)}}
      const pids=new Set(lanes.flatMap(l=>[...l.ids]));if(!pids.size)continue;pids.forEach(x=>used.add(x));FLOWS.push({f,doc,lanes:lanes.filter(l=>l.ids.size),pids})}
    for(const F of FLOWS){const fk="f:"+F.f.id;const ps=PR.filter(p=>F.pids.has(p.id));lines.push({...agg(F.f.name,"f",fk,ps,0),meta:`${ps.length} project(s) · E2E flow`});
      if(g.open.has(fk))for(const L of F.lanes){const lk=fk+"|"+L.name;const lp=PR.filter(p=>L.ids.has(p.id));lines.push({...agg(L.name,"l",lk,lp,1),meta:"swimlane"});
        if(g.open.has(lk))lp.forEach(p=>pushP(p,2))}}
    const rest=PR.filter(p=>!used.has(p.id));if(rest.length){const nk="f:none";lines.push({...agg("No E2E flow mapped yet","f",nk,rest,0),none:true});if(g.open.has(nk))rest.forEach(p=>pushP(p,1))}}
  else for(const p of PR)pushP(p,0);
  const all=lines.flatMap(l=>[l.d.s,l.d.e,l.d.ps,l.d.pe]).filter(x=>x>0&&isFinite(x));
  let min=all.length?Math.min(...all):TODAY-90,max=all.length?Math.max(...all):TODAY+180;min=Math.min(min,TODAY-30);max=Math.max(max,TODAY+183);
  const d0=serialToDate(min);min=dateToSerial(new Date(Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth(),1)));const d1=serialToDate(max);max=dateToSerial(new Date(Date.UTC(d1.getUTCFullYear(),d1.getUTCMonth()+1,1)));
  const px=[0.6,1,1.6,2.6,4][g.zoom-1]||1.6;const W=Math.max(600,(max-min)*px);const X=s=>(s-min)*px;
  const HT=(c,bg)=>`repeating-linear-gradient(135deg,${c} 0 3px,${bg} 3px 6.5px)`;
  /* same language as the project-page Gantt: solid = work (green done / pale green on time / amber at risk), red hatch = delay, white outline = plan */
  const FCB={"Done":"#2E7D32","Late":HT("#D92D20","#FDA29B"),"On time":"#A6D5AA","At risk of delay":"#F5B544","Not started":"#CFE8D1","On-Hold":"#475467","Cancelled":"#E1E5EA"};
  const FCL={"Done":"Completed","Late":"Delayed","On time":"Forecast on time","At risk of delay":"Forecast at risk of delay","Not started":"Not started","On-Hold":"On hold","Cancelled":"Cancelled"};
  const lineFc=l=>{if(l.fc)return l.fc;const st=l.status,fs=(l.segs||[]).map(t=>t.fc);if(st==="Completed")return "Done";if(st==="Delayed")return "Late";if(st==="On-Hold"||st==="Cancelled")return st;if(st==="At Risk"||fs.includes("At risk of delay"))return "At risk of delay";return "On time"};
  let monthsHtml="";for(let d=serialToDate(min);dateToSerial(d)<max;d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1))){const s=dateToSerial(d);
    monthsHtml+=`<div class="g-month" style="left:${X(s)}px">${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}</div>`}
  /* tree guides (├ └ │) so the breakdown flow ▸ lane ▸ project ▸ stage ▸ task reads like a structure */
  const dep=lines.map(l=>l.kind?(l.ind||0):(l.ind||0)+l.lvl);const nxt=new Array(lines.length).fill(false);{const seen=[];for(let i=lines.length-1;i>=0;i--){const d=dep[i];nxt[i]=!!seen[d];seen[d]=true;seen.length=d+1}}
  const guides=[];{const anc=[];lines.forEach((l,i)=>{const d=dep[i];let h="";if(d>0){for(let k=1;k<d;k++)if(anc[k])h+=`<i class="gtv" style="left:${8+(k-1)*16+6}px"></i>`;h+=`<i class="gte${nxt[i]?"":" last"}" style="left:${8+(d-1)*16+6}px"></i>`}anc[d]=nxt[i];anc.length=d+1;guides.push(h)})}
  let gi=-1;const left=lines.map(l=>(gi++,l.kind?`<div class="g-row gd${Math.min(5,dep[gi])} ${l.kind==="f"?"gf":"gl"} ${g.hl===l.key?"ghl":""}" style="padding-left:${8+(l.ind||0)*16}px">${guides[gi]}<span class="g-caret" data-gk="${esc(l.key)}">${g.open.has(l.key)?"▾":"▸"}</span>
      <span class="g-name" title="${esc(l.label)}">${l.kind==="f"?(l.none?"○ ":"⇄ "):"▭ "}${esc(l.label)} <span class="muted" style="font-weight:400">(${l.n})</span></span>${gPpl(l.wsl,"Workstream leader(s)",l.wslNone)}${gPpl(l.lead,"Project leads",l.leadNone)}<span class="g-meta">${Math.round(l.pct*100)}%</span></div>`
    :`<div class="g-row gd${Math.min(5,dep[gi])} ${l.lvl===0?"p":l.lvl===1?"s":""} ${l.lvl===0&&GRP&&g.hl===l.id?"ghl":""}" style="padding-left:${8+((l.ind||0)+l.lvl)*16}px" ${l.lvl===0&&GRP?`data-ghp="${esc(l.id)}"`:""}>${guides[gi]}
      ${l.lvl===0?`<span class="g-caret" data-p="${esc(l.id)}">${g.level==="projects"?"":g.open.has(l.id)?"▾":"▸"}</span>`:""}
      <span class="g-name" title="${esc(l.id+" "+l.label+(l.meta?" | "+l.meta:""))}">${l.lvl===2?`<span class="muted">${esc(l.id.split("-").pop())}</span> `:""}${esc(l.label)}${l.lvl===0&&l.team?` <span class="pteam">${esc(l.team)}</span>`:""}${l.pending?' <span class="badge-changes" style="font-size:10px;padding:0 6px">edited</span>':""}${l.rp&&l.lvl!==1?rpTag(l.rp,l.rpref):""}</span>
      ${l.lvl===0?gPpl(l.wsl,"Workstream leader")+gPpl(l.lead,"Project lead"):l.lvl===2?'<span class="g-ppl"></span>'+gPpl(l.pic,"Task PIC"):'<span class="g-ppl"></span><span class="g-ppl"></span>'}<span class="g-meta">${l.lvl!==1?Math.round(l.pct*100)+"%":""}</span></div>`)).join("");
  const right=lines.map((l,ri)=>{let h="";if(l.d.ps&&l.d.pe){const bw=Math.max(2,X(l.d.pe+1)-X(l.d.ps));h+=`<div class="g-base" style="left:${X(l.d.ps)}px;width:${bw}px" title="Plan (baseline) ${fmtDate(l.d.ps)} → ${fmtDate(l.d.pe)}">${bw>=30?"Plan":""}</div>`}
    if(l.d.s&&l.d.e){const x0=X(l.d.s),w=Math.max(3,X(l.d.e+1)-x0);
      /* started late: solid red from the plan start up to where the bar now starts (the delay so far) */
      if(l.d.ps&&l.d.s>l.d.ps&&l.d.ps<=TODAY){const lx=X(l.d.ps),lw=Math.max(2,x0-lx);const dd=l.d.s-l.d.ps;h+=`<div class="g-late${l.lvl===2?" t":""}" style="left:${lx}px;width:${lw}px" title="Late start: planned ${fmtDate(l.d.ps)}, now ${fmtDate(l.d.s)} (+${dd}d)">${lw>=58?`<span>late +${dd}d</span>`:""}</div>`}
      /* tag after the bar: how many days the end is behind the plan */
      if(l.d.pe&&l.d.e>l.d.pe&&!l.none){const sl=l.d.e-l.d.pe;h+=`<span class="g-latetag" style="left:${X(l.d.e+1)+4+(l.rp?54:0)}px" title="Forecast end ${fmtDate(l.d.e)} vs plan end ${fmtDate(l.d.pe)}">⚠ +${sl}d</span>`}
      if(l.lvl<2){const SEV={"Cancelled":0,"Done":1,"Not started":2,"On time":3,"On-Hold":4,"At risk of delay":5,"Late":6};
        const segs=(l.segs||[]).filter(t=>t.s&&t.e).sort((a,b)=>(SEV[a.fc]??3)-(SEV[b.fc]??3));
        const inner=segs.map(t=>{const sx=Math.max(0,X(t.s)-x0),sw=Math.max(2,Math.min(w,X(t.e+1)-x0)-sx);return `<div class="g-seg" style="left:${sx}px;width:${sw}px;background:${FCB[t.fc]||FCB["On time"]}" title="${esc(t.name)}: ${fmtDate(t.s)} → ${fmtDate(t.e)} · ${esc(t.status)} · ${esc(FCL[t.fc]||"")}"></div>`}).join("");
        h+=`<div class="g-bar" style="left:${x0}px;width:${w}px;background:${l.kind==="f"?"#C9D3E0":l.lvl===0?"#D3DAE3":"#E1E6ED"};box-shadow:inset 0 0 0 ${l.kind==="f"?"2px #1F3864":l.lvl===0?"1.5px #1F3864":"1px #8497B0"};height:${l.kind==="f"?18:l.lvl===0?16:14}px;top:${l.kind==="f"?2:l.lvl===0?3:4}px" title="${esc(l.label)}: ${fmtDate(l.d.s)} → ${fmtDate(l.d.e)}${l.status?" · "+esc(l.status):""}">${inner}</div>`}
      else h+=`<div class="g-bar t" style="left:${x0}px;width:${w}px;background:${FCB[lineFc(l)]}" title="${esc(l.label)}: ${fmtDate(l.d.s)} → ${fmtDate(l.d.e)} · ${esc(l.status||"")} · ${esc(FCL[lineFc(l)])}">${l.pct>0?`<div class="g-prog" style="width:${Math.min(100,l.pct*100)}%"></div>`:""}</div>`}
    if(l.lvl===0&&!l.d.s&&!l.d.ps)h+=`<button class="g-nodates" data-gop="${l.p.r}">No dates yet — open project ›</button>`;
    if(l.rp&&l.d.e)h+=`<span class="g-rpflag" style="left:${X(l.d.e+1)+4}px" title="Approved re-plan ${esc((l.rpref||[]).join(", "))}">⟳ +${l.rp}d</span>`;
    if(l.none)h="";if(l.lvl===1&&!l.kind&&g.level==="tasks")h="";/* stage rows are just headings when the tasks are shown — no subtotal bar *//* "No E2E flow mapped yet" is a bucket, not a process — no summary bar */
    return `<div class="g-row gr gd${Math.min(5,dep[ri])} ${l.kind==="f"?"gf":l.kind==="l"?"gl":""}">${h}</div>`}).join("");
  /* swimlane picture of the open flow(s); the selected project's / lane's steps are highlighted */
  const openF=GRP?FLOWS.filter(F=>g.open.has("f:"+F.f.id)):[];
  const swim=openF.map(F=>`<div class="card pad gswim"><div class="e2esnaph"><b>⇄ ${esc(F.f.name)}</b><span class="muted">TO-BE swimlane — ${g.hl&&!String(g.hl).startsWith("f:")?"highlighted: "+esc(String(g.hl).includes("|")?String(g.hl).split("|").pop()+" lane":(projects().find(p=>p.id===g.hl)||{}).name||g.hl):"click a lane or a project in the Gantt to highlight its steps"}</span><span style="flex:1"></span><span class="gzbtns" role="group" aria-label="Zoom the swimlane"><button class="btn small" data-gsz="-" data-f="${esc(F.f.id)}" title="Zoom out">−</button><span class="gzv">${Math.round(((g.swz||{})[F.f.id]||1)*100)}%</span><button class="btn small" data-gsz="+" data-f="${esc(F.f.id)}" title="Zoom in">＋</button><button class="btn small" data-gsz="0" data-f="${esc(F.f.id)}" title="Fit to width">Fit</button></span><button class="btn small" data-gopenflow="${esc(F.f.id)}">Open in E2E flows ›</button></div>
     <div class="e2esnapimg gswimimg" data-gsnap="${esc(F.f.id)}" style="--gsz:${(g.swz||{})[F.f.id]||1}" title="Ctrl + scroll to zoom"></div></div>`).join("");
  m.innerHTML=`${banner("report")}<div class="toolbar">${sel("gb","BU",bus,g.bu)}${sel("gf","CF",cfs,g.cf)}${sel("gc","Process",procs,g.proc)}${sel("gt","Team",teams,g.team||"")}${sel("gp","Project",P3.map(p=>p.id),g.proj)}
    <span class="seg" title="Group the Gantt"><button data-ggrp="e2e" class="${g.grp!=="flat"?"on":""}">By E2E flow</button><button data-ggrp="flat" class="${g.grp==="flat"?"on":""}">Projects</button></span>
    <select id="gl"><option value="projects" ${g.level==="projects"?"selected":""}>Projects only</option><option value="stages" ${g.level==="stages"?"selected":""}>+ Stages</option><option value="tasks" ${g.level==="tasks"?"selected":""}>+ Stages + Tasks</option></select>
    <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gh" ${g.hideDone?"checked":""}> Hide completed/cancelled</label>
    <button class="btn small" id="gx">Expand all</button><button class="btn small" id="gcoll">Collapse all</button>
    <span class="glegend2">${[["Done","Completed"],["On time","On time / remaining"],["At risk of delay","At risk"],["Late","Delayed"],["On-Hold","On hold"]].map(([k,l])=>`<span><i style="background:${FCB[k]}"></i>${l}</span>`).join("")}<span><i class="pl"></i>Plan (lower bar)</span><span><i class="td"></i>Today</span></span>
    <span style="flex:1"></span><span class="nowrapg"><span class="muted">Zoom</span><input type="range" id="gz" min="1" max="5" value="${g.zoom}"></span></div>
    ${noE2E?`<div class="warnbox" style="margin-bottom:10px">Grouping by E2E flow needs the E2E_Flows sheet — open <b>SGA_Reduction_Initiative_Tracker_17.xlsx</b> (this workbook is an older version).</div>`:""}${swim}<div class="gantt"><div class="g-left"><div class="g-head" style="display:flex;align-items:flex-end;padding:6px 8px;font-weight:700;font-size:12px;color:var(--navy)"><span class="g-name">${GRP?"E2E flow ▸ Lane ▸ Project ▸ Task":"Project ▸ Stage ▸ Task"}</span><span class="g-ppl" title="Workstream leader">WS leader</span><span class="g-ppl" title="Project lead (project rows) · PIC (task rows)">Lead / PIC</span><span class="g-meta">% done</span></div><div id="gL">${left}</div></div>
    <div class="g-right" id="gR"><div class="g-canvas" style="width:${W}px"><div class="g-head" style="position:sticky">${monthsHtml}</div>${right}
    ${TODAY>=min&&TODAY<=max?`<div class="g-today" style="left:${X(TODAY)}px" title="Today"></div>`:""}</div></div></div>

    <details class="muted" style="font-size:12px;margin-top:8px"><summary>ⓘ How the bars are calculated</summary><p class="muted" style="font-size:12px">Top bar = live forecast (same rules as the Excel workbook: RAIDD blocks, late-start and overdue shifts, approved re-plans). Bottom bar = original plan. <b>Hatched</b> = work still to come, coloured by prediction: <b>amber</b> when the task is already At Risk (slip, overdue RAIDD, late start) or its % done trails the share of plan time elapsed by more than ${Math.round((()=>{const v=setting("S_PredTol");return v===""?0.15:+v})()*100)} points (Lists → S_PredTol); otherwise <b>green</b>. Not-started (future) tasks are hatched too: amber when an earlier stage of the same project is forecast to finish after its own plan end and after this task should start. Project and stage bars are coloured section by section from their tasks. Hover any section for detail.</p></details>`;
  const gl=$("#gL"),gr=$("#gR");gr.onscroll=()=>{gl.style.transform=`translateY(${-gr.scrollTop}px)`};
  gl.parentElement.addEventListener("wheel",e=>{if(!e.deltaY)return;e.preventDefault();gr.scrollTop+=e.deltaY},{passive:false});
  gr.style.maxHeight="calc(100vh - 290px)";gl.parentElement.style.maxHeight="calc(100vh - 290px)";
  $("#gp").onchange=e=>{g.proj=e.target.value;if(g.proj)g.open.add(g.proj);vGantt(m)};$("#gc").onchange=e=>{g.proc=e.target.value;vGantt(m)};$("#gb").onchange=e=>{g.bu=e.target.value;g.cf="";g.proc="";g.proj="";vGantt(m)};$("#gf").onchange=e=>{g.cf=e.target.value;g.proc="";g.proj="";vGantt(m)};
  $("#gl").onchange=e=>{g.level=e.target.value;vGantt(m)};$("#gz").oninput=e=>{g.zoom=+e.target.value;vGantt(m)};$("#gh").onchange=e=>{g.hideDone=e.target.checked;vGantt(m)};
  $("#gx").onclick=()=>{PR.forEach(p=>g.open.add(p.id));if(GRP){FLOWS.forEach(F=>{g.open.add("f:"+F.f.id);F.lanes.forEach(L=>g.open.add("f:"+F.f.id+"|"+L.name))});g.open.add("f:none")}if(g.level==="projects")g.level="tasks";vGantt(m)};$("#gcoll").onclick=()=>{g.open.clear();vGantt(m)};
  m.querySelectorAll(".g-caret[data-p]").forEach(c=>c.onclick=e=>{e.stopPropagation();const id=c.dataset.p;g.open.has(id)?g.open.delete(id):g.open.add(id);if(g.level==="projects"&&g.open.has(id))g.level="tasks";vGantt(m)});
  m.querySelectorAll("[data-ggrp]").forEach(b=>b.onclick=()=>{g.grp=b.dataset.ggrp;vGantt(m)});
  m.querySelectorAll("[data-gop]").forEach(b=>b.onclick=e=>{e.stopPropagation();openProject(+b.dataset.gop)});
  const gt=m.querySelector("#gt");if(gt)gt.onchange=e=>{g.team=e.target.value;vGantt(m)};
  m.querySelectorAll("[data-gk]").forEach(c=>c.parentElement.onclick=()=>{const k=c.dataset.gk;if(g.open.has(k)){g.open.delete(k);if(g.hl===k||String(g.hl||"").startsWith(k))g.hl=null}else{g.open.add(k);g.hl=k}vGantt(m)});
  m.querySelectorAll("[data-ghp]").forEach(r=>r.onclick=e=>{if(e.target.closest(".g-caret"))return;g.hl=g.hl===r.dataset.ghp?null:r.dataset.ghp;vGantt(m)});
  m.querySelectorAll("[data-gopenflow]").forEach(b=>b.onclick=()=>{UI.e2e.home=false;UI.e2e.flow=b.dataset.gopenflow;UI.e2e.ver="TO-BE";view="E2E";render()});
  const gsz=(fid,dir)=>{g.swz=g.swz||{};const Z=[0.5,0.75,1,1.25,1.5,2,2.5,3];let z=g.swz[fid]||1;if(dir==="0")z=1;else{let i=Z.findIndex(x=>x>=z-1e-9);if(i<0)i=Z.length-1;i=Math.max(0,Math.min(Z.length-1,i+(dir==="+"?1:-1)));z=Z[i]}g.swz[fid]=z;
    const el=m.querySelector(`[data-gsnap="${CSS.escape(fid)}"]`);if(el){const fx=el.scrollLeft/Math.max(1,el.scrollWidth),fy=el.scrollTop/Math.max(1,el.scrollHeight);el.style.setProperty("--gsz",z);el.scrollLeft=fx*el.scrollWidth;el.scrollTop=fy*el.scrollHeight;const v=el.parentElement.querySelector(".gzv");if(v)v.textContent=Math.round(z*100)+"%"}};
  m.querySelectorAll("[data-gsz]").forEach(b=>b.onclick=()=>gsz(b.dataset.f,b.dataset.gsz));
  m.querySelectorAll("[data-gsnap]").forEach(el=>el.addEventListener("wheel",e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();gsz(el.dataset.gsnap,e.deltaY<0?"+":"-")},{passive:false}));
  if(openF.length){e2eEnsureFrame();openF.forEach(F=>{const el=m.querySelector(`[data-gsnap="${CSS.escape(F.f.id)}"]`);if(!el)return;
    const hl=g.hl||"";let ids=[];if(String(hl).includes("|")){const ln=String(hl).split("|").pop();ids=(F.doc.shapes||[]).filter(sh=>(sh.proj||[]).length&&laneOfShape(F.doc,sh)===ln).map(sh=>sh.id)}
    else if(hl&&!String(hl).startsWith("f:"))ids=(F.doc.shapes||[]).filter(sh=>(sh.proj||[]).includes(hl)).map(sh=>sh.id);
    else ids=[];/* nothing selected: plain picture with count chips */
    el.dataset.hl=ids.join(",");e2eSnapshot(F.doc,el)})}
  if(TODAY>=min&&TODAY<=max&&!g._scrolled){gr.scrollLeft=Math.max(0,X(TODAY)-gr.clientWidth/3);g._scrolled=true}
}

