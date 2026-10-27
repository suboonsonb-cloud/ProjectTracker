/* 04-dashboard.js — views router, dashboard charts, zoom panel, page banners */
"use strict";
/* ---------------- views ---------------- */
let view=null;const UI={q:{},f:{},cf:{},sort:{},sel:null,gantt:{open:new Set(),proj:"",proc:"",level:"tasks",zoom:3}};
const TABS=["Dashboard","Gantt","Projects","Activities","Benefits","Realisation","RAIDD","Changes"];
function renderTabs(){const b=t=>`<button class="${t===view?"on":""}" data-t="${t}">${t==="Changes"?`Review changes (${S.changes.length?e2eNetCount(netChanges()):0})`:t==="Quick"?"⚡ Quick update":t==="E2E"?"⇄ E2E flows":t}</button>`;
  $("#tabs").innerHTML=`<div class="tgrp rep"><span class="glab">REPORTS</span>${["Dashboard","Gantt"].map(b).join("")}</div>
   <div class="tgrp inp"><span class="glab">UPDATE DATA</span>${["Projects","E2E"].map(b).join("")}</div>
   ${typeof canEdit==="function"&&!canEdit()?`<div class="tgrp rep"><span class="glab">VIEW ONLY</span><span class="muted" style="font-size:12px;padding:0 8px">Ask an Admin for edit access</span></div>`:`<div class="tgrp inp"><span class="glab">IMPORT</span><button class="${view==="Sync"?"on":""}" data-t="Sync">⇄ Sync old file${SY.plan?" ●":""}</button></div>
   <div class="tgrp sav"><span class="glab">SAVE</span>${b("Changes")}</div>`}`;requestAnimationFrame(stickVars);
  $("#tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{if(b.dataset.t==="Projects"&&view==="Projects"){UI.proj=null}const ch=view!==b.dataset.t;if(b.dataset.t==="E2E"){if(view==="E2E"&&UI.e2e.home===false){e2eFlush()}UI.e2e.home=true}view=b.dataset.t;render();if(ch&&view!=="E2E")window.scrollTo(0,0)})}
function render(){
  if(!S.zip||view!=="E2E")e2eHide();
  if(!S.zip){renderLanding();return}
  liveCalc();S._needCalc=false;
  renderTabs();const m=$("#main");
  if(view==="Quick"){view="Projects";UI.pview="projects";UI.plist="simple";UI.proj=null}
  if(view==="Activities"){view="Projects";UI.pview="tasks";UI.proj=null}
  if(view==="Benefits"){view="Projects";UI.pview="benefits";UI.proj=null}
  ({Dashboard:vDash,Projects:vProjHub,Benefits:vBenefits,Realisation:vReal,RAIDD:vRaidd,Gantt:vGantt,Changes:vChanges,Settings:vSettings,Sync:vSync,Quick:vQuick,E2E:vE2E})[view](m);
}
function stickVars(){try{const h=document.querySelector("header.top"),n=document.querySelector("nav.tabs");const hs=h&&getComputedStyle(h).position==="sticky"?h.offsetHeight:0;document.documentElement.style.setProperty("--hdrH",hs+"px");const st=hs+(n?n.offsetHeight:0);document.documentElement.style.setProperty("--stickH",st+"px");
  const f=document.querySelector(".dfilt");document.documentElement.style.setProperty("--filtH",(f&&getComputedStyle(f).position==="sticky"?f.offsetHeight:0)+"px")}catch(e){}}
window.addEventListener("resize",stickVars);
function renderLanding(){
  $("#main").innerHTML=`<div class="landing">
  <div class="drop card" id="drop"><h2 style="font-size:20px">Open the SG&amp;A tracker workbook</h2>
  <p class="muted">Drag the <b>.xlsx</b> here or click the button. Everything stays on your computer; nothing is uploaded anywhere.</p>
  ${WB.rec?connectCardHtml():`<p><button class="btn primary" id="bigOpen">Open workbook…</button></p>${connectCardHtml()}`}${spCardHtml()}${S.env&&S.env.level==="ok"?`<p class="envok">✓ Opened from your OneDrive / SharePoint synced folder — saving will reach SharePoint.</p>`:""}</div>
  <div class="card pad" style="margin-top:16px"><h2>With SharePoint</h2><ol class="steps">
  <li>Sync the SharePoint library to your PC (Sync button in SharePoint → OneDrive).</li>
  <li>Use Edge or Chrome, open the synced workbook here, edit, then click <b>Save to Excel</b>. The file is overwritten in place and OneDrive uploads it.</li>
  <li>Close the workbook in Excel first. After saving, open it once in Excel so it recalculates statuses, dates and totals.</li></ol></div>
  <div class="card pad" style="margin-top:16px"><h2>Updating from the old tracker</h2><p class="muted">Open this workbook first, then use <b>⇄ Sync old file</b> (top tabs) to compare it with the old-format <i>Project 2T Club Update</i> file and bring across whatever is newer.</p></div></div>`;
  if($("#bigOpen"))$("#bigOpen").onclick=openFile;const d=$("#drop");bindConnectCard(d);bindSpCard(d);
  d.ondragover=e=>{e.preventDefault();d.classList.add("over")};d.ondragleave=()=>d.classList.remove("over");
  d.ondrop=async e=>{e.preventDefault();d.classList.remove("over");const it=e.dataTransfer.items&&e.dataTransfer.items[0];
    if(it&&it.getAsFileSystemHandle){try{const h=await it.getAsFileSystemHandle();if(h&&h.kind==="file"){const f=await h.getFile();await ingest(await f.arrayBuffer(),f.name,h,f.lastModified);return}}catch(_){}}
    const f=e.dataTransfer.files[0];if(f)await ingest(await f.arrayBuffer(),f.name,null,f.lastModified)};
}
function uniq(a){return [...new Set(a.filter(x=>x!==""&&x!=null))].sort()}
function sel(id,label,opts,val){return `<select id="${id}" title="${esc(label)}"><option value="">${esc(label)}: All</option>${opts.map(o=>`<option ${o===val?"selected":""}>${esc(o)}</option>`).join("")}</select>`}
function changedRows(sheet){const s=new Set();for(const c of S.changes)if(c.sheet===sheet)s.add(+c.ref.replace(/[A-Z]+/,""));return s}

/* ---- dashboard (charts) ---- */
UI.dash={bu:"",cf:"",proc:"",q:"",cell:null,procView:"status",relView:"monthly",buView:"status"};let DASHP=null;
const CAT=["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#4a3aa7","#e34948"],OTHER="#A3ACB8";
const SCOL={"Completed":"#2E7D32","On Track":"#2E75B6","In Progress":"#2E75B6","At Risk":"#F79009","Delayed":"#D92D20","On-Hold":"#8A93A0","Not Started":"#C3CEDC","Cancelled":"#E1E5EA"};
function catColors(keys){const m={};let j=0;keys.forEach(k=>{m[k]=k==="Other"?OTHER:(j<CAT.length?CAT[j++]:OTHER)});return m}
function foldOther(keys,valFn,max=7){const s=[...keys].sort((a,b)=>valFn(b)-valFn(a));return s.length<=max+1?s:[...s.slice(0,max),"Other"]}
function legendHtml(items){return `<div class="legend">${items.map(([n,c])=>`<span><i style="background:${c}"></i>${esc(n)}</span>`).join("")}</div>`}
/* vertical stacked bars: cats[], series[{name,color,vals[]}] */
function stackedV(cats,series,{fmt=fmtShort,h=260,click=null,catLabel=x=>x,maxLbl=14,catW=64,totals=true}={}){
  const every=cats.length>18?3:1;const W=Math.max(420,cats.length*catW+60),pl=48,pb=48,pt=18,H=h;const tot=cats.map((_,i)=>series.reduce((a,s)=>a+(s.vals[i]||0),0));
  const max=Math.max(1,...tot);const y=v=>pt+(H-pt-pb)*(1-v/max);const bw=Math.min(46,(W-pl-10)/cats.length*0.62),step=(W-pl-10)/Math.max(1,cats.length);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img">`;
  for(let g=0;g<=4;g++){const v=max*g/4,yy=y(v);s+=`<line x1="${pl}" x2="${W-6}" y1="${yy}" y2="${yy}" stroke="#EEF1F5"/><text x="${pl-6}" y="${yy+4}" font-size="10" text-anchor="end" fill="#5B6573">${fmt(v)}</text>`}
  cats.forEach((c,i)=>{const x=pl+i*step+(step-bw)/2;let acc=0;
    series.forEach(se=>{const v=se.vals[i]||0;if(!v)return;const y1=y(acc+v),y0=y(acc);acc+=v;
      s+=`<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0,y0-y1-1.5)}" rx="2" fill="${se.color}" ${click?`data-click="${esc(c)}" data-seg="${esc(se.name)}" style="cursor:pointer"`:""}><title>${esc(catLabel(c))} · ${esc(se.name)}: ${fmt(v)}</title></rect>`});
    if(tot[i]&&totals)s+=`<text x="${x+bw/2}" y="${y(tot[i])-5}" font-size="11" font-weight="700" text-anchor="middle" fill="#1B2430">${fmt(tot[i])}</text>`;
    const lab=String(catLabel(c));if(i%every===0)s+=`<text x="${x+bw/2}" y="${H-pb+14}" font-size="10.5" text-anchor="middle" fill="#1B2430" ${click?`data-click="${esc(c)}" style="cursor:pointer;text-decoration:underline"`:""}>${esc(lab.length>maxLbl?lab.slice(0,maxLbl-1)+"…":lab)}<title>${esc(lab)}</title></text>`});
  s+=`<line x1="${pl}" x2="${W-6}" y1="${H-pb}" y2="${H-pb}" stroke="#C9D0DA"/></svg>`;
  return s+legendHtml(series.filter(x=>x.vals.some(Boolean)).map(x=>[x.name,x.color]));
}
/* plan (stacked by segment) vs actual (navy) — side by side per month, or cumulative with an actual line */
function pvaSegChart(months,series,act,cum,actS){const n=months.length,W=Math.max(900,n*38+70),H=330,pl=60,pb=40,pt=16;
  actS=actS||[{name:"Actual",color:"#1F3864",vals:act}];
  const cumv=(arr,stopToday)=>{let a=0;return arr.map((v,i)=>stopToday&&months[i].s>TODAY?null:(a+=v||0))};
  const P=series.map(se=>({...se,vals:cum?cumv(se.vals,false):[...se.vals]})),A=actS.map(se=>({...se,vals:cum?cumv(se.vals,true):[...se.vals]}));
  const tot=arr=>months.map((_,i)=>arr.reduce((a,se)=>a+(se.vals[i]||0),0));const ptot=tot(P),atot=tot(A);
  const max=Math.max(1,...ptot,...atot);const y=v=>pt+(H-pt-pb)*(1-v/max);const step=(W-pl-10)/n;
  const bw=cum?Math.min(26,step*.72):Math.min(16,step*.42),abw=cum?bw*.5:bw;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">`;
  for(let g=0;g<=4;g++){const v=max*g/4,yy=y(v);s+=`<line x1="${pl}" x2="${W-6}" y1="${yy}" y2="${yy}" stroke="#EEF1F5"/><text x="${pl-6}" y="${yy+4}" font-size="10" text-anchor="end" fill="#5B6573">${fmtShort(v)}</text>`}
  months.forEach((mm,i)=>{const cx=pl+i*step+step/2;const xp=cum?cx-bw/2:cx-bw-1,xa=cum?cx-abw/2:cx+1;
    let acc=0;P.forEach(se=>{const v=se.vals[i]||0;if(!v)return;const y1=y(acc+v),y0=y(acc);acc+=v;
      s+=`<rect x="${xp}" y="${y1}" width="${bw}" height="${Math.max(0,y0-y1)}" fill="${se.color}" fill-opacity=".3" stroke="${se.color}" stroke-width=".8"><title>${mm.h} · PLAN · ${esc(se.name)}: ${fmtNum(v)}${cum?" (cumulative)":""}</title></rect>`});
    acc=0;A.forEach(se=>{const v=se.vals[i]||0;if(!v)return;const y1=y(acc+v),y0=y(acc);acc+=v;
      s+=`<rect x="${xa}" y="${y1}" width="${abw}" height="${Math.max(0,y0-y1)}" fill="${se.color}"><title>${mm.h} · ACTUAL · ${esc(se.name)}: ${fmtNum(v)}${cum?" (cumulative)":""}</title></rect>`});
    if(atot[i]&&ptot[i]&&!cum)s+=`<title>${mm.h}: plan ${fmtNum(ptot[i])} · actual ${fmtNum(atot[i])}</title>`;
    s+=`<text x="${cx}" y="${H-pb+14}" font-size="10" text-anchor="middle" fill="${mm.h.startsWith("Jan")?"#1B2430":"#5B6573"}" font-weight="${mm.h.startsWith("Jan")?700:400}">${mm.h.slice(0,3)}</text>${mm.h.startsWith("Jan")||i===0?`<text x="${cx}" y="${H-pb+28}" font-size="10" font-weight="700" text-anchor="middle" fill="#1B2430">${mm.h.slice(-4)}</text>`:""}`;
    if(mm.s<=TODAY&&(i===n-1||months[i+1].s>TODAY))s+=`<line x1="${pl+(i+1)*step}" x2="${pl+(i+1)*step}" y1="${pt}" y2="${H-pb}" stroke="#C00000" stroke-dasharray="3 3"/>`});
  s+=`<line x1="${pl}" x2="${W-6}" y1="${H-pb}" y2="${H-pb}" stroke="#C9D0DA"/></svg>`;
  const pTD=months.reduce((a,mm,i)=>a+(mm.s<=TODAY?series.reduce((x,se)=>x+(se.vals[i]||0),0):0),0),aTD=months.reduce((a,mm,i)=>a+(mm.s<=TODAY?act[i]:0),0);
  const used=series.filter(x=>x.vals.some(Boolean)||actS.some(a=>a.name===x.name&&a.vals.some(Boolean)));
  return s+`<div class="legend"><span class="pvakey"><i class="kp"></i>Plan (light, ${cum?"wide":"left"} bar)</span><span class="pvakey"><i class="ka"></i>Actual (solid, ${cum?"narrow":"right"} bar)</span>${used.map(x=>`<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join("")}<span><i style="background:#C00000;width:3px"></i>Today</span></div>`+
    `<p class="muted" style="font-size:12px;margin:6px 0 0">To date: plan <b>${fmtNum(pTD)}</b> · actual <b>${fmtNum(aTD)}</b> THB · <b style="color:${pTD&&aTD/pTD>=.9?"#1E6B24":"#B42318"}">${pTD?Math.round(aTD/pTD*100)+"% of plan":"—"}</b></p>`}
/* horizontal stacked bars */
function stackedH(cats,series,{fmt=v=>fmtNum(v),click=null}={}){
  const tot=cats.map((_,i)=>series.reduce((a,s)=>a+(s.vals[i]||0),0));const max=Math.max(1,...tot);
  return `<div>${cats.map((c,i)=>`<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12.5px">
    <span style="width:150px" class="clip" title="${esc(c)}">${esc(c)}</span>
    <span style="flex:1;display:flex;gap:2px;height:16px;${click?"cursor:pointer":""}" ${click?`data-click="${esc(c)}"`:""}>${series.map(se=>{const v=se.vals[i]||0;return v?`<span title="${esc(c)} · ${esc(se.name)}: ${fmt(v)}" style="width:${v/max*100}%;background:${se.color};border-radius:3px"></span>`:""}).join("")}</span>
    <span style="width:54px;text-align:right;font-weight:700">${fmt(tot[i])}</span></div>`).join("")}${legendHtml(series.filter(x=>x.vals.some(Boolean)).map(x=>[x.name,x.color]))}</div>`;
}
function donut(items,{size=190,center=""}={}){
  const tot=items.reduce((a,b)=>a+b.v,0)||1;const r=70,cx=95,cy=95,w=26;let a0=-Math.PI/2,s=`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">`;
  items.filter(x=>x.v).forEach(it=>{const a1=a0+it.v/tot*Math.PI*2-0.012;const lg=a1-a0>Math.PI?1:0;
    const p=(a,rr)=>[cx+rr*Math.cos(a),cy+rr*Math.sin(a)];const [x0,y0]=p(a0,r),[x1,y1]=p(a1,r),[x2,y2]=p(a1,r-w),[x3,y3]=p(a0,r-w);
    s+=`<path d="M${x0} ${y0}A${r} ${r} 0 ${lg} 1 ${x1} ${y1}L${x2} ${y2}A${r-w} ${r-w} 0 ${lg} 0 ${x3} ${y3}Z" fill="${it.c}"><title>${esc(it.n)}: ${it.v} (${Math.round(it.v/tot*100)}%)</title></path>`;a0=a1+0.012});
  s+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="24" font-weight="700" fill="#1F3864">${center}</text><text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="11" fill="#5B6573">projects</text></svg>`;
  return `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${s}<div style="font-size:12.5px">${items.filter(x=>x.v).map(it=>`<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><i style="width:12px;height:12px;border-radius:3px;background:${it.c};display:inline-block"></i><span style="width:92px">${esc(it.n)}</span><b>${it.v}</b><span class="muted">${Math.round(it.v/tot*100)}%</span></div>`).join("")}</div></div>`;
}
/* live benefit plan (mirrors Plan_Calc) and actuals */
const hasBP=()=>!!(S.sheets.Benefit_Plan&&S.sheets.Benefit_Plan.vals);
function bpRows(bid){return hasBP()?rowsOf("Benefit_Plan").filter(x=>gv("Benefit_Plan","B",x)===bid):[]}
function customPlan(bid,months){const rs=bpRows(bid);return months.map(mm=>rs.reduce((a,x)=>a+(+gv("Benefit_Plan",mm.col,x)||0),0))}
function benefitSeries(){
  const months=realMonths();const rate=+setting("S_Rate")||0;const out=[];
  const act={};for(const r of rowsOf("Realisation")){const id=gv("Realisation",FR.bid,r);if(!id)continue;const a=act[id]=act[id]||months.map(()=>0);months.forEach((mm,i)=>a[i]+=+gv("Realisation",mm.col,r)||0)}
  for(const r of rowsOf("Benefits")){
    const id=bId(r),pid=gv("Benefits",FB.pid,r);const n=c=>+gv("Benefits",c,r)||0;
    const one=gv("Benefits",FB.nature,r)==="One-off";const gm=(n(FB.ca)+n(FB.cr)+n(FB.rg))/((!one&&gv("Benefits",FB.basis,r)==="Annual")?12:1)+n(FB.trh)*(gv("Benefits",FB.rate,r)===""?rate:n(FB.rate));
    const gross=one?gm:gm*12,net=gross-(+gv("Benefits","T",r)||0);const st=+gv("Benefits",FB.start,r)||0;const ramp=Math.max(1,n(FB.ramp));const drop=gv("Benefits",FB.bstat,r)==="Dropped";
    let sm=0,est=false;if(st){const d=serialToDate(st);sm=dateToSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)))}
    else{const fe=+((LIVE.proj[pid]||{}).fend)||0;if(fe){const d=serialToDate(fe);sm=dateToSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)));est=true}}
    const dv_=(n(FB.ca)+n(FB.cr)+n(FB.rg))?1/((!one&&gv("Benefits",FB.basis,r)==="Annual")?12:1):0;const trvm=n(FB.trh)*(gv("Benefits",FB.rate,r)===""?rate:n(FB.rate));
    const drv={"Cost Avoidance":n(FB.ca)*dv_,"Cost Reduction":n(FB.cr)*dv_,"Revenue Growth":n(FB.rg)*dv_,"Time Reduction (hrs × rate)":trvm};
    const custom=gv("Benefits",FB.phase,r)==="Custom";if(custom)est=false;const cp=custom?customPlan(id,months):null;
    const plan=months.map((mm,mi)=>{if(drop)return 0;if(custom)return cp[mi];if(!sm)return 0;if(one)return mm.s===sm?net:0;if(mm.s<sm)return 0;const a=serialToDate(mm.s),b=serialToDate(sm);
      const k=(a.getUTCFullYear()-b.getUTCFullYear())*12+a.getUTCMonth()-b.getUTCMonth()+1;return net/12*Math.min(1,k/ramp)});
    const pr=projRowById(pid);
    out.push({r,id,pid,est,sm,custom,drv,vtype:(n(FB.ca)+n(FB.cr)+n(FB.rg))>0?"THB (hard)":n(FB.trh)>0?"Time saving only":"No value yet",desc:gv("Benefits",FB.desc,r),one,gross,net,drop,hrs:one?0:n(FB.trh),plan,act:act[id]||months.map(()=>0),
      bu:pr?gv("Projects",FP.bu,pr)||"(blank)":"(no project)",cf:pr?gv("Projects",FP.cf,pr)||"(blank)":"(no project)",proc:pr?gv("Projects",FP.proc,pr)||"(blank)":"(no project)",pname:pr?gv("Projects",FP.name,pr):pid});
  }
  return {months,list:out};
}
function curStage(r){const id=pId(r);const L=LIVE.proj[id];if(!L||!L.ntask)return "(no tasks)";
  const ag=gv("Projects",FP.meth,r)==="Agile";const stages=listFromName(ag?"L_StageAG":"L_StageWF");
  const ts=Object.values(LIVE.task).filter(t=>t.pid===id);for(const sn of stages){if(ts.some(t=>t.stage===sn&&!["Completed","Cancelled"].includes(t.status)))return sn}return "All complete"}
function planActChart(months,plan,act,view){
  if(!plan.some(v=>v)&&!act.some(v=>v))return `<p class="muted">No plan or actual realisation for this selection yet. Plan appears once benefit lines have a <b>Realisation Start Month</b>; actuals appear as you enter them on the Realisation page.</p>`;
  let P=plan,A=act;if(view==="cumulative"){let a=0,b=0;P=plan.map(v=>a+=v);A=act.map((v,i)=>months[i].s<=TODAY?(b+=v):null)}
  const W=1300,H=300,pl=60,pb=34,pt=12,n=months.length,max=Math.max(1,...P,...A.filter(x=>x!=null));const bw=(W-pl-10)/n;const y=v=>pt+(H-pt-pb)*(1-v/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">`;
  for(let g=0;g<=4;g++){const v=max*g/4,yy=y(v);s+=`<line x1="${pl}" x2="${W-10}" y1="${yy}" y2="${yy}" stroke="#EEF1F5"/><text x="${pl-6}" y="${yy+4}" font-size="10" text-anchor="end" fill="#5B6573">${fmtShort(v)}</text>`}
  months.forEach((mm,i)=>{const x=pl+i*bw;
    if(P[i])s+=`<rect x="${x+1}" y="${y(P[i])}" width="${bw/2-1.5}" height="${H-pb-y(P[i])}" rx="2" fill="#9DC3E6"><title>${mm.h} plan ${fmtNum(P[i])} THB</title></rect>`;
    if(A[i])s+=`<rect x="${x+bw/2}" y="${y(A[i])}" width="${bw/2-1.5}" height="${H-pb-y(A[i])}" rx="2" fill="#1F3864"><title>${mm.h} actual ${fmtNum(A[i])} THB</title></rect>`;
    if(i%3===0)s+=`<text x="${x+bw/2}" y="${H-pb+14}" font-size="10" text-anchor="middle" fill="#5B6573">${mm.h.replace("-20","-")}</text>`;
    if(mm.s<=TODAY&&(i===n-1||months[i+1].s>TODAY))s+=`<line x1="${x+bw}" x2="${x+bw}" y1="${pt}" y2="${H-pb}" stroke="#C00000" stroke-dasharray="3 3"/>`});
  return s+`</svg>`+legendHtml([["Plan realisation","#9DC3E6"],["Actual realisation","#1F3864"],["Today","#C00000"]]);
}
/* ---- zoom-in panel: click a stacked bar to break it into projects ---- */
function zoomRows(P,z){
  const f=(r,fld)=>gv("Projects",fld,r)||"(blank)";
  const dimF=z.chart==="proc"?FP.proc:(z.dimField||FP.bu);
  let rows=P.filter(r=>f(r,dimF)===z.cat);
  if(z.seg){
    if(z.segType==="status")rows=rows.filter(r=>pStat(r)===z.seg);
    else if(z.segType==="stage")rows=rows.filter(r=>!["Completed","Cancelled"].includes(pStat(r))&&curStage(r)===z.seg);
    else if(z.segType==="cf")rows=rows.filter(r=>z.seg==="Other"?!(z.cfKeep||[]).includes(f(r,FP.cf)):f(r,FP.cf)===z.seg);
    else if(z.segType==="delay")rows=rows.filter(r=>z.seg==="Delayed tasks"?(pLive(r).ndel||0)>0:(pLive(r).nrisk||0)>0);
  }
  return rows;
}
function zoomPanel(P){
  const z=UI.dash.zoom;if(!z)return "";const rows=zoomRows(P,z);
  const g=z.group||"cf";const gf={cf:r=>gv("Projects",FP.cf,r)||"(blank)",proc:r=>gv("Projects",FP.proc,r)||"(blank)",status:r=>pStat(r),lead:r=>gv("Projects",FP.lead,r)||"(no project lead)",wsl:r=>gv("Projects",FP.wsl,r)||"(no workstream leader)",none:()=>"All projects"}[g];
  const ms=z.measure||"comp";const mv=r=>ms==="comp"?(pLive(r).comp||0):ms==="value"?(+gv("Projects",FP.value,r)||0):((pLive(r).ndel||0)+(pLive(r).nrisk||0));
  const fmt=v=>ms==="comp"?Math.round(v*100)+"%":ms==="value"?fmtShort(v):String(v);
  const max=ms==="comp"?1:Math.max(1,...rows.map(mv));
  const groups={};rows.forEach(r=>{const k=gf(r);(groups[k]=groups[k]||[]).push(r)});
  const keys=g==="status"?STL.filter(k=>groups[k]):Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length);
  const opt=(id,val,arr)=>`<select id="${id}" class="mini">${arr.map(([v,t])=>`<option value="${v}" ${v===val?"selected":""}>${t}</option>`).join("")}</select>`;
  const dimName=z.chart==="proc"?"Process area":(z.dimField===FP.cf?"CF":"BU");
  const rowHtml=r=>{const L=pLive(r),v=mv(r),st=pStat(r);
    const bar=ms==="delay"?`<span style="display:flex;gap:2px;height:14px;width:${v/max*100}%"><span style="flex:${L.ndel||0};background:${SCOL.Delayed};border-radius:3px"></span><span style="flex:${L.nrisk||0};background:${SCOL["At Risk"]};border-radius:3px"></span></span>`
      :`<span style="display:block;height:14px;border-radius:3px;width:${Math.max(v>0?1.5:0,v/max*100)}%;background:${SCOL[st]||"#2E75B6"}"></span>`;
    return `<div class="zrow" data-r="${r}" title="Click to open ${esc(pId(r))}"><span class="zid">${esc(pId(r))}</span><span class="zname clip">${esc(gv("Projects",FP.name,r))}</span>
      <span class="zmeta clip">${esc(gv("Projects",FP.cf,r))} · ${esc(gv("Projects",FP.proc,r))} · ${esc(gv("Projects",FP.wsl,r)||"—")} › ${esc(gv("Projects",FP.lead,r)||"—")}</span><span>${pill(st)}${L.rpdays?`<span class="rptag" style="margin-left:3px">⟳ +${L.rpdays}d</span>`:""}</span>
      <span class="ztrack">${bar}</span><b class="zval">${fmt(v)}</b></div>`};
  return `<div class="card pad zoom" id="zoomCard" style="margin-top:14px">
   <div class="chead"><h2>🔍 ${esc(dimName)}: ${esc(z.cat)}${z.seg?` · ${esc(z.seg)}`:""} — ${rows.length} project(s)</h2>
    <span class="ctl">Group by ${opt("zGroup",g,[["cf","Corporate Function"],["proc","Process area"],["status","Status"],["wsl","Workstream leader"],["lead","Project lead"],["none","No grouping"]])}
     Bar shows ${opt("zMeasure",ms,[["comp","Completion %"],["value","Recurring value (THB/yr)"],["delay","Delayed + at-risk tasks"]])}
     ${z.seg?`<button class="btn small" id="zAll">Show all of ${esc(z.cat)}</button>`:""}<button class="btn small" id="zClose">Close</button></span></div>
   <p class="muted" style="margin:0 0 8px;font-size:12px">Zoomed in from the chart above · bar colour = project status · click a project to open it</p>
   <div style="max-height:640px;overflow:auto;padding-right:4px">${keys.map(k=>{const rs=groups[k].sort((a,b)=>mv(b)-mv(a));const val=rs.reduce((a,r)=>a+(+gv("Projects",FP.value,r)||0),0);
     return `<div class="zgrp"><div class="zhead"><b>${esc(k)}</b><span class="muted">${rs.length} project(s) · ${fmtShort(val)} THB/yr · ${rs.filter(r=>pStat(r)==="Delayed").length} delayed</span></div>${rs.map(rowHtml).join("")}</div>`}).join("")||`<p class="muted">No projects</p>`}</div>
   ${legendHtml(ms==="delay"?[["Delayed tasks",SCOL.Delayed],["At-risk tasks",SCOL["At Risk"]]]:STL.map(s=>[s,SCOL[s]]))}</div>`;
}
function bindZoom(m,P){
  const z=UI.dash.zoom;if(!z)return;const re=()=>vDash(m,true);
  if($("#zGroup"))$("#zGroup").onchange=e=>{z.group=e.target.value;re()};if($("#zMeasure"))$("#zMeasure").onchange=e=>{z.measure=e.target.value;re()};
  if($("#zClose"))$("#zClose").onclick=()=>{UI.dash.zoom=null;vDash(m)};if($("#zAll"))$("#zAll").onclick=()=>{z.seg="";re()};
  m.querySelectorAll(".zrow[data-r]").forEach(el=>el.onclick=()=>openProject(+el.dataset.r));
}

/* status filter chips (tick = shown). state.stOff = statuses hidden */
function stChips(list,off,count,key){return `<span class="stchk" data-chips="${key}"><span class="muted">Status</span>${list.map(b=>`<label class="stc${off.has(b)?" off":""}${count(b)?"":" zero"}" style="--c:${SCOL[b]||"#888"}" title="Tick to show, untick to hide"><input type="checkbox" data-stk="${key}" data-st="${esc(b)}" ${off.has(b)?"":"checked"}><i></i><span>${esc(b)}</span> <em>${count(b)}</em><b class="only" data-only="${esc(b)}" title="Show only this status">only</b></label>`).join("")}<button class="btn small" data-stall="${key}" title="Tick all statuses">All</button></span>`}
function bindStChips(m,key,state,redraw){const all=[...m.querySelectorAll(`[data-chips="${key}"] [data-st]`)].map(c=>c.dataset.st);
  m.querySelectorAll(`[data-stk="${key}"]`).forEach(c=>c.onchange=()=>{const v=c.dataset.st;state.stOff=c.checked?(state.stOff||[]).filter(x=>x!==v):[...(state.stOff||[]),v];redraw()});
  m.querySelectorAll(`[data-chips="${key}"] [data-only]`).forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const uni=all.every(x=>STL.includes(x))?STL:all;state.stOff=uni.filter(x=>x!==b.dataset.only);redraw()});
  const ab=m.querySelector(`[data-stall="${key}"]`);if(ab)ab.onclick=()=>{state.stOff=[];redraw()}}
function vDash(m,keepScroll){const _y=window.scrollY;setTimeout(()=>{if(keepScroll)window.scrollTo(0,_y)},0);
  const allP=rowsOf("Projects");const F=UI.dash;const fv=(r,c)=>gv("Projects",c,r)||"(blank)";
  const bus=uniq(allP.map(r=>fv(r,FP.bu)));if(F.bu&&!bus.includes(F.bu))F.bu="";const bu=F.bu;
  const P1=allP.filter(r=>!bu||fv(r,FP.bu)===bu);const cfs_=uniq(P1.map(r=>fv(r,FP.cf)));if(F.cf&&!cfs_.includes(F.cf))F.cf="";
  const P2=P1.filter(r=>!F.cf||fv(r,FP.cf)===F.cf);const procs_=uniq(P2.map(r=>fv(r,FP.proc)));if(F.proc&&!procs_.includes(F.proc))F.proc="";
  const P3a=P2.filter(r=>!F.proc||fv(r,FP.proc)===F.proc);F.stOff=Array.isArray(F.stOff)?F.stOff:[];const off=new Set(F.stOff);const sts_=off.size?STL.slice():STL.filter(st=>P3a.some(r=>pStat(r)===st));
  const P3=P3a.filter(r=>!off.has(pStat(r)));const qq=(F.q||"").trim().toLowerCase();
  const P=P3.filter(r=>!qq||(pId(r)+" "+gv("Projects",FP.name,r)).toLowerCase().includes(qq));const pids=new Set(P.map(pId));DASHP=pids;
  const nF=[bu,F.cf,F.proc,F.stOff.length?1:"",qq].filter(Boolean).length;
  const A=rowsOf("Activities").filter(r=>pids.has(gv("Activities",FA.pid,r))),D=rowsOf("RAIDD").filter(r=>pids.has(gv("RAIDD",FD.pid,r)));
  const BS=benefitSeries();const Bl=BS.list.filter(b=>pids.has(b.pid));const months=BS.months;
  const BlA=Bl.filter(b=>!b.drop);const plan=months.map((_,i)=>BlA.reduce((a,b)=>a+b.plan[i],0)),act=months.map((_,i)=>BlA.reduce((a,b)=>a+b.act[i],0));
  const pTD=months.reduce((a,mm,i)=>a+(mm.s<=TODAY?plan[i]:0),0),aTD=months.reduce((a,mm,i)=>a+(mm.s<=TODAY?act[i]:0),0);
  const valRec=Bl.filter(b=>!b.one&&!b.drop).reduce((a,b)=>a+b.gross,0),valOne=Bl.filter(b=>b.one&&!b.drop).reduce((a,b)=>a+b.gross,0),hrs=Bl.filter(b=>!b.drop).reduce((a,b)=>a+b.hrs,0);
  const fteh=+setting("S_FTEh")||176;
  const k=(l,v,s="")=>`<div class="card pad kpi"><div class="lab">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  const stCount=STL.map(st=>({n:st,v:P.filter(r=>pStat(r)===st).length,c:SCOL[st]}));
  // generic "by dimension" chart (used for Process Area and BU)
  const dimChart=(dimFn,view)=>{const cats=uniq(P.map(r=>dimFn(r)||"(blank)"));const inCat=(r,c)=>(dimFn(r)||"(blank)")===c;let series;
    if(view==="status")series=STL.map(st=>({name:st,color:SCOL[st],vals:cats.map(c=>P.filter(r=>inCat(r,c)&&pStat(r)===st).length)}));
    else if(view==="stage"){const act_=P.filter(r=>!["Completed","Cancelled"].includes(pStat(r)));const ord=[...listFromName("L_StageWF"),...listFromName("L_StageAG"),"(no tasks)","All complete"];
      const stg=ord.filter(x=>act_.some(r=>curStage(r)===x));const cc=catColors(stg);series=stg.map(sn=>({name:sn,color:cc[sn],vals:cats.map(c=>act_.filter(r=>inCat(r,c)&&curStage(r)===sn).length)}))}
    else if(view==="cfcount"){const cfs=foldOther(uniq(P.map(r=>gv("Projects",FP.cf,r)||"(blank)")),c=>P.filter(r=>(gv("Projects",FP.cf,r)||"(blank)")===c).length);const cc=catColors(cfs);
      series=cfs.map(cf=>({name:cf,color:cc[cf],vals:cats.map(c=>P.filter(r=>inCat(r,c)&&(cf==="Other"?!cfs.includes(gv("Projects",FP.cf,r)||"(blank)"):(gv("Projects",FP.cf,r)||"(blank)")===cf)).length)}))}
    else if(view==="value"){const cfs=foldOther(uniq(P.map(r=>gv("Projects",FP.cf,r)||"(blank)")),c=>P.filter(r=>(gv("Projects",FP.cf,r)||"(blank)")===c).length);const cc=catColors(cfs);
      series=cfs.map(cf=>({name:cf,color:cc[cf],vals:cats.map(c=>P.filter(r=>inCat(r,c)&&(cf==="Other"?!cfs.includes(gv("Projects",FP.cf,r)||"(blank)"):(gv("Projects",FP.cf,r)||"(blank)")===cf)).reduce((a,r)=>a+(+gv("Projects",FP.value,r)||0),0))}))}
    else{const tp=r=>{const pr=projRowById(gv("Activities",FA.pid,r));return pr?dimFn(pr)||"(blank)":"(blank)"};
      series=[{name:"Delayed tasks",color:SCOL.Delayed,vals:cats.map(c=>A.filter(r=>tStat(r)==="Delayed"&&tp(r)===c).length)},{name:"At-risk tasks",color:SCOL["At Risk"],vals:cats.map(c=>A.filter(r=>tStat(r)==="At Risk"&&tp(r)===c).length)}]}
    return stackedV(cats,series,{fmt:view==="value"?fmtShort:v=>fmtNum(v),h:250,maxLbl:12,click:true})};
  let pv=UI.dash.procView==="stage"?"status":UI.dash.procView,bv=["status","cfcount","value","delay"].includes(UI.dash.buView)?UI.dash.buView:"status";
  const orgDim=bu?FP.cf:FP.bu,orgName=bu?"Corporate Function":"BU";if(bu&&bv==="cfcount")bv="status";
  const VIEWS=[["status","Projects by status"],["cfcount","Projects by CF"],["value","Recurring value by CF (THB)"],["delay","Delayed / at-risk tasks"]];if(pv==="stage")UI.dash.procView="status";
  // in-progress by current stage
  const inprog=P.filter(r=>!["Completed","Cancelled"].includes(pStat(r)));const stgAll=[...listFromName("L_StageWF"),...listFromName("L_StageAG"),"(no tasks)","All complete"];
  const stgKeys=stgAll.filter(sn=>inprog.some(r=>curStage(r)===sn));
  const stageSeries=["On Track","At Risk","Delayed","On-Hold","Not Started"].map(st=>({name:st,color:SCOL[st],vals:stgKeys.map(sn=>inprog.filter(r=>curStage(r)===sn&&pStat(r)===st).length)}));
  // leaders
  const LDIM=UI.dash.ldim==="lead"?"lead":"wsl",LCOL=FP[LDIM],LNONE="Not assigned",lk=r=>gv("Projects",LCOL,r)||LNONE;
  const leads=uniq(P.map(lk)).sort((a,b)=>(a===LNONE)-(b===LNONE)||P.filter(r=>lk(r)===b).length-P.filter(r=>lk(r)===a).length).filter((x,i,a)=>x===LNONE||i<15);
  const leadSeries=STL.map(st=>({name:st,color:SCOL[st],vals:leads.map(l=>P.filter(r=>lk(r)===l&&pStat(r)===st).length)}));
  const selOpt=(id,val,opts)=>`<select id="${id}" class="mini">${opts.map(([v,t])=>`<option value="${v}" ${v===val?"selected":""}>${t}</option>`).join("")}</select>`;
  m.innerHTML=`${banner("report")}
  <div class="filterbar card dfilt"><b>Filter dashboard</b>
   <label>BU <select id="fBU"><option value="">All</option>${bus.map(b=>`<option ${b===bu?"selected":""}>${esc(b)}</option>`).join("")}</select></label>
   <label>CF <select id="fCF"><option value="">All${bu?" in "+esc(bu):""}</option>${cfs_.map(b=>`<option ${b===F.cf?"selected":""}>${esc(b)}</option>`).join("")}</select></label>
   <label>Project <span style="width:300px;display:inline-block">${comboHtml("fQ",F.q||"",[{v:"",t:`All projects${F.cf?" in "+esc(F.cf):bu?" in "+esc(bu):""} (${P3.length})`},...P3.map(r=>({v:pId(r),t:pId(r)+" — "+gv("Projects",FP.name,r)}))],{strict:false})}</span></label>
   <label>Process area <select id="fProc"><option value="">All</option>${procs_.map(b=>`<option ${b===F.proc?"selected":""}>${esc(b)}</option>`).join("")}</select></label>
   ${stChips(sts_,off,st=>P3a.filter(r=>pStat(r)===st).length,"dst")}
   ${nF?`<button class="btn small" id="clrAll">✕ Clear filters (${nF})</button>`:""}
   <span class="muted" style="margin-left:auto">${P.length} of ${allP.length} projects · ${A.length} tasks · ${Bl.length} benefit lines</span>
   <span class="muted finfo" title="Pick a BU, then a CF of that BU, then a project of that CF — or leave any on All. Status: untick a box to hide projects with that status, tick it to show them again (Only = show just that one). Type part of a name in Project to show all matching projects. These filters apply to every chart, KPI and table on the dashboard; dropdowns inside a card only change how that card is drawn.">ⓘ</span></div>
  <div class="grid kpis">
    ${k("Active / total projects",`${P.filter(r=>pStat(r)!=="Cancelled").length} / ${P.length}`)}
    ${k("Recurring value (THB / yr)",fmtShort(valRec))}${k("One-off value (THB)",fmtShort(valOne))}
    ${k("Hours saved / month",fmtNum(hrs),"≈ "+(hrs/fteh).toFixed(1)+" FTE")}
    ${k("Plan realised to date",fmtShort(pTD),"THB")}${k("Actual realised to date",fmtShort(aTD),(pTD?Math.round(aTD/pTD*100):0)+"% of plan")}
    ${k("Delayed / at-risk tasks",`${A.filter(r=>tStat(r)==="Delayed").length} / ${A.filter(r=>tStat(r)==="At Risk").length}`)}
    ${k("Open RAIDD items",D.filter(r=>gv("RAIDD",FD.status,r)!=="Closed"&&gv("RAIDD",FD.type,r)!=="Re-plan").length)}
    ${typeof hasE2E==="function"&&hasE2E()?k("Mapped to an E2E flow",`${(()=>{const G=e2eGroups(pids);return pids.size-G.rest.length})()} / ${pids.size}`,"projects linked to process steps"):""}
    ${k("Re-planned (approved)",`${P.filter(r=>pLive(r).rpdays>0).length} projects`,`${A.filter(r=>tLive(r).rpdays).length} tasks with a new plan`)}
  </div>
  ${typeof hasE2E==="function"&&hasE2E()?`<div class="card pad dsec" style="margin-top:14px"><div class="chead"><h2>By end-to-end process</h2><span class="muted" style="font-size:12px">Click a flow to see its swimlanes (left lane first), a lane to see its projects, a project to open it · process time comes from the E2E step pop-ups</span></div>${e2eTreeHtml(pids,"dash",BS)}</div>`:""}
  <div class="grid three" style="margin-top:14px">
    <div class="card pad"><h2>All project status</h2>${donut(stCount.map(x=>({n:x.n,v:x.v,c:x.c})),{center:P.length})}</div>
    <div class="card pad" data-chart="proc"><div class="chead"><h2>By process area</h2><span class="ctl"><span class="muted">Show</span>${selOpt("procView",pv,VIEWS)}</span></div><p class="muted" style="margin:-6px 0 4px;font-size:12px">Click a bar or colour to zoom into its projects</p>${dimChart(r=>gv("Projects",FP.proc,r),pv)}</div>
    <div class="card pad"><h2>Open projects by current stage</h2><p class="muted" style="margin:-6px 0 8px;font-size:12px">Stage of the first unfinished task · colour = project status</p>${stgKeys.length?stackedH(stgKeys,stageSeries):`<p class="muted">No open projects</p>`}</div>
  </div>
  ${UI.dash.zoom&&UI.dash.zoom.chart==="proc"?zoomPanel(P):""}
  <div style="margin-top:14px">${benefitPanel("dash")}</div>
  <div class="grid two" style="margin-top:14px">
    <div class="card pad" data-chart="bu"><div class="chead"><h2>By ${orgName}${bu?` <span class="muted" style="font-size:13px;font-weight:500">in ${esc(bu)}</span>`:""}</h2><span class="ctl"><span class="muted">Show</span>${selOpt("buView",bv,VIEWS.filter(v=>!(bu&&v[0]==="cfcount")))}</span></div><p class="muted" style="margin:-6px 0 4px;font-size:12px">${bu?"Bars = corporate functions of the selected BU":"Bars = BUs (pick a BU in the filter to see its CFs)"} · click a bar or colour to zoom in</p>${dimChart(r=>gv("Projects",orgDim,r),bv==="cfcount"&&bu?"status":bv)}</div>
    <div class="card pad${UI.dash.lshow?"":" lcollapsed"}"><div class="chead"><h2>Projects by ${LDIM==="lead"?"working team (project lead)":"workstream leader"}</h2><span class="ctl">${UI.dash.lshow?`<span class="muted">Show</span>${selOpt("ldim",LDIM,[["wsl","Workstream leader"],["lead","Working team (project lead)"]])}`:""}<button type="button" class="btn small" id="lshow" aria-expanded="${!!UI.dash.lshow}">${UI.dash.lshow?"▾ Hide":"▸ Show chart"}</button></span></div>${UI.dash.lshow?`<p class="muted" style="margin:-6px 0 4px;font-size:12px">${LDIM==="lead"?"Working team = the project lead running each project (dev / BA team on the project page)":"Workstream leader = owner of the programme area (e.g. P Oh for SSC simplification)"} · click a bar to list the projects</p>${stackedH(leads,leadSeries,{click:true})}`:`<p class="muted" style="margin:0;font-size:12.5px">${leads.filter(x=>x!==LNONE).length} ${LDIM==="lead"?"project leads":"workstream leaders"} · hidden — click <b>Show chart</b> to see projects by workstream leader or working team.</p>`}</div>
  </div>
  ${UI.dash.zoom&&UI.dash.zoom.chart!=="proc"?zoomPanel(P):""}
  <div id="cellList"></div>
  <details class="card pad" style="margin-top:14px"><summary><b>Detail tables</b> <span class="muted">— status × BU / CF / process area and the delayed & at-risk list</span></summary>
    <h2 style="margin-top:12px">Projects by status × ${bu?"CF":"BU"}</h2>${matrix(bu?"CF":"BU",P,r=>gv("Projects",bu?FP.cf:FP.bu,r),{})}
    <h2 style="margin-top:12px">Projects by status × process area</h2>${matrix("Process Area",P,r=>gv("Projects",FP.proc,r),{})}
    <h2 style="margin-top:12px">Delayed & at-risk projects</h2>${riskList(P)}</details>`;
  const reF=()=>{UI.dash.cell=null;UI.dash.zoom=null;vDash(m,true)};
  $("#fBU").onchange=e=>{F.bu=e.target.value;F.cf="";F.proc="";reF()};$("#fCF").onchange=e=>{F.cf=e.target.value;F.proc="";reF()};$("#fProc").onchange=e=>{F.proc=e.target.value;reF()};bindStChips(m,"dst",F,reF);
  $("#fQ").addEventListener("change",e=>{F.q=e.target.value.trim();reF()});
  if($("#clrAll"))$("#clrAll").onclick=()=>{F.bu=F.cf=F.proc=F.q="";F.stOff=[];reF()};
  $("#procView").onchange=e=>{UI.dash.procView=e.target.value;vDash(m,true)};$("#buView").onchange=e=>{UI.dash.buView=e.target.value;vDash(m,true)};
  m.querySelectorAll("svg [data-click]").forEach(el=>el.onclick=()=>{const chart=el.closest("[data-chart]").dataset.chart;const seg=el.dataset.seg||"";
    const view=chart==="proc"?pv:chart==="bu"?bv:null;
    const segType=({status:"status",stage:"stage",value:"cf",cfcount:"cf",delay:"delay"})[view];
    const cfKeep=uniq(P.map(r=>gv("Projects",FP.cf,r)||"(blank)")).sort((a,b)=>P.filter(r=>(gv("Projects",FP.cf,r)||"(blank)")===b).length-P.filter(r=>(gv("Projects",FP.cf,r)||"(blank)")===a).length).slice(0,7);
    UI.dash.zoom={chart:chart==="bu"?"org":chart,cat:el.dataset.click,seg,segType,cfKeep,dimField:chart==="bu"?orgDim:null,group:chart==="proc"?"status":(bu?"status":"cf"),measure:"comp"};
    vDash(m);const zc=$("#zoomCard");if(zc)zc.scrollIntoView({behavior:"auto",block:"start"})});
  bindZoom(m,P);bindBenefitPanel(m,()=>vDash(m,true),UI.benD);if(typeof e2eTreeBind==="function")e2eTreeBind(m.querySelector(".dsec")||document.createElement("div"),()=>vDash(m,true));
  m.querySelectorAll("span[data-click]").forEach(el=>el.onclick=()=>{UI.dash.cell={dim:UI.dash.ldim==="lead"?"Project Lead":"Workstream Leader",k:el.dataset.click==="Not assigned"?"(blank)":el.dataset.click,st:""};showCell(P,allP)});if($("#ldim"))$("#ldim").onchange=e=>{UI.dash.ldim=e.target.value;vDash(m,true)};if($("#lshow"))$("#lshow").onclick=()=>{UI.dash.lshow=!UI.dash.lshow;const y=scrollY;vDash(m,true);window.scrollTo(0,y)};
  m.querySelectorAll("[data-cell]").forEach(el=>el.onclick=e=>{e.stopPropagation();UI.dash.cell=JSON.parse(el.dataset.cell);showCell(P,allP)});
  m.querySelectorAll("tr[data-r]").forEach(tr=>tr.onclick=()=>openProject(+tr.dataset.r));
  if(UI.dash.cell)showCell(P,allP);
}

/* ---- page banners (report vs input) ---- */
function banner(kind,sheet){
  if(kind==="report")return `<div class="banner rep"><b>REPORT · read-only</b><span>Calculated live from the 5 input sheets. Change data under <b>Update data</b>, then <b>Save to Excel</b>.</span></div>`;
  return `<div class="banner inp"><b>INPUT · ${esc(sheet)}</b><span>Edits here are written into the ${esc(sheet)} sheet of the Excel file when you click <b>Save to Excel</b>. ${({Realisation:"Type the actual THB for each month in the grid.",RAIDD:"Use <b>Edit</b> / <b>Delete</b> on each row, or <b>+ New</b>.",Projects:"Click a row to open it, or <b>+ New</b>.",Benefits:"Click a row to open it, or <b>+ New</b>.",Activities:"Click a row to open it, or <b>+ New</b>."})[sheet]||""}</span></div>`;
}
