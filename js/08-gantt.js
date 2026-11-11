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
  const teams=uniq(P2b.map(p=>fv(p,"AB")));if(g.team&&!teams.includes(g.team))g.team="";const P2c=P2b.filter(p=>!g.team||fv(p,"AB")===g.team);
  const inits=uniq(P2c.map(p=>fv(p,FP.init)));if(g.init&&!inits.includes(g.init))g.init="";const P2d=P2c.filter(p=>(!g.init||fv(p,FP.init)===g.init)&&(!g.prog||progOf(p.r)===g.prog));
  /* status: one pick from the dropdown (All = every status) */
  const stCount=st=>P2d.filter(p=>pStat(p.r)===st).length;if(g.st&&!STL.includes(g.st))g.st="";
  const P3=P2d.filter(p=>!g.st||pStat(p.r)===g.st);
  /* E2E map of every flow ▸ lane ▸ project (before filters) — used for grouping, lane search and the swimlane card */
  const MAP=gFlowMap();const pNames={};MAP.forEach(F=>F.lanes.forEach(L=>L.ids.forEach(pid=>{(pNames[pid]=pNames[pid]||[]).push(F.f.name,L.name)})));
  /* search box: an exact ID shows that project; other text matches project ID / name, or the flow / lane it sits in */
  const qq=String(g.q||"").trim();const exact=qq&&P3.find(p=>p.id===qq);const ql=qq.toLowerCase();
  let PR=P3.filter(p=>!qq||(exact?p.id===qq:(p.id+" "+gv("Projects",FP.name,p.r)+" "+(pNames[p.id]||[]).join(" ")).toLowerCase().includes(ql)));
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
    return {lvl:-1,kind,key,ind,label,id:"",d:{s:mn(ds.map(x=>x.s)),e:mx(ds.map(x=>x.e)),ps:mn(ds.map(x=>x.ps)),pe:mx(ds.map(x=>x.pe))},segs:[],status:ps.length&&ps.every(p=>pStat(p.r)==="Completed")?"Completed":"",pct:ps.length?ps.reduce((a,p)=>a+(pLive(p.r).comp||0),0)/ps.length:0,n:ps.length,wsl:uniq(ps.map(p=>gv("Projects",FP.wsl,p.r)).filter(Boolean)),wslNone:ps.filter(p=>!gv("Projects",FP.wsl,p.r)).length,lead:uniq(ps.map(p=>gv("Projects",FP.lead,p.r)).filter(Boolean)),leadNone:ps.filter(p=>!gv("Projects",FP.lead,p.r)).length}};
  const hasMap=typeof hasE2E==="function"&&hasE2E();const GRP=g.grp!=="flat"&&hasMap;const noE2E=g.grp!=="flat"&&!hasMap;
  const inPR=new Set(PR.map(p=>p.id));
  const FLOWS=MAP.map(F=>{const lanes=F.lanes.map(L=>({name:L.name,ids:new Set([...L.ids].filter(x=>inPR.has(x)))})).filter(L=>L.ids.size);return {...F,lanes,pids:new Set(lanes.flatMap(L=>[...L.ids]))}}).filter(F=>F.pids.size);
  if(GRP){const used=new Set();FLOWS.forEach(F=>F.pids.forEach(x=>used.add(x)));
    for(const F of FLOWS){const fk="f:"+F.f.id;const ps=PR.filter(p=>F.pids.has(p.id));lines.push({...agg(F.f.name,"f",fk,ps,0),meta:`${ps.length} project(s) · E2E flow`});
      if(g.open.has(fk))for(const L of F.lanes){const lk=fk+"|"+L.name;const lp=PR.filter(p=>L.ids.has(p.id));lines.push({...agg(L.name,"l",lk,lp,1),meta:"swimlane"});
        if(g.open.has(lk))lp.forEach(p=>pushP(p,2))}}
    const rest=PR.filter(p=>!used.has(p.id));if(rest.length){const nk="f:none";lines.push({...agg("No E2E flow mapped yet","f",nk,rest,0),none:true});if(g.open.has(nk))rest.forEach(p=>pushP(p,1))}}
  else for(const p of PR)pushP(p,0);
  /* ---- time window: 12 months, moved with ‹ › ; Month = fits the card, Week = wider and scrolls ---- */
  const mStart=s=>{const d=serialToDate(s);return dateToSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)))};
  const addM=(s,n)=>{const d=serialToDate(s);return dateToSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)))};
  if(!g.win)g.win=addM(mStart(TODAY),-3);
  const min=g.win,max=addM(min,12);const wk=g.unit==="week";
  const LW=innerWidth/ZF()<1280?380:470;const avail=Math.max(600,Math.floor((m.clientWidth||1200)-LW-36));
  const px=wk?5:avail/(max-min);const W=wk?Math.round((max-min)*px):avail;const X=s=>(s-min)*px;
  const fmtM=s=>{const d=serialToDate(s);return MON[d.getUTCMonth()]+" "+d.getUTCFullYear()};
  const curM=mStart(TODAY);
  let monthsHtml="",gridHtml="";for(let s=min;s<max;s=addM(s,1)){const d=serialToDate(s),e=addM(s,1),cur=s===curM;
    monthsHtml+=`<div class="gx-m${cur?" cur":""}" style="left:${X(s)}px;width:${X(e)-X(s)}px"><b>${MON[d.getUTCMonth()]}</b>${d.getUTCMonth()===0||s===min?` <small>${d.getUTCFullYear()}</small>`:""}</div>`;
    gridHtml+=`<i class="gx-vl" style="left:${X(s)}px"></i>`+(cur?`<i class="gx-cur" style="left:${X(s)}px;width:${X(e)-X(s)}px"></i>`:"")}
  if(wk){/* week ticks (Mondays) under the month names */
    let s=min;while(serialToDate(s).getUTCDay()!==1)s++;for(;s<max;s+=7){const d=serialToDate(s);monthsHtml+=`<span class="gx-wk" style="left:${X(s)}px">${d.getUTCDate()}</span>`;gridHtml+=`<i class="gx-vw" style="left:${X(s)}px"></i>`}}
  /* tree guides (├ └ │), light, so the breakdown flow ▸ lane ▸ project ▸ stage ▸ task reads like a structure */
  const dep=lines.map(l=>l.kind?(l.ind||0):(l.ind||0)+l.lvl);const nxt=new Array(lines.length).fill(false);{const seen=[];for(let i=lines.length-1;i>=0;i--){const d=dep[i];nxt[i]=!!seen[d];seen[d]=true;seen.length=d+1}}
  const guides=[];{const anc=[];lines.forEach((l,i)=>{const d=dep[i];let h="";if(d>0){for(let k=1;k<d;k++)if(anc[k])h+=`<i class="gtv" style="left:${8+(k-1)*16+6}px"></i>`;h+=`<i class="gte${nxt[i]?"":" last"}" style="left:${8+(d-1)*16+6}px"></i>`}anc[d]=nxt[i];anc.length=d+1;guides.push(h)})}
  const CHEV=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const chev=(attr,open)=>`<span class="g-caret gx-chev${open?" open":""}" ${attr}>${CHEV}</span>`;
  const doneTxt=l=>`<span class="g-meta gx-done${l.status==="Completed"?" ok":""}">${Math.round((l.pct||0)*100)}%</span>`;
  let gi=-1;const left=lines.map(l=>(gi++,l.kind?`<div class="g-row gd${Math.min(5,dep[gi])} ${l.kind==="f"?"gf":"gl"} ${g.hl===l.key?"ghl":""}" style="padding-left:${8+(l.ind||0)*16}px">${guides[gi]}${chev(`data-gk="${esc(l.key)}"`,g.open.has(l.key))}
      <span class="g-name" title="${esc(l.label)}">${l.kind==="f"?(l.none?'<i class="gx-dot none"></i>':'<i class="gx-dot"></i>'):'<i class="gx-lane"></i>'}${esc(l.label)} <span class="gx-n">${l.n}</span></span>${gPpl(l.wsl,"Workstream leader(s)",l.wslNone)}${doneTxt(l)}</div>`
    :`<div class="g-row gd${Math.min(5,dep[gi])} ${l.lvl===0?"p":l.lvl===1?"s":"t"} ${l.lvl===0&&g.hl===l.id?"ghl":""}" style="padding-left:${8+((l.ind||0)+l.lvl)*16}px" ${l.lvl===0?`data-ghp="${esc(l.id)}"`:""}>${guides[gi]}
      ${l.lvl===0?(g.level==="projects"?'<span class="g-caret gx-chev"></span>':chev(`data-p="${esc(l.id)}"`,g.open.has(l.id))):""}
      <span class="g-name" title="${esc(l.id+" "+l.label+(l.meta?" | "+l.meta:""))}">${l.lvl===0?`<span class="gx-id">${esc(l.id)}</span> `:l.lvl===2?`<span class="gx-id">${esc(l.id.split("-").pop())}</span> `:""}${esc(l.label)}${l.lvl===0&&l.team?` <span class="pteam">${esc(l.team)}</span>`:""}${l.pending?' <span class="badge-changes" style="font-size:10px;padding:0 6px">edited</span>':""}${l.rp&&l.lvl!==1?rpTag(l.rp,l.rpref):""}</span>
      ${l.lvl===0?gPpl(l.wsl,"Workstream leader · project lead: "+(l.lead||"—")):l.lvl===2?gPpl(l.pic,"Task PIC"):'<span class="g-ppl"></span>'}${l.lvl!==1?doneTxt(l):'<span class="g-meta"></span>'}</div>`)).join("");
  const lineFc=l=>{if(l.fc)return l.fc;const st=l.status,fs=(l.segs||[]).map(t=>t.fc);if(st==="Completed")return "Done";if(st==="Delayed")return "Late";if(st==="On-Hold"||st==="Cancelled")return st;if(st==="At Risk"||fs.includes("At risk of delay"))return "At risk of delay";return "On time"};
  const right=lines.map((l,ri)=>{let h="";const lv=l.kind?(l.kind==="f"?"f":"l"):["p","s","t"][l.lvl];
    if(g.base&&l.d.ps&&l.d.pe){const bw=Math.max(2,X(l.d.pe+1)-X(l.d.ps));h+=`<div class="gx-base" style="left:${X(l.d.ps)}px;width:${bw}px" title="Baseline (original plan) ${fmtDate(l.d.ps)} → ${fmtDate(l.d.pe)}"></div>`}
    if(l.d.s&&l.d.e){const x0=X(l.d.s),w=Math.max(4,X(l.d.e+1)-x0);
      /* started late: soft red from the plan start up to where the bar now starts */
      if(l.d.ps&&l.d.s>l.d.ps&&l.d.ps<=TODAY&&!l.none){const lx=X(l.d.ps),lw=Math.max(2,x0-lx);h+=`<div class="gx-late ${lv}" style="left:${lx}px;width:${lw}px" title="Late start: planned ${fmtDate(l.d.ps)}, now ${fmtDate(l.d.s)} (+${l.d.s-l.d.ps}d)"></div>`}
      const fc=l.kind?"":lineFc(l);const cls=l.status==="Completed"||fc==="Done"?"done":fc==="On-Hold"||fc==="Cancelled"?"hold":fc==="At risk of delay"?"risk":fc==="Late"?"lateb":"";
      const pc=Math.max(0,Math.min(100,(l.pct||0)*100));
      h+=`<div class="gx-bar ${lv} ${cls}" style="left:${x0}px;width:${w}px" title="${esc(l.label)}: ${fmtDate(l.d.s)} → ${fmtDate(l.d.e)}${l.status?" · "+esc(l.status):""} · ${Math.round(pc)}% done${l.d.pe?" · plan end "+fmtDate(l.d.pe):""}">${cls!=="done"&&pc>0?`<i style="width:${pc}%"></i>`:""}</div>`;
      let tx=X(l.d.e+1)+6;
      if(l.d.pe&&l.d.e>l.d.pe&&!l.none&&l.status!=="Completed"){const sl=l.d.e-l.d.pe;h+=`<span class="gx-pill" style="left:${Math.min(tx,W-58)}px" title="Forecast end ${fmtDate(l.d.e)} vs plan end ${fmtDate(l.d.pe)}">+${sl}d</span>`;tx+=50}
      if(l.rp)h+=`<span class="g-rpflag gx-rp" style="left:${Math.min(tx,W-60)}px" title="Approved re-plan ${esc((l.rpref||[]).join(", "))}">⟳ +${l.rp}d</span>`}
    if(l.lvl===0&&!l.d.s&&!l.d.ps)h+=`<button class="g-nodates" data-gop="${l.p.r}">No dates yet — open project ›</button>`;
    if(l.none)h="";if(l.lvl===1&&!l.kind&&g.level==="tasks")h="";/* stage rows are headings when tasks show; "No E2E flow" is a bucket — no bar */
    return `<div class="g-row gr gd${Math.min(5,dep[ri])} ${l.kind==="f"?"gf":l.kind==="l"?"gl":""}${l.lvl===0&&g.hl===l.id?" ghl":""}">${h}</div>`}).join("");
  /* ---- swimlane card: lanes as columns, step cards; the ones linked to the selection are highlighted ---- */
  const hl=String(g.hl||"");const hlFlow=hl.startsWith("f:")?hl.slice(2).split("|")[0]:"";
  const flowOf=pid=>MAP.find(F=>F.lanes.some(L=>L.ids.has(pid)));
  let SF=null;if(g.swimOn&&MAP.length){SF=(hlFlow&&MAP.find(F=>F.f.id===hlFlow))||(hl&&!hl.startsWith("f:")&&flowOf(hl))||MAP.find(F=>F.f.id===g.swF)||FLOWS[0]||MAP[0];g.swF=SF.f.id}
  let swim="";
  if(g.swimOn&&!SF)swim=`<div class="card gx-swc"><div class="muted" style="padding:6px 2px">No E2E flow is mapped yet — draw one under <b>E2E flows</b> and link steps to projects.</div></div>`;
  if(SF){const doc=e2eFlat(SF.doc);const steps=stepOrder(SF.doc);const lanes=(doc.lanes||[]).map(L=>({name:L.name,steps:[]}));
    for(const sh of steps){const ln=laneOfShape(doc,sh);let L=lanes.find(x=>x.name===ln);if(!L){L={name:ln||"(no lane)",steps:[]};lanes.push(L)}L.steps.push(sh)}
    let selLane="",selPid="";if(hl.includes("|")&&hlFlow===SF.f.id)selLane=hl.split("|").pop();else if(hl&&!hl.startsWith("f:"))selPid=hl;
    const hit=sh=>{const pj=sh.proj||[];if(!pj.length)return false;if(selLane)return laneOfShape(doc,sh)===selLane;if(selPid)return pj.includes(selPid);return pj.some(x=>inPR.has(x))};
    const nHit=steps.filter(hit).length;
    const chip=selLane?`${esc(selLane)} · ${new Set(steps.filter(hit).flatMap(sh=>sh.proj||[])).size} linked project(s)`:selPid?`${esc(selPid)} · ${nHit} linked step(s)`:`Filtered projects · ${nHit} linked step(s)`;
    swim=`<div class="card gx-swc"><div class="gx-swh"><div><h3>${esc(SF.f.name)}</h3><p>Mapped process steps · simplified overview</p></div><span class="sp"></span>
      ${MAP.length>1?`<select id="gswf" class="gx-sel" title="Flow to show">${MAP.map(F=>`<option value="${esc(F.f.id)}" ${F===SF?"selected":""}>${esc(F.f.name)}</option>`).join("")}</select>`:""}
      <span class="gx-selchip">${chip}${selLane||selPid?` <button data-gclr title="Clear the selection">×</button>`:""}</span>
      <button class="gx-link" id="gswfull">${g.swFull?"Hide full flow":"Show full flow"}</button><span class="gx-badge">${SF.ver}</span>
      <button class="btn small" data-gopenflow="${esc(SF.f.id)}">Open in E2E flows ›</button></div>
      <div class="gx-lanes" style="--n:${Math.max(1,lanes.length)}">${lanes.map(L=>`<div class="gx-lc${selLane===L.name?" on":""}"><div class="gx-lh" data-glane="${esc(L.name)}" title="Highlight this lane">${esc(L.name)}</div>${L.steps.map(sh=>{const pj=sh.proj||[];return `<button class="gx-step${hit(sh)?" hit":""}${pj.length?"":" np"}" ${pj.length?`data-gstep="${esc(pj[0])}" data-glane2="${esc(L.name)}"`:""} title="${esc(stepTitle(sh))}${pj.length?"\nProjects: "+esc(pj.join(", ")):""}"><b>${esc(stepTitle(sh))}</b>${pj.length?`<span>${pj.map(esc).join(" · ")}</span>`:""}</button>`}).join("")||'<span class="muted gx-empty">No steps</span>'}</div>`).join("")}</div>
      <p class="gx-foot">Highlighted cards are linked to your selection. Other steps stay visible for context. Click a card to find its project in the schedule.</p>
      ${g.swFull?`<div class="gx-full"><div class="e2esnaph"><span class="muted">Full ${SF.ver} swimlane</span><span style="flex:1"></span><span class="gzbtns" role="group" aria-label="Zoom the swimlane"><button class="btn small" data-gsz="-" data-f="${esc(SF.f.id)}" title="Zoom out">−</button><span class="gzv">${Math.round(((g.swz||{})[SF.f.id]||1)*100)}%</span><button class="btn small" data-gsz="+" data-f="${esc(SF.f.id)}" title="Zoom in">＋</button><button class="btn small" data-gsz="0" data-f="${esc(SF.f.id)}" title="Fit to width">Fit</button></span></div>
        <div class="e2esnapimg gswimimg" data-gsnap="${esc(SF.f.id)}" style="--gsz:${(g.swz||{})[SF.f.id]||1}" title="Ctrl + scroll to zoom"></div></div>`:""}</div>`}
  const nMore=[g.bu,g.cf,g.proc,g.team,g.init,g.prog].filter(Boolean).length+(g.level!=="tasks"?1:0);
  const IC={search:`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m13.2 13.2 3.6 3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    filt:`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    lanes:`<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 3.5v13M12.5 3.5v13" stroke="currentColor" stroke-width="1.6"/></svg>`};
  m.innerHTML=`${banner("report")}
  <div class="ovh gx-top"><div><h1>Gantt timeline</h1><p>See the schedule. Keep the process in view.</p></div><span class="sp"></span>
    <div class="gx-nav" role="group" aria-label="Time window"><button data-gwin="-3" title="3 months earlier">‹</button><button class="lbl" data-gwin="0" title="Back to the window around today">${fmtM(min)} – ${fmtM(addM(max,-1))}</button><button data-gwin="3" title="3 months later">›</button></div>
    <button class="btn gx-swbtn${g.swimOn?" on":""}" id="gsw">${IC.lanes}${g.swimOn?"Hide swimlane":"Show swimlane"}</button></div>
  <div class="card gx-tools">
    <label class="gx-search">${IC.search}<input id="gQ" type="search" placeholder="Search projects or lanes" value="${esc(g.q||"")}" autocomplete="off"></label>
    <select id="ggrp" class="gx-sel" title="Group the rows"><option value="e2e" ${g.grp!=="flat"?"selected":""}>By E2E flow</option><option value="flat" ${g.grp==="flat"?"selected":""}>By project</option></select>
    <select id="gst" class="gx-sel${g.st?" act":""}" title="Status"><option value="">Status: All</option>${STL.map(st=>`<option value="${esc(st)}" ${g.st===st?"selected":""}>${esc(st)} (${stCount(st)})</option>`).join("")}</select>
    <button class="btn gx-more${g.more?" on":""}${nMore?" act":""}" id="gmore" aria-expanded="${!!g.more}">${IC.filt}More filters${nMore?`<b>${nMore}</b>`:""}</button>
    <label class="gx-chk"><input type="checkbox" id="gh" ${g.hideDone?"checked":""}> Hide completed</label>
    <span class="sp"></span><span class="gx-count">${PR.length} of ${P.length} projects</span>
    <span class="seg gx-unit"><button data-gunit="month" class="${wk?"":"on"}">Month</button><button data-gunit="week" class="${wk?"on":""}">Week</button></span>
    ${g.more?`<div class="gx-morep">${[["gb","BU",bus,g.bu],["gf","CF",cfs,g.cf],["gc","Process",procs,g.proc],["gt","Team",teams,g.team||""],["gi","Project type",inits,g.init||""],["gpg","Programme",PROGS,g.prog||""]].map(([id,lb,o,v])=>`<label>${lb}${sel(id,lb,o,v)}</label>`).join("")}
      <label>Detail<select id="gl"><option value="projects" ${g.level==="projects"?"selected":""}>Projects only</option><option value="stages" ${g.level==="stages"?"selected":""}>+ Stages</option><option value="tasks" ${g.level==="tasks"?"selected":""}>+ Stages + Tasks</option></select></label>
      ${nMore?'<button class="gx-link" id="gclear">Clear filters</button>':""}</div>`:""}
  </div>
  ${noE2E?`<div class="warnbox" style="margin-bottom:10px">Grouping by E2E flow needs the E2E_Flows sheet — open <b>SGA_Reduction_Initiative_Tracker_17.xlsx</b> (this workbook is an older version).</div>`:""}${swim}
  <div class="card gx-card"><div class="gx-ch"><b>Schedule</b>
    <span class="gx-leg"><span><i class="s"></i>Scheduled</span><span><i class="p"></i>Done so far</span><span><i class="c"></i>Completed</span><span><i class="r"></i>At risk</span><span><i class="l"></i>Delayed</span><span><em class="gx-pill">+5d</em>Behind plan</span>${g.base?'<span><i class="b"></i>Baseline</span>':""}</span><span class="sp"></span>
    <label class="gx-chk"><input type="checkbox" id="gbase" ${g.base?"checked":""}> Show baseline</label>
    <button class="btn small" id="gx">Expand all</button><button class="btn small" id="gcoll">Collapse all</button><button class="btn small" id="gtoday">Today</button></div>
  <div class="gantt gx" style="grid-template-columns:${LW}px 1fr"><div class="g-left"><div class="g-head gx-lhd"><span class="g-name">${GRP?"Flow / lane / project":"Project / stage / task"}</span><span class="g-ppl" title="Workstream leader (task rows: PIC)">WS leader</span><span class="g-meta">Done</span></div><div id="gL">${left||'<div class="gx-none">No projects match these filters.</div>'}</div></div>
    <div class="g-right" id="gR"><div class="g-canvas" style="width:${W}px"><div class="g-head gx-mhd${wk?" wk":""}">${monthsHtml}</div><div class="gx-grid">${gridHtml}</div>${right}
    ${TODAY>=min&&TODAY<max?`<div class="g-today gx-today" style="left:${X(TODAY)}px" title="Today ${fmtDate(TODAY)}"></div>`:""}</div></div></div></div>
  <details class="muted" style="font-size:12px;margin-top:8px"><summary>ⓘ How the bars are calculated</summary><p class="muted" style="font-size:12px">Bar = live forecast (same rules as the Excel workbook: RAIDD blocks, late-start and overdue shifts, approved re-plans); the darker part is % done. <b>Green</b> = completed, <b>amber</b> = at risk (slip, overdue RAIDD, late start, or % done trails plan time by more than ${Math.round((()=>{const v=setting("S_PredTol");return v===""?0.15:+v})()*100)} points), <b>red</b> = delayed. The pale red strip before a bar = late start. <b>+Nd</b> = forecast end is N days after the plan end. Tick <b>Show baseline</b> to see the original plan as a thin line under each bar.</p></details>`;
  const gl=$("#gL"),gr=$("#gR");gr.onscroll=()=>{gl.style.transform=`translateY(${-gr.scrollTop}px)`};
  gl.parentElement.addEventListener("wheel",e=>{if(!e.deltaY)return;e.preventDefault();gr.scrollTop+=e.deltaY},{passive:false});
  gr.style.maxHeight="calc(100vh - 300px)";gl.parentElement.style.maxHeight="calc(100vh - 300px)";
  const R=()=>vGantt(m);g._m=m;
  /* search: redraw while typing (short pause), keep the cursor in the box */
  const q=$("#gQ");q.oninput=()=>{clearTimeout(g._qt);g._qt=setTimeout(()=>{g.q=q.value.trim();const pos=q.selectionStart;R();const n=$("#gQ");if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}},280)};
  q.onkeydown=e=>{if(e.key==="Enter"){clearTimeout(g._qt);g.q=q.value.trim();if(g.q&&projects().some(p=>p.id===g.q))g.open.add(g.q);R()}};
  $("#ggrp").onchange=e=>{g.grp=e.target.value;R()};$("#gst").onchange=e=>{g.st=e.target.value;R()};
  $("#gmore").onclick=()=>{g.more=!g.more;R()};$("#gh").onchange=e=>{g.hideDone=e.target.checked;R()};$("#gbase").onchange=e=>{g.base=e.target.checked;R()};
  m.querySelectorAll("[data-gunit]").forEach(b=>b.onclick=()=>{g.unit=b.dataset.gunit;g._scrolled=false;R()});
  m.querySelectorAll("[data-gwin]").forEach(b=>b.onclick=()=>{const n=+b.dataset.gwin;g.win=n?addM(g.win,n):addM(curM,-3);g._scrolled=!!n;if(n)gr.scrollLeft=0;R()});
  $("#gsw").onclick=()=>{g.swimOn=!g.swimOn;R()};
  const on=(id,f)=>{const el=m.querySelector("#"+id);if(el)el.onchange=f};
  on("gb",e=>{g.bu=e.target.value;g.cf="";g.proc="";R()});on("gf",e=>{g.cf=e.target.value;g.proc="";R()});on("gc",e=>{g.proc=e.target.value;R()});on("gt",e=>{g.team=e.target.value;R()});on("gpg",e=>{g.prog=e.target.value;R()});on("gi",e=>{g.init=e.target.value;R()});on("gl",e=>{g.level=e.target.value;R()});
  const gcl=m.querySelector("#gclear");if(gcl)gcl.onclick=()=>{g.bu=g.cf=g.proc=g.team=g.init=g.prog="";g.level="tasks";R()};
  $("#gx").onclick=()=>{PR.forEach(p=>g.open.add(p.id));if(GRP){FLOWS.forEach(F=>{g.open.add("f:"+F.f.id);F.lanes.forEach(L=>g.open.add("f:"+F.f.id+"|"+L.name))});g.open.add("f:none")}if(g.level==="projects")g.level="tasks";R()};$("#gcoll").onclick=()=>{g.open.clear();R()};
  $("#gtoday").onclick=()=>{if(!(TODAY>=min&&TODAY<max))g.win=addM(curM,-3);g._scrolled=false;R()};
  m.querySelectorAll(".g-caret[data-p]").forEach(c=>c.onclick=e=>{e.stopPropagation();const id=c.dataset.p;g.open.has(id)?g.open.delete(id):g.open.add(id);if(g.level==="projects"&&g.open.has(id))g.level="tasks";R()});
  m.querySelectorAll("[data-gop]").forEach(b=>b.onclick=e=>{e.stopPropagation();openProject(+b.dataset.gop)});
  m.querySelectorAll("[data-gk]").forEach(c=>c.parentElement.onclick=()=>{const k=c.dataset.gk;if(g.open.has(k)){g.open.delete(k);if(g.hl===k||String(g.hl||"").startsWith(k))g.hl=null}else{g.open.add(k);g.hl=k}R()});
  m.querySelectorAll("[data-ghp]").forEach(r=>r.onclick=e=>{if(e.target.closest(".g-caret"))return;g.hl=g.hl===r.dataset.ghp?null:r.dataset.ghp;R()});
  m.querySelectorAll("[data-gopenflow]").forEach(b=>b.onclick=()=>{UI.e2e.home=false;UI.e2e.flow=b.dataset.gopenflow;UI.e2e.ver="TO-BE";view="E2E";render()});
  /* swimlane card */
  const swf=m.querySelector("#gswf");if(swf)swf.onchange=e=>{g.swF=e.target.value;if(String(g.hl||"").startsWith("f:")||g.hl)g.hl=null;R()};
  const sfl=m.querySelector("#gswfull");if(sfl)sfl.onclick=()=>{g.swFull=!g.swFull;R()};
  m.querySelectorAll("[data-gclr]").forEach(b=>b.onclick=()=>{g.hl=null;R()});
  m.querySelectorAll("[data-glane]").forEach(h=>h.onclick=()=>{const k="f:"+g.swF+"|"+h.dataset.glane;g.hl=g.hl===k?null:k;if(g.hl){g.open.add("f:"+g.swF);g.open.add(k)}R()});
  m.querySelectorAll("[data-gstep]").forEach(b=>b.onclick=()=>{const pid=b.dataset.gstep;if(g.hl===pid){g.hl=null;R();return}g.hl=pid;
    if(g.grp!=="flat"){g.open.add("f:"+g.swF);g.open.add("f:"+g.swF+"|"+b.dataset.glane2)}g._scrollTo=pid;R()});
  if(g._scrollTo){const row=gl.querySelector(`[data-ghp="${CSS.escape(g._scrollTo)}"]`);g._scrollTo=null;if(row){gr.scrollTop=Math.max(0,row.offsetTop-80);row.parentElement&&gr.dispatchEvent(new Event("scroll"));m.querySelector(".gx-card").scrollIntoView({block:"nearest",behavior:"smooth"})}}
  const gsz=(fid,dir)=>{g.swz=g.swz||{};const Z=[0.5,0.75,1,1.25,1.5,2,2.5,3];let z=g.swz[fid]||1;if(dir==="0")z=1;else{let i=Z.findIndex(x=>x>=z-1e-9);if(i<0)i=Z.length-1;i=Math.max(0,Math.min(Z.length-1,i+(dir==="+"?1:-1)));z=Z[i]}g.swz[fid]=z;
    const el=m.querySelector(`[data-gsnap="${CSS.escape(fid)}"]`);if(el){const fx=el.scrollLeft/Math.max(1,el.scrollWidth),fy=el.scrollTop/Math.max(1,el.scrollHeight);el.style.setProperty("--gsz",z);el.scrollLeft=fx*el.scrollWidth;el.scrollTop=fy*el.scrollHeight;const v=el.parentElement.parentElement.querySelector(".gzv");if(v)v.textContent=Math.round(z*100)+"%"}};
  m.querySelectorAll("[data-gsz]").forEach(b=>b.onclick=()=>gsz(b.dataset.f,b.dataset.gsz));
  m.querySelectorAll(".gswimimg").forEach(el=>{gswimFit(el);new MutationObserver(()=>gswimFit(el)).observe(el,{childList:true});el.addEventListener("mouseup",()=>{if(el._h&&Math.abs(el.offsetHeight-el._h)>4)el.dataset.manual="1"})});
  m.querySelectorAll("[data-gsnap]").forEach(el=>el.addEventListener("wheel",e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();gsz(el.dataset.gsnap,e.deltaY<0?"+":"-")},{passive:false}));
  if(SF&&g.swFull){const el=m.querySelector(`[data-gsnap="${CSS.escape(SF.f.id)}"]`);if(el){e2eEnsureFrame();
    const doc=SF.doc;let ids=[];if(hl.includes("|")&&hlFlow===SF.f.id){const ln=hl.split("|").pop();ids=(doc.shapes||[]).filter(sh=>(sh.proj||[]).length&&laneOfShape(doc,sh)===ln).map(sh=>sh.id)}
    else if(hl&&!hl.startsWith("f:"))ids=(doc.shapes||[]).filter(sh=>(sh.proj||[]).includes(hl)).map(sh=>sh.id);
    el.dataset.hl=ids.join(",");e2eSnapshot(doc,el)}}
  if(wk&&TODAY>=min&&TODAY<max&&!g._scrolled){gr.scrollLeft=Math.max(0,X(TODAY)-gr.clientWidth/3);g._scrolled=true}
}
/* every E2E flow with its lanes and the projects linked to steps in each lane (TO-BE first, AS-IS fills gaps) */
function gFlowMap(){if(!(typeof hasE2E==="function"&&hasE2E()))return [];const out=[];
  for(const f of e2eFlows()){const tb=f.v["TO-BE"]&&f.v["TO-BE"].doc,doc=tb||(f.v["AS-IS"]&&f.v["AS-IS"].doc);if(!doc)continue;
    const lanes=(doc.lanes||[]).map(l=>({name:l.name,ids:new Set()}));const seen=new Set();
    for(const ver of ["TO-BE","AS-IS"]){const dd=f.v[ver]&&f.v[ver].doc;if(!dd)continue;for(const sh of dd.shapes||[])for(const pid of sh.proj||[]){if(ver==="AS-IS"&&seen.has(pid))continue;const ln=laneOfShape(dd,sh);let L=lanes.find(x=>x.name===ln);if(!L){L={name:ln,ids:new Set()};lanes.push(L)}L.ids.add(pid);if(ver==="TO-BE")seen.add(pid)}}
    out.push({f,doc,ver:tb?"TO-BE":"AS-IS",lanes})}return out}
/* Month view fits the card: redraw when the window changes size */
window.addEventListener("resize",()=>{const g=UI.gantt;if(!g||!g._m||!document.body.contains(g._m)||!g._m.querySelector(".gx"))return;clearTimeout(g._rt);g._rt=setTimeout(()=>{if(g.unit!=="week")vGantt(g._m)},200)});


/* swimlane box above the Gantt: as tall as the flow needs at full width (max ¾ of the window), so the whole flow shows big */
function gswimFit(el){const sv=el.querySelector("svg");if(!sv||el.dataset.manual)return;const vb=(sv.getAttribute("viewBox")||"").split(/[ ,]+/).map(Number);
  let w=vb[2],h=vb[3];if(!(w>0&&h>0)){w=+sv.getAttribute("width")||0;h=+sv.getAttribute("height")||0}if(!(w>0&&h>0))return;
  const want=Math.round(Math.min(el.clientWidth*h/w+6,innerHeight/ZF()*0.75));if(Math.abs(el.offsetHeight-want)>3){el.style.height=Math.max(240,want)+"px"}el._h=el.offsetHeight}
window.addEventListener("resize",()=>document.querySelectorAll(".gswimimg").forEach(gswimFit));
