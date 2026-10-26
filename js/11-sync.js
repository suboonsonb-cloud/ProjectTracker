/* 11-sync.js — sync from the old-format tracker */
"use strict";
/* =====================================================================================
   SYNC FROM THE OLD-FORMAT TRACKER (Project 2T Club Update)  →  this workbook (database)
   - reads the old .xlsx in the browser (no upload), finds its project sheet by header names
   - matches every old project to a database project (Legacy ID → saved sync key → name)
   - compares field by field with tolerant rules and decides which side is newer:
       · a saved "sync baseline" (what the old file said last time) gives a true 3-way compare
       · progress / phase only move forward; misplaced or placeholder old values are ignored
       · otherwise the newer FILE wins (dates shown, can be switched)
   - nothing is written until you tick and Apply; then Review changes → Save to Excel as usual
   ===================================================================================== */
const SY={old:null,plan:null,oldNewer:null,tab:"todo",q:"",st:"",stOff:[]};
const SYNC_SHEET="Migration_Log",SYNC_C={key:"N",oid:"O",oname:"P",json:"Q",at:"R"},SYNC_FIRST=15,SYNC_LAST=600;
const sq=v=>String(v??"").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\p{M}]+/gu,"");
const tx=v=>v==null?"":String(v).replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").trim();
const one=v=>tx(v).replace(/\s*\n\s*/g,"; ").replace(/\s+/g," ").trim();
const PLACE=/^(-+|—|–|n\/?a|na|none|null|nil|tbc|tbd|\.+|\?+)$/i;
const PHASE_RX=/^\s*([A-E])\s*=\s*/i;
const STATUSW=/^(hold|on.?hold|in\s*progress|project\s*cancell?ed)$/i;
const STOP=new Set(["of","and","the","for","by","to","in","on","with","from","a","an","&"]);
const stem=w=>w.startsWith("auto")?"auto":w.length>6?w.slice(0,6):w;
function isBlank(v){const s=tx(v);return s===""||PLACE.test(s)}
function words(s){return String(s||"").toLowerCase().replace(/\([^)]*\)/g," ").split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1&&!STOP.has(w)).map(stem)}
function sameWords(a,b){const B=words(b);return [...new Set(words(a))].filter(w=>B.includes(w)).length}
function contains2(a,b){const x=sq(a),y=sq(b);return x.length>=4&&y.length>=4&&(x.includes(y)||y.includes(x))}
function simName(a,b){const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return sq(a)===sq(b)?1:0;let k=0;A.forEach(w=>{if(B.has(w))k++});return 2*k/(A.size+B.size)}
function parseDateAny(v){if(v===""||v==null)return "";if(typeof v==="number")return v>20000&&v<80000?Math.round(v):"";
  const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return dateToSerial(new Date(Date.UTC(+m[1],+m[2]-1,+m[3])));
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);if(m){let d=+m[1],mo=+m[2],y=+m[3];if(y<100)y+=2000;if(mo>12&&d<=12){const t=d;d=mo;mo=t}if(mo<1||mo>12||d<1||d>31)return "";return dateToSerial(new Date(Date.UTC(y,mo-1,d)))}
  if(/^\d{5}(\.\d+)?$/.test(s))return parseDateAny(+s);return ""}
function parsePct(v){if(v===""||v==null)return "";let n=typeof v==="number"?v:parseFloat(String(v).replace(/[%\s,]/g,""));if(isNaN(n))return "";if(/%/.test(String(v))||n>1)n=n/100;return n<0||n>1?"":Math.round(n*1000)/1000}
function phaseOf(v){const m=tx(v).match(PHASE_RX);return m?m[1].toUpperCase():""}
function isPeople(v){const ppl=new Set([...listFromName("L_People"),...(hasMD()?mdList("L_Leader"):[])].flatMap(x=>String(x).split(/[,\/&]+/)).map(sq).filter(Boolean));
  const t=String(v).split(/[,\/&]+|\band\b/).map(sq).filter(Boolean);return t.length>0&&t.every(x=>ppl.has(x))}
function looksMisplaced(f,v){const s=tx(v);if(!s)return false;if(["subfn","tools","objective","area"].includes(f)&&isPeople(s))return true;if(f!=="phase"&&PHASE_RX.test(s))return true;if(STATUSW.test(s)&&!["status"].includes(f))return true;
  if(["done","willdo","issue","objective","tools","members","lead","requester","subfn","quarter","priority"].includes(f)&&(typeof v==="number"||parseDateAny(s)!==""))return true;return false}

/* ---------- read the old workbook ---------- */
const OLDH=[["id",/^(project\s*)?id$|^no\.?$|^#$/],["name",/^project\s*name$|^project$|^initiative\s*name$/],["objective",/^objective|^scope/],["category",/^category$/],
  ["process",/^process(\s*area)?$/],["division",/^division$/],["function",/^function$|^sub.?function|^team$/],["app",/^app\s*\d*$|^tools?$|^technology/],["lead",/^(project\s*)?lead/],
  ["members",/^member/],["phase",/^phase$/],["quarter",/^time\s*line|^target\s*quarter|^timeline/],["start",/^start(\s*date)?$/],["end",/^end(\s*date)?$|^finish(\s*date)?$/],
  ["progress",/^progress$|^%\s*complete|^completion/],["status",/^(project\s*)?status$/],["done",/^done$|^last\s*update/],["willdo",/^will\s*do|^next\s*steps?/],["issue",/^issues?|^blocker/],
  ["frequency",/^frequency/],["asis",/as\s*-?\s*is/],["tobe",/to\s*-?\s*be/],["savingtxt",/^saving\s*time/],["savinghrs",/^saving\s*hours?/],["priority",/^priority/],
  ["requester",/^requester|business\s*owner/],["_skip",/^days$|^plan\s*%|^est\.?\s*cost|^saving\s*fte/]];
async function readOldWorkbook(buf,fname,lastMod){
  const list=readZip(buf);const by={};list.forEach(e=>by[e.name]=e);
  if(!by["xl/workbook.xml"])throw new Error("This is not an Excel workbook");
  const wbDoc=parser.parseFromString(await entryText(by["xl/workbook.xml"]),"application/xml");
  const rels=parser.parseFromString(await entryText(by["xl/_rels/workbook.xml.rels"]),"application/xml");const relMap={};
  for(const r of rels.getElementsByTagName("Relationship"))relMap[r.getAttribute("Id")]=r.getAttribute("Target");
  let sst=[];if(by["xl/sharedStrings.xml"]){const d=parser.parseFromString(await entryText(by["xl/sharedStrings.xml"]),"application/xml");
    for(const si of d.getElementsByTagNameNS(NS,"si")){let t="";for(const x of si.getElementsByTagNameNS(NS,"t"))t+=x.textContent;sst.push(t)}}
  const shs=[];for(const sh of wbDoc.getElementsByTagNameNS(NS,"sheet")){const rid=sh.getAttributeNS(RNS,"id")||sh.getAttribute("r:id");let t=relMap[rid];if(!t)continue;
    t=t.replace(/^\/?xl\//,"").replace(/^\//,"");shs.push({name:sh.getAttribute("name"),path:"xl/"+t})}
  let modified=0;if(by["docProps/core.xml"]){const m=(await entryText(by["docProps/core.xml"])).match(/<dcterms:modified[^>]*>([^<]+)</);if(m)modified=Date.parse(m[1])||0}
  const grid=async p=>{const doc=parser.parseFromString(await entryText(by[p]),"application/xml");const G=new Map();
    for(const c of doc.getElementsByTagNameNS(NS,"c")){const ref=c.getAttribute("r");const m=ref.match(/^([A-Z]+)(\d+)$/);if(!m)continue;const v=cellValue(c,sst);if(v===""||v==null)continue;
      const r=+m[2];if(!G.has(r))G.set(r,new Map());G.get(r).set(m[1],v)}return G};
  if(shs.some(s=>s.name==="Projects")&&shs.some(s=>s.name==="Activities")&&shs.some(s=>s.name==="Lists"))
    throw new Error("This file is in the NEW tracker format. Pick the old-format file (e.g. Project_2T_Club_Update …xlsx).");
  // find the project sheet: by name first, else the first sheet whose header row has "Project Name"
  const order=[...shs.filter(s=>/project.?data/i.test(s.name)),...shs.filter(s=>!/project.?data/i.test(s.name))];
  let found=null;
  for(const s of order){if(!by[s.path])continue;const G=await grid(s.path);
    for(let r=1;r<=12;r++){const row=G.get(r);if(!row)continue;const hs=[...row.values()].map(v=>String(v).trim().toLowerCase());
      if(hs.some(h=>/^project\s*name$/.test(h))&&hs.filter(h=>OLDH.some(([k,rx])=>k[0]!=="_"&&rx.test(h))).length>=4){found={sheet:s.name,G,hr:r};break}}
    if(found)break}
  if(!found)throw new Error("Could not find a project sheet with a 'Project Name' header. Sheets in the file: "+shs.map(s=>s.name).join(", "));
  const {G,hr}=found;const hdr=G.get(hr);const map={},unmapped=[],notesCols=[];
  const allCols=new Set();G.forEach(row=>row.forEach((_,c)=>allCols.add(c)));
  for(const c of [...allCols].sort((a,b)=>colIdx(a)-colIdx(b))){const h=hdr.has(c)?String(hdr.get(c)).trim():"";const hl=h.toLowerCase().replace(/\s+/g," ");
    if(!h){notesCols.push({c,h:"(no header)"});continue}
    if(PHASE_RX.test(h)||/^remarks?$|^notes?$|^comments?$|^daily\s*=|^-?\d+(\.\d+)?$/i.test(hl)){notesCols.push({c,h});continue}
    const hit=OLDH.find(([k,rx])=>rx.test(hl));
    if(!hit){unmapped.push({c,h});continue}if(hit[0]==="_skip")continue;
    if(hit[0]==="app"){(map.app=map.app||[]).push(c);continue}
    if(map[hit[0]]){unmapped.push({c,h:h+" (duplicate of "+hit[0]+")"});continue}map[hit[0]]=c}
  if(!map.name)throw new Error("The project sheet has no 'Project Name' column");
  const recs=[];let maxR=0;G.forEach((_,r)=>{if(r>maxR)maxR=r});
  for(let r=hr+1;r<=maxR;r++){const row=G.get(r);if(!row)continue;const g=k=>map[k]?(row.has(map[k])?row.get(map[k]):""):"";
    const rawName=tx(g("name"));if(!rawName)continue;
    recs.push({row:r,raw:{id:g("id"),name:rawName,objective:g("objective"),category:g("category"),process:g("process"),division:g("division"),function:g("function"),
      apps:(map.app||[]).map(c=>row.has(c)?row.get(c):""),lead:g("lead"),members:g("members"),phase:g("phase"),quarter:g("quarter"),start:g("start"),end:g("end"),
      progress:g("progress"),status:g("status"),done:g("done"),willdo:g("willdo"),issue:g("issue"),frequency:g("frequency"),asis:g("asis"),tobe:g("tobe"),
      savingtxt:g("savingtxt"),savinghrs:g("savinghrs"),priority:g("priority"),requester:g("requester"),
      notes:notesCols.map(n=>row.has(n.c)?row.get(n.c):"").filter(v=>v!==""&&v!=null)}})}
  // optional "Progress" sheet: remarks per project name
  const prog=[];const ps=shs.find(s=>/^progress$/i.test(s.name));
  if(ps&&by[ps.path]){const PG=await grid(ps.path);let h=null,rc=null,nc=null;
    for(let r=1;r<=8&&!h;r++){const row=PG.get(r);if(!row)continue;row.forEach((v,c)=>{const s=String(v).trim().toLowerCase();if(s==="remark"||s==="remarks")rc=c;if(s==="project name")nc=c});if(rc){h=r}}
    if(h){const keyc="A";PG.forEach((row,r)=>{if(r<=h)return;const nm=tx(row.get(keyc)),rm=tx(row.get(rc));if(nm&&rm)prog.push({name:nm,alt:tx(row.get(nc)),remark:rm})})}}
  return {fname,lastMod:lastMod||0,modified,sheet:found.sheet,sheets:shs.map(s=>s.name),hr,map,unmapped,notesCols,recs,prog};
}

/* ---------- old row → values in the database's language ---------- */
function mdAreas(){const a=hasMD()?mdList("L_Proc"):listFromName("L_Proc");return a.length?a:["O2C","P2P","R2R","Treasury","IR","TFM","ITC"]}
function cfForArea(area){if(!area)return "";if(hasMD()){for(const r of mdRows(ORGC))if(sq(mg("J",r))===sq(area)&&mg("H",r))return mg("H",r)}
  const p=rowsOf("Projects").find(r=>sq(gv("Projects",FP.proc,r))===sq(area)&&gv("Projects",FP.cf,r));return p?gv("Projects",FP.cf,p):""}
function splitName(n){let s=tx(n).replace(/\s*\n\s*/g," ");const notes=[];
  s=s.replace(/\*\*([^*]+)\*\*/g,(m,a)=>{notes.push(a.trim());return " "});
  s=s.replace(/\s+((same as|duplicate of|dup(licate)? with|includ(e|es|ed) in|merged? (in)?to|mov(e|ed) to)\s*(#|no\.?)?\s*\d+.*|ซ้ำ.*|to check if.*)$/i,(m,a)=>{notes.push(a.trim());return ""});
  return {name:s.replace(/\s+/g," ").trim(),notes}}
/* one spelling per team, so filters don't split the same team */
function normTeam(v){let s=String(v||"").trim();if(!s)return "";const M={"overse payment":"Overseas Payment","oversea payment":"Overseas Payment","overseas payment":"Overseas Payment","oversea otc":"Overseas OTC","oversea collection":"Overseas Collection","us & eu":"US/EU","us/eu":"US/EU","us and eu":"US/EU"};return M[s.toLowerCase().replace(/\s+/g," ")]||s}
function oldValues(rec){const R=rec.raw,O={};const nm=splitName(R.name);O.name=nm.name;O.nameNotes=nm.notes;
  O.objective=one(R.objective);
  const areas=mdAreas(),inA=v=>areas.find(a=>sq(a)===sq(v))||"";O.area=inA(R.process)||inA(R.division)||one(R.process)||"";
  /* Division / Team: the old file's Division column holds the team when Process is filled (AR, AP, US/EU…); otherwise Function does */
  const dv=one(R.division);O.subfn=normTeam(dv&&!inA(dv)&&!/,/.test(dv)?dv:one(R.function));
  O.tools=R.apps.map(a=>one(a).replace(/[,;]+$/,"").trim()).filter(a=>a&&!PHASE_RX.test(a)).join(" / ");
  O.lead=one(R.lead);O.members=one(R.members);O.phase=phaseOf(R.phase)?one(R.phase):"";O.quarter=one(R.quarter);
  O.start=parseDateAny(R.start);O.end=parseDateAny(R.end);O.startRaw=R.start;O.endRaw=R.end;O.progress=parsePct(R.progress);
  const st=one(R.status);O.status=st;
  const cancel=/cancel/i.test(st)||[R.requester,R.done,R.willdo,R.issue,R.lead].some(v=>/^\s*project\s*cancell?ed\s*$/i.test(tx(v)))||/\(\s*cancell?ed\s*\)/i.test(tx(R.objective))||/\(\s*cancell?ed\s*\)/i.test(tx(R.name));
  O.flag=cancel?"Cancelled":/^hold$|on.?hold/i.test(st)?"On-Hold":/go\s*live/i.test(st)?"Go Live":st?"Active":"";
  O.checkCancel=O.nameNotes.some(n=>/cancel/i.test(n));
  O.done=one(R.done);O.willdo=one(R.willdo);O.issue=one(R.issue);O.priority=one(R.priority);O.requester=one(R.requester);
  O.category=one(R.category);O.id=tx(R.id);
  O.notes=[...R.notes.filter(v=>typeof v!=="number"&&typeof v!=="boolean").map(one).filter(v=>v&&!PHASE_RX.test(v)&&!STATUSW.test(v)&&parseDateAny(v)===""&&!/^monthly hours|\(\s*\d+\s*\*\s*\d+\s*\)/i.test(v)),...O.nameNotes];
  const hrs=typeof R.savinghrs==="number"?R.savinghrs:parseFloat(R.savinghrs);O.hrs=isNaN(hrs)||hrs<=0?"":hrs;
  O.freq=isBlank(R.frequency)?"":one(R.frequency);O.asis=isBlank(R.asis)?"":one(R.asis);O.tobe=isBlank(R.tobe)?"":one(R.tobe);O.savingtxt=isBlank(R.savingtxt)?"":one(R.savingtxt);
  const tag=tx(R.name).match(/\(([^()]*(deep\s*dive|simplification|2t\b)[^()]*)\)/i);O.tag=tag?one(tag[1]):"";
  return O}

/* ---------- the database side ---------- */
function benefitRowOf(pid){const rs=rowsOf("Benefits").filter(r=>gv("Benefits",FB.pid,r)===pid);return rs.find(r=>/^time saving/i.test(gv("Benefits",FB.desc,r)))||(rs.length===1?rs[0]:null)}
function dbValues(pr){const g=c=>gv("Projects",c,pr);const pid=pId(pr);const br=benefitRowOf(pid);
  return {name:one(g(FP.name)),objective:one(g("AD")),area:one(g(FP.proc)),subfn:one(g("AB")),tools:one(g("AF")),lead:one(g(FP.lead)),members:one(g("AG")),
    phase:one(g("AJ")),quarter:one(g("AI")),start:+g(FP.ps)||"",end:+g(FP.pe)||"",progress:Math.round(((LIVE.proj[pid]||{}).comp||0)*1000)/1000,
    ovr:g(FP.ovr),done:one(g("AK")),willdo:one(g("AL")),issue:one(g("AM")),priority:one(g(FP.prio)),requester:one(g("AH")),remark:tx(g("M")),
    hrs:br?(+gv("Benefits",FB.trh,br)||""):"",freq:br?one(gv("Benefits","N",br)):"",basis:br?tx(gv("Benefits","AJ",br)):"",brow:br,pid,legacy:tx(g("Z"))}}

/* ---------- baselines (what the old file said at the last sync) ---------- */
function syncRows(){const sh=S.sheets[SYNC_SHEET];if(!sh||!sh.vals)return [];const o=[];for(let r=SYNC_FIRST;r<=SYNC_LAST;r++){const k=gv(SYNC_SHEET,SYNC_C.key,r);if(k!=="")o.push(r)}return o}
function readBaselines(){const B={},byOname={};for(const r of syncRows()){let j=null;try{j=JSON.parse(gv(SYNC_SHEET,SYNC_C.json,r))}catch(e){}
  const k=String(gv(SYNC_SHEET,SYNC_C.key,r));B[k]={r,j,oname:String(gv(SYNC_SHEET,SYNC_C.oname,r)),oid:String(gv(SYNC_SHEET,SYNC_C.oid,r)),at:gv(SYNC_SHEET,SYNC_C.at,r)};
  if(B[k].oname)byOname[sq(B[k].oname)]=k}
  // first sync: the Migration Log records the old tracker's status / phase / progress at migration time
  const L={};const sh=S.sheets[SYNC_SHEET];if(sh&&sh.vals)for(let r=15;r<=600;r++){const id=gv(SYNC_SHEET,"B",r),nm=gv(SYNC_SHEET,"C",r);if(id===""&&nm==="")continue;
    L[String(id)+"|"+sq(nm)]={id:String(id),name:String(nm),status:String(gv(SYNC_SHEET,"E",r)),phase:String(gv(SYNC_SHEET,"F",r)),progress:gv(SYNC_SHEET,"G",r)}}
  return {B,byOname,L}}

/* ---------- compare ---------- */
const FIELDS=[
 {k:"name",l:"Project name",col:FP.name},{k:"objective",l:"Objective / Scope",col:"AD"},{k:"area",l:"Process Area",col:FP.proc},{k:"subfn",l:"Sub-Function / Team",col:"AB"},
 {k:"tools",l:"Technology / Tools",col:"AF"},{k:"lead",l:"Project Lead",col:FP.lead},{k:"members",l:"Project Team (Dev / BA)",col:"AG"},{k:"phase",l:"Phase (legacy)",col:"AJ",dir:"phase"},
 {k:"quarter",l:"Target Quarter",col:"AI"},{k:"start",l:"Plan Start",col:FP.ps,date:1},{k:"end",l:"Plan End",col:FP.pe,date:1},{k:"progress",l:"Progress %",dir:"pct"},
 {k:"done",l:"Last Update — Done",col:"AK"},{k:"willdo",l:"Next Steps",col:"AL"},{k:"issue",l:"Issues / Blockers",col:"AM"},{k:"priority",l:"Priority",col:FP.prio},
 {k:"requester",l:"Requester / Business Owner",col:"AH"},{k:"hrs",l:"Time saving (hrs / month)",ben:1},{k:"freq",l:"Task frequency",ben:1}];
const disp=(f,v)=>f.date?fmtDate(v):f.k==="progress"?(v===""?"":fmtPct(v)):f.k==="hrs"&&v!==""?String(Math.round(+v*100)/100):String(v??"");
function eqF(f,a,b){if(f.k==="hrs")return Math.abs((+a||0)-(+b||0))<0.01;if(f.date)return (+a||0)===(+b||0);if(f.k==="progress")return Math.abs((+a||0)-(+b||0))<0.005;if(f.k==="phase")return phaseOf(a)===phaseOf(b);
  if(f.k==="members"||f.k==="lead"){const s=x=>sq(x).split("").sort().join("");return s(a)===s(b)}return sq(a)===sq(b)}
function buildPlan(old){
  liveCalc();const base=readBaselines();const oldDate=Math.max(old.modified||0,old.lastMod||0);
  const dbDate=Math.max(S._coreMod||0,S.lastMod||0);
  if(SY.oldNewer==null)SY.oldNewer=oldDate>dbDate;
  const recs=old.recs.map(r=>({rec:r,O:oldValues(r)}));
  const db=rowsOf("Projects").filter(r=>gv("Projects",FP.name,r)!=="").map(r=>({r,pid:pId(r),name:gv("Projects",FP.name,r),leg:tx(gv("Projects","Z",r))}));
  const idCount={};recs.forEach(x=>{const k=sq(x.O.id);if(k)idCount[k]=(idCount[k]||0)+1});
  const generic=id=>!sq(id)||/^n$/i.test(tx(id))||idCount[sq(id)]>1;
  const used=new Map(),pairs=[];
  const take=(x,d,how,score)=>{used.set(d.r,x);pairs.push({x,d,how,score})};
  // 1) saved sync key: same old ID + same old name as last time
  for(const x of recs){const k=base.byOname[sq(x.rec.raw.name)];if(!k)continue;const d=db.find(d=>d.pid===k&&!used.has(d.r));if(d){x.m=1;take(x,d,"same as last sync",1)}}
  // 2) Legacy ID (unique, not a generic "n")
  for(const x of recs){if(x.m||generic(x.O.id))continue;const d=db.find(d=>!used.has(d.r)&&d.leg!==""&&sq(d.leg)===sq(x.O.id));if(!d)continue;
    const s=contains2(x.O.name,d.name)?1:Math.max(simName(x.O.name,d.name),simName(x.rec.raw.name,d.name));x.m=1;take(x,d,"Legacy ID "+x.O.id,s)}
  // 3) name similarity
  const cand=[];for(const x of recs){if(x.m)continue;for(const d of db){if(used.has(d.r))continue;const s=Math.max(simName(x.O.name,d.name),sq(x.O.name)===sq(d.name)?1:0);if(s>=0.8&&(sq(x.O.name)===sq(d.name)||words(x.O.name).filter(w=>words(d.name).includes(w)).length>=2))cand.push({x,d,s})}}
  cand.sort((a,b)=>b.s-a.s);for(const c of cand){if(c.x.m||used.has(c.d.r))continue;c.x.m=1;take(c.x,c.d,"name match "+Math.round(c.s*100)+"%",c.s)}
  // projects
  const groups=[];
  for(const p of pairs){const {x,d}=p;const O=x.O,N=dbValues(d.r);const g={type:"match",pr:d.r,pid:d.pid,dbName:d.name,x,O,N,how:p.how,score:p.score,items:[],warn:[]};
    const legKey=String(d.leg)+"|"+sq((base.L[String(d.leg)+"|"]||{}).name||"");
    let B=null,bsrc="";if(base.B[d.pid]&&base.B[d.pid].j){B=base.B[d.pid].j;bsrc="last sync "+(base.B[d.pid].at?fmtDate(base.B[d.pid].at):"")}
    else{const L=Object.values(base.L).find(l=>sq(l.id)===sq(d.leg)&&d.leg!=="");if(L){B={name:L.name,phase:L.phase,progress:L.progress===""?"":+L.progress,flag:/hold/i.test(L.status)?"On-Hold":/cancel/i.test(L.status)?"Cancelled":/go\s*live/i.test(L.status)?"Go Live":"Active"};bsrc="migration log"}}
    g.base=B;g.bsrc=bsrc;
    if(p.score<0.35&&/Legacy ID/.test(p.how))g.warn.push(`Same Legacy ID but the names are very different (“${esc(one(x.rec.raw.name))}” vs “${esc(d.name)}”). Check the ID was not re-used before applying.`);
    compareFields(g);groups.push(g)}
  // unmatched old rows → new projects (or likely duplicates)
  const adds=[];
  for(const x of recs){if(x.m)continue;let best=null;for(const d of db){const s=simName(x.O.name,d.name);if(!best||s>best.s)best={d,s}}
    for(const y of recs){if(y===x||y.m||y.rec.row>=x.rec.row)continue;const s=simName(y.O.name,x.O.name);if(s>=0.8&&(!best||s>best.s))best={d:{name:y.O.name+" (an earlier row of the old file)"},s}}
    const dupWord=/ซ้ำ|duplicate|same as/i.test(x.rec.raw.name);const dup=dupWord||(best&&best.s>=0.75&&sameWords(x.O.name,best.d.name)>=2);
    const reason=dupWord?"the old file marks it as a duplicate":dup?`looks like “${esc(best.d.name)}” (${Math.round(best.s*100)}% similar)`:"";
    const similar=!dup&&best&&best.s>=0.5?`similar to “${esc(best.d.name)}” (${Math.round(best.s*100)}%) — check it is really new`:"";
    const skipB=base.B["skip:"+sq(x.rec.raw.name)];
    adds.push({type:"add",x,O:x.O,on:!dup&&!skipB,dup,reason,similar,skipped:!!skipB,items:[],warn:[]})}
  const only=db.filter(d=>!used.has(d.r)).map(d=>({r:d.r,pid:d.pid,name:d.name}));
  SY.plan={old,groups,adds,only,oldDate,dbDate,base};return SY.plan}
function mkItem(g,f,kind,oldV,newV,reason,on,apply){const it={g,f,k:f.k||f,l:f.l||f,kind,oldV,newV,reason,on,sug:on,apply};g.items.push(it);return it}
function compareFields(g){const {O,N}=g;const B=g.base;const ON=SY.oldNewer;
  for(const f of FIELDS){let o=O[f.k],n=N[f.k];if(f.ben&&!N.brow&&O.hrs===""&&f.k!=="hrs")continue;
    const oBlank=f.date||f.k==="progress"||f.k==="hrs"?(o===""||o==null):isBlank(o);const nBlank=f.date||f.k==="progress"||f.k==="hrs"?(n===""||n==null||(f.k!=="progress"&&!+n)):isBlank(n);
    if(oBlank){if(f.date&&tx(f.k==="start"?O.startRaw:O.endRaw)!=="")mkItem(g,f,"ignored",tx(f.k==="start"?O.startRaw:O.endRaw),disp(f,n),"old value is not a date",false);continue}
    if(eqF(f,o,n))continue;
    if(looksMisplaced(f.k,o)){mkItem(g,f,"ignored",disp(f,o),disp(f,n),"old value looks like it belongs in another column",false);continue}
    // the old value already sits in another database field → the database was cleaned up, keep it
    if(!f.date&&f.k!=="progress"&&f.k!=="hrs"&&["name","objective","subfn","tools","lead","members","done","willdo","issue","requester","remark"].some(k=>k!==f.k&&N[k]&&(sq(N[k])===sq(o)||(["subfn","lead","members","requester"].includes(f.k)&&["lead","members","requester","subfn"].includes(k)&&contains2(N[k],o))))){
      mkItem(g,f,"ignored",disp(f,o),disp(f,n),"the database already has this value in another field (cleaned up)",false);continue}
    if(nBlank){mkItem(g,f,"fill",disp(f,o),"",`database is empty — fill from old file`,true,()=>applyField(g,f,o));continue}
    if(f.dir==="pct"){const fw=o>n;mkItem(g,f,fw?"update":"dbnewer",disp(f,o),disp(f,n),fw?"old file is further along":"database is further along — kept",fw,()=>applyField(g,f,o));continue}
    if(f.dir==="phase"){const a=phaseOf(o),b=phaseOf(n);if(a&&b){const fw=a>b;mkItem(g,f,fw?"update":"dbnewer",disp(f,o),disp(f,n),fw?"old file is at a later phase":"database is at a later phase — kept",fw,()=>applyField(g,f,o));continue}}
    let bv=B&&B[f.k]!==undefined&&B[f.k]!==null?B[f.k]:undefined;
    if(bv!==undefined){const oSame=eqF(f,o,bv),nSame=eqF(f,n,bv);
      if(oSame&&!nSame){mkItem(g,f,"dbnewer",disp(f,o),disp(f,n),`changed in the database since the ${g.bsrc} — kept`,false,()=>applyField(g,f,o));continue}
      if(!oSame&&nSame){mkItem(g,f,"update",disp(f,o),disp(f,n),`changed in the old file since the ${g.bsrc}`,true,()=>applyField(g,f,o));continue}
      if(!oSame&&!nSame){mkItem(g,f,"conflict",disp(f,o),disp(f,n),`changed on BOTH sides since the ${g.bsrc} — ${ON?"old file is newer":"database is newer"}`,ON,()=>applyField(g,f,o));continue}}
    mkItem(g,f,ON?"update":"conflict",disp(f,o),disp(f,n),`different, no earlier sync to compare — ${ON?"old file is the newer file":"database is the newer file"}`,ON,()=>applyField(g,f,o))}
  // name notes, remarks
  const notes=[...O.notes];const pr_=(SY.old&&SY.old.prog)||[];
  let pm=null,ps_=0;for(const p of pr_){const s_=sq(p.name)===sq(O.name)?1:(sameWords(p.name,O.name)>=2?simName(p.name,O.name):0);if(s_>=0.8&&s_>ps_){pm=p;ps_=s_}}if(pm)notes.push("Progress sheet: "+one(pm.remark));
  const miss=notes.filter(t=>t&&!sq(N.remark).includes(sq(t.replace(/^Progress sheet:\s*/,""))));
  if(miss.length)mkItem(g,{k:"remark",l:"Remark (notes)"},"append",miss.join(" | "),N.remark,"note from the old file not yet in the Remark — append",true,()=>{const cur=tx(gv("Projects","M",g.pr));setCell("Projects","M",g.pr,(cur?cur+" | ":"")+miss.join(" | "))});
  // status: hold / resume / cancel
  const ov=N.ovr,fl=O.flag,bf=B&&B.flag;
  if(fl==="Cancelled"&&ov!=="Cancelled")mkItem(g,{k:"status",l:"Status override"},O.checkCancel?"conflict":"update","Cancelled",ov||"(calculated)",O.checkCancel?"objective says Cancelled but the name still says “to check if cancel” — confirm before ticking":"old file says the project is cancelled",!O.checkCancel,()=>{setCell("Projects",FP.ovr,g.pr,"Cancelled");addRaidd(g.pid,"Decision","Project cancelled (from old tracker).","Closed")});
  else if(fl==="On-Hold"&&!ov){const ch=bf===undefined||bf===null||bf!=="On-Hold";mkItem(g,{k:"status",l:"Status override"},ch?"update":"dbnewer","On-Hold","(calculated)",ch?"old file puts the project on HOLD":"was already HOLD at the last sync and the database cleared it — kept",ch,()=>setCell("Projects",FP.ovr,g.pr,"On-Hold"))}
  else if((fl==="Active"||fl==="Go Live")&&ov==="On-Hold"){const ch=bf==="On-Hold";mkItem(g,{k:"status",l:"Status override"},ch?"update":(SY.oldNewer?"conflict":"dbnewer"),"clear override → calculated (old file: "+(O.status||"active")+")","On-Hold",ch?"old file no longer says HOLD — resume (clear override)":"old file is not on HOLD but the database is — check",ch,()=>setCell("Projects",FP.ovr,g.pr,""))}
  if(O.checkCancel&&ov!=="Cancelled")g.warn.push("The old file flags this project “"+esc(O.nameNotes.join("; "))+"” — decide whether to cancel it (Status override).");
  if(fl==="Go Live"&&O.progress!==""&&O.progress<1)g.warn.push(`Old file says <b>Go Live</b> but progress is ${fmtPct(O.progress)} — progress is synced as given.`);
  // benefit basis text
  if(O.asis||O.tobe||O.savingtxt){const parts=[O.asis,O.tobe,O.savingtxt].filter(Boolean);const have=sq(N.basis);
    if(N.brow&&parts.some(p=>!have.includes(sq(p))))mkItem(g,{k:"basis",l:"Benefit basis"},N.basis?(SY.oldNewer?"update":"conflict"):"fill",basisText(O),N.basis,"as-is / to-be text changed",N.basis?SY.oldNewer:true,()=>setCell("Benefits","AJ",N.brow,basisText(O)))}
  if(O.hrs===""&&O.savingtxt&&!N.hrs)g.warn.push("Saving is only given as text (“"+esc(O.savingtxt)+"”) — enter hours on the benefit line if it is a monthly time saving.");
}
function basisText(O){return `As-is ${O.asis||"?"} → To-be ${O.tobe||"?"}${O.savingtxt?` (saving ${O.savingtxt})`:""}.`}

/* ---------- writing into the database ---------- */
function applyField(g,f,v){const pr=g.pr;
  if(f.k==="progress"){setProjectProgress(pr,+v);return}
  if(f.ben){let br=benefitRowOf(g.pid);if(!br){br=addBenefit(pr);if(br==null)return;setCell("Benefits",FB.desc,br,"Time saving — "+gv("Projects",FP.name,pr));if(g.O.freq)setCell("Benefits","N",br,g.O.freq);
      if(g.O.asis||g.O.tobe)setCell("Benefits","AJ",br,basisText(g.O))}
    setCell("Benefits",f.k==="hrs"?FB.trh:"N",br,f.k==="hrs"?+v:v);return}
  if(f.k==="area"){setCell("Projects",FP.proc,pr,v);const cf=cfForArea(v);if(cf&&!gv("Projects",FP.cf,pr))setCell("Projects",FP.cf,pr,cf);return}
  if(f.k==="issue"){setCell("Projects","AM",pr,v);addRaidd(g.pid,"Issue",v,"Open");return}
  setCell("Projects",f.col,pr,f.date?+v:v)}
function addRaidd(pid,type,desc,status){if(rowsOf("RAIDD").some(r=>gv("RAIDD",FD.pid,r)===pid&&sq(gv("RAIDD",FD.desc,r))===sq(desc)))return;const r=firstFree("RAIDD");if(!r)return;
  S.newRows.RAIDD=S.newRows.RAIDD||new Set();S.newRows.RAIDD.add(r);setCell("RAIDD",FD.type,r,type);setCell("RAIDD",FD.pid,r,pid);setCell("RAIDD",FD.desc,r,desc);
  setCell("RAIDD",FD.status,r,status);setCell("RAIDD",FD.impact,r,"None");setCell("RAIDD",FD.raised,r,TODAY);if(status==="Closed")setCell("RAIDD","N",r,1);
  setCell("RAIDD","T",r,"Synced from old tracker "+(SY.old?SY.old.fname:""))}
function setProjectProgress(pr,p){const pid=pId(pr);let ts=tasksOfProject(pid);
  if(!ts.length){const st=stagesOf(pr);st.names.forEach((n,k)=>{const w=stdWindow(pr,k);addTask(pr,n,{name:st.std[k]||n,ps:w?w.s:"",pe:w?w.e:""})});ts=tasksOfProject(pid)}
  const st=stagesOf(pr);const cus=["T","U","V","W","X","Y"].map(c=>+gv("Projects",c,pr)||0);const anyC=cus.some(x=>x>0);
  const live=t=>gv("Activities",FA.ovr,t)!=="Cancelled";
  const basis=st.names.map((sn,k)=>ts.some(t=>gv("Activities",FA.stage,t)===sn&&live(t))?(anyC?cus[k]:(st.w[k]||0)):0);const bs=basis.reduce((a,b)=>a+b,0);if(!bs)return;
  let rem=p;st.names.forEach((sn,k)=>{if(!basis[k])return;const share=basis[k]/bs;const fr=rem>=share-1e-9?1:Math.max(0,rem/share);rem=Math.max(0,rem-share);
    for(const t of ts){if(gv("Activities",FA.stage,t)!==sn||!live(t)||gv("Activities",FA.ae,t)!=="")continue;const v=Math.round(fr*1000)/1000;if((+gv("Activities",FA.act,t)||0)!==v)setCell("Activities",FA.act,t,v)}})}
function createProject(a){const O=a.O;const r=nextProjectRow();if(!r){toast("No free rows left in the Projects table",6000);return null}
  S.newRows.Projects=S.newRows.Projects||new Set();S.newRows.Projects.add(r);const set=(c,v)=>{if(v!==""&&v!=null)setCell("Projects",c,r,v)};
  const inits=listFromName("L_Init");const init=/process\s*improv/i.test(O.category)?(inits.find(x=>/process improvement/i.test(x))||inits[0]):(inits.find(x=>/automation/i.test(x))||inits[0]);
  set(FP.init,init);const glob=/\b(us|eu|oversea|overseas|global|cross.?region)\b/i.test([O.name,O.subfn,a.x.rec.raw.division].join(" "));if(glob&&listFromName("L_Region").includes("Global"))set(FP.region,"Global");
  set(FP.bu,listFromName("L_BU").includes("Finance")?"Finance":(listFromName("L_BU")[0]||""));const cf=cfForArea(O.area);set(FP.cf,cf);set(FP.name,O.name);
  const lead=O.lead||O.members;set(FP.lead,lead);setCell("Projects",FP.meth,r,"Waterfall");set("R","Equal");set(FP.ps,O.start);set(FP.pe,O.end);
  set("Z",/^n?$/i.test(tx(O.id))?"":O.id);set(FP.proc,O.area);set("AB",O.subfn);set(FP.prio,O.priority);set("AD",O.objective);set("AE",O.tag||(/^n/i.test(tx(O.id))?"Simplification":"2T"));/* old 2T Club rows are 2T unless tagged deep dive / simplification; "n" rows are new simplification items */set("AF",O.tools);set("AG",O.members);set("AH",O.requester);
  set("AI",O.quarter);set("AJ",O.phase);set("AK",O.done);set("AL",O.willdo);set("AM",O.issue);set("M",O.notes.join(" | "));set("AN",dateToSerial(new Date(SY.plan.oldDate||Date.now())));
  if(O.flag==="Cancelled")set(FP.ovr,"Cancelled");else if(O.flag==="On-Hold")set(FP.ovr,"On-Hold");
  setCell("Projects",FP.lock,r,genProjectId(r));const pid=pId(r);
  const st=stagesOf(r);st.names.forEach((n,k)=>{const w=stdWindow(r,k);addTask(r,n,{name:st.std[k]||n,ps:w?w.s:"",pe:w?w.e:"",pic:lead})});
  if(O.progress!=="")setProjectProgress(r,O.progress);
  if(O.hrs!==""){const br=addBenefit(r);if(br!=null){setCell("Benefits",FB.desc,br,"Time saving — "+O.name);setCell("Benefits",FB.trh,br,O.hrs);if(O.freq)setCell("Benefits","N",br,O.freq);if(O.asis||O.tobe)setCell("Benefits","AJ",br,basisText(O))}}
  if(O.issue&&!looksMisplaced("issue",O.issue))addRaidd(pid,"Issue",O.issue,"Open");
  if(O.flag==="Cancelled")addRaidd(pid,"Decision","Project cancelled (from old tracker).","Closed");
  return r}
function baselineOf(O){const b={};for(const f of FIELDS)b[f.k]=O[f.k];b.flag=O.flag;b.basis=[O.asis,O.tobe,O.savingtxt].join(" | ");return b}
function setIf(sh,c,r,v){const cur=gv(sh,c,r);if(String(cur)===String(v??""))return;setCell(sh,c,r,v)}
function writeBaseline(key,O,rawName){const sh=S.sheets[SYNC_SHEET];if(!sh||!sh.vals)return false;
  if(gv(SYNC_SHEET,SYNC_C.key,14)===""){setCell(SYNC_SHEET,SYNC_C.key,12,"Old-tracker sync baseline — written by the Tracker Desk ⇄ Sync (do not edit). It records what the old file said at the last sync, so the next sync can tell which side changed.");
    setCell(SYNC_SHEET,SYNC_C.key,14,"Sync Key (Project ID)");setCell(SYNC_SHEET,SYNC_C.oid,14,"Old-file ID");setCell(SYNC_SHEET,SYNC_C.oname,14,"Old-file Project Name");setCell(SYNC_SHEET,SYNC_C.json,14,"Baseline (old-file values, JSON)");setCell(SYNC_SHEET,SYNC_C.at,14,"Synced on")}
  let r=syncRows().find(x=>String(gv(SYNC_SHEET,SYNC_C.key,x))===key);
  if(!r){for(let x=SYNC_FIRST;x<=SYNC_LAST;x++)if(gv(SYNC_SHEET,SYNC_C.key,x)===""){r=x;break}}if(!r)return false;
  const js=JSON.stringify(baselineOf(O));const same=String(gv(SYNC_SHEET,SYNC_C.json,r))===js;
  setIf(SYNC_SHEET,SYNC_C.key,r,key);setIf(SYNC_SHEET,SYNC_C.oid,r,O.id||"");setIf(SYNC_SHEET,SYNC_C.oname,r,rawName);if(!same){setCell(SYNC_SHEET,SYNC_C.json,r,js);setCell(SYNC_SHEET,SYNC_C.at,r,TODAY)}return true}
async function applySync(opts={}){const P=SY.plan;if(!P)return;const moved=new Set();let nCells=S.changes.length,nItems=0,nNew=0,nProj=0;
  const stamp=dateToSerial(new Date(P.oldDate||Date.now()));
  for(const g of P.groups){const sel=g.items.filter(i=>i.on&&i.apply);if(sel.length){nProj++;for(const it of sel){it.apply();nItems++;if(it.k==="start"||it.k==="end")moved.add(g.pr)}liveCalc();setIf("Projects","AN",g.pr,stamp)}}
  for(const a of P.adds){if(a.on){const r=createProject(a);if(r){a.pr=r;nNew++;liveCalc()}}}
  let bOk=true;for(const g of P.groups)bOk=writeBaseline(g.pid,g.O,g.x.rec.raw.name)&&bOk;
  for(const a of P.adds){if(a.pr)bOk=writeBaseline(pId(a.pr),a.O,a.x.rec.raw.name)&&bOk;else bOk=writeBaseline("skip:"+sq(a.x.rec.raw.name),a.O,a.x.rec.raw.name)&&bOk}
  const dated=[...moved].filter(pr=>{const ps=+gv("Projects",FP.ps,pr)||0,pe=+gv("Projects",FP.pe,pr)||0;return ps&&pe&&pe>=ps&&tasksOfProject(pId(pr)).length});
  if(dated.length){const k=opts.respread!==undefined?(opts.respread?"yes":"keep"):await choose("Move the task plans too?",`<p>Plan start / end changed on <b>${dated.length}</b> project(s): ${dated.slice(0,6).map(pr=>esc(gv("Projects",FP.name,pr))).join(", ")}${dated.length>6?"…":""}.</p><p>Status is calculated from the <b>task</b> dates. Spread their tasks over the new plan dates (standard stage windows)?</p>`,[["keep","Keep task dates"],["yes","Re-spread tasks","primary"]]);
    if(k==="yes")dated.forEach(pr=>quRespread(pr))}
  liveCalc();const msg=`Applied ${nItems} field update(s) on ${nProj} project(s) and added ${nNew} new project(s) — ${S.changes.length-nCells} cell(s) changed. Review, then Save to Excel.`;
  SY.lastApplied={nItems,nProj,nNew,cells:S.changes.length-nCells,baseline:bOk};SY.plan=null;SY.old=null;view="Changes";render();toast(msg+(bOk?"":" (No Migration_Log sheet — sync baseline not stored.)"),8000);return SY.lastApplied}

/* ---------- UI ---------- */
async function pickOld(){const go=async(buf,name,lm)=>{try{toast("Reading the old file…",20000);SY.old=await readOldWorkbook(buf,name,lm);SY.oldNewer=null;buildPlan(SY.old);SY.tab="todo";toast("Compared "+SY.old.recs.length+" old rows",2000);render()}catch(e){console.error(e);toast("Could not read the old file: "+e.message,9000)}};
  if(window.showOpenFilePicker){try{const [h]=await window.showOpenFilePicker({types:[{description:"Excel workbook",accept:{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":[".xlsx",".xlsm"]}}]});const f=await h.getFile();await go(await f.arrayBuffer(),f.name,f.lastModified);return}catch(e){if(e.name==="AbortError")return}}
  const i=document.createElement("input");i.type="file";i.accept=".xlsx,.xlsm";i.onchange=async()=>{const f=i.files[0];if(f)await go(await f.arrayBuffer(),f.name,f.lastModified)};i.click()}
const KIND={fill:["Fill","#E7F5EA","#1E6B24"],update:["Old newer","#E8F0FB","#1F4E9A"],append:["Append","#E8F0FB","#1F4E9A"],conflict:["Conflict","#FFF3D6","#7A4B00"],dbnewer:["DB newer","#ECEEF1","#4B5563"],ignored:["Ignored","#F4F4F5","#6B7280"]};
const ktag=k=>{const [t,b,c]=KIND[k]||[k,"#eee","#333"];return `<span class="pill" style="background:${b};color:${c}">${t}</span>`};
function vSync(m){const P=SY.plan;
  const head=`<div class="banner inp"><b>⇄ SYNC OLD FILE</b><span>Bring updates from the old-format tracker (Project 2T Club Update) into this workbook. This workbook stays the database: the old file is only read. Nothing changes until you click <b>Apply</b>; then use <b>Review changes</b> → <b>Save to Excel</b>.</span></div>`;
  if(!P){m.innerHTML=head+`<div class="card pad"><h2>1 · Database (new format)</h2><p>✓ <b>${esc(S.fileName)}</b> is open.</p>
    <h2 style="margin-top:14px">2 · Old-format file</h2><p class="muted">Pick the latest <b>Project_2T_Club_Update …xlsx</b>. The app finds the project sheet and its columns by header names, so moved or extra columns are fine.</p>
    <p><button class="btn primary" id="syPick">Choose old-format file…</button></p>
    ${SY.lastApplied?`<div class="note">Last apply: ${SY.lastApplied.nItems} field update(s), ${SY.lastApplied.nNew} new project(s), ${SY.lastApplied.cells} cell(s). ${S.changes.length?"Not saved yet — open <b>Review changes</b>.":""}</div>`:""}
    <h2 style="margin-top:14px">How it decides which side is newer</h2><ol class="rules">
    <li><b>Matching</b> — by the saved sync key, then the <b>Legacy ID</b>, then by project name (≥ 80% similar). Old rows without a match are offered as <b>new projects</b>; rows marked “ซ้ำ / same as” or very similar to an existing project are flagged as likely duplicates and left unticked.</li>
    <li><b>Baseline</b> — after every sync the app stores what the old file said (Migration_Log, columns N–R). Next time: changed only in the old file → update; changed only in the database → keep; changed on both → conflict. The first time, the Migration Log’s status / phase / progress are the baseline.</li>
    <li><b>Progress and phase only move forward</b> — a lower % or an earlier phase in the old file never overwrites the database.</li>
    <li><b>Messy old cells are ignored</b> — blanks, “-”, “N/A”, a phase or status typed in the wrong column, or a value the database already holds in another field.</li>
    <li>Anything else that differs is decided by the <b>newer file</b> (you can switch this) and shown for review.</li></ol></div>`;
    $("#syPick").onclick=pickOld;return}
  const all=P.groups.flatMap(g=>g.items),cnt=k=>all.filter(i=>i.kind===k).length;const sel=all.filter(i=>i.on).length+P.adds.filter(a=>a.on).length;const TF=SY.tab==="todo"?(i=>i.sug||i.on):(i=>i.kind===SY.tab);
  const fwd=P.groups.filter(g=>g.items.some(i=>i.on&&i.kind!=="ignored")).length,back=P.groups.filter(g=>g.items.some(i=>i.kind==="dbnewer")).length;
  const tabs=[["todo","Suggested",all.filter(i=>i.sug||i.on).length],["conflict","Conflicts",cnt("conflict")],["dbnewer","Database newer",cnt("dbnewer")],["ignored","Ignored old cells",cnt("ignored")],
    ["add","New in old file",P.adds.length],["only","Only in database",P.only.length],["fmt","Old-file columns",Object.keys(P.old.map).length]];
  const od=new Date(P.oldDate),dd=new Date(P.dbDate);const dt=d=>isNaN(d)||!+d?"unknown":d.toLocaleString();
  let body="";const q=sq(SY.q);
  const stOf=r=>pStat(r)||"Not Started",aSt=a=>a.O.flag==="Cancelled"?"Cancelled":a.O.flag==="On-Hold"?"On-Hold":a.O.flag==="Go Live"?"Go Live (old file)":a.O.flag==="Active"?"In Progress (old file)":"(no status)";
  const stOffS=new Set(SY.stOff||[]);const stOK=v=>!stOffS.has(v);
  const gm=g=>(!q||sq(g.dbName+" "+g.O.name+" "+g.pid).includes(q))&&stOK(stOf(g.pr));
  const stList=[...new Set([...P.groups.map(g=>stOf(g.pr)),...P.only.map(o=>stOf(o.r)),...P.adds.map(aSt),...stOffS])].sort();
  if(["todo","conflict","dbnewer","ignored"].includes(SY.tab)){const f=SY.tab==="todo"?(i=>i.sug||i.on):(i=>i.kind===SY.tab);
    const gs=P.groups.filter(g=>gm(g)&&(g.items.some(f)||(SY.tab==="todo"&&g.warn.length)));
    body=gs.length?gs.map(g=>{const its=g.items.filter(f);return `<div class="bcard${its.some(i=>i.on)?" changed":""}"><div class="bch"><b>${esc(g.dbName)}</b><span class="zid">${esc(g.pid)}</span><span class="estchip">${esc(g.how)}</span>${g.bsrc?`<span class="estchip auto">baseline: ${esc(g.bsrc)}</span>`:`<span class="estchip">no baseline</span>`}
      ${its.length?`<span style="margin-left:auto"><label class="muted" style="font-size:12px"><input type="checkbox" data-gall="${g.pr}" ${its.every(i=>i.on)?"checked":""}> all</label></span>`:""}</div>
      ${g.warn.map(w=>`<div class="estnote">⚠ ${w}</div>`).join("")}
      ${its.length?`<div class="tablewrap"><table class="data"><tr><th style="width:28px"></th><th>Field</th><th>Database now</th><th>Old file</th><th>Verdict</th></tr>${its.map(i=>`<tr><td>${i.apply?`<input type="checkbox" data-it="${all.indexOf(i)}" ${i.on?"checked":""}>`:""}</td><td>${esc(i.l)}</td><td class="muted">${esc(i.newV)}</td><td><b>${esc(i.oldV)}</b></td><td>${ktag(i.kind)} <span class="muted" style="font-size:12px">${esc(i.reason)}</span></td></tr>`).join("")}</table></div>`:""}</div>`}).join(""):`<p class="muted">Nothing here.</p>`}
  else if(SY.tab==="add"){body=P.adds.filter(a=>(!q||sq(a.O.name).includes(q))&&stOK(aSt(a))).map((a,k)=>`<div class="bcard${a.on?" changed":""}"><div class="bch"><label><input type="checkbox" data-add="${P.adds.indexOf(a)}" ${a.on?"checked":""}> <b>${esc(a.O.name)}</b></label><span class="zid">old ID ${esc(a.O.id||"–")} · row ${a.x.rec.row}</span>
      ${a.dup?`<span class="bflag">likely duplicate — ${a.reason}</span>`:`<span class="bok">new project</span>${a.similar?` <span class="bflag tflag">${a.similar}</span>`:""}`}${a.skipped?`<span class="estchip">skipped at the last sync</span>`:""}</div>
      <div class="bval">${[["Area",a.O.area],["Lead",a.O.lead||a.O.members],["Phase",a.O.phase],["Progress",a.O.progress===""?"":fmtPct(a.O.progress)],["Status",a.O.flag],["Plan",[fmtDate(a.O.start),fmtDate(a.O.end)].filter(Boolean).join(" → ")],["Saving",a.O.hrs?a.O.hrs+" hrs/month":""]].filter(x=>x[1]).map(x=>`${x[0]}: <b>${esc(x[1])}</b>`).join(" · ")}</div>
      ${a.O.objective?`<div class="muted" style="font-size:12px;margin-top:4px">${esc(a.O.objective)}</div>`:""}
      ${!cfForArea(a.O.area)&&a.O.area?`<div class="estnote">Process area “${esc(a.O.area)}” is not in Master_Data — the Corporate Function is left blank; set it after adding.</div>`:""}</div>`).join("")||`<p class="muted">Every old project matched a database project.</p>`}
  else if(SY.tab==="only"){body=`<p class="muted">These database projects have no row in the old file. They are not changed or deleted.</p><ul>${P.only.filter(o=>stOK(stOf(o.r))&&(!q||sq(o.name+" "+o.pid).includes(q))).map(o=>`<li>${esc(o.name)} <span class="zid">${esc(o.pid)}</span></li>`).join("")}</ul>`}
  else if(SY.tab==="fmt"){const o=P.old;body=`<p>Read sheet <b>${esc(o.sheet)}</b> (header row ${o.hr}, ${o.recs.length} project rows). Other sheets: ${esc(o.sheets.filter(s=>s!==o.sheet).join(", "))}.</p>
    <div class="tablewrap"><table class="data"><tr><th>Old column</th><th>Used as</th></tr>${Object.entries(o.map).map(([k,c])=>`<tr><td>${esc(Array.isArray(c)?c.join(", "):c)}</td><td>${esc(k)}</td></tr>`).join("")}
    ${o.notesCols.map(n=>`<tr><td>${esc(n.c)} <span class="muted">${esc(n.h)}</span></td><td>notes → Remark</td></tr>`).join("")}</table></div>
    ${o.unmapped.length?`<div class="warnbox" style="margin-top:10px"><b>Columns not used</b> (new or renamed in the old file — tell the admin if they matter): ${o.unmapped.map(u=>`${esc(u.c)} “${esc(u.h)}”`).join(", ")}</div>`:`<p class="bok">All old-file columns are understood.</p>`}`}
  m.innerHTML=head+`<div class="card pad"><div class="kprow">
     <div class="kpgrp"><div class="kp"><span>Old file</span><b>${esc(P.old.fname)}</b></div><div class="kp"><span>saved</span><b>${dt(od)}</b></div></div>
     <div class="kpgrp"><div class="kp"><span>Database</span><b>${esc(S.fileName)}</b></div><div class="kp"><span>saved</span><b>${dt(dd)}</b></div></div>
     <div class="kpgrp"><div class="kp"><span>Matched projects</span><b>${P.groups.length}</b></div><div class="kp"><span>Old file ahead on</span><b>${fwd}</b></div><div class="kp"><span>Database ahead on</span><b>${back}</b></div></div></div>
    <div class="${SY.oldNewer?"note":"warnbox"}" style="margin-top:10px">${SY.oldNewer?"The <b>old file is newer</b> than the database, so where nothing else decides, the old value is pre-selected.":"The <b>database is newer</b> than the old file — only fills, forward progress and baseline-proven changes are pre-selected. The old file may lag behind."}
      <button class="btn small" id="syFlip">Treat the ${SY.oldNewer?"database":"old file"} as newer</button></div>
    <div class="toolbar" style="margin-top:12px;flex-wrap:wrap">${tabs.map(([k,t,n])=>`<button class="btn small ${SY.tab===k?"primary":""}" data-syt="${k}">${t} (${n})</button>`).join("")}
      <input class="bq" id="syQ" placeholder="Filter projects…" value="${esc(SY.q)}">
      ${stChips(stList,stOffS,v=>P.groups.filter(g=>stOf(g.pr)===v).length+P.adds.filter(a=>aSt(a)===v).length+P.only.filter(o=>stOf(o.r)===v).length,"syst")}</div>
    <div style="margin-top:12px">${body}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
      <button class="btn primary" id="syApply">Apply ${sel} selected item(s) to the database</button><button class="btn" id="syRe">Reset to suggestions</button><button class="btn" id="syNone">Untick all</button><button class="btn" id="syOther">Choose another old file</button><button class="btn" id="syClose">Cancel</button>
      <span class="muted" style="font-size:12px">After applying: Review changes → Save to Excel. The stored baseline makes the next sync a 3-way compare.</span></div></div>`;
  bindStChips(m,"syst",SY,()=>render());
  m.querySelectorAll("[data-syt]").forEach(b=>b.onclick=()=>{SY.tab=b.dataset.syt;render()});
  const qi=$("#syQ");qi.oninput=()=>{SY.q=qi.value;clearTimeout(vSync._t);vSync._t=setTimeout(()=>{render();const e=$("#syQ");e.focus();e.setSelectionRange(e.value.length,e.value.length)},350)};
  m.querySelectorAll("[data-it]").forEach(c=>c.onchange=()=>{all[+c.dataset.it].on=c.checked;render()});
  m.querySelectorAll("[data-gall]").forEach(c=>c.onchange=()=>{const g=P.groups.find(g=>g.pr===+c.dataset.gall);g.items.filter(i=>i.apply&&TF(i)).forEach(i=>i.on=c.checked);render()});
  m.querySelectorAll("[data-add]").forEach(c=>c.onchange=()=>{P.adds[+c.dataset.add].on=c.checked;render()});
  $("#syFlip").onclick=()=>{SY.oldNewer=!SY.oldNewer;buildPlan(P.old);render()};
  $("#syRe").onclick=()=>{buildPlan(P.old);render()};$("#syNone").onclick=()=>{all.forEach(i=>i.on=false);P.adds.forEach(a=>a.on=false);render()};
  $("#syOther").onclick=pickOld;$("#syClose").onclick=()=>{SY.plan=null;SY.old=null;render()};
  $("#syApply").onclick=async()=>{if(!sel){toast("Nothing selected");return}const k=await choose("Apply to the database?",`<p>${all.filter(i=>i.on).length} field update(s) and ${P.adds.filter(a=>a.on).length} new project(s) will be written into the open workbook (not saved yet).</p><p class="muted">You can still review every cell and discard before saving.</p>`,[["c","Cancel"],["ok","Apply","primary"]]);if(k==="ok")applySync()}}


