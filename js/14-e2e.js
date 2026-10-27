/* 14-e2e.js — E2E flows (swimlane studio host, maps, breakdown tree) */
"use strict";
/* =====================================================================================
   E2E FLOWS — AS-IS (before) and TO-BE (new design) swimlanes per end-to-end process,
   with every step box linkable to the projects that deliver it.
   Storage (workbook): E2E_Flows = one row per flow version, the diagram JSON split over
   "Diagram data 1..30"; E2E_Map = one row per step ↔ project link (rebuilt on each change).
   Editing happens in the embedded Swimlane Studio (iframe, postMessage).
   ===================================================================================== */
const E2EF="E2E_Flows",E2EM="E2E_Map",EF={id:"B",name:"C",area:"D",ver:"E",owner:"F",steps:"G",projs:"H",upd:"I",notes:"J"},EF_DATA0=11,EF_NDATA=30,EF_FIRST=6,EF_LAST=205;
const EM={fid:"B",fname:"C",ver:"D",no:"E",lane:"F",sid:"G",step:"H",chg:"I",repl:"J",pid:"K",cp:"R",key:"S",hrs:"T",saved:"U",cost:"V"},EM_FIRST=6,EM_LAST=1505,VERS=["AS-IS","TO-BE"];
UI.e2e=UI.e2e||{flow:null,ver:"TO-BE",all:false,q:"",chip:"count",tags:true,link:null,focus:null,full:true};
const hasE2E=()=>!!(S.sheets[E2EF]&&S.sheets[E2EF].vals&&S.sheets[E2EM]&&S.sheets[E2EM].vals);
function eSet(sh,c,r,v){if(String(gv(sh,c,r))===String(v??""))return;if(sh===E2EM&&typeof canEdit==="function"&&!canEdit())return;setCell(sh,c,r,v)}
let E2E_CACHE=null;
function e2eFlows(){if(E2E_CACHE)return E2E_CACHE;const out=[];if(!hasE2E())return out;const by={};
  for(let r=EF_FIRST;r<=EF_LAST;r++){const id=String(gv(E2EF,EF.id,r)||"");if(!id)continue;const ver=String(gv(E2EF,EF.ver,r)||"AS-IS").toUpperCase().includes("TO")?"TO-BE":"AS-IS";
    let js="";for(let k=0;k<EF_NDATA;k++){const v=gv(E2EF,colLet(EF_DATA0+k),r);if(v===""||v==null)break;js+=String(v)}let doc=null;try{doc=js?JSON.parse(js):null}catch(e){doc=null}
    const f=by[id]||(by[id]={id,name:String(gv(E2EF,EF.name,r)||id),area:String(gv(E2EF,EF.area,r)||""),owner:String(gv(E2EF,EF.owner,r)||""),notes:String(gv(E2EF,EF.notes,r)||""),v:{}});
    if(f.v[ver])(f.dup||(f.dup=[])).push(ver+" (row "+r+")");else f.v[ver]={r,doc,bad:!!js&&!doc};if(!out.includes(f))out.push(f)}
  E2E_CACHE=out;return out}
function e2eFlow(id){return e2eFlows().find(f=>f.id===id)||null}
function e2eFreeRow(){for(let r=EF_FIRST;r<=EF_LAST;r++)if(gv(E2EF,EF.id,r)==="")return r;return null}
function e2eNewId(area){const base="E2E-"+(String(area||"GEN").toUpperCase().replace(/[^A-Z0-9]+/g,"")||"GEN")+"-";const ids=e2eFlows().map(f=>f.id);let n=1;while(ids.includes(base+String(n).padStart(2,"0")))n++;return base+String(n).padStart(2,"0")}
function docProjects(doc){const s=new Set();for(const sh of (doc&&doc.shapes)||[])for(const p of sh.proj||[])s.add(p);return [...s]}
function laneOfShape(doc,sh){if(!doc||!doc.lanes)return "";const v=(doc.ori||"v")==="v";const hasSec=(doc.secs||[]).length>0;let a=v?(hasSec?34:0):46+(hasSec?34:0);const c=v?sh.x+sh.w/2:sh.y+sh.h/2;
  for(const l of doc.lanes){if(c<a+l.size)return l.name;a+=l.size}return doc.lanes.length?doc.lanes[doc.lanes.length-1].name:""}
const chgOf=sh=>sh.chg||(sh.isNew?"New":"");
const isStep=sh=>!["frame","image","text"].includes(sh.type);
/* step # = longest-path level from the main start. Only arrows that loop back to a step already upstream (found by a
   depth-first pass) are ignored — forward "No"/"Yes" branches count. Side inputs with no incoming arrow (e.g. an R2R
   chain) start half a level before the first step they feed, and their own chain follows by level. Ties by position. */
/* step numbers: the main path (longest arrow chain from the start) is numbered 1,2,3…; branches hang off it as sub-steps
   (12.1, 12.2 after the main step they leave from; side inputs before the main step they feed) */
/* multi-page diagrams: lay pages one after another and bridge the last step of a page to the first step of the next, so numbering runs on */
function e2eFlat(doc){if(!doc||!doc.pages||doc.pages.length<2)return doc;const v=(doc.ori||"v")==="v";const idx=Object.fromEntries(doc.pages.map((p,i)=>[p.id,i]));const off=s=>(idx[s.pg]||0)*100000;
  const shapes=(doc.shapes||[]).map(s=>v?{...s,y:s.y+off(s)}:{...s,x:s.x+off(s)});const links=(doc.links||[]).slice();const steps=shapes.filter(isStep);
  const pos=(a,b)=>v?(a.y-b.y)||(a.x-b.x):(a.x-b.x)||(a.y-b.y);const hasOut=new Set(links.map(l=>l.from)),hasIn=new Set(links.map(l=>l.to));
  for(let i=0;i<doc.pages.length-1;i++){const a=steps.filter(s=>(idx[s.pg]||0)===i),b=steps.filter(s=>(idx[s.pg]||0)===i+1);if(!a.length||!b.length)continue;
    const e=a.filter(s=>!hasOut.has(s.id)),st=b.filter(s=>!hasIn.has(s.id));const last=(e.length?e:a).sort(pos).pop(),first=(st.length?st:b).sort(pos)[0];links.push({id:"_pg"+i,from:last.id,to:first.id})}
  const o={...doc,shapes,links};delete o.pages;return o}
function stepNumbers(doc){doc=e2eFlat(doc);const order=stepOrder(doc);if(!order.length)return [];const by=Object.fromEntries(order.map(x=>[x.id,x]));const v=(doc.ori||"v")==="v";
  const pos=(a,b)=>v?(a.y-b.y)||(a.x-b.x):(a.x-b.x)||(a.y-b.y);const idx=Object.fromEntries(order.map((x,i)=>[x.id,i]));
  const out={},pred={};order.forEach(x=>{out[x.id]=[];pred[x.id]=[]});
  for(const l of doc.links||[]){if(!(l.from in out)||!(l.to in out)||l.from===l.to)continue;if(idx[l.to]<=idx[l.from])continue;/* forward arrows only (by order) */out[l.from].push(l.to);pred[l.to].push(l.from)}
  const dist={},par={};const start=order[0].id;dist[start]=0;
  for(const x of order){if(!(x.id in dist))continue;for(const t of out[x.id])if((dist[t]??-1)<dist[x.id]+1||(dist[t]===dist[x.id]+1&&pos(by[x.id],by[par[t]])<0)){dist[t]=dist[x.id]+1;par[t]=x.id}}
  let end=start;for(const id in dist)if(dist[id]>dist[end]||(dist[id]===dist[end]&&pos(by[id],by[end])>0))end=id;
  const main=[];for(let c=end;c!=null;c=par[c])main.unshift(c);const mi=Object.fromEntries(main.map((id,i)=>[id,i]));
  const anc=id=>{const seen=new Set([id]),q=[id];let best=-1;while(q.length){const a=q.shift();for(const p of pred[a]){if(seen.has(p))continue;seen.add(p);if(p in mi)best=Math.max(best,mi[p]);else q.push(p)}}return best};
  const desc=id=>{const seen=new Set([id]),q=[id];let best=Infinity;while(q.length){const a=q.shift();for(const t of out[a]){if(seen.has(t))continue;seen.add(t);if(t in mi)best=Math.min(best,mi[t]);else q.push(t)}}return best};
  const grp={},key={};/* a branch step with no main ancestor follows its own branch predecessor, else sits before the main step it feeds */
  const side=new Set();
  for(const x of order){if(x.id in mi)continue;const a=anc(x.id);let k;if(a>=0)k=a;else{const bp=pred[x.id].find(p=>p in key);if(bp){k=key[bp];if(side.has(bp))side.add(x.id)}else{k=desc(x.id)<Infinity?desc(x.id)-1:main.length-1;side.add(x.id)}}key[x.id]=k;(grp[k]=grp[k]||[]).push(x)}
  for(const k in grp)grp[k].sort((a,b)=>(side.has(a.id)-side.has(b.id))||(idx[a.id]-idx[b.id]));/* branches first, then side inputs feeding the next step */
  const res=[];const pushSubs=k=>{const g=grp[k]||[];const w=g.length>9?100:10;g.forEach((x,j)=>res.push({sh:x,no:Math.round((Math.max(0,k+1)+(j+1)/w)*100)/100}))};
  pushSubs(-1);main.forEach((id,i)=>{res.push({sh:by[id],no:i+1});pushSubs(i)});return res}
function stepOrder(doc){doc=e2eFlat(doc);const v=(doc.ori||"v")==="v";const pos=(a,b)=>v?(a.y-b.y)||(a.x-b.x):(a.x-b.x)||(a.y-b.y);
  const S=(doc.shapes||[]).filter(isStep);if(!S.length)return [];const ids=new Set(S.map(x=>x.id));const by=Object.fromEntries(S.map(x=>[x.id,x]));
  const out={};S.forEach(x=>out[x.id]=[]);for(const l of doc.links||[])if(ids.has(l.from)&&ids.has(l.to)&&l.from!==l.to&&!out[l.from].includes(l.to))out[l.from].push(l.to);
  for(const k in out)out[k].sort((a,b)=>pos(by[a],by[b]));
  const hasIn=new Set();for(const k in out)out[k].forEach(t=>hasIn.add(t));const srcs=S.filter(x=>!hasIn.has(x.id)).sort(pos);
  const main=(srcs[0]||S.slice().sort(pos)[0]).id;
  /* depth-first pass: back edges = arrows to a step on the current path */
  const state={},back=new Set();const dfs=a=>{state[a]=1;for(const t of out[a]){if(state[t]===1)back.add(a+">"+t);else if(!state[t])dfs(t)}state[a]=2};
  dfs(main);srcs.forEach(x=>{if(!state[x.id])dfs(x.id)});S.slice().sort(pos).forEach(x=>{if(!state[x.id])dfs(x.id)});
  const dag={},pred={};S.forEach(x=>{dag[x.id]=[];pred[x.id]=[]});for(const a in out)for(const t of out[a])if(!back.has(a+">"+t)){dag[a].push(t);pred[t].push(a)}
  /* longest path from main over the part it reaches */
  const reach=new Set([main]);const q=[main];while(q.length){const a=q.shift();for(const t of dag[a])if(!reach.has(t)){reach.add(t);q.push(t)}}
  const lvl={};const din={};for(const id of reach)din[id]=pred[id].filter(p=>reach.has(p)).length;const k=[main];lvl[main]=0;
  while(k.length){const a=k.shift();for(const t of dag[a]){if(!reach.has(t))continue;lvl[t]=Math.max(lvl[t]??-1,lvl[a]+1);if(--din[t]===0)k.push(t)}}
  for(const id of reach)if(!(id in lvl))lvl[id]=1;
  for(let it=0;it<S.length*2;it++){let ch=false;
    for(const x of S){if(x.id in lvl)continue;const P=pred[x.id];
      if(P.length&&P.every(p=>p in lvl)){lvl[x.id]=Math.max(...P.map(p=>lvl[p]))+1;ch=true;continue}
      if(!P.length){const L=dag[x.id].filter(t=>t in lvl&&reach.has(t)).map(t=>lvl[t]);if(L.length){lvl[x.id]=Math.min(...L)-0.5;ch=true}}}
    if(!ch)break}
  const lv=S.filter(x=>x.id in lvl);for(const x of S)if(!(x.id in lvl)){const n=lv.slice().sort((a,b)=>Math.abs(a.y-x.y)+Math.abs(a.x-x.x)-Math.abs(b.y-x.y)-Math.abs(b.x-x.x))[0];lvl[x.id]=n?lvl[n.id]:0}
  return S.slice().sort((a,b)=>(lvl[a.id]-lvl[b.id])||pos(a,b))}
/* full step text: wrapped lines join with a space, list items with " – " */
function stepFull(sh){let out="";for(const raw of String(sh.text||"").split("\n")){const isItem=/^\s*([-•*▪☐]|\[.?\]|o)\s+/.test(raw);const t=raw.replace(/^\s*([-•*▪☐]|\[.?\]|o)\s+/,"").trim();if(!t)continue;out+=out?(isItem?" – ":" ")+t:t}return out||"(no text)"}
function e2eFull(pid){const r=projRowById(pid);const l=r?String(gv("Projects","Z",r)||""):"";return pid+(l?" (old "+l+")":"")}
/* box title = lines up to the first bullet, joined ("Issue Invoice & Submit Invoice") */
function stepTitle(sh){const out=[];for(const raw of String(sh.text||"").split("\n")){if(/^\s*([-•*▪☐]|\[.?\]|o)\s+/.test(raw)&&out.length)break;const t=raw.replace(/^\s*([-•*▪☐]|\[.?\]|o)\s+/,"").trim();if(t)out.push(t)}return out.join(" ")||"(no text)"}
function stepText(sh){return String(sh.text||"").split("\n")[0].replace(/^\s*([-•*▪]|\[.?\]|o)\s+/,"").trim()||"(no text)"}
function e2eWriteDoc(flow,ver,doc){let row=flow.v[ver]&&flow.v[ver].r;
  if(!row){row=e2eFreeRow();if(!row){toast("E2E_Flows is full (200 rows) — insert rows in Excel",6000);return false}
    eSet(E2EF,EF.id,row,flow.id);eSet(E2EF,EF.name,row,flow.name);eSet(E2EF,EF.area,row,flow.area);eSet(E2EF,EF.owner,row,flow.owner||"");eSet(E2EF,EF.ver,row,ver)}
  const js=JSON.stringify(doc);const parts=[];for(let i=0;i<js.length;i+=30000)parts.push(js.slice(i,i+30000));
  if(parts.length>EF_NDATA){toast("This diagram is too large to store (pictures?) — remove some pictures and try again",8000);return false}
  for(let k=0;k<EF_NDATA;k++)eSet(E2EF,colLet(EF_DATA0+k),row,parts[k]||"");
  const steps=(doc.shapes||[]).filter(s=>!["frame","image","text"].includes(s.type)).length;eSet(E2EF,EF.steps,row,steps);
  eSet(E2EF,EF.projs,row,docProjects(doc).map(e2eFull).join(", "));eSet(E2EF,EF.upd,row,TODAY);
  E2E_CACHE=null;return true}
/* time spent per step (hrs / month) and, for TO-BE steps, the saving vs the AS-IS steps they replace; cost = typed value or saving × hourly rate × 12 */
function e2eStepTime(f,ver,sh){const hrs=sh.hrs!=null&&sh.hrs!==""?+sh.hrs:"";if(ver!=="TO-BE")return {hrs,saved:"",cost:""};
  const A=f.v["AS-IS"]&&f.v["AS-IS"].doc;const rp=[].concat(sh.repl||[]);const rate0=+setting("S_Rate")||0;
  if(!rp.length&&chgOf(sh)==="New"&&hrs!=="")return {hrs,saved:-hrs,cost:sh.cost!=null?+sh.cost:(rate0?Math.round(-hrs*rate0*12):"")};/* brand-new work counts against the saving */
  if(!rp.length)return {hrs,saved:"",cost:sh.cost!=null?+sh.cost:""};
  if(rp.some(id=>{const x=A&&(A.shapes||[]).find(q=>q.id===id);return !x||x.hrs==null||x.hrs===""}))return {hrs,saved:"",cost:sh.cost!=null?+sh.cost:""};/* every replaced AS-IS step must be timed */
  const T_=f.v["TO-BE"]&&f.v["TO-BE"].doc;const share=id=>Math.max(1,T_?(T_.shapes||[]).filter(x=>[].concat(x.repl||[]).includes(id)).length:1);
  const asisH=rp.reduce((a,id)=>{const x=A&&(A.shapes||[]).find(q=>q.id===id);return a+(x&&x.hrs?+x.hrs/share(id):0)},0);/* merged AS-IS steps are shared between the TO-BE steps they feed */if(!asisH&&hrs==="")return {hrs,saved:"",cost:sh.cost!=null?+sh.cost:""};
  if(hrs===""||!asisH)return {hrs,saved:"",cost:sh.cost!=null?+sh.cost:""};/* a saving needs time on both sides */
  const sv=asisH-(+hrs||0);const rate=+setting("S_Rate")||0;return {hrs,saved:Math.round(sv*100)/100,cost:sh.cost!=null?+sh.cost:(rate?Math.round(sv*rate*12):"")}}
function e2eFlowTotals(f){const out={asis:0,tobe:0,saved:0,cost:0,steps:0,timed:0};for(const ver of VERS){const d=f.v[ver]&&f.v[ver].doc;if(!d)continue;
    for(const sh of (d.shapes||[]).filter(isStep)){const t=e2eStepTime(f,ver,sh);if(ver==="AS-IS")out.asis+=+t.hrs||0;else{out.tobe+=+t.hrs||0;out.saved+=+t.saved||0;out.cost+=+t.cost||0;out.steps++;if(t.hrs!=="")out.timed++;if(t.saved!=="")out.matched=(out.matched||0)+1}}}return out}
function e2eTimeHtml(f){const t=e2eFlowTotals(f);const n=v=>fmtNum(Math.round(v*10)/10);
  return t.asis||t.tobe?`<span class="e2etime" title="Hours per month across all steps (set in each box's pop-up). Saving counts only TO-BE steps timed on both sides.">⏱ AS-IS ${n(t.asis)} h/m → TO-BE ${n(t.tobe)} h/m${t.saved?` · <b style="color:${t.saved>0?"#1E6B24":"#B42318"}">${t.saved>0?"saves":"adds"} ${n(Math.abs(t.saved))} h/m</b>`:""}${t.cost?(t.cost>0?` ≈ ${fmtNum(t.cost)} THB/yr saved`:` ≈ ${fmtNum(-t.cost)} THB/yr extra cost`):""} <span class="muted" style="font-size:11px">(saving on ${t.matched||0} matched step${t.matched===1?"":"s"})</span></span>`:`<span class="e2etime muted" title="Click a box and enter the time spent per month">⏱ add time per step to see savings</span>`}
function e2eRebuildMap(){if(!hasE2E())return;const rows=[];
  for(const f of e2eFlows()){const A=f.v["AS-IS"]&&f.v["AS-IS"].doc,T=f.v["TO-BE"]&&f.v["TO-BE"].doc;
    const nm=(d,id)=>{const sh=d&&(d.shapes||[]).find(x=>x.id===id);return sh?stepTitle(sh)+" ("+laneOfShape(d,sh)+")":id};
    const repBy={};if(T)for(const sh of T.shapes||[])for(const a of [].concat(sh.repl||[]))(repBy[a]=repBy[a]||[]).push(sh);
    for(const ver of VERS){const d=f.v[ver]&&f.v[ver].doc;if(!d)continue;
      stepNumbers(d).forEach(({sh,no})=>{let chg=chgOf(sh),cp=[],rp="",P=[...(sh.proj||[])];
        if(ver==="TO-BE"){cp=[].concat(sh.repl||[]);rp=cp.length?(chg?"Replaces: ":"Same as AS-IS: ")+cp.map(id=>nm(A,id)).join("; "):""}
        else{const by=repBy[sh.id]||[];cp=by.map(x=>x.id);if(by.length)rp=(chgOf(sh)==="Merged"||chgOf(sh)==="Removed"?"Merged into: ":chgOf(sh)||by.some(x=>chgOf(x))?"Replaced by: ":"Same step in TO-BE: ")+by.map(x=>nm(T,x.id)).join("; ");
          if(!chg&&by.some(x=>chgOf(x)))chg="Changed";/* AS-IS rows carry the projects of the TO-BE steps that replace them */
          if(chg)for(const x of by)for(const p of x.proj||[])if(!P.includes(p))P.push(p)}
        const base=[f.id,f.name,ver,no,laneOfShape(d,sh),sh.id,stepFull(sh),chg,rp];const tail=[cp.join(";"),f.id+"|"+ver+"|"+sh.id];
        const tc=e2eStepTime(f,ver,sh);const tm=[tc.hrs,tc.saved,tc.cost];const blank=["","",""];
        if(P.length)P.forEach((p,i)=>rows.push([...base,p,...tail,...(i?blank:tm)]));else rows.push([...base,"",...tail,...tm])})}}
  rows.sort((a,b)=>a[0].localeCompare(b[0])||a[2].localeCompare(b[2])||a[3]-b[3]);
  if(rows.length>EM_LAST-EM_FIRST+1)toast("E2E_Map holds 1,500 rows — the rest were not written",6000);
  const cs=Object.values(EM);for(let i=0;EM_FIRST+i<=EM_LAST;i++){const r=EM_FIRST+i,v=rows[i];if(!v&&gv(E2EM,EM.fid,r)==="")break;cs.forEach((c,k)=>eSet(E2EM,c,r,v?v[k]:""))}}
let E2E_MAPQ=0;function e2eQueueMap(){clearTimeout(E2E_MAPQ);E2E_MAPQ=setTimeout(()=>{e2eRebuildMap();updateBadge();renderTabs()},500)}
/* links of a project, across all flows/versions */
function e2eLinksOf(pid){const out=[];for(const f of e2eFlows())for(const ver of VERS){const d=f.v[ver]&&f.v[ver].doc;if(!d)continue;
  for(const sh of d.shapes||[])if((sh.proj||[]).includes(pid))out.push({f,ver,sh,lane:laneOfShape(d,sh),step:stepText(sh)})}return out}
/* short label keeps the AUT/PIM series and the area — "SSC-004" alone is ambiguous (AUT-SSC-004 vs PIM-SSC-004) */
/* short tag: programme-initiative-number (SIMP-AUT-062, 2T-AUT-016); the area is added only when that would be ambiguous */
let E2E_SHORTDUP=null;
function e2eShortBase(pid){return String(pid)}/* one code format everywhere: the full Project ID (e.g. SIMP-PIM-FIN-SSC-002) */
function e2eShortBaseOld(pid){const p=String(pid).split("-");if(p.length<5)return String(pid);
  if(!E2E_SHORTDUP||E2E_SHORTDUP.n!==rowsOf("Projects").length){const c={};rowsOf("Projects").forEach(r=>{const q=pId(r).split("-");if(q.length>=5){const k=q[0]+"-"+q[1]+"-"+q[q.length-1];c[k]=(c[k]||0)+1}});E2E_SHORTDUP={n:rowsOf("Projects").length,c}}
  const k=p[0]+"-"+p[1]+"-"+p[p.length-1];return E2E_SHORTDUP.c[k]>1?p[0]+"-"+p[1]+"-"+p[p.length-2]+"-"+p[p.length-1]:k}
/* seed constants were written with the old SGA- prefix: resolve to whatever programme prefix the project has now */
function e2eResolve(pid){if(projRowById(pid))return pid;const tail=String(pid).replace(/^[A-Z0-9]+-/,"-");const r=rowsOf("Projects").find(x=>pId(x).endsWith(tail)&&pId(x).split("-").length===String(pid).split("-").length);return r?pId(r):null}
function e2eShort(pid){const r=projRowById(pid);if(UI.e2e.chip==="legacy"&&r){const l=String(gv("Projects","Z",r)||"");if(l)return "#"+l}return e2eShortBase(pid)}
function e2eProjList(){liveCalc();return rowsOf("Projects").filter(r=>gv("Projects",FP.name,r)!=="").map(r=>{const id=pId(r);return {id,short:e2eShort(id),legacy:String(gv("Projects","Z",r)||""),name:String(gv("Projects",FP.name,r)),status:pStat(r),area:String(gv("Projects",FP.proc,r)||""),team:String(gv("Projects","AB",r)||"")}})}

/* ---------- studio iframe ----------
   One editor iframe lives for the whole session in a host layer placed over the slot of the E2E page, so Desk re-renders
   (Save, version switch, opening a project and coming back) never reload it — undo, zoom and typing survive. */
let E2E_FRAME=null,E2E_READY=false,E2E_HOST=null,E2E_SLOT=null,E2E_SENT={key:"",js:""},E2E_RO=null;
function e2ePost(m){if(E2E_FRAME&&E2E_FRAME.contentWindow)E2E_FRAME.contentWindow.postMessage({src:"desk",...m},"*")}
function e2eEnsureFrame(){if(E2E_HOST&&document.body.contains(E2E_HOST))return;E2E_HOST=document.createElement("div");E2E_HOST.id="e2eHost";
  E2E_FRAME=document.createElement("iframe");E2E_FRAME.id="e2eFrame";E2E_FRAME.title="Swimlane editor";E2E_HOST.appendChild(E2E_FRAME);document.body.appendChild(E2E_HOST);
  E2E_READY=false;E2E_SENT={key:"",js:""};E2E_FRAME.srcdoc=STUDIO_HTML;
  E2E_RO=new ResizeObserver(()=>e2ePlace());E2E_RO.observe(document.body);window.addEventListener("resize",e2ePlace)}
function e2ePlace(){if(!E2E_HOST)return;const s=E2E_SLOT;
  if(!s||!document.body.contains(s)||view!=="E2E"||!S.zip||s.dataset.hidden==="1"){E2E_HOST.style.cssText="position:absolute;left:-10000px;top:0;width:1000px;height:640px;visibility:hidden;z-index:-1";return}
  const r=s.getBoundingClientRect();E2E_HOST.style.cssText=`position:absolute;left:${r.left+scrollX}px;top:${r.top+scrollY}px;width:${r.width}px;height:${r.height}px;z-index:5`}
function e2eAttach(slot){e2eEnsureFrame();E2E_SLOT=slot;if(slot&&E2E_RO)E2E_RO.observe(slot);e2ePlace();requestAnimationFrame(e2ePlace)}
/* editor height = what is left of the window under the sticky header and the flow bar (so the pop-up is never cut off) */
let E2E_ALIGN_T=0;
function e2eStick(){const h=document.querySelector("header.top"),n=document.querySelector("nav.tabs");return Math.max(h?h.offsetHeight:0,(n?52+n.offsetHeight:0))}
function e2eFitSlot(scroll){const sl=document.querySelector("#e2eSlot.e2eslot"),bar=document.querySelector(".e2ebar");if(!sl||!bar||view!=="E2E")return;const st=e2eStick();
  if(scroll){E2E_ALIGN_T=Date.now();window.scrollTo(0,Math.max(0,bar.getBoundingClientRect().top+scrollY-st-6))}
  const gap=sl.getBoundingClientRect().top-bar.getBoundingClientRect().top;sl.style.height=Math.max(420,innerHeight-st-6-gap-10)+"px";e2ePlace()}
window.addEventListener("resize",()=>{if(view==="E2E")e2eFitSlot(false)});
function e2eHide(){E2E_SLOT=null;if(E2E_HOST)e2ePlace()}
function e2eInitFrame(){const f=e2eFlow(UI.e2e.flow);if(!f||!E2E_READY)return;const ver=UI.e2e.ver;const cur=f.v[ver];
  const doc=cur&&cur.doc?cur.doc:null;if(!doc)return;
  const ad=f.v["AS-IS"]&&f.v["AS-IS"].doc;const td_=f.v["TO-BE"]&&f.v["TO-BE"].doc;const shr=id=>td_?(td_.shapes||[]).filter(x=>[].concat(x.repl||[]).includes(id)).length:1;
  const asis=ad?stepOrder(ad).map(sh=>({id:sh.id,text:stepTitle(sh),hrs:sh.hrs==null||sh.hrs===""?null:+sh.hrs,share:Math.max(1,shr(sh.id))})):[];
  if(f.dup&&!f.dupWarned){f.dupWarned=1;toast("“"+f.name+"” has more than one row for "+f.dup.join(", ")+" in E2E_Flows — only the first is used",8000)}
  const key=f.id+"|"+ver;E2E_SENT={key,js:JSON.stringify(doc)};
  e2ePost({type:"init",key,rate:+setting("S_Rate")||0,version:ver,asis,doc,projects:e2eProjList(),title:e2eTitle(f,ver),link:UI.e2e.link,focus:UI.e2e.focus});
  e2ePost({type:"tags",on:UI.e2e.tags,mode:UI.e2e.chip==="count"?"count":"all"});UI.e2e.focus=null}
const e2eTitle=(f,ver)=>`${f.name} · ${ver==="AS-IS"?"AS-IS (before)":"TO-BE (new design)"}`;
/* bring the editor in line with the workbook: full re-init only when the flow/version or the stored diagram differs from what the editor holds */
function e2eSync(){if(!E2E_READY)return;const f=e2eFlow(UI.e2e.flow);const ver=UI.e2e.ver;const cur=f&&f.v[ver];if(!cur||!cur.doc)return;
  const key=f.id+"|"+ver;if(key!==E2E_SENT.key||JSON.stringify(cur.doc)!==E2E_SENT.js){e2eInitFrame();return}
  e2ePost({type:"projects",projects:e2eProjList()});e2ePost({type:"title",title:e2eTitle(f,ver)});e2ePost({type:"tags",on:UI.e2e.tags,mode:UI.e2e.chip==="count"?"count":"all"});e2ePost({type:"link",project:UI.e2e.link});
  if(UI.e2e.focus){e2ePost({type:"focus",ids:UI.e2e.focus});UI.e2e.focus=null}}
/* ask the editor to commit any text being typed and send pending changes; resolves on its reply (or after 400 ms) */
const E2E_FLQ={},E2E_SNAP={},E2E_SNAPQ={};let E2E_SNAPWAIT=[];
/* static picture of the other version (AS-IS above the TO-BE editor, TO-BE below the AS-IS editor), drawn by the editor */
/* el.dataset.hl = comma list of step ids to highlight (others are dimmed) */
function e2eSnapFill(el,svg){el.innerHTML=svg||'<p class="muted">Could not draw this version.</p>';const ids=(el.dataset.hl||"").split(",").filter(Boolean);
  if(ids.length){el.classList.add("hlmode");ids.forEach(id=>el.querySelectorAll(`[data-shape="${CSS.escape(id)}"]`).forEach(g=>g.classList.add("hlstep")))}else el.classList.remove("hlmode")}
function e2eSnapshot(doc,el){const js=JSON.stringify(doc)+"|"+UI.e2e.chip+"|"+(el.dataset.hl||"");if(E2E_SNAP[js]){e2eSnapFill(el,E2E_SNAP[js]);if(view==="E2E")requestAnimationFrame(()=>e2eFitSlot(Date.now()-E2E_ALIGN_T<4000));return}
  if(!E2E_READY){el.innerHTML='<p class="muted">Drawing…</p>';E2E_SNAPWAIT.push([doc,el]);e2eEnsureFrame();return}
  const id=Math.random().toString(36).slice(2);E2E_SNAPQ[id]={js,el};const hl=(el.dataset.hl||"").split(",").filter(Boolean);e2ePost({type:"snapshot",id,doc,projects:e2eProjList(),tagOnly:hl.length?hl:null})}
function e2eFlush(){return new Promise(res=>{if(!E2E_READY||!E2E_FRAME){res();return}const id=Math.random().toString(36).slice(2);
  const t=setTimeout(()=>{delete E2E_FLQ[id];res()},400);E2E_FLQ[id]=()=>{clearTimeout(t);delete E2E_FLQ[id];setTimeout(res,0)};e2ePost({type:"flush",id})})}
window.addEventListener("message",ev=>{const m=ev.data;if(!m||m.src!=="swimlane")return;
  if(E2E_FRAME&&ev.source!==E2E_FRAME.contentWindow)return;
  if(m.type==="ready"){E2E_READY=true;const w=E2E_SNAPWAIT;E2E_SNAPWAIT=[];w.forEach(([doc,el])=>{if(document.body.contains(el))e2eSnapshot(doc,el)});if(view==="E2E"){e2eSync();const f=e2eFlow(UI.e2e.flow);if(f)document.querySelectorAll("[data-snap]").forEach(el=>{const x=f.v[el.dataset.snap];if(x&&x.doc)e2eSnapshot(x.doc,el)})}return}
  if(m.type==="snapshot"){const q=E2E_SNAPQ[m.id];if(q){delete E2E_SNAPQ[m.id];if(m.svg)E2E_SNAP[q.js]=m.svg;if(document.body.contains(q.el)){e2eSnapFill(q.el,m.svg);if(view==="E2E"){if(Date.now()-E2E_ALIGN_T<4000)e2eFitSlot(true);else e2ePlace()}}}return}
  if(m.type==="newProject"){e2eCreateProject(m.step,m.name);return}
  if(m.type==="flushed"){const cb=E2E_FLQ[m.id];if(cb)cb();return}
  if(m.type==="change"){const [fid,kv]=String(m.key||"").split("|");const f=e2eFlow(fid||UI.e2e.flow),ver=VERS.includes(kv)?kv:UI.e2e.ver;if(!f||!m.doc)return;
    if(e2eWriteDoc(f,ver,m.doc)){if(f.id+"|"+ver===E2E_SENT.key)E2E_SENT.js=JSON.stringify(m.doc);e2eQueueMap();e2eSidePanel();updateBadge();const tb=document.getElementById("e2eTimeBox");if(tb)tb.innerHTML=e2eTimeHtml(e2eFlow(f.id))}return}
  if(m.type==="openProject"){const r=projRowById(m.id);if(r)openProject(r);else toast("Project "+m.id+" is not in this workbook");return}
  if(m.type==="linkDone"){UI.e2e.link=null;e2eSidePanel();return}
  if(m.type==="template"){const cb=e2eTplWait;e2eTplWait=null;if(cb)cb(m.doc);return}});
let e2eTplWait=null;
function e2eTemplate(kind){return new Promise(res=>{e2eTplWait=res;e2ePost({type:"template",kind});setTimeout(()=>{if(e2eTplWait===res){e2eTplWait=null;res(null)}},2500)})}

/* ---------- view ---------- */
function vE2E(m){
  if(!hasE2E()){m.innerHTML=`<div class="card pad"><h2>E2E process flows</h2><div class="warnbox">This workbook has no <b>E2E_Flows</b> / <b>E2E_Map</b> sheets. Open <b>SGA_Reduction_Initiative_Tracker_17.xlsx</b> (or later), which adds them.</div></div>`;return}
  if(UI.e2e.home!==false||!e2eFlows().length){vE2EHome(m);return}
  const fl=e2eFlows();if(UI.e2e.flow&&!e2eFlow(UI.e2e.flow))UI.e2e.flow=null;if(!UI.e2e.flow&&fl.length)UI.e2e.flow=fl[0].id;const f=e2eFlow(UI.e2e.flow);
  const tipOff=(()=>{try{return localStorage.getItem("sga_e2e_tip")!=="1"}catch(e){return true}})();
  const top=tipOff?`<div class="e2etipmin"><button class="btn small" id="e2eTip">ⓘ How E2E flows work</button></div>`:`<div class="banner inp"><b>⇄ E2E FLOWS</b><span>Draw each end-to-end process <b>AS-IS (before)</b> and <b>TO-BE (new design)</b>, and tag every step with the projects that deliver it. <b>Click a step box</b> to open its pop-up: search and tick the projects that deliver it, and mark it New / Changed / Removed. You can also drag a project from the project list onto a step. Links are saved to <b>E2E_Flows</b> and <b>E2E_Map</b> — then <b>Save to database</b>.</span><button class="btn small" id="e2eTip" style="margin-left:auto">Hide</button></div><div class="e2enarrow warnbox">Editing flows needs a wider screen (laptop). On a phone you can still see each project's linked steps on its project page.</div>`;
  if(!fl.length){m.innerHTML=top+`<div class="card pad"><h2>No process flows yet</h2><p class="muted">Start from the Shared Services deck's P2P Domestic flow, or create a blank flow.</p>
    <p><button class="btn primary" id="e2eSeed">Add P2P Domestic AS-IS + TO-BE (from the SSC deck)</button> <button class="btn" id="e2eNew">＋ New blank flow</button></p></div><div id="e2eSlot" data-hidden="1"></div>`;
    e2eAttach(m.querySelector("#e2eSlot"));e2eBindTip(m);$("#e2eNew").onclick=e2eNewFlow;$("#e2eSeed").onclick=()=>e2eSeedP2P();return}
  const has=v=>f.v[v]&&f.v[v].doc;const ver=UI.e2e.ver;
  const fullTop=UI.e2e.full&&fl.length?'<div class="e2enarrow warnbox">Editing flows needs a wider screen (laptop). On a phone you can still see each project\'s linked steps on its project page.</div>':top;
  const other=VERS.find(v=>v!==ver);const snap=(v,where)=>has(v)&&has(ver)?`<div class="card pad e2esnap ${where}"><div class="e2esnaph"><b>${v==="AS-IS"?"AS-IS · before":"TO-BE · new design"}</b><span class="muted">${where==="above"?"scroll up to compare — picture only":"for comparison — picture only"}</span><span style="flex:1"></span><button class="btn small" data-ver="${v}">Edit ${v}</button></div><div class="e2esnapimg" data-snap="${v}"></div></div>`:"";
  m.innerHTML=fullTop+(ver==="TO-BE"?snap("AS-IS","above"):"")+`<div class="card pad e2ebar"><button class="btn" id="e2eHome" title="All process flows — search, open, create">← All flows</button><label>Process flow <select id="e2eSel">${fl.map(x=>`<option value="${esc(x.id)}" ${x.id===f.id?"selected":""}>${esc(x.name)}${x.area?" · "+esc(x.area):""}</option>`).join("")}</select></label>
     <span class="seg" role="group" aria-label="Version">${VERS.map(v=>`<button data-ver="${v}" class="${v===ver?"on":""}">${v==="AS-IS"?"AS-IS · before":"TO-BE · new design"}${has(v)?"":" (empty)"}</button>`).join("")}</span>
     <button class="btn ${UI.e2e.full?"":"on"}" id="e2eFull" aria-pressed="${!UI.e2e.full}" title="Project list on the right — drag projects onto steps">☰ Project list ${UI.e2e.full?"▸":"◂ hide"}</button><button class="btn" id="e2eEdit" title="Rename, process area, owner, notes · delete flow">⚙ Details</button><button class="btn" id="e2eNew" title="New process flow">＋ Flow</button>
     <span id="e2eTimeBox">${e2eTimeHtml(f)}</span>${(()=>"")()}<span class="e2ekey" title="How changes vs AS-IS are marked"><i class="k new">NEW</i><i class="k chg">CHANGED</i><i class="k mrg">MERGED</i><i class="k rem">REMOVED</i><span class="muted" style="font-size:11px;margin-left:4px" title="Project tag colour = project status">tag colour = status</span></span><span style="flex:1"></span>
     <label class="muted">Tags <select id="e2eChip" aria-label="Project tags on boxes"><option value="count" ${UI.e2e.tags&&UI.e2e.chip==="count"?"selected":""}>Count (click box for IDs)</option><option value="pid" ${UI.e2e.tags&&UI.e2e.chip==="pid"?"selected":""}>Project ID</option><option value="legacy" ${UI.e2e.tags&&UI.e2e.chip==="legacy"?"selected":""}>Old tracker no.</option><option value="off" ${!UI.e2e.tags?"selected":""}>Hidden</option></select></label><button class="btn small" id="e2eHow" title="How E2E flows work">ⓘ</button></div>
   ${f.v[ver]&&f.v[ver].bad?`<div class="warnbox" style="margin:10px 0">The stored ${ver} diagram could not be read (it may have been edited in Excel). Start it again below.</div>`:""}
   <div class="e2egrid ${UI.e2e.full?"noside":""}"><div class="card e2ecanvas">${has(ver)?`<div id="e2eSlot" class="e2eslot${UI.e2e.full?" full":""}" role="region" aria-label="Swimlane editor — ${esc(f.name)} ${ver}"></div>`:
     `<div class="pad"><h2>${esc(f.name)} — ${ver==="AS-IS"?"AS-IS (before)":"TO-BE (new design)"} is empty</h2><p class="muted">${ver==="TO-BE"&&has("AS-IS")?"Start the new design from a copy of the AS-IS flow, then change it.":"Start from blank lanes or an example."}</p>
       <p>${ver==="TO-BE"&&has("AS-IS")?`<button class="btn primary" data-start="copy">Copy AS-IS as the starting point</button> `:""}<button class="btn" data-start="blank">Blank lanes</button> <button class="btn" data-start="${ver==="AS-IS"?"p2p":"p2ptobe"}">P2P example (${ver})</button></p></div><div id="e2eSlot" data-hidden="1"></div>`}</div>
     <aside class="card pad e2eside" id="e2eSide"></aside></div>${ver==="AS-IS"?snap("TO-BE","below"):""}`;
  e2eAttach(m.querySelector("#e2eSlot"));e2eBindTip(m);e2eSync();
  m.querySelectorAll("[data-snap]").forEach(el=>e2eSnapshot(f.v[el.dataset.snap].doc,el));
  $("#e2eFull").onclick=()=>{UI.e2e.full=!UI.e2e.full;UI.e2e.scrollBar=true;render()};
  if(UI.e2e.full||UI.e2e.scrollBar){UI.e2e.scrollBar=false;requestAnimationFrame(()=>{e2eFitSlot(true)})}else requestAnimationFrame(()=>e2eFitSlot(false))
  if(UI.e2e.scrollTo){UI.e2e.scrollTo=false;const sl=m.querySelector("#e2eSlot.e2eslot");if(sl)requestAnimationFrame(()=>{window.scrollTo(0,Math.max(0,sl.getBoundingClientRect().top+scrollY-110));e2ePlace()})}
  $("#e2eSel").onchange=e=>{UI.e2e.flow=e.target.value;UI.e2e.link=null;render()};
  m.querySelectorAll("[data-ver]").forEach(b=>b.onclick=()=>{UI.e2e.ver=b.dataset.ver;render()});
  $("#e2eEdit").onclick=()=>e2eEditFlow(f);$("#e2eNew").onclick=e2eNewFlow;$("#e2eHome").onclick=()=>{e2eFlush().then(()=>{UI.e2e.home=true;render();window.scrollTo(0,0)})};
  $("#e2eHow").onclick=()=>choose("How E2E flows work",`<ul style="margin:0 0 0 18px;line-height:1.6"><li>Each flow has an <b>AS-IS (before)</b> and a <b>TO-BE (new design)</b> swimlane. In TO-BE the AS-IS picture is shown above — scroll up to compare.</li><li><b>Click a step box</b> → pop-up: tick the projects that deliver it (search by ID, name or area), set New / Changed / Removed. Click anywhere else to close.</li><li>Double-click a box to edit its text; drag boxes, lanes and arrows like in PowerPoint.</li><li>☰ Project list: drag a project onto a step, or click <b>Link</b> then click its steps.</li><li>Links are written to <b>E2E_Flows</b> / <b>E2E_Map</b> — then <b>Save to database</b>. Projects show their steps on the project page and in the Gantt (grouped by flow and lane).</li></ul>`,[["ok","Got it","primary"]]);

  $("#e2eChip").onchange=e=>{const v=e.target.value;UI.e2e.tags=v!=="off";if(v!=="off")UI.e2e.chip=v;e2ePost({type:"tags",on:UI.e2e.tags,mode:UI.e2e.chip==="count"?"count":"all"});e2ePost({type:"projects",projects:e2eProjList()});e2eSidePanel()};
  m.querySelectorAll("[data-start]").forEach(b=>b.onclick=async()=>{const k=b.dataset.start;let doc=null;
    if(k==="copy"){doc=JSON.parse(JSON.stringify(f.v["AS-IS"].doc));doc.tag="TO-BE + NEW";doc.name=f.name+" TO-BE"}else doc=await e2eTemplate(k);
    if(!doc){toast("Could not load the template — try again");return}doc.name=f.name+" "+ver;if(k!=="copy"&&!(/p2p/.test(k)&&/p2p/i.test(f.area+" "+f.name)))doc.title=f.name;
    if(e2eWriteDoc(f,ver,doc)){e2eQueueMap();render()}});
  e2eSidePanel()}
function e2eBindTip(m){const b=m.querySelector("#e2eTip");if(!b)return;b.onclick=()=>{const off=!!m.querySelector(".banner #e2eTip");try{localStorage.setItem("sga_e2e_tip",off?"0":"1")}catch(e){}if(!off&&UI.e2e.full)UI.e2e.full=false;render()}}
function e2eSidePanel(){const box=document.getElementById("e2eSide");const f=e2eFlow(UI.e2e.flow);if(!box||!f)return;const ver=UI.e2e.ver;const d=f.v[ver]&&f.v[ver].doc;
  const cnt={};if(d)for(const sh of d.shapes||[])for(const p of sh.proj||[])cnt[p]=(cnt[p]||0)+1;
  const other=VERS.find(v=>v!==ver);const od=f.v[other]&&f.v[other].doc;const ocnt={};if(od)for(const sh of od.shapes||[])for(const p of sh.proj||[])ocnt[p]=(ocnt[p]||0)+1;
  const q=(UI.e2e.q||"").toLowerCase();let list=e2eProjList();const inArea=p=>!f.area||sq(p.area)===sq(f.area);const stOff=new Set(UI.e2e.stOff||[]);
  const pics=e2ePicIndex();
  list=list.filter(p=>(UI.e2e.all||inArea(p)||cnt[p.id])&&!stOff.has(p.status)&&(!UI.e2e.team||p.team===UI.e2e.team)&&(!q||(p.id+" "+p.short+" "+p.legacy+" "+p.name+" "+p.team+" "+p.area+" "+(pics[p.id]||"")).toLowerCase().includes(q)));
  list.sort((a,b)=>(!!cnt[b.id]-!!cnt[a.id])||a.short.localeCompare(b.short,undefined,{numeric:true}));
  const linked=list.filter(p=>cnt[p.id]).length;
  box.innerHTML=`<h3 style="margin:0 0 6px">Projects ${f.area?`in ${esc(f.area)}`:""}</h3>
    <p class="muted" style="margin:0 0 8px;font-size:12px">Drag a project onto a step, or click <b>Link</b> and then click the steps it delivers. Click a project to highlight its steps.</p>
    <div style="display:flex;gap:6px;margin-bottom:6px"><input id="e2eQ" class="bq" style="flex:1;min-width:0" placeholder="Search name, ID, PIC, team…" value="${esc(UI.e2e.q||"")}"><button class="btn small new" id="e2eNewP" title="Create a new project (it is added to the tracker)">＋ New</button></div>
    <div class="e2efilt"><select id="e2eTeam" aria-label="Division / team"><option value="">All teams</option>${uniq(e2eProjList().map(p=>p.team).filter(Boolean)).map(t=>`<option ${t===UI.e2e.team?"selected":""}>${esc(t)}</option>`).join("")}</select>
      <span class="e2est">${STL.filter(st=>e2eProjList().some(p=>p.status===st)).map(st=>`<label title="${esc(st)}"><input type="checkbox" data-e2est="${esc(st)}" ${stOff.has(st)?"":"checked"}>${esc(st)}</label>`).join("")}</span></div>
    <label class="muted" style="font-size:12px"><input type="checkbox" id="e2eAll" ${UI.e2e.all?"checked":""}> show projects from all process areas</label>
    <div class="muted" style="font-size:12px;margin:6px 0">${linked} of ${list.length} shown are linked to ${ver}${d?"":" (diagram empty)"}</div>
    <div class="e2eplist">${list.map(p=>`<div class="e2ep ${cnt[p.id]?"on":""} ${UI.e2e.link&&UI.e2e.link.id===p.id?"linking":""}" draggable="true" data-pj="${esc(p.id)}" title="${esc(p.id)}${p.legacy?" · old ID "+esc(p.legacy):""}">
       <div class="e2ep1"><span class="pchip2" style="background:${SCOL[p.status]||"#1F4E79"}${p.status==="Cancelled"||p.status==="Not Started"?";color:#1A2433":""}">${esc(p.short)}</span><span class="e2en">${esc(p.name)}</span></div>
       <div class="e2ep2">${pill(p.status)}<span class="muted">${cnt[p.id]?`${cnt[p.id]} step${cnt[p.id]>1?"s":""}`:"not linked"}${ocnt[p.id]?` · ${ocnt[p.id]} in ${other}`:""}</span><span style="flex:1"></span>
         <button class="btn small" data-plink="${esc(p.id)}">${UI.e2e.link&&UI.e2e.link.id===p.id?"Linking…":"Link"}</button><button class="btn small" data-popen="${esc(p.id)}" title="Open the project">↗</button></div></div>`).join("")||`<p class="muted">No projects match.</p>`}</div>`;
  const qi=box.querySelector("#e2eQ");qi.oninput=()=>{UI.e2e.q=qi.value;const pos=qi.selectionStart;e2eSidePanel();const n=document.getElementById("e2eQ");n.focus();n.setSelectionRange(pos,pos)};
  box.querySelector("#e2eAll").onchange=e=>{UI.e2e.all=e.target.checked;e2eSidePanel()};
  box.querySelector("#e2eTeam").onchange=e=>{UI.e2e.team=e.target.value;e2eSidePanel()};
  box.querySelectorAll("[data-e2est]").forEach(c=>c.onchange=()=>{const s0=new Set(UI.e2e.stOff||[]);c.checked?s0.delete(c.dataset.e2est):s0.add(c.dataset.e2est);UI.e2e.stOff=[...s0];e2eSidePanel()});
  box.querySelector("#e2eNewP").onclick=()=>e2eCreateProject(null,UI.e2e.q||"");
  box.querySelectorAll("[data-pj]").forEach(el=>{el.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/swimproj",el.dataset.pj);e.dataTransfer.effectAllowed="copy"});
    el.addEventListener("click",e=>{if(e.target.closest("button"))return;e2ePost({type:"highlight",id:el.dataset.pj})})});
  box.querySelectorAll("[data-plink]").forEach(b=>b.onclick=()=>{const p=e2eProjList().find(x=>x.id===b.dataset.plink);if(!d){toast("Draw or start this version first");return}
    UI.e2e.link=UI.e2e.link&&UI.e2e.link.id===p.id?null:{id:p.id,short:p.short,name:p.name};e2ePost({type:"link",project:UI.e2e.link});e2eSidePanel()});
  box.querySelectorAll("[data-popen]").forEach(b=>b.onclick=()=>{const r=projRowById(b.dataset.popen);if(r)openProject(r)});e2ePlace()}
function e2eFlowForm(f){const areas=uniqOrder([...(hasMD()?mdList("L_Proc"):listFromName("L_Proc")),...e2eFlows().map(x=>x.area)]).filter(Boolean);
  return `<div class="fgrid"><label>Flow name<input id="efName" value="${esc(f?f.name:"")}" placeholder="e.g. P2P Domestic — AP & Payment"></label>
   <label>Process area<input id="efArea" list="efAreas" value="${esc(f?f.area:"")}" placeholder="O2C, P2P, R2R…"><datalist id="efAreas">${areas.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></label>
   <label>Owner<input id="efOwner" value="${esc(f?f.owner:"")}"></label><label>Notes<input id="efNotes" value="${esc(f?f.notes:"")}"></label></div>`}
async function e2eNewFlow(){let IMP=null;
  const p=choose("New E2E process flow",e2eFlowForm(null)+`<div class="nfimp"><div class="nfh"><b>Start from Excel / AI (optional)</b><span class="muted">or leave empty for blank lanes</span></div>
    <div class="nfdrop" id="nfDrop" tabindex="0" role="button" aria-label="Drop or choose an Excel file"><b>Drop the .xlsx here</b> or <u>choose a file</u> · or paste the table below<input type="file" id="nfFile" accept=".xlsx,.csv,.txt" hidden></div>
    <div class="nfver"><span>Version</span><label><input type="radio" name="nfVer" value="auto" checked> Auto-detect</label><label><input type="radio" name="nfVer" value="AS-IS"> AS-IS</label><label><input type="radio" name="nfVer" value="TO-BE"> TO-BE</label></div>
    <textarea id="nfPaste" rows="3" placeholder="…or paste the table copied from Excel or from the AI answer (Markdown / tab separated)"></textarea>
    <div class="nfres" id="nfRes"></div>
    <details class="nfhow"><summary>Format &amp; AI prompt</summary><ol>
      <li><b>Row 1</b> = swimlanes, one per column: <code>Lane name; Sub-title; Style</code> — Style <b>New</b> = green frame + NEW stamp (new lane), or a header colour (Navy, Blue, Green, Olive, Purple, Grey).</li>
      <li><b>Rows below</b> = the process top → bottom; each filled cell = one box: <code>Type; Text; Connect to; Change; Projects; Hours/month; Style</code> (only Type + Text needed).</li>
      <li><b>Type</b> Start · End · Process · Decision · Document · System · Note. <b>Connect to</b> = <code>C5 [Yes], E7 [No] red</code>; empty = next filled row; <code>-</code> = none. <code>//</code> = new line, <code>- </code> = bullet.</li>
      <li><b>Change</b> New (green) · Changed (orange) · Merged (purple) · Removed (red). <b>Style</b> = <code>Fill Yellow, Border Red, Text Blue, Thick</code>. Excel cell fill / font colour work too (green lane header = new lane).</li>
      <li><b>Long flow</b>: a row with only <code>PAGE BREAK</code> starts Page 2 (same lanes). In the editor use <b>+ Page</b> under the diagram.</li>
      <li><b>Version</b> auto: sheet name TO-BE / AS-IS, else TO-BE when steps have a Change or a lane is New. One file can hold both sheets.</li></ol>
      <p><button type="button" class="btn small primary" id="nfCopy">⧉ Copy AI prompt</button> <button type="button" class="btn small" id="nfTpl">⬇ Template (.csv)</button> <span class="muted" style="font-size:12px">Paste the prompt into Copilot / ChatGPT / Claude, add your process description, then drop the Excel it makes (or paste its table) here.</span></p></details></div>`,[["c","Cancel"],["ok","Create","primary"]]);
  const box=document.querySelector("#confirm .box");const res=box.querySelector("#nfRes");
  const show=()=>{if(!IMP){res.innerHTML="";return}const v=Object.keys(IMP.res);res.innerHTML=v.length?`<div class="nfok">✓ ${v.map(x=>{const st=IMP.res[x].stats;return `<b>${x}</b> ${st.pages>1?st.pages+" pages · ":""}${st.lanes} lanes · ${st.boxes} boxes · ${st.links} arrows${st.styled?` · ${st.styled} coloured`:""}${st.newLanes?` · ${st.newLanes} new lane${st.newLanes>1?"s":""}`:""}`}).join(" &nbsp;·&nbsp; ")} <button type="button" class="btn small" id="nfClr">✕ clear</button>${IMP.how?`<div class="muted" style="font-size:11.5px;margin-top:3px">${Object.values(IMP.how).map(esc).join(" · ")}</div>`:""}</div>`:"";
    if(IMP.warn.length)res.innerHTML+=`<div class="nfwarn">${IMP.warn.slice(0,8).map(esc).join("<br>")}${IMP.warn.length>8?`<br>… ${IMP.warn.length-8} more`:""}</div>`;
    const c=res.querySelector("#nfClr");if(c)c.onclick=()=>{IMP=null;box.querySelector("#nfPaste").value="";show()}};
  const nm=()=>(box.querySelector("#efName").value||"").trim();
  const take=sheets=>{if(!sheets.length){IMP={res:{},warn:["No table found — row 1 must hold the lane names"]};show();return}IMP=e2eImportFromGrids(sheets,nm()||"Imported flow",verPick());IMP.sheets=sheets;show()};
  const verPick=()=>(box.querySelector('input[name="nfVer"]:checked')||{}).value||"auto";
  box.querySelectorAll('input[name="nfVer"]').forEach(r=>r.onchange=()=>{if(IMP&&IMP.sheets)take(IMP.sheets)});
  const file=async f=>{try{if(/\.xlsx$/i.test(f.name))take(await readXlsxGrids(await f.arrayBuffer()));else take(textGrids(await f.text()));if(!nm())box.querySelector("#efName").value=f.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ")}catch(e){IMP={res:{},warn:["Could not read "+f.name+": "+e.message]};show()}};
  const dz=box.querySelector("#nfDrop"),fi=box.querySelector("#nfFile");
  dz.onclick=()=>fi.click();dz.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fi.click()}};fi.onchange=()=>{if(fi.files[0])file(fi.files[0])};
  dz.ondragover=e=>{e.preventDefault();dz.classList.add("over")};dz.ondragleave=()=>dz.classList.remove("over");dz.ondrop=e=>{e.preventDefault();dz.classList.remove("over");const f=e.dataTransfer.files[0];if(f)file(f)};
  const pa=box.querySelector("#nfPaste");pa.oninput=()=>{clearTimeout(pa._t);pa._t=setTimeout(()=>{if(pa.value.trim())take(textGrids(pa.value));else{IMP=null;show()}},250)};
  box.querySelector("#nfCopy").onclick=async()=>{try{await navigator.clipboard.writeText(E2E_AI_PROMPT);toast("AI prompt copied — paste it into your AI chat and describe the process",5000)}catch(e){const t=document.createElement("textarea");t.value=E2E_AI_PROMPT;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();toast("AI prompt copied",4000)}};
  box.querySelector("#nfTpl").onclick=()=>download(new Blob(["\ufeff"+e2eTemplateCsv()],{type:"text/csv"}),"E2E_flow_template.csv");
  const k=await p;if(k!=="ok")return;
  const name=$("#efName").value.trim(),area=$("#efArea").value.trim();if(!name){toast("Give the flow a name");return}
  const id=e2eNewId(area);const f={id,name,area,owner:$("#efOwner").value.trim(),notes:$("#efNotes").value.trim(),v:{}};
  const vp=(document.querySelector('input[name="nfVer"]:checked')||{}).value||"auto";if(IMP&&IMP.sheets){IMP=e2eImportFromGrids(IMP.sheets,name,vp)}/* rebuild with the final name */
  const vers=IMP?VERS.filter(v=>IMP.res[v]):[];
  if(vers.length){for(const v of vers){if(!e2eWriteDoc(e2eFlow(id)||f,v,IMP.res[v].doc))return;E2E_CACHE=null}}
  else{const doc={id:"d"+Date.now(),name:name+" AS-IS",title:name,tag:"AS-IS",ori:"v",flow:700,head:46,lanes:["Requester","Team A","Team B","System"].map((n,i)=>({id:"L"+i,name:n,sub:"",size:220})),secs:[],shapes:[],links:[]};if(!e2eWriteDoc(f,"AS-IS",doc))return}
  const x=e2eFlow(id);if(x)VERS.forEach(v=>{if(x.v[v])eSet(E2EF,EF.notes,x.v[v].r,f.notes)});
  UI.e2e.home=false;UI.e2e.flow=id;UI.e2e.ver=vers.includes("AS-IS")||!vers.length?"AS-IS":"TO-BE";E2E_CACHE=null;e2eRebuildMap();render();
  toast(vers.length?`Created ${name} from the table — ${vers.join(" + ")}. Drag boxes to fine-tune.`:"Created "+name+" — rename the lanes by double-clicking their headers",6000)}
async function e2eEditFlow(f){const k=await choose("Flow details",e2eFlowForm(f),[["del","Delete this flow…","danger"],["c","Cancel"],["ok","Save","primary"]]);if(k==="del"){e2eDeleteFlow(f);return}if(k!=="ok")return;
  const name=$("#efName").value.trim()||f.name,area=$("#efArea").value.trim(),owner=$("#efOwner").value.trim(),notes=$("#efNotes").value.trim();
  for(const v of VERS){const x=f.v[v];if(!x)continue;eSet(E2EF,EF.name,x.r,name);eSet(E2EF,EF.area,x.r,area);eSet(E2EF,EF.owner,x.r,owner);eSet(E2EF,EF.notes,x.r,notes)}E2E_CACHE=null;e2eQueueMap();render()}
async function e2eDeleteFlow(f){const links=VERS.reduce((a,v)=>a+((f.v[v]&&f.v[v].doc)?(f.v[v].doc.shapes||[]).reduce((n,sh)=>n+(sh.proj||[]).length,0):0),0);
  const k=await choose(`Delete “${esc(f.name)}”?`,`<p>This removes its AS-IS and TO-BE diagrams${links?` and ${links} step↔project link(s)`:""} from the workbook (when you save). Projects themselves are not changed.</p>`,[["c","Cancel"],["ok","Delete flow","danger"]]);if(k!=="ok")return;
  for(const v of VERS){const x=f.v[v];if(!x)continue;for(const c of [...Object.values(EF),...Array.from({length:EF_NDATA},(_,i)=>colLet(EF_DATA0+i))])eSet(E2EF,c,x.r,"")}
  E2E_CACHE=null;UI.e2e.flow=null;UI.e2e.home=true;e2eRebuildMap();render();toast("Flow deleted — Save to database to keep the change")}
/* seed: P2P Domestic from the SSC deck (AS-IS slide 5, TO-BE slide 6) — TO-BE steps tagged with the projects that deliver them */
const P2P_TOBE_LINKS={t12:["SGA-PIM-FIN-SSC-002","SGA-PIM-FIN-SSC-014"],t13:["SGA-PIM-FIN-SSC-002"],t14:["SGA-AUT-FIN-SSC-048","SGA-AUT-FIN-SSC-024","SGA-AUT-FIN-SSC-018"],
  t15:["SGA-AUT-FIN-SSC-048"],t16:["SGA-AUT-FIN-SSC-048","SGA-PIM-FIN-SSC-013","SGA-AUT-FIN-SSC-016"],
  t17:["SGA-PIM-FIN-SSC-001"],t18:["SGA-PIM-FIN-SSC-001","SGA-AUT-FIN-SSC-016"],t7:["SGA-PIM-FIN-SSC-001"],t6:["SGA-PIM-FIN-SSC-001"],
  t19:["SGA-PIM-FIN-SSC-001"],t20:["SGA-PIM-FIN-SSC-001"],t21:["SGA-AUT-FIN-SSC-029"],t22:["SGA-AUT-FIN-SSC-029"],t24:["SGA-AUT-FIN-SSC-024"],t25:["SGA-AUT-FIN-SSC-024","SGA-AUT-FIN-SSC-054"],
  t30:["SGA-AUT-FIN-SSC-017","SGA-PIM-FIN-SSC-016"]/* overseas projects (060-062 US/EU, PIM-004 overseas payment) belong to an overseas flow */,t26:["SGA-AUT-FIN-SSC-054"],t5:["SGA-PIM-FIN-SSC-014"],t3:["SGA-PIM-FIN-SSC-014","SGA-AUT-FIN-SSC-016"],
  t29:["SGA-PIM-FIN-SSC-015"],t23:["SGA-PIM-FIN-SSC-015"],t9:["SGA-PIM-FIN-SSC-002"],t11:["SGA-PIM-FIN-SSC-002","SGA-PIM-FIN-SSC-013"]};
/* AS-IS steps that a project removes or changes */
const P2P_ASIS_LINKS={s10:["SGA-PIM-FIN-SSC-002","SGA-PIM-FIN-SSC-001"],s15:["SGA-PIM-FIN-SSC-002"],s11:["SGA-PIM-FIN-SSC-002","SGA-PIM-FIN-SSC-001"],s17:["SGA-PIM-FIN-SSC-001"],s18:["SGA-PIM-FIN-SSC-001"],
  s19:["SGA-AUT-FIN-SSC-029"],s20:["SGA-AUT-FIN-SSC-029"]};
async function e2eSeedP2P(){if(!E2E_READY){toast("The editor is still loading — try again in a second");return}
  const asis=await e2eTemplate("p2p"),tobe=await e2eTemplate("p2ptobe");if(!asis||!tobe){toast("Could not load the examples");return}
  const miss=new Set();const tag=(doc,M)=>{for(const sh of doc.shapes){const all=(M[sh.id]||[]).map(p=>e2eResolve(p)||p);all.filter(p=>!projRowById(p)).forEach(p=>miss.add(p));const L=all.filter(p=>projRowById(p));if(L.length)sh.proj=L}};
  tag(tobe,P2P_TOBE_LINKS);tag(asis,P2P_ASIS_LINKS);if(miss.size)console.warn("seed: not in Projects",[...miss]);
  const name="P2P Domestic — AP & Payment",id=e2eNewId("P2P");const f={id,name,area:"P2P",owner:"Paweena (Domestic PTP & OTC)",notes:"From the SSC simplification deck (slides 5-6). Project links are a first mapping — confirm with owners.",v:{}};
  asis.name=name+" AS-IS";tobe.name=name+" TO-BE";if(!e2eWriteDoc(f,"AS-IS",asis))return;const f2=e2eFlow(id);if(!e2eWriteDoc(f2,"TO-BE",tobe))return;
  for(const v of VERS){const x=e2eFlow(id).v[v];eSet(E2EF,EF.notes,x.r,f.notes)}E2E_CACHE=null;e2eRebuildMap();UI.e2e.flow=id;UI.e2e.ver="TO-BE";render();
  toast("Added P2P Domestic AS-IS and TO-BE with "+Object.keys(P2P_TOBE_LINKS).length+" linked steps — review, then Save to database",6000)}
/* project workspace section */
function e2eProjectSection(pid){if(!hasE2E()||!pid)return "";const L=e2eLinksOf(pid);const fl=e2eFlows();
  return `<div class="card pad" style="margin-top:14px" id="wsE2E"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><h2 style="margin:0">E2E process steps</h2>
     <span class="muted">${L.length?`${L.length} step(s) in ${new Set(L.map(x=>x.f.id)).size} flow(s)`:"This project is not linked to any process step yet"}</span><span style="flex:1"></span>
     ${fl.length?`<select id="wsE2EFlow" class="mini">${fl.map(f=>[...VERS].reverse().map(v=>`<option value="${esc(f.id)}|${v}">${esc(f.name)} · ${v}</option>`).join("")).join("")}</select><button class="btn" id="wsE2ELink">Link to steps…</button>`:`<button class="btn" id="wsE2EGo">Create a process flow</button>`}</div>
   ${(()=>{const fs=[...new Set(L.map(x=>x.f.id))];return fs.map(fid=>{const f=e2eFlow(fid);const v=f.v["TO-BE"]&&f.v["TO-BE"].doc?"TO-BE":"AS-IS";const ids=L.filter(x=>x.f.id===fid&&x.ver===v).map(x=>x.sh.id);
     return `<div class="wsswim"><div class="muted" style="font-size:12px;margin:4px 0">${esc(f.name)} · ${v} — this project's steps are highlighted</div><div class="e2esnapimg" data-wssnap="${esc(fid)}|${v}" data-hl="${esc(ids.join(","))}"></div></div>`}).join("")})()}
   ${L.length?`<div class="tablewrap" style="max-height:none"><table class="data"><tr><th>Flow</th><th>Version</th><th>Lane</th><th>Step</th><th></th></tr>${L.map(x=>`<tr><td>${esc(x.f.name)}</td><td>${x.ver==="TO-BE"?'<b>TO-BE</b>':"AS-IS"}${chgOf(x.sh)?` <span class="badge-new" data-chg="${chgOf(x.sh)}">${chgOf(x.sh).toLowerCase()} step</span>`:""}${x.sh.repl&&[].concat(x.sh.repl).length?` <span class="muted">replaces ${esc([].concat(x.sh.repl).map(id=>{const a=x.f.v["AS-IS"]&&x.f.v["AS-IS"].doc;const sh=a&&(a.shapes||[]).find(q=>q.id===id);return sh?stepText(sh):id}).join("; "))}</span>`:""}</td><td>${esc(x.lane)}</td><td>${esc(x.step)}</td><td><button class="btn small" data-e2eopen="${esc(x.f.id)}|${x.ver}|${esc(x.sh.id)}">Open in flow</button></td></tr>`).join("")}</table></div>`:""}</div>`}
function e2eBindProjectSection(m,pid){const go=(fid,ver,link,focus)=>{UI.e2e.home=false;UI.e2e.flow=fid;UI.e2e.ver=ver;UI.e2e.link=link;UI.e2e.focus=focus||null;UI.e2e.scrollTo=true;UI.proj=null;view="E2E";render()};
  m.querySelectorAll("[data-e2eopen]").forEach(b=>b.onclick=()=>{const [fid,ver,sid]=b.dataset.e2eopen.split("|");go(fid,ver,null,[sid])});
  const lk=m.querySelector("#wsE2ELink");if(lk)lk.onclick=()=>{const [fid,ver]=m.querySelector("#wsE2EFlow").value.split("|");const p=e2eProjList().find(x=>x.id===pid);go(fid,ver,{id:pid,short:p?p.short:pid,name:p?p.name:""})};
  const g=m.querySelector("#wsE2EGo");if(g)g.onclick=()=>{UI.proj=null;view="E2E";render()};
  m.querySelectorAll("[data-wssnap]").forEach(el=>{const [fid,v]=el.dataset.wssnap.split("|");const f=e2eFlow(fid);if(f&&f.v[v]&&f.v[v].doc)e2eSnapshot(f.v[v].doc,el)})}

/* ---------- merge (reload newer file + re-apply): diagrams merge per flow version, never cell by cell ---------- */
function e2eOrigMap(changes){const o={};for(const c of changes){if(c.sheet!==E2EF)continue;if(!(c.ref in o))o[c.ref]=c.old}return o}
function e2eRowDocJs(r,orig){let js="";for(let k=0;k<EF_NDATA;k++){const c=colLet(EF_DATA0+k),ref=c+r;const v=orig&&ref in orig?orig[ref]:gv(E2EF,c,r);if(v===""||v==null)break;js+=String(v)}
  try{return js?JSON.stringify(JSON.parse(js)):""}catch(e){return ""}}
function e2eRowVal(r,c,orig){const ref=c+r;return String(orig&&ref in orig?orig[ref]??"":gv(E2EF,c,r)??"")}
function e2eCollectMine(changes){if(!hasE2E())return [];const orig=e2eOrigMap(changes);const rows=[...new Set(Object.keys(orig).map(k=>+k.replace(/[A-Z]+/g,"")))];
  return rows.map(r=>{const id=String(gv(E2EF,EF.id,r)||""),bid=e2eRowVal(r,EF.id,orig);const verOf=x=>String(x).toUpperCase().includes("TO")?"TO-BE":"AS-IS";
    return {id:id||bid,ver:verOf(id?gv(E2EF,EF.ver,r):e2eRowVal(r,EF.ver,orig)),deleted:!id,js:id?e2eRowDocJs(r,null):"",base:e2eRowDocJs(r,orig),
      meta:{name:String(gv(E2EF,EF.name,r)||""),area:String(gv(E2EF,EF.area,r)||""),owner:String(gv(E2EF,EF.owner,r)||""),notes:String(gv(E2EF,EF.notes,r)||"")}}}).filter(x=>x.id)}
async function e2eReapply(mine){let ok=0,skip=0;E2E_CACHE=null;
  for(const x of mine){const f=e2eFlow(x.id);const cur=f&&f.v[x.ver];const theirs=cur&&cur.doc?JSON.stringify(cur.doc):"";
    if(theirs!==x.base&&theirs!==x.js){const k=await choose("A process flow was changed by both of you",`<p><b>${esc(x.meta.name||x.id)} · ${x.ver}</b> was ${x.deleted?"deleted by you":"edited by you"} and also changed in the newer file.</p><p class="muted">Diagrams can't be merged box by box. Pick which version to keep — the other one is lost.</p>`,[["theirs","Keep the newer file's version"],["mine","Keep my version","primary"]]);
      if(k!=="mine"){skip++;continue}}
    if(x.deleted){if(cur){for(const c of [...Object.values(EF),...Array.from({length:EF_NDATA},(_,i)=>colLet(EF_DATA0+i))])eSet(E2EF,c,cur.r,"")}E2E_CACHE=null;ok++;continue}
    const doc=JSON.parse(x.js);const tgt=f||{id:x.id,...x.meta,v:{}};if(!e2eWriteDoc(tgt,x.ver,doc)){skip++;continue}
    const row=e2eFlow(x.id).v[x.ver].r;eSet(E2EF,EF.name,row,x.meta.name);eSet(E2EF,EF.area,row,x.meta.area);eSet(E2EF,EF.owner,row,x.meta.owner);eSet(E2EF,EF.notes,row,x.meta.notes);E2E_CACHE=null;ok++}
  e2eRebuildMap();return {ok,skip}}
/* ---------- review screen: one readable line per changed flow version instead of raw JSON cells ---------- */
function e2eChangeLines(rows){if(!hasE2E())return [];const orig={};for(const c of rows)if(c.sheet===E2EF)orig[c.ref]=c.orig;
  const rs=[...new Set(rows.filter(c=>c.sheet===E2EF).map(c=>+c.ref.replace(/[A-Z]+/g,"")))];
  return rs.map(r=>{const id=String(gv(E2EF,EF.id,r)||""),bid=e2eRowVal(r,EF.id,orig);const name=String(gv(E2EF,EF.name,r)||e2eRowVal(r,EF.name,orig)||bid);
    const ver=String((id?gv(E2EF,EF.ver,r):e2eRowVal(r,EF.ver,orig))||"").toUpperCase().includes("TO")?"TO-BE":"AS-IS";
    const pj=js=>{try{return js?JSON.parse(js):null}catch(e){return null}};const a=pj(e2eRowDocJs(r,orig)),b=id?pj(e2eRowDocJs(r,null)):null;
    const parts=[];if(!a&&b)parts.push("new diagram");else if(a&&!b)parts.push("flow deleted");
    else if(a&&b){const L=d=>new Set((d.shapes||[]).flatMap(sh=>(sh.proj||[]).map(p=>sh.id+"\u0001"+p)));const la=L(a),lb=L(b);const txt=id=>{const sh=(b.shapes||[]).concat(a.shapes||[]).find(x=>x.id===id);return sh?stepFull(sh).slice(0,60):id};
      const add=[...lb].filter(x=>!la.has(x)),rem=[...la].filter(x=>!lb.has(x));const fmt=x=>{const [sid,p]=x.split("\u0001");return e2eShortBase(p)+" → "+txt(sid)};
      if(add.length)parts.push("linked "+add.slice(0,4).map(fmt).join("; ")+(add.length>4?` (+${add.length-4} more)`:""));
      if(rem.length)parts.push("unlinked "+rem.slice(0,4).map(fmt).join("; ")+(rem.length>4?` (+${rem.length-4} more)`:""));
      const ia=new Set((a.shapes||[]).map(s=>s.id)),ib=new Set((b.shapes||[]).map(s=>s.id));const sa=[...ib].filter(x=>!ia.has(x)).length,sr=[...ia].filter(x=>!ib.has(x)).length;
      const cA=Object.fromEntries((a.shapes||[]).map(x=>[x.id,chgOf(x)]));const cm=(b.shapes||[]).filter(x=>x.id in cA&&cA[x.id]!==chgOf(x)).map(x=>`${stepText(x).slice(0,40)} → ${chgOf(x)||"unchanged"}`);
      if(cm.length)parts.push("marked "+cm.slice(0,4).join("; ")+(cm.length>4?` (+${cm.length-4} more)`:""));
      const hA=Object.fromEntries((a.shapes||[]).map(x=>[x.id,(x.hrs??"")+"|"+(x.cost??"")]));const hm=(b.shapes||[]).filter(x=>x.id in hA&&hA[x.id]!==(x.hrs??"")+"|"+(x.cost??""));
      if(hm.length)parts.push("time/cost set on "+hm.slice(0,3).map(x=>`${stepTitle(x).slice(0,30)} [${laneOfShape(b,x)}] (${x.hrs??"—"} h/m${x.cost!=null?", "+fmtNum(x.cost)+" THB":""})`).join("; ")+(hm.length>3?` (+${hm.length-3} more)`:""));
      if(sa)parts.push(sa+" box(es) added");if(sr)parts.push(sr+" box(es) removed");
      const strip=d=>JSON.stringify({...d,shapes:(d.shapes||[]).map(({proj,...x})=>x)});const strip2=d=>JSON.stringify({...d,shapes:(d.shapes||[]).map(({proj,chg,isNew,hrs,cost,...x})=>x)});if(!sa&&!sr&&strip2(a)!==strip2(b))parts.push("diagram text/layout edited")}
    const meta=[EF.name,EF.area,EF.owner,EF.notes].filter(c=>rows.some(x=>x.sheet===E2EF&&x.ref===c+r)&&id);if(meta.length)parts.push("flow details edited");
    return {name,ver,text:parts.join(" · ")||"updated"}})}
function e2eNetCount(rows){const o=rows.filter(c=>c.sheet!==E2EF&&c.sheet!==E2EM).length;const g=new Set(rows.filter(c=>c.sheet===E2EF).map(c=>c.ref.replace(/[A-Z]+/g,""))).size;
  return o+g+(!g&&rows.some(c=>c.sheet===E2EM)?1:0)}

/* PIC search: leader, members and every task PIC of each project */
function e2ePicIndex(){const o={};for(const r of rowsOf("Projects")){const id=pId(r);if(!id)continue;o[id]=[gv("Projects",FP.wsl,r),gv("Projects",FP.lead,r),gv("Projects","AG",r),gv("Projects","AH",r)].filter(Boolean).join(" ")}
  for(const x of rowsOf("Activities")){const pid=gv("Activities",FA.pid,x);if(pid&&o[pid]!=null)o[pid]+=" "+(gv("Activities",FA.pic,x)||"")}return o}
/* create a project from the E2E page (optionally linked to a step straight away) */
async function e2eCreateProject(step,name){const f=e2eFlow(UI.e2e.flow);const area=f?f.area:"";
  const areas=uniqOrder([area,...(hasMD()?mdList("L_Proc"):listFromName("L_Proc"))]).filter(Boolean);const teams=uniq(rowsOf("Projects").map(r=>gv("Projects","AB",r)).filter(Boolean));
  const inits=listFromName("L_Init");const people=uniq([...listFromName("L_Leader"),...rowsOf("Projects").flatMap(r=>[gv("Projects",FP.lead,r),gv("Projects",FP.wsl,r)])].filter(Boolean));
  const k=await choose("New project"+(step?" for this step":""),`<div class="fgrid">
     <label class="field wide"><span>Project name</span><input id="npName" value="${esc(name||"")}" placeholder="e.g. Auto AP posting for overseas vendors"></label>
     <label class="field"><span>Programme</span><select id="npProg"><option>Simplification</option><option>2T</option><option>P2P Deep Dive</option><option>O2C Deep Dive</option><option>R2R Deep Dive</option></select></label>
     <label class="field"><span>Initiative (part of the ID)</span><select id="npInit"><option value="">— choose —</option>${inits.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
     <label class="field"><span>Process area</span><input id="npArea" list="npAreas" value="${esc(area)}"><datalist id="npAreas">${areas.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></label>
     <label class="field"><span>Division / team</span><input id="npTeam" list="npTeams"><datalist id="npTeams">${teams.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></label>
     <label class="field"><span>Workstream leader</span><input id="npWsl" list="npPeople" placeholder="SSC simplification → P Oh (auto)"></label>
     <label class="field"><span>Project lead</span><input id="npLead" list="npPeople"><datalist id="npPeople">${people.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></label></div>
     <p class="muted" style="font-size:12px">The project is added to the tracker (Projects sheet) — fill in the rest on its project page later. ${step?"It is linked to the selected step.":""}</p>`,[["c","Cancel"],["ok","Create project","primary"]]);
  if(k!=="ok")return null;const nm=($("#npName").value||"").trim();if(!nm){toast("Give the project a name");return null}if(!$("#npInit").value){toast("Choose the Initiative (it is part of the project ID)",5000);return e2eCreateProject(step,nm)}
  const r=nextProjectRow();if(!r){toast("No free rows left in the Projects table",6000);return null}
  S.newRows.Projects=S.newRows.Projects||new Set();S.newRows.Projects.add(r);
  const ar=$("#npArea").value.trim(),tm=$("#npTeam").value.trim(),ld=$("#npLead").value.trim(),wl=$("#npWsl").value.trim(),pg=$("#npProg").value,ini=$("#npInit").value;
  const ref=rowsOf("Projects").find(x=>x!==r&&sq(gv("Projects",FP.proc,x))===sq(ar)&&gv("Projects",FP.cf,x));
  setCell("Projects",FP.meth,r,"Waterfall");if(ini)setCell("Projects",FP.init,r,ini);if(ref){setCell("Projects",FP.bu,r,gv("Projects",FP.bu,ref));setCell("Projects",FP.cf,r,gv("Projects",FP.cf,ref))}
  if(ar)setCell("Projects",FP.proc,r,ar);if(tm)setCell("Projects","AB",r,tm);if(ld)setCell("Projects",FP.lead,r,ld);if(wl)setCell("Projects",FP.wsl,r,wl);setCell("Projects","AE",r,pg);setCell("Projects",FP.name,r,nm);
  refreshNewId("Projects",r);liveCalc();const id=pId(r);E2E_SHORTDUP=null;
  if(step)e2ePost({type:"addProj",step,id,projects:e2eProjList()});else{e2ePost({type:"projects",projects:e2eProjList()});UI.e2e.link={id,short:e2eShort(id),name:nm};e2ePost({type:"link",project:UI.e2e.link})}
  e2eSidePanel();updateBadge();renderTabs();toast(`Created ${id}${step?" and linked it":" — click the steps it delivers (Link mode)"}`,5000);return id}

/* ---------- E2E breakdown tree (Dashboard + Benefits): flow ▸ lane (left lane first) ▸ project ---------- */
UI.e2eTree=UI.e2eTree||new Set();UI.e2eVT=UI.e2eVT||new Set();
function e2eGroups(pidSet){const flows=[];const used=new Set();if(!hasE2E())return {flows,rest:[...pidSet]};
  for(const f of e2eFlows()){const T=f.v["TO-BE"]&&f.v["TO-BE"].doc,A=f.v["AS-IS"]&&f.v["AS-IS"].doc;const doc=T||A;if(!doc)continue;
    const lanes=(doc.lanes||[]).map(l=>({name:l.name,ids:new Set(),asis:0,tobe:0,saved:0,cost:0}));const lane=n=>{let L=lanes.find(x=>x.name===n);if(!L){L={name:n,ids:new Set(),asis:0,tobe:0,saved:0,cost:0};lanes.push(L)}return L};
    for(const [ver,dd] of [["TO-BE",T],["AS-IS",A]]){if(!dd)continue;for(const sh of (dd.shapes||[]).filter(isStep)){const L=lane(laneOfShape(dd,sh));const t=e2eStepTime(f,ver,sh);
      if(ver==="AS-IS")L.asis+=+t.hrs||0;else{L.tobe+=+t.hrs||0;L.saved+=+t.saved||0;L.cost+=+t.cost||0}
      for(const p of sh.proj||[])if(pidSet.has(p)&&(ver==="TO-BE"||![...lanes].some(x=>x.ids.has(p))))L.ids.add(p)}}
    const ids=new Set(lanes.flatMap(l=>[...l.ids]));ids.forEach(x=>used.add(x));flows.push({f,lanes,ids,t:e2eFlowTotals(f)})}
  return {flows,rest:[...pidSet].filter(p=>!used.has(p))}}
function e2eTreeHtml(pidSet,mode,BS){const G=e2eGroups(pidSet);const open=UI.e2eTree;const byPid={};const ms=(BS&&BS.months)||[];const td=arr=>ms.reduce((a,mm,i)=>a+(mm.s<=TODAY?(+arr[i]||0):0),0);
  for(const b of (BS&&BS.list)||[]){if(b.drop||!pidSet.has(b.pid))continue;const o=byPid[b.pid]=byPid[b.pid]||{rec:0,one:0,hrs:0,n:0,ptd:0,atd:0,vt:{rec:{},one:{}}};o.n++;if(b.one)o.one+=b.gross;else o.rec+=b.gross;
    {const tot=Object.values(b.drv||{}).reduce((a,v)=>a+(+v||0),0);const bag=o.vt[b.one?"one":"rec"];if(tot)for(const [k,v] of Object.entries(b.drv)){if(!v)continue;const vk=VTK[k]||k;bag[vk]=(bag[vk]||0)+b.gross*v/tot}else if(b.gross)bag["?"]=(bag["?"]||0)+b.gross}o.hrs+=b.hrs||0;o.ptd+=td(b.plan||[]);o.atd+=td(b.act||[])}
  const rowOf=id=>projRowById(id);const agg=ids=>{const o={n:0,st:{},comp:0,rec:0,one:0,hrs:0,ptd:0,atd:0,lines:0,vt:{rec:{},one:{}}};for(const id of ids){const r=rowOf(id);if(!r)continue;o.n++;const s=pStat(r);o.st[s]=(o.st[s]||0)+1;o.comp+=pLive(r).comp||0;const b=byPid[id]||{};o.rec+=b.rec||0;o.one+=b.one||0;o.hrs+=b.hrs||0;o.ptd+=b.ptd||0;o.atd+=b.atd||0;o.lines+=b.n||0;if(b.vt)for(const w of ["rec","one"])for(const [k,v] of Object.entries(b.vt[w]))o.vt[w][k]=(o.vt[w][k]||0)+v}return o};
  const mix=o=>`<span class="tmix" title="${STL.filter(s=>o.st[s]).map(s=>s+": "+o.st[s]).join(" · ")}">${STL.filter(s=>o.st[s]).map(s=>`<i style="flex:${o.st[s]};background:${SCOL[s]}"></i>`).join("")}</span>`;
  const pct=v=>Math.round(v*100)+"%";const N=v=>v?(v<0?`<span class="tadd2">+${fmtShort(-v)} cost</span>`:fmtShort(v)):"—";const H=v=>v?fmtNum(Math.round(v*10)/10):"—";
  const sv=v=>v>0?` <b class="tsave">−${H(v)}</b>`:v<0?` <b class="tadd2">+${H(-v)}</b>`:"";
  const tcell=t=>t&&(t.asis||t.tobe)?`<span title="${t.steps?t.timed+" of "+t.steps+" TO-BE steps timed · saving counts only steps timed on both sides":""}">${H(t.asis)} → ${H(t.tobe)}${sv(t.saved)}</span>`:t&&t.steps!=null?`<a class="tadd" href="#" data-e2ego="${esc(t.fid||"")}">0 of ${t.steps} steps timed — add ›</a>`:"<span class=\"muted\">—</span>";
  let KEY="";/* row key of the cell being drawn — the value-type boxes open per row + column */
  const vcell=(o,w)=>{const v=w==="rec"?o.rec:o.one;if(!v)return "—";const vk=KEY+"#"+w;const on=UI.e2eVT.has(vk);const bag=o.vt[w]||{};
    const boxes=VTYPES.map(([k,l,c])=>`<span class="vtb${bag[k]?"":" z"}" style="--vc:${c}" title="${esc(l)}: ${bag[k]?fmtNum(Math.round(bag[k])):"none"}"><em>${esc(l)}</em><b>${bag[k]?fmtShort(bag[k]):"—"}</b></span>`).join("")+(bag["?"]?`<span class="vtb" style="--vc:#98A2B3"><em>No driver set</em><b>${fmtShort(bag["?"])}</b></span>`:"");
    return `<button type="button" class="vtcell${on?" on":""}" data-vt="${esc(vk)}" aria-expanded="${on}" title="${on?"Hide":"Show"} the split by business-value type">${N(v)} <span class="vtcar">${on?"▴":"▾"}</span></button>${on?`<span class="vtgrid">${boxes}</span>`:""}`};
  const cols=mode==="benefit"?[["Benefit lines",o=>o.lines||"—",""],["Planned recurring<small>THB/yr · click to split</small>",o=>vcell(o,"rec"),"plan"],["Planned one-off<small>THB · click to split</small>",o=>vcell(o,"one"),"plan"],["Planned hrs saved<small>per month</small>",o=>H(o.hrs),"plan"],["Plan to date<small>THB, months up to today</small>",o=>N(o.ptd),"plan"],["Actual to date<small>THB realised</small>",o=>N(o.atd),"act"],["Realised<small>actual ÷ plan</small>",o=>o.ptd?Math.round(o.atd/o.ptd*100)+"%":"—","act"]]
    :[["Status mix",o=>mix(o),""],["Avg % done",o=>o.n?pct(o.comp/o.n):"—",""],["Planned recurring<small>THB/yr · click to split</small>",o=>vcell(o,"rec"),"plan"],["Planned hrs saved<small>per month (time saving)</small>",o=>H(o.hrs),"plan"],["Actual to date<small>THB realised</small>",o=>N(o.atd),"act"]];
  const e2eCols=mode==="benefit"?[["Process saving<small>THB/yr · E2E estimate</small>",t=>t&&t.cost?N(t.cost):t&&t.steps!=null&&!t.timed?`<a class="tadd" href="#" data-e2ego="${esc(t.fid||"")}">0 of ${t.steps} steps timed — add ›</a>`:"—"]]:[["Process time<small>h/month AS-IS → TO-BE</small>",t=>tcell(t)],["Process saving<small>THB/yr · E2E estimate</small>",t=>t&&t.cost?N(t.cost):"—"]];
  const tag=k=>k==="plan"?'<span class="vtag plan">PLAN</span>':k==="act"?'<span class="vtag act">ACTUAL</span>':"";
  const head=`<tr class="thgrp"><th colspan="2"></th><th colspan="${cols.length}" class="thg">Projects &amp; their benefit plans</th><th colspan="${e2eCols.length}" class="thg e2eg">Process view (from E2E flows)</th></tr><tr><th>E2E flow ▸ lane ▸ project</th><th class="num">Projects / status</th>${cols.map(c=>`<th class="${c[0]==="Status mix"?"":"num"}">${tag(c[2])}${c[0]}</th>`).join("")}${e2eCols.map(c=>`<th class="num"><span class="vtag e2e">E2E</span>${c[0]}</th>`).join("")}</tr>`;
  const grpRow=(key,label,ids,lvl,t,icon)=>{const o=agg(ids);KEY=key;const isOpen=open.has(key);return `<tr class="tr-g l${lvl}" data-tk="${esc(key)}"><td><span class="tcar">${isOpen?"▾":"▸"}</span>${icon} ${esc(label)}</td><td class="num">${o.n}</td>${cols.map(c=>`<td class="${c[0]==="Status mix"?"":"num"}">${c[1](o)}</td>`).join("")}${e2eCols.map(c=>`<td class="num">${c[1](t)}</td>`).join("")}</tr>`};
  const projRow=(id,lvl,nl,pk)=>{const r=rowOf(id);if(!r)return "";const o=agg([id]);KEY=(pk||"")+"|p:"+id;return `<tr class="tr-p l${lvl}" data-tp="${r}"><td><span class="tname">${esc(gv("Projects",FP.name,r))}</span><br><span class="muted mono" style="font-size:11px">${esc(id)}</span>${gv("Projects","AB",r)?` <span class="pteam">${esc(gv("Projects","AB",r))}</span>`:""}${nl>1?` <span class="pteam" title="This project has steps in ${nl} lanes — it is listed under each; the flow total counts it once">↔ ${nl} lanes</span>`:""}</td><td class="num">${pill(pStat(r))}</td>${cols.map(c=>`<td class="${c[0]==="Status mix"?"":"num"}">${c[0]==="Status mix"?`<span class="tbar"><i style="width:${Math.round((pLive(r).comp||0)*100)}%"></i></span>`:c[1](o)}</td>`).join("")}${e2eCols.map(()=>`<td></td>`).join("")}</tr>`};
  let body="";const laneCount={};for(const F of G.flows)for(const L of F.lanes)for(const id of L.ids)laneCount[F.f.id+"|"+id]=(laneCount[F.f.id+"|"+id]||0)+1;
  for(const F of G.flows){const fk="tf:"+F.f.id;F.t.fid=F.f.id;body+=grpRow(fk,F.f.name,[...F.ids],0,F.t,"⇄");
    if(open.has(fk))for(const L of F.lanes){if(!L.ids.size&&!L.asis&&!L.tobe)continue;const lk=fk+"|"+L.name;body+=grpRow(lk,L.name,[...L.ids],1,L,"▭");if(open.has(lk))[...L.ids].forEach(id=>body+=projRow(id,2,laneCount[F.f.id+"|"+id],lk))}}
  if(G.rest.length){const nk="tf:none";body+=grpRow(nk,"No E2E flow mapped yet",G.rest,0,null,"○");if(open.has(nk)){const all=open.has("tf:none:all");const sh=all?G.rest:G.rest.slice(0,15);sh.forEach(id=>body+=projRow(id,1,0,nk));
    if(G.rest.length>15)body+=`<tr class="tr-more" data-tk="tf:none:all"><td colspan="${2+cols.length+e2eCols.length}">${all?"Show fewer ▴":`Show all ${G.rest.length} projects ▾`}</td></tr>`}}
  return `<div class="tablewrap ttree"><table class="data e2etree"><thead>${head}</thead><tbody>${body||`<tr><td colspan="9" class="muted">No projects.</td></tr>`}</tbody></table></div><p class="muted" style="font-size:11.5px;margin:6px 2px 0">A project with steps in several lanes is listed under each lane (↔); the flow total counts it once. <b>PLAN</b> = from the benefit plans (not yet realised) · <b>ACTUAL</b> = realised to date. Click a planned value to split it into <b>time saving (indirect)</b>, <b>cost avoidance</b>, <b>cost reduction</b> and <b>revenue growth</b>. Process time = hours per month entered on each step in E2E flows.</p>`}
const VTK={"Cost Avoidance":"CA","Cost Reduction":"CR","Revenue Growth":"RG","Time Reduction (hrs × rate)":"TS"};
const VTYPES=[["TS","Time saving (indirect)","#7A5AF8"],["CA","Cost avoidance","#0E9384"],["CR","Cost reduction","#1F3864"],["RG","Revenue growth","#DC6803"]];
function e2eTreeBind(m,rerender){m.querySelectorAll("[data-vt]").forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.vt;UI.e2eVT.has(k)?UI.e2eVT.delete(k):UI.e2eVT.add(k);rerender()});m.querySelectorAll("[data-e2ego]").forEach(a=>a.onclick=e=>{e.preventDefault();e.stopPropagation();UI.e2e.home=false;UI.e2e.flow=a.dataset.e2ego||UI.e2e.flow;UI.e2e.ver="AS-IS";view="E2E";render()});m.querySelectorAll("tr[data-tk]").forEach(tr=>tr.onclick=()=>{const k=tr.dataset.tk;UI.e2eTree.has(k)?UI.e2eTree.delete(k):UI.e2eTree.add(k);rerender()});
  m.querySelectorAll("tr[data-tp]").forEach(tr=>tr.onclick=()=>openProject(+tr.dataset.tp))}
/* Benefits list panel: delegated clicks (the list view re-renders the panel itself) */
document.addEventListener("click",e=>{const vt=e.target.closest&&e.target.closest(".bsec [data-vt]");if(vt){e.stopPropagation();const k=vt.dataset.vt;UI.e2eVT.has(k)?UI.e2eVT.delete(k):UI.e2eVT.add(k);const y=scrollY;render();window.scrollTo(0,y);return}
  const go0=e.target.closest&&e.target.closest(".bsec [data-e2ego]");if(go0){e.preventDefault();UI.e2e.home=false;UI.e2e.flow=go0.dataset.e2ego||UI.e2e.flow;UI.e2e.ver="AS-IS";view="E2E";render();return}
  const g=e.target.closest&&e.target.closest(".bsec tr[data-tk]");if(g){const k=g.dataset.tk;UI.e2eTree.has(k)?UI.e2eTree.delete(k):UI.e2eTree.add(k);const y=scrollY;render();window.scrollTo(0,y);return}
  const go=e.target.closest&&e.target.closest(".bsec [data-e2ego]");if(go){e.preventDefault();UI.e2e.home=false;UI.e2e.flow=go.dataset.e2ego||UI.e2e.flow;UI.e2e.ver="AS-IS";view="E2E";render();return}
  const p=e.target.closest&&e.target.closest(".bsec tr[data-tp]");if(p)openProject(+p.dataset.tp)});
/* ---------- E2E home: every flow as a card — search (name, area, owner, lanes, step text, projects), filter, sort, open / edit / duplicate / delete / create ---------- */
UI.e2eH=UI.e2eH||{q:"",area:"",state:"",sort:"name"};
function e2eFlowInfo(f){const docs=VERS.map(v=>f.v[v]&&f.v[v].doc).filter(Boolean);const pids=new Set();docs.forEach(d=>docProjects(d).forEach(p=>pids.add(p)));
  const steps={};VERS.forEach(v=>{const d=f.v[v]&&f.v[v].doc;steps[v]=d?(d.shapes||[]).filter(isStep).length:0});
  const d0=(f.v["TO-BE"]&&f.v["TO-BE"].doc)||(f.v["AS-IS"]&&f.v["AS-IS"].doc);const lanes=d0?(d0.lanes||[]).map(l=>l.name).filter(Boolean):[];
  const upd=Math.max(0,...VERS.map(v=>f.v[v]?(+gv(E2EF,EF.upd,f.v[v].r)||0):0));
  const st={};[...pids].forEach(p=>{const r=projRowById(p);const s=r?pStat(r):"(not in Projects)";st[s]=(st[s]||0)+1});
  const texts=docs.flatMap(d=>(d.shapes||[]).filter(isStep).map(sh=>String(sh.text||"")));
  return {pids,steps,lanes,upd,st,t:e2eFlowTotals(f),texts}}
function vE2EHome(m){e2eHide();const H=UI.e2eH;const fl=e2eFlows();const info=Object.fromEntries(fl.map(f=>[f.id,e2eFlowInfo(f)]));
  const q=H.q.trim().toLowerCase();const areas=uniq(fl.map(f=>f.area||"(no area)")).sort();if(H.area&&!areas.includes(H.area))H.area="";
  const pname=p=>{const r=projRowById(p);return r?gv("Projects",FP.name,r):""};
  const hit=f=>{if(!q)return {ok:true,steps:0};const I=info[f.id];const base=[f.name,f.id,f.area,f.owner,f.notes,...I.lanes,...[...I.pids].flatMap(p=>[p,pname(p)])].join(" ").toLowerCase();
    const steps=I.texts.filter(t=>t.toLowerCase().includes(q)).length;return {ok:base.includes(q)||steps>0,steps}};
  const STATE={"":"All flows",both:"AS-IS + TO-BE",asis:"AS-IS only",tobe:"TO-BE missing steps",untimed:"Steps not timed",proj:"Linked to projects",noproj:"No projects linked"};
  const okState=f=>{const I=info[f.id];switch(H.state){case "both":return I.steps["AS-IS"]>0&&I.steps["TO-BE"]>0;case "asis":return I.steps["AS-IS"]>0&&!I.steps["TO-BE"];case "tobe":return !I.steps["TO-BE"];
    case "untimed":return I.t.steps>0&&I.t.timed<I.t.steps;case "proj":return I.pids.size>0;case "noproj":return !I.pids.size;default:return true}};
  let list=fl.filter(f=>(!H.area||(f.area||"(no area)")===H.area)&&okState(f)&&hit(f).ok);
  const S_={name:(a,b)=>a.name.localeCompare(b.name),area:(a,b)=>(a.area||"~").localeCompare(b.area||"~")||a.name.localeCompare(b.name),proj:(a,b)=>info[b.id].pids.size-info[a.id].pids.size,
    saving:(a,b)=>(info[b.id].t.cost||0)-(info[a.id].t.cost||0),upd:(a,b)=>info[b.id].upd-info[a.id].upd};list.sort(S_[H.sort]||S_.name);
  const H1=v=>fmtNum(Math.round(v*10)/10);
  const mix=st=>{const ks=STL.filter(s=>st[s]);return ks.length?`<span class="tmix" title="${ks.map(s=>s+": "+st[s]).join(" · ")}">${ks.map(s=>`<i style="flex:${st[s]};background:${SCOL[s]}"></i>`).join("")}</span>`:""};
  const card=f=>{const I=info[f.id],t=I.t,h=hit(f);const ver=(v,lbl)=>{const n=I.steps[v];return `<button type="button" class="fhver${n?"":" empty"}" data-fopen="${esc(f.id)}" data-fver="${v}" title="${n?`Open ${lbl} — ${n} step(s)`:`Start the ${lbl} version`}"><b>${lbl}</b><span>${n?n+" steps":"not started"}</span></button>`};
    return `<article class="card fhcard"><div class="fhtop"><span class="fharea">${esc(f.area||"no area")}</span><span class="muted mono" style="font-size:11px">${esc(f.id)}</span><span style="flex:1"></span>
      <button type="button" class="btn small" data-fedit="${esc(f.id)}" title="Rename, process area, owner, notes">⚙</button><button type="button" class="btn small" data-fdup="${esc(f.id)}" title="Duplicate this flow (both versions)">⧉</button><button type="button" class="btn small danger" data-fdel="${esc(f.id)}" title="Delete flow">🗑</button></div>
      <h3 class="fhname"><a href="#" data-fopen="${esc(f.id)}" data-fver="${I.steps["TO-BE"]?"TO-BE":"AS-IS"}">${esc(f.name)}</a></h3>
      <div class="muted fhmeta">${f.owner?`Owner ${esc(f.owner)} · `:""}${I.lanes.length} lane${I.lanes.length===1?"":"s"}${I.upd?` · updated ${fmtDate(I.upd)}`:""}${h.steps&&q?` · <b class="fhhit">${h.steps} step${h.steps>1?"s":""} match “${esc(H.q.trim())}”</b>`:""}</div>
      ${I.lanes.length?`<div class="fhlanes">${I.lanes.slice(0,7).map(l=>`<span>${esc(l)}</span>`).join("")}${I.lanes.length>7?`<span>+${I.lanes.length-7}</span>`:""}</div>`:""}
      <div class="fhvers">${ver("AS-IS","AS-IS · before")}${ver("TO-BE","TO-BE · new design")}</div>
      <div class="fhstats"><div><span>Projects</span><b>${I.pids.size}</b>${mix(I.st)}</div><div><span>Process time h/m</span><b>${t.asis||t.tobe?`${H1(t.asis)} → ${H1(t.tobe)}`:"—"}</b><em>${t.steps?`${t.timed}/${t.steps} TO-BE steps timed`:""}</em></div><div><span>Saving THB/yr</span><b>${t.cost?fmtShort(t.cost):"—"}</b><em>${t.saved?`−${H1(t.saved)} h/m`:""}</em></div></div></article>`};
  const totP=new Set(fl.flatMap(f=>[...info[f.id].pids])).size,totC=fl.reduce((a,f)=>a+(info[f.id].t.cost||0),0);
  m.innerHTML=`<div class="card pad fhhead"><div class="fhh1"><div><h2 style="margin:0">⇄ E2E process flows</h2><p class="muted" style="margin:4px 0 0;font-size:12.5px">${fl.length} flow${fl.length===1?"":"s"} · ${totP} linked project${totP===1?"":"s"}${totC?` · process saving ${fmtShort(totC)} THB/yr`:""} · search finds flow names, areas, owners, lanes, step text and projects</p></div><span style="flex:1"></span>
      ${fl.some(f=>/p2p/i.test(f.name+f.area))?"":`<button class="btn" id="fhSeed" title="Adds the P2P Domestic AS-IS + TO-BE from the Shared Services deck">＋ P2P example</button>`}<button class="btn new" id="fhNew">＋ New flow</button></div>
    <div class="fhfilt"><input type="search" id="fhQ" placeholder="Search flows, lanes, steps or projects…" value="${esc(H.q)}" aria-label="Search flows">
      <span class="fhchips" role="group" aria-label="Process area">${["",...areas].map(a=>`<button type="button" class="e2ech${H.area===a?" on":""}" data-farea="${esc(a)}">${esc(a||"All areas")} <b>${a?fl.filter(f=>(f.area||"(no area)")===a).length:fl.length}</b></button>`).join("")}</span>
      <label class="muted">Show <select id="fhState">${Object.entries(STATE).map(([k,v])=>`<option value="${k}" ${H.state===k?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="muted">Sort <select id="fhSort">${[["name","Name"],["area","Process area"],["proj","Most projects"],["saving","Biggest saving"],["upd","Recently updated"]].map(([k,v])=>`<option value="${k}" ${H.sort===k?"selected":""}>${v}</option>`).join("")}</select></label>
      <span class="muted" style="margin-left:auto">${list.length} of ${fl.length}</span></div></div>
   ${fl.length?(list.length?`<div class="fhgrid">${list.map(card).join("")}</div>`:`<div class="card pad muted">No flow matches — <a href="#" id="fhClr">clear the search and filters</a>.</div>`)
     :`<div class="card pad"><h2>No process flows yet</h2><p class="muted">Create a blank flow, or start from the Shared Services deck's P2P Domestic flow (AS-IS + TO-BE).</p></div>`}
   <div id="e2eSlot" data-hidden="1"></div>`;
  e2eAttach(m.querySelector("#e2eSlot"));
  const re=()=>{const y=scrollY;vE2EHome(m);window.scrollTo(0,y)};
  const qi=$("#fhQ");qi.oninput=()=>{H.q=qi.value;clearTimeout(vE2EHome._t);vE2EHome._t=setTimeout(()=>{re();const n=$("#fhQ");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250)};
  m.querySelectorAll("[data-farea]").forEach(b=>b.onclick=()=>{H.area=b.dataset.farea;re()});
  $("#fhState").onchange=e=>{H.state=e.target.value;re()};$("#fhSort").onchange=e=>{H.sort=e.target.value;re()};
  if($("#fhClr"))$("#fhClr").onclick=e=>{e.preventDefault();H.q="";H.area="";H.state="";re()};
  $("#fhNew").onclick=e2eNewFlow;if($("#fhSeed"))$("#fhSeed").onclick=async()=>{UI.e2e.home=false;UI.e2e.flow=null;await e2eSeedP2P()};
  m.querySelectorAll("[data-fopen]").forEach(b=>b.onclick=e=>{e.preventDefault();UI.e2e.home=false;UI.e2e.flow=b.dataset.fopen;UI.e2e.ver=b.dataset.fver;UI.e2e.link=null;render();window.scrollTo(0,0)});
  m.querySelectorAll("[data-fedit]").forEach(b=>b.onclick=()=>{const f=e2eFlow(b.dataset.fedit);if(f)e2eEditFlow(f)});
  m.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{const f=e2eFlow(b.dataset.fdel);if(f)e2eDeleteFlow(f)});
  m.querySelectorAll("[data-fdup]").forEach(b=>b.onclick=()=>{const f=e2eFlow(b.dataset.fdup);if(f)e2eDupFlow(f)});
}
async function e2eDupFlow(f){const k=await choose("Duplicate flow",`<p>Copy <b>${esc(f.name)}</b> (both versions) as a new flow.</p><label class="field"><span>New name</span><input id="fdName" value="${esc(f.name+" (copy)")}"></label>
  <label class="connauto" style="justify-content:flex-start"><input type="checkbox" id="fdLinks"> Keep the step ↔ project links</label>`,[["c","Cancel"],["ok","Duplicate","primary"]]);if(k!=="ok")return;
  const name=($("#fdName").value||"").trim()||f.name+" (copy)",keep=$("#fdLinks").checked;const nf={id:e2eNewId(f.area),name,area:f.area,owner:f.owner,notes:f.notes,v:{}};
  for(const v of VERS){const d=f.v[v]&&f.v[v].doc;if(!d)continue;const c=JSON.parse(JSON.stringify(d));c.id="d"+Date.now()+v.length;c.name=name+" "+v;c.title=name;if(!keep)(c.shapes||[]).forEach(sh=>{sh.proj=[]});
    const cur=e2eFlow(nf.id)||nf;if(!e2eWriteDoc(cur,v,c))return;E2E_CACHE=null}
  const x=e2eFlow(nf.id);if(x)VERS.forEach(v=>{if(x.v[v])eSet(E2EF,EF.notes,x.v[v].r,f.notes||"")});E2E_CACHE=null;e2eRebuildMap();render();toast(`Duplicated as ${name} (${nf.id})`)}
