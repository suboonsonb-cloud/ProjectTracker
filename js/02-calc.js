/* 02-calc.js — live calculation engine (mirrors the Excel formulas) */
"use strict";
/* ---------------- live calculation engine (mirrors the Excel formulas) ---------------- */
const STL=["Not Started","On Track","At Risk","Delayed","On-Hold","Completed","Cancelled"];
let LIVE={task:{},proj:{}};
function liveCalc(){
  const tol=+setting("S_Tol")||5;const pt_=setting("S_PredTol");const predTol=pt_===""?0.15:+pt_;const RI={};
  const RPT={},RPP={},RPREF={};
  for(const r of rowsOf("RAIDD")){const t=gv("RAIDD",FD.tid,r),ty=gv("RAIDD",FD.type,r);
    if(ty==="Re-plan"){const ne=+gv("RAIDD",FD.rpend,r)||0;if(ne&&gv("RAIDD",FD.rpok,r)==="Y"){const pid=gv("RAIDD",FD.pid,r);const key=t||("P:"+pid);(RPREF[key]=RPREF[key]||[]).push(gv("RAIDD",FD.id,r)||"RAIDD");
      if(t)RPT[t]=Math.max(RPT[t]||0,ne);else if(pid)RPP[pid]=Math.max(RPP[pid]||0,ne)}continue}
    if(!t||gv("RAIDD",FD.status,r)==="Closed")continue;(RI[t]=RI[t]||[]).push({due:+gv("RAIDD",FD.due,r)||0,imp:gv("RAIDD",FD.impact,r)})}
  const PJ={};for(const r of rowsOf("Projects")){const id=pId(r);if(id)PJ[id]={r,ovr:gv("Projects",FP.ovr,r),meth:gv("Projects",FP.meth,r)==="Agile"?"Agile":"Waterfall",tm:gv("Projects",FP.tmeth,r),tasks:[]}}
  const T={};const num=(c,r)=>{const v=gv("Activities",c,r);return v===""?"":+v};
  for(const r of rowsOf("Activities")){
    const tid=tId(r),pid=gv("Activities",FA.pid,r);const act=+gv("Activities",FA.act,r)||0,ae=num(FA.ae,r),as=num(FA.as,r),ps=num(FA.ps,r),pe=num(FA.pe,r),ovr=gv("Activities",FA.ovr,r);
    const eact=ae!==""?1:act;const it=RI[tid]||[];
    const pPE=PJ[pid]?(+gv("Projects",FP.pe,PJ[pid].r)||0):0;const rpt=RPT[tid]||0;const rpd=(RPP[pid]&&pPE)?Math.max(0,RPP[pid]-pPE):0;
    const eps=ps===""?"":ps+((eact===0&&as==="")?rpd:0);const epe=pe===""?"":(rpt>0?rpt:(eact>=1?pe:pe+rpd));
    const rpdays=(epe!==""&&pe!=="")?epe-pe:0;const rpref=[...(RPREF[tid]||[]),...(rpd&&eact<1?(RPREF["P:"+pid]||[]):[])];
    const bsI=it.filter(i=>i.imp==="Blocks Start"),beI=it.filter(i=>i.imp!=="Blocks Start"&&i.imp!=="None");
    const bs=bsI.length?Math.max(TODAY,...bsI.map(i=>i.due)):0,be=beI.length?Math.max(TODAY,...beI.map(i=>i.due)):0;
    const fs=as!==""?as:eps===""?"":Math.max(eps,bs,(eact===0&&!ovr)?TODAY:0);
    const fe=ae!==""?ae:epe===""?"":Math.max(epe+((fs!==""&&eps!=="")?fs-eps:0),be,(eact<1&&!ovr)?TODAY:0);
    const slip=(fe!==""&&epe!=="")?fe-epe:"";const overdue=it.filter(i=>i.due&&i.due<TODAY).length;const pov=PJ[pid]?PJ[pid].ovr:"";
    let st;if(ovr)st=ovr;else if(eact>=1)st="Completed";else if(pov==="On-Hold"||pov==="Cancelled")st=pov;else if(fe==="")st="Not Started";
    else if((epe!==""&&TODAY>epe)||(slip!==""&&slip>tol))st="Delayed";else if((slip!==""&&slip>0)||overdue>0||(eact===0&&as===""&&eps!==""&&TODAY>eps))st="At Risk";
    else if(eact>0||as!=="")st="In Progress";else st="Not Started";
    const el=(eps!==""&&epe!=="")?Math.min(1,Math.max(0,(TODAY-eps+1)/Math.max(1,epe-eps+1))):0;
    const fc=st==="Completed"?"Done":st==="Delayed"?"Late":(st==="On-Hold"||st==="Cancelled")?st:st==="At Risk"?"At risk of delay":st==="Not Started"?(eps===""?"Not started":"On time"):(eps!==""&&epe!==""&&el-eact>predTol)?"At risk of delay":"On time";
    T[r]={r,tid,pid,fs,fe,slip,status:st,fc,el,eact,ps,pe,eps,epe,rpdays,rpref,ovr,stage:gv("Activities",FA.stage,r),wb:+gv("Activities","S",r)||0};
    if(PJ[pid])PJ[pid].tasks.push(T[r]);
  }
  // upcoming tasks: at risk when an earlier stage's forecast end has slipped past its plan end AND past this task's (effective) plan start
  for(const p of Object.values(PJ)){const stg=listFromName(p.meth==="Agile"?"L_StageAG":"L_StageWF");p.tasks.forEach(t=>t.sidx=stg.indexOf(t.stage)+1);
    for(const t of p.tasks){if(t.status!=="Not Started"||t.eps===""||!t.sidx)continue;
      const pr=p.tasks.filter(x=>x.sidx&&x.sidx<t.sidx&&x.status!=="Cancelled");const mfe=Math.max(0,...pr.map(x=>+x.fe||0)),mpe=Math.max(0,...pr.map(x=>+x.epe||0));
      t.fc=(mfe>t.eps&&mfe>mpe)?"At risk of delay":"On time"}}
  const P={};
  for(const [id,p] of Object.entries(PJ)){
    const ts=p.tasks,n=ts.length;const ps=+gv("Projects",FP.ps,p.r)||"",pe=+gv("Projects",FP.pe,p.r)||"";
    let st;if(p.ovr)st=p.ovr;else if(!n)st="Not Started";else if(ts.every(t=>t.status==="Completed"||t.status==="Cancelled"))st="Completed";
    else if(ts.some(t=>t.status==="Delayed"))st="Delayed";else if(ts.some(t=>t.status==="At Risk"))st="At Risk";
    else if(ts.some(t=>t.status==="In Progress"||t.status==="Completed"))st="On Track";else st="Not Started";
    const ag=p.meth==="Agile";const stages=listFromName(ag?"L_StageAG":"L_StageWF"),tpl=listFromName(ag?"L_WAG":"L_WWF").map(Number);
    const cus=["T","U","V","W","X","Y"].map(c=>+gv("Projects",c,p.r)||0);const anyC=cus.some(x=>x>0);
    const tb=t=>t.ovr==="Cancelled"?0:p.tm==="Duration"?((t.ps!==""&&t.pe!=="")?Math.max(1,t.pe-t.ps+1):1):p.tm==="Custom"?t.wb:1;
    const basis=stages.map((sn,k)=>{const nk=ts.filter(t=>t.stage===sn&&t.ovr!=="Cancelled").length;return nk?(anyC?cus[k]:(tpl[k]||0)):0});
    const bsum=basis.reduce((a,b)=>a+b,0);let comp=0;
    stages.forEach((sn,k)=>{if(!bsum||!basis[k])return;const st_=ts.filter(t=>t.stage===sn);const tot=st_.reduce((a,t)=>a+tb(t),0);if(!tot)return;
      comp+=basis[k]/bsum*st_.reduce((a,t)=>a+tb(t)/tot*t.eact,0)});
    const fsA=ts.map(t=>t.fs).filter(x=>x!==""),feA=ts.map(t=>t.fe).filter(x=>x!=="");
    const fstart=n?(fsA.length?Math.min(...fsA):""):ps,fend=n?(feA.length?Math.max(...feA):""):pe;
    const rpd_=Math.max(0,...ts.map(t=>t.rpdays||0));P[id]={rpdays:rpd_,rpref:[...new Set(ts.flatMap(t=>t.rpdays?t.rpref:[]))],status:st,comp,fstart,fend,slip:(fend!==""&&pe!=="")?fend-pe:"",ntask:n,ndel:ts.filter(t=>t.status==="Delayed").length,nrisk:ts.filter(t=>t.status==="At Risk").length};
  }
  LIVE={task:T,proj:P};
}
function rpTag(days,refs,small){if(!days)return "";return `<span class="rptag" title="Timeline adjusted by approved RAIDD re-plan ${esc((refs||[]).join(', '))}">⟳ Re-planned ${days>0?"+":""}${days}d</span>`}
const tLive=r=>LIVE.task[r]||{};const pLive=r=>LIVE.proj[pId(r)]||{};
const pStat=r=>pLive(r).status||gv("Projects",FP.ovr,r)||gv("Projects",FP.status,r)||"Not Started";
const tStat=r=>tLive(r).status||gv("Activities",FA.status,r);

