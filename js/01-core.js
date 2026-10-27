/* 01-core.js — utilities, timezone-aware today, ZIP read/write, XLSX model, records */
"use strict";
/* ---------------- utilities ---------------- */
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function colIdx(c){let n=0;for(const ch of c)n=n*26+(ch.charCodeAt(0)-64);return n}
function colLet(n){let s="";while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s}
const EPOCH=Date.UTC(1899,11,30);
function serialToDate(s){return new Date(EPOCH+Math.round(s)*86400000)}
function dateToSerial(d){return Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-EPOCH)/86400000)}
function isoFromSerial(s){if(s===""||s==null||isNaN(s))return "";return serialToDate(+s).toISOString().slice(0,10)}
function serialFromIso(iso){if(!iso)return "";const [y,m,d]=iso.split("-").map(Number);return dateToSerial(new Date(Date.UTC(y,m-1,d)))}
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(s){if(s===""||s==null||isNaN(+s)||+s<=0)return "";const d=serialToDate(+s);return String(d.getUTCDate()).padStart(2,"0")+"-"+MON[d.getUTCMonth()]+"-"+String(d.getUTCFullYear()).slice(2)}
function fmtNum(v,dp=0){if(v===""||v==null||isNaN(+v))return "";return (+v).toLocaleString("en-US",{maximumFractionDigits:dp,minimumFractionDigits:dp})}
function fmtPct(v){if(v===""||v==null||isNaN(+v))return "";return Math.round(+v*100)+"%"}
function fmtShort(v){v=+v||0;const a=Math.abs(v);if(a>=1e6)return (v/1e6).toFixed(2)+"m";if(a>=1e3)return (v/1e3).toFixed(0)+"k";return v.toFixed(0)}
/* ---- "Today" — timezone-aware, advances on its own ---- */
const TZ_LIST=["Asia/Bangkok","Asia/Ho_Chi_Minh","Asia/Jakarta","Asia/Singapore","Asia/Kuala_Lumpur","Asia/Manila","Asia/Shanghai","Asia/Tokyo","Asia/Kolkata","Asia/Dubai","Europe/London","Europe/Paris","Europe/Amsterdam","America/New_York","America/Chicago","America/Los_Angeles","Australia/Sydney","UTC"];
let TZ=(()=>{try{return localStorage.getItem("sga_tz")||"Asia/Bangkok"}catch(e){return "Asia/Bangkok"}})();
function todayIn(tz){try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const g=t=>+p.find(x=>x.type===t).value;return dateToSerial(new Date(Date.UTC(g("year"),g("month")-1,g("day"))))}catch(e){const d=new Date();return dateToSerial(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())))}}
function nowIn(tz){try{return new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date())}catch(e){return ""}}
let TODAY=todayIn(TZ);
function paintClock(){const el=document.getElementById("todayLbl");let fz=false;try{fz=typeof S!=="undefined"&&S.zip&&+setting("S_AsOf")>0}catch(e){}if(el)el.textContent=fmtDate(TODAY)+(fz?" · frozen (Settings)":" · "+nowIn(TZ))}
function setTZ(tz){TZ=tz;try{localStorage.setItem("sga_tz",tz)}catch(e){}tickToday(true)}
function tickToday(force){let t=todayIn(TZ);try{if(typeof S!=="undefined"&&S.zip){const a=+setting("S_AsOf");if(a>0)t=a}}catch(e){}const changed=t!==TODAY;TODAY=t;paintClock();
  if((changed||force)&&typeof S!=="undefined"&&S.zip){if(document.getElementById("drawer")?.classList.contains("on")){S._todayPending=true;return}render();if(changed)toast("New day ("+fmtDate(TODAY)+", "+TZ+") — statuses, Gantt today line and current month updated")}}
setInterval(()=>tickToday(false),30000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tickToday(false)});
function toast(msg,ms=3200){const t=$("#toast");t.textContent=msg;t.classList.add("on");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("on"),ms)}
function pill(s){if(!s)return "";return `<span class="pill st-${esc(String(s).replace(/ /g,"."))}">${esc(s)}</span>`}

/* ---------------- ZIP (read / write, no libraries) ---------------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC_T[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
async function streamBytes(u8,ts){return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ts)).arrayBuffer())}
const inflate=u8=>streamBytes(u8,new DecompressionStream("deflate-raw"));
const deflate=u8=>streamBytes(u8,new CompressionStream("deflate-raw"));
function readZip(buf){
  const dv=new DataView(buf),u8=new Uint8Array(buf);let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-70000);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
  if(e<0)throw new Error("Not a valid .xlsx (zip) file");
  const cnt=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);const list=[];
  const dec=new TextDecoder();
  for(let k=0;k<cnt;k++){
    if(dv.getUint32(off,true)!==0x02014b50)throw new Error("Corrupt zip directory");
    const method=dv.getUint16(off+10,true),time=dv.getUint16(off+12,true),date=dv.getUint16(off+14,true),crc=dv.getUint32(off+16,true),
      csize=dv.getUint32(off+20,true),usize=dv.getUint32(off+24,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),
      lho=dv.getUint32(off+42,true);
    const name=dec.decode(u8.subarray(off+46,off+46+nl));
    const lnl=dv.getUint16(lho+26,true),lel=dv.getUint16(lho+28,true);const ds=lho+30+lnl+lel;
    list.push({name,method,time,date,crc,csize,usize,data:u8.slice(ds,ds+csize)});
    off+=46+nl+el+cl;
  }
  return list;
}
async function entryText(ent){const raw=ent.method===0?ent.data:await inflate(ent.data);return new TextDecoder().decode(raw)}
async function writeZip(list,changed){
  const enc=new TextEncoder();const parts=[];const central=[];let offset=0;
  for(const ent of list){
    if(changed[ent.name]){
      const raw=changed[ent.name];const comp=await deflate(raw);
      Object.assign(ent,{method:8,crc:crc32(raw),csize:comp.length,usize:raw.length,data:comp});
    }
    const nb=enc.encode(ent.name);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0,true);lh.setUint16(8,ent.method,true);
    lh.setUint16(10,ent.time,true);lh.setUint16(12,ent.date,true);lh.setUint32(14,ent.crc,true);lh.setUint32(18,ent.csize,true);
    lh.setUint32(22,ent.usize,true);lh.setUint16(26,nb.length,true);lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer),nb,ent.data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0,true);ch.setUint16(10,ent.method,true);
    ch.setUint16(12,ent.time,true);ch.setUint16(14,ent.date,true);ch.setUint32(16,ent.crc,true);ch.setUint32(20,ent.csize,true);
    ch.setUint32(24,ent.usize,true);ch.setUint16(28,nb.length,true);ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),nb);
    offset+=30+nb.length+ent.data.length;
  }
  const cdSize=central.reduce((a,b)=>a+b.length,0);
  const eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);eo.setUint16(8,list.length,true);eo.setUint16(10,list.length,true);eo.setUint32(12,cdSize,true);eo.setUint32(16,offset,true);
  return new Blob([...parts,...central,new Uint8Array(eo.buffer)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

/* ---------------- XLSX model ---------------- */
const S={zip:null,byName:{},sst:[],sheets:{},names:{},dirty:new Set(),changes:[],handle:null,fileName:"",lastMod:0,newRows:{},wbDoc:null};
const parser=new DOMParser(),ser=new XMLSerializer();
async function loadWorkbook(buf,name,handle,lastMod){
  const list=readZip(buf);const by={};list.forEach(e=>by[e.name]=e);
  const wbXml=await entryText(by["xl/workbook.xml"]);const wbDoc=parser.parseFromString(wbXml,"application/xml");
  const rels=parser.parseFromString(await entryText(by["xl/_rels/workbook.xml.rels"]),"application/xml");
  const relMap={};for(const r of rels.getElementsByTagName("Relationship"))relMap[r.getAttribute("Id")]=r.getAttribute("Target");
  let sst=[];
  if(by["xl/sharedStrings.xml"]){
    const d=parser.parseFromString(await entryText(by["xl/sharedStrings.xml"]),"application/xml");
    for(const si of d.getElementsByTagNameNS(NS,"si")){let t="";for(const x of si.getElementsByTagNameNS(NS,"t"))t+=x.textContent;sst.push(t)}
  }
  const sheets={};
  for(const sh of wbDoc.getElementsByTagNameNS(NS,"sheet")){
    const nm=sh.getAttribute("name");const rid=sh.getAttributeNS(RNS,"id")||sh.getAttribute("r:id");
    let tgt=relMap[rid];if(!tgt)continue;tgt=tgt.replace(/^\/?xl\//,"");sheets[nm]={path:"xl/"+tgt.replace(/^\//,"")};
  }
  const need=["Projects","Activities","Benefits","Realisation","RAIDD","Lists","Plan_Calc"];
  for(const n of need){if(!sheets[n])throw new Error(`Sheet "${n}" not found — is this the SG&A tracker workbook?`)}
  for(const n of [...need,...["Master_Data","Benefit_Plan","Migration_Log","E2E_Flows","E2E_Map","Activity_Log"].filter(n=>sheets[n])]){
    const doc=parser.parseFromString(await entryText(by[sheets[n].path]),"application/xml");
    const sd=doc.getElementsByTagNameNS(NS,"sheetData")[0];const rows=new Map(),cells=new Map(),vals=new Map();
    for(const row of sd.getElementsByTagNameNS(NS,"row")){
      rows.set(+row.getAttribute("r"),row);
      for(const c of row.getElementsByTagNameNS(NS,"c")){const ref=c.getAttribute("r");cells.set(ref,c);vals.set(ref,cellValue(c,sst))}
    }
    Object.assign(sheets[n],{doc,sd,rows,cells,vals});
  }
  const names={};
  for(const dn of wbDoc.getElementsByTagNameNS(NS,"definedName")){const nm=dn.getAttribute("name");if(!dn.getAttribute("localSheetId"))names[nm]=dn.textContent}
  let coreMod=0;if(by["docProps/core.xml"]){const m=(await entryText(by["docProps/core.xml"])).match(/<dcterms:modified[^>]*>([^<]+)</);if(m)coreMod=Date.parse(m[1])||0}
  Object.assign(S,{zip:list,byName:by,sst,sheets,names,dirty:new Set(),changes:[],handle,fileName:name,lastMod,newRows:{},wbDoc,_coreMod:coreMod,extraParts:{},_logFor:null});try{E2E_CACHE=null}catch(e){}
}
function cellValue(c,sst){
  const t=c.getAttribute("t");
  if(t==="inlineStr"){let s="";for(const x of c.getElementsByTagNameNS(NS,"t"))s+=x.textContent;return s}
  const v=c.getElementsByTagNameNS(NS,"v")[0];if(!v||v.textContent==="")return "";
  const tx=v.textContent;
  if(t==="s")return sst[+tx]??"";
  if(t==="str"||t==="e")return t==="e"?"":tx;
  if(t==="b")return tx==="1";
  const n=Number(tx);return isNaN(n)?tx:n;
}
function gv(sheet,col,row){const v=S.sheets[sheet].vals.get(col+row);return v===undefined?"":v}
function setCell(sheet,col,row,val){
  const sh=S.sheets[sheet];const ref=col+row;const doc=sh.doc;
  let rowEl=sh.rows.get(row);
  if(!rowEl){rowEl=doc.createElementNS(NS,"row");rowEl.setAttribute("r",row);
    let before=null;for(const [r,el] of sh.rows){if(r>row&&(!before||r<+before.getAttribute("r")))before=el}
    sh.sd.insertBefore(rowEl,before);sh.rows.set(row,rowEl)}
  let c=sh.cells.get(ref);
  if(!c){c=doc.createElementNS(NS,"c");c.setAttribute("r",ref);const ci=colIdx(col);let before=null;
    for(const x of rowEl.getElementsByTagNameNS(NS,"c")){if(colIdx(x.getAttribute("r").replace(/\d+/g,""))>ci){before=x;break}}
    rowEl.insertBefore(c,before);sh.cells.set(ref,c)}
  if(c.getElementsByTagNameNS(NS,"f").length)throw new Error("Refusing to overwrite a formula cell "+ref);
  while(c.firstChild)c.removeChild(c.firstChild);c.removeAttribute("t");
  if(val===""||val==null){/* blank */}
  else if(typeof val==="number"&&isFinite(val)){const v=doc.createElementNS(NS,"v");v.textContent=String(val);c.appendChild(v)}
  else{c.setAttribute("t","inlineStr");const is=doc.createElementNS(NS,"is");const t=doc.createElementNS(NS,"t");
    t.setAttributeNS("http://www.w3.org/XML/1998/namespace","xml:space","preserve");t.textContent=String(val);is.appendChild(t);c.appendChild(is)}
  const old=sh.vals.get(ref);sh.vals.set(ref,val===null?"":val);S.dirty.add(sheet);S._needCalc=true;if(sheet==="E2E_Flows"){try{E2E_CACHE=null}catch(e){}}
  S.changes.push({sheet,ref,old,val});updateBadge();
}
function listFromName(nm){
  if(MDNAMES[nm]&&hasMD())return mdList(nm);
  const ref=S.names[nm];if(!ref)return [];const m=ref.replace(/\$/g,"").match(/^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);if(!m)return [];
  const [,sh,c1,r1,,r2]=m;const out=[];
  for(let r=+r1;r<=+(r2||r1);r++){const v=S.sheets[sh]?gv(sh,c1,r):"";if(v!==""&&v!=null)out.push(v)}return out;
}
function setting(nm){const v=listFromName(nm);return v.length?v[0]:""}

/* ---------------- records ---------------- */
function rowsOf(sheet){const c=CFG[sheet];const out=[];for(let r=c.first;r<=c.last;r++){const k=gv(sheet,KEY[sheet],r);if(k!==""||(S.newRows[sheet]&&S.newRows[sheet].has(r)))out.push(r)}return out}
function firstFree(sheet){const c=CFG[sheet];for(let r=c.first;r<=c.last;r++){if(gv(sheet,KEY[sheet],r)===""&&!(S.newRows[sheet]&&S.newRows[sheet].has(r))){
  const idc=sheet==="Realisation"?null:(sheet==="Projects"?FP.lock:sheet==="Activities"?FA.lock:sheet==="Benefits"?FB.lock:null);
  if(idc&&gv(sheet,idc,r)!=="")continue;return r}}return null}
const pId=r=>gv("Projects",FP.lock,r)||gv("Projects",FP.id,r);
const tId=r=>gv("Activities",FA.lock,r)||gv("Activities",FA.id,r);
const bId=r=>gv("Benefits",FB.lock,r)||gv("Benefits",FB.id,r);
function projects(){return rowsOf("Projects").map(r=>({r,id:pId(r),name:gv("Projects",FP.name,r)}))}
function projRowById(id){for(const r of rowsOf("Projects"))if(pId(r)===id)return r;return null}
function projMeth(pid){const r=projRowById(pid);return r&&gv("Projects",FP.meth,r)==="Agile"?"Agile":"Waterfall"}
function codeFor(listNm,codeNm,val,def){const a=listFromName(listNm),b=listFromName(codeNm);const i=a.indexOf(val);return i>=0&&b[i]?b[i]:def}
function maxSuffix(ids,prefix,width){let m=0;for(const id of ids){if(typeof id==="string"&&id.startsWith(prefix)){const n=parseInt(id.slice(prefix.length),10);if(!isNaN(n)&&id.length===prefix.length+width)m=Math.max(m,n)}}return m}
/* ID prefix = programme: 2T (old 2T Club project, Programme Tag "2T") or SIMP (simplification — everything else) */
function progChip(id){const p=String(id||"").split("-")[0];return p==="2T"?`<span class="pchipP p2t" title="Old 2T Club project">2T</span> `:p==="SIMP"?`<span class="pchipP psimp" title="Simplification project">SIMP</span> `:""}
function progCode(r){return String(gv("Projects","AE",r)||"").trim().toUpperCase()==="2T"?"2T":"SIMP"}
function genProjectId(r){
  const pre=[progCode(r),codeFor("L_Init","L_InitCode",gv("Projects",FP.init,r),"GEN"),codeFor("L_BU","L_BUCode",gv("Projects",FP.bu,r),"GRP"),codeFor("L_CF","L_CFCode",gv("Projects",FP.cf,r),"GEN")].join("-")+"-";
  /* one number sequence for 2T and SIMP, so "SSC-048" never means two projects */
  const tail=pre.slice(pre.indexOf("-"));const ids=rowsOf("Projects").filter(x=>x!==r).map(pId);let mx=0;
  for(const id of ids){const k=String(id).indexOf("-");if(k<0)continue;const t=String(id).slice(k);if(t.startsWith(tail)){const n=parseInt(t.slice(tail.length),10);if(!isNaN(n)&&t.length===tail.length+3)mx=Math.max(mx,n)}}
  return pre+String(mx+1).padStart(3,"0");
}
function genTaskId(r){
  const pid=gv("Activities",FA.pid,r),st=gv("Activities",FA.stage,r);if(!pid||!st)return "";
  const ag=projMeth(pid)==="Agile";const stages=listFromName(ag?"L_StageAG":"L_StageWF"),codes=listFromName(ag?"L_CodeAG":"L_CodeWF");
  const i=stages.indexOf(st);if(i<0)return "";const pre=pid+"-"+codes[i];
  const ids=rowsOf("Activities").filter(x=>x!==r).map(tId);return pre+String(maxSuffix(ids,pre,2)+1).padStart(2,"0");
}
function genBenefitId(r){const ids=rowsOf("Benefits").filter(x=>x!==r).map(bId);return "B-"+String(maxSuffix(ids,"B-",3)+1).padStart(3,"0")}
function refreshNewId(sheet,r){
  if(!(S.newRows[sheet]&&S.newRows[sheet].has(r)))return;
  if(sheet==="Projects"){if(gv("Projects",FP.name,r)!==""){if(gv("Projects",FP.meth,r)==="")setCell("Projects",FP.meth,r,"Waterfall");setCell("Projects",FP.lock,r,genProjectId(r));S.autoWsl=S.autoWsl||new Map();const cw=gv("Projects",FP.wsl,r),dw=defaultWsl(r);
    /* only a value this rule wrote itself is re-evaluated — a leader picked by hand is never touched */
    if(S.autoWsl.has(r)&&S.autoWsl.get(r)!==cw)S.autoWsl.delete(r);
    if(cw===""&&dw){setCell("Projects",FP.wsl,r,dw);S.autoWsl.set(r,dw)}else if(S.autoWsl.has(r)&&cw!==dw){setCell("Projects",FP.wsl,r,dw);if(dw)S.autoWsl.set(r,dw);else S.autoWsl.delete(r)}}}
  if(sheet==="Activities"){const id=genTaskId(r);if(id)setCell("Activities",FA.lock,r,id)}
  if(sheet==="Benefits"){if(gv("Benefits",FB.lock,r)==="")setCell("Benefits",FB.lock,r,genBenefitId(r))}
}


/* date boxes: while a date is being TYPED the browser fires "change" after every digit (0002 → 0020 → 2026, month 0 → 03 …).
   Each one used to be saved and re-drew the form, so typing was impossible (dates jumped to 1900 / the old value).
   Now a date box commits once: when it loses focus, or on Enter. Picking from the calendar still saves straight away.
   Dates outside 1950–2100 are refused. */
const DATE_MIN_Y=1950,DATE_MAX_Y=2100;
function dateYearOk(v){if(!v)return true;const y=+String(v).slice(0,4);return y>=DATE_MIN_Y&&y<=DATE_MAX_Y}
document.addEventListener("change",e=>{const el=e.target;if(!el||el.type!=="date"||el._commit)return;
  if(el._typing){e.stopImmediatePropagation();el._pend=true;return}
  if(!dateYearOk(el.value)){e.stopImmediatePropagation();el.value=el.defaultValue||"";toast(`Year must be between ${DATE_MIN_Y} and ${DATE_MAX_Y} — the date was not changed`,5000)}},true);
document.addEventListener("input",e=>{const el=e.target;if(el&&el.type==="date"&&el._typing&&!el._commit){e.stopImmediatePropagation();el._pend=true}},true);
function dateCommit(el){if(!el._pend)return;el._pend=false;
  if(!dateYearOk(el.value)||(el.validity&&el.validity.badInput)){el.value=el.defaultValue||"";toast(`Incomplete date or year outside ${DATE_MIN_Y}–${DATE_MAX_Y} — the date was not changed`,5000);return}
  if(el.value===(el.defaultValue||""))return;el._commit=true;try{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}finally{el._commit=false}if(document.contains(el))el.defaultValue=el.value}
document.addEventListener("focusout",e=>{const el=e.target;if(el&&el.type==="date"){el._typing=false;setTimeout(()=>dateCommit(el),0)}},true);
document.addEventListener("keydown",e=>{const el=e.target;if(!el||el.type!=="date")return;if(e.key==="Enter"){e.preventDefault();el._typing=false;el.blur();return}
  if(/^[0-9]$/.test(e.key)||e.key==="Backspace"||e.key==="Delete"||e.key==="ArrowUp"||e.key==="ArrowDown")el._typing=true},true);
document.addEventListener("focusin",e=>{const el=e.target;if(el&&el.type==="date"&&!el.min){el.min=DATE_MIN_Y+"-01-01";el.max=DATE_MAX_Y+"-12-31"}},true);
