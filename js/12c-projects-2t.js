/* 12c-projects-2t.js — "Old view": the project table laid out like the 2T Club Project_Data sheet.
   Every 2T column is filled from the tracker (tasks, benefits, RAIDD); cells are edited in place and written back
   to the same fields the rest of the app uses. Tracker-only fields sit in an extra group on the right. */
"use strict";
const T2_TAGS=["2T","Deep Dive","Simplification"];
function t2Ben(r){return typeof benefitRowOf==="function"?benefitRowOf(pId(r)):null}
function t2Basis(br){const s=br!=null?String(gv("Benefits",FB.basis,br)||""):"";const m=/^As-is (.*?) → To-be (.*?)(?: \(saving (.*?)\))?\.?(?:\s*\|\s*([\s\S]*))?$/.exec(s);
  return m?{a:m[1]==="?"?"":m[1],b:m[2]==="?"?"":m[2],s:m[3]||"",rest:m[4]||""}:{a:"",b:"",s:"",rest:s}}
function t2Apps(r){return String(gv("Projects","AF",r)||"").split(/\s*\/\s*|\s*,\s*/).map(x=>x.trim()).filter(Boolean)}
/* current phase = first stage (in stage order) that still has unfinished tasks */
function t2Phase(r){const st=stagesOf(r);const ts=tasksOfProject(pId(r));if(!ts.length)return {names:st.names,idx:-1,done:false,none:true};
  const act=t=>+gv("Activities",FA.act,t)||0;const used=st.names.filter(n=>ts.some(t=>gv("Activities",FA.stage,t)===n));
  const i=used.findIndex(n=>ts.some(t=>gv("Activities",FA.stage,t)===n&&act(t)<1));
  return {names:st.names,idx:i<0?st.names.indexOf(used[used.length-1]):st.names.indexOf(used[i]),done:i<0,none:false}}
function t2SetPhase(r,name){const st=stagesOf(r);const k=st.names.indexOf(name);if(k<0)return false;let ch=false;
  for(const t of tasksOfProject(pId(r))){const si=st.names.indexOf(gv("Activities",FA.stage,t));const a=+gv("Activities",FA.act,t)||0;
    const v=si<k?1:si>k?0:(a>=1?0.5:a);if(Math.abs(v-a)>0.0005){setCell("Activities",FA.act,t,v);ch=true}}return ch}
function t2Cols(){const ro=typeof canEdit==="function"&&!canEdit();const dis=ro?" disabled":"";
  const inp=(r,c,v,cls="")=>`<input class="t2i ${cls}" data-t2="${r}" data-c="${c}" value="${esc(v)}"${dis}>`;
  const ta=(r,c,v)=>`<textarea class="t2t" data-t2="${r}" data-c="${c}" rows="2"${dis}>${esc(v)}</textarea>`;
  const sl=(r,attr,opts,v,blank)=>{const o=uniqOrder([...(v&&!opts.includes(v)?[v]:[]),...opts]);return `<select class="t2s" data-t2="${r}" ${attr}${dis}>${blank!=null?`<option value="">${esc(blank)}</option>`:""}${o.map(x=>`<option ${String(x)===String(v)?"selected":""}>${esc(x)}</option>`).join("")}</select>`};
  const k=(r,key,v,type="text",extra="")=>`<input class="t2i" data-t2="${r}" data-k="${key}" type="${type}" value="${esc(v)}" ${extra}${dis}>`;
  const kta=(r,key,v)=>`<textarea class="t2t" data-t2="${r}" data-k="${key}" rows="2"${dis}>${esc(v)}</textarea>`;
  const n=v=>+v||0;const rate=()=>+setting("S_Rate")||0;
  const bhrs=br=>br!=null?n(gv("Benefits",FB.trh,br)):0;
  return [
  {g:"p",h:"Project ID",w:120,cls:"t2id",f:r=>`<a href="#" data-t2op="${r}" title="Open the project details"><b>${esc(pId(r)||"(new)")}</b></a>${gv("Projects","Z",r)!==""?`<small>2T #${esc(gv("Projects","Z",r))}</small>`:""}`},
  {g:"p",h:"Project Name",w:240,cls:"t2nm",f:r=>ta(r,FP.name,gv("Projects",FP.name,r))},
  {g:"p",h:"Objective",w:240,f:r=>ta(r,"AD",gv("Projects","AD",r))},
  {g:"p",h:"Category",tip:"Project type (Initiative)",w:140,f:r=>sl(r,`data-c="${FP.init}"`,listFromName("L_Init").map(String),gv("Projects",FP.init,r))},
  {g:"p",h:"Process",tip:"Process area",w:120,f:r=>sl(r,`data-c="${FP.proc}"`,orgProc(gv("Projects",FP.bu,r),gv("Projects",FP.cf,r)).map(String),gv("Projects",FP.proc,r),"—")},
  {g:"p",h:"Division",tip:"Corporate Function (CF)",w:120,f:r=>sl(r,`data-c="${FP.cf}"`,orgCF(gv("Projects",FP.bu,r)).map(String),gv("Projects",FP.cf,r),"—")},
  {g:"p",h:"Function",tip:"Division / team",w:130,f:r=>`<input class="t2i" list="quTeams" data-t2="${r}" data-c="AB" value="${esc(gv("Projects","AB",r))}"${dis}>`},
  ...[0,1,2].map(i=>({g:"p",h:"App "+(i+1),tip:"Technology / tools",w:110,f:r=>k(r,"app"+i,t2Apps(r)[i]||"","text",i===2&&t2Apps(r).length>3?`title="Also: ${esc(t2Apps(r).slice(3).join(", "))}"`:"")})),
  {g:"p",h:"Project Lead",w:110,f:r=>`<input class="t2i" list="quPeople" data-t2="${r}" data-c="${FP.lead}" value="${esc(gv("Projects",FP.lead,r))}"${dis}>`},
  {g:"p",h:"Member Project",tip:"Project team (Dev / BA)",w:120,f:r=>inp(r,"AG",gv("Projects","AG",r))},
  {g:"s",h:"Phase",tip:"Current stage — from the tasks. Picking a stage sets earlier stages 100 % done, later stages 0 %.",w:170,f:r=>{const P=t2Phase(r);
    if(P.none)return sl(r,`data-k="lph"`,QU_PH,gv("Projects","AJ",r),"—")+`<small class="t2hint">no tasks — legacy phase</small>`;
    return `<select class="t2s t2ph${P.done?" ok":""}" data-t2="${r}" data-k="ph"${dis}>${P.names.map((x,i)=>`<option ${i===P.idx?"selected":""}>${String.fromCharCode(65+i)} = ${esc(x)}</option>`).join("")}</select>${P.done?`<small class="t2hint ok">✓ all stages done</small>`:""}`}},
  {g:"s",h:"Time Line (Finish)",tip:"Target quarter",w:96,f:r=>sl(r,`data-c="AI"`,["Q1","Q2","Q3","Q4"],gv("Projects","AI",r),"—")},
  {g:"s",h:"Start Date",w:132,f:r=>k(r,"ps",isoFromSerial(gv("Projects",FP.ps,r)),"date",'min="2000-01-01" max="2100-12-31"')},
  {g:"s",h:"End Date",w:132,f:r=>k(r,"pe",isoFromSerial(gv("Projects",FP.pe,r)),"date",'min="2000-01-01" max="2100-12-31"')},
  {g:"s",h:"Days",w:56,cls:"num",f:r=>{const a=n(gv("Projects",FP.ps,r)),b=n(gv("Projects",FP.pe,r));return a&&b?`<span class="t2ro">${b-a}</span>`:""}},
  {g:"s",h:"Plan %",tip:"Planned % complete by today",w:64,cls:"num",f:r=>{const p=quPlanned(r);return p===""?"":`<span class="t2ro">${Math.round(p*100)}%</span>`}},
  {g:"s",h:"Progress",w:120,f:r=>{const pc=Math.round((pLive(r).comp||0)*100),p=quPlanned(r),bh=p!==""&&pc+0.5<p*100;return `<div class="t2pg${bh?" bad":""}">${k(r,"prog",pc,"number",'min="0" max="100" step="5"')}<span>%</span></div><span class="t2bar"><b style="width:${Math.min(100,pc)}%"></b>${p!==""?`<i style="left:${Math.min(100,p*100)}%"></i>`:""}</span>`}},
  {g:"s",h:"Project Status",tip:"Calculated from the tasks; pick On-Hold / Cancelled to override",w:150,f:r=>{const ov=gv("Projects",FP.ovr,r);return `${pill(pStat(r))}<select class="t2s t2ov" data-t2="${r}" data-k="ovr"${dis}><option value="">${ov?"Auto (calculated)":"Auto"}</option>${listFromName("L_POvr").map(x=>`<option ${x===ov?"selected":""}>${esc(x)}</option>`).join("")}</select>`}},
  {g:"u",h:"Done",tip:"Last update — done",w:220,f:r=>ta(r,"AK",gv("Projects","AK",r))},
  {g:"u",h:"Will do",tip:"Next steps",w:220,f:r=>ta(r,"AL",gv("Projects","AL",r))},
  {g:"u",h:"Issue",tip:"Issues / blockers — log them in RAIDD",w:220,f:r=>ta(r,"AM",gv("Projects","AM",r))+`<div class="t2rd">${raiddBtn(pId(r))}</div>`},
  {g:"b",h:"Frequency",tip:"Task frequency (time-saving benefit line)",w:120,f:r=>{const br=t2Ben(r);return k(r,"bfreq",br!=null?gv("Benefits","N",br):"")}},
  {g:"b",h:"Usage Time As is",w:120,f:r=>k(r,"ba",t2Basis(t2Ben(r)).a)},
  {g:"b",h:"Usage Time To be",w:120,f:r=>k(r,"bb",t2Basis(t2Ben(r)).b)},
  {g:"b",h:"Saving time",w:130,f:r=>k(r,"bs",t2Basis(t2Ben(r)).s)},
  {g:"b",h:"Saving Hours",tip:"Hours / month on the time-saving benefit line",w:84,cls:"num",f:r=>{const br=t2Ben(r);return k(r,"bh",br!=null&&gv("Benefits",FB.trh,br)!==""?gv("Benefits",FB.trh,br):"","number",'min="0" step="0.5"')}},
  {g:"b",h:"Est. Cost saving",tip:"THB / month = saving hours × hourly rate",w:96,cls:"num",f:r=>{const br=t2Ben(r);const h=bhrs(br);if(!h)return "";const rt=br!=null&&gv("Benefits",FB.rate,br)!==""?n(gv("Benefits",FB.rate,br)):rate();return `<span class="t2ro" title="${h} h × ${rt} THB/h">${fmtNum(h*rt)}</span>`}},
  {g:"b",h:"Saving FTE/month",tip:"Saving hours ÷ 176",w:76,cls:"num",f:r=>{const h=bhrs(t2Ben(r));return h?`<span class="t2ro">${(h/176).toFixed(2)}</span>`:""}},
  {g:"b",h:"Priority",w:96,f:r=>sl(r,`data-c="${FP.prio}"`,listFromName("L_Priority").map(String),gv("Projects",FP.prio,r),"—")},
  {g:"b",h:"Requester",tip:"Requester / business owner",w:150,f:r=>inp(r,"AH",gv("Projects","AH",r))},
  {g:"b",h:"Remark",w:200,f:r=>ta(r,"M",gv("Projects","M",r))},
  /* tracker-only detail, kept next to the 2T columns */
  {g:"x",h:"Programme",w:120,f:r=>sl(r,`data-c="AE"`,T2_TAGS,gv("Projects","AE",r),"—")},
  {g:"x",h:"BU",w:90,f:r=>`<span class="t2ro">${esc(gv("Projects",FP.bu,r)||"—")}</span>`},
  {g:"x",h:"WS leader",w:110,f:r=>`<input class="t2i" list="quPeople" data-t2="${r}" data-c="${FP.wsl}" value="${esc(gv("Projects",FP.wsl,r))}"${dis}>`},
  {g:"x",h:"Forecast end",w:110,f:r=>{const L=pLive(r);return L.fend?`<span class="t2ro${L.slip>0?" bad":""}">${fmtDate(L.fend)}${L.slip>0?` <em>+${L.slip}d</em>`:""}</span>`:""}},
  {g:"x",h:"Tasks",w:96,f:r=>{const L=pLive(r);return L.ntask?`<span class="t2ro">${L.ntask}${L.ndel?` · <b class="bad">${L.ndel} late</b>`:""}${L.nrisk?` · ${L.nrisk} risk`:""}</span>`:'<span class="muted">—</span>'}},
  {g:"x",h:"RAIDD",w:140,f:r=>raiddCell(pId(r))},
  {g:"x",h:"Value (THB/yr)",tip:"Recurring gross annual, from all benefit lines",w:110,cls:"num",f:r=>{const v=n(gv("Projects","I",r));return v?`<span class="t2ro">${fmtNum(v)}</span>`:""}},
  {g:"x",h:"Realised (THB)",tip:"Actual realised to date",w:104,cls:"num",f:r=>{const v=n(gv("Projects","AS",r));return v?`<span class="t2ro">${fmtNum(v)}</span>`:""}},
  {g:"x",h:"E2E flow",w:170,f:r=>e2eChip(pId(r),true)},
  {g:"x",h:"Updated",w:92,f:r=>{const d=n(gv("Projects","AN",r));return d?`<span class="t2ro">${fmtDate(d)}</span>`:""}}]}
const T2G={p:["Project","#7C5CFC"],s:["Schedule & status","#2E90FA"],u:["Update","#12B76A"],b:["Benefit","#F79009"],x:["Tracker detail (not in 2T file)","#6E6893"]};
function t2RowHtml(r,C){const F=UI.qu;return `<tr data-t2row="${r}" class="${F.edited.has(r)?"changed":""}">${C.map((c,i)=>`<td class="g-${c.g} ${c.cls||""}${i<2?" fz fz"+i:""}">${c.f(r)}</td>`).join("")}</tr>`}
function v2T(m){const F=UI.qu;F.simple=true;liveCalc();const {rows}=quRows();const re=()=>{const y=scrollY;v2T(m);window.scrollTo(0,y)};
  const showX=UI.t2x!==false;const C=t2Cols().filter(c=>showX||c.g!=="x");
  const groups=[];C.forEach(c=>{const g=groups[groups.length-1];if(g&&g.g===c.g)g.n++;else groups.push({g:c.g,n:1})});
  m.innerHTML=projHead(true)+quFilterBar()+`
  <div class="card t2card"><div class="t2top"><div><b>Project data</b><span class="muted">Same columns as the 2T Club <i>Project_Data</i> sheet — edit any cell, it saves into the tracker. Hover a header for where it comes from.</span></div><span class="sp"></span>
    <label class="gx-chk"><input type="checkbox" id="t2x" ${showX?"checked":""}> Show tracker detail</label><span class="t2cnt">${rows.length} project(s)</span></div>
  <div class="t2wrap"><table class="t2"><colgroup>${C.map(c=>`<col style="width:${c.w}px">`).join("")}</colgroup>
    <thead><tr class="t2g">${groups.map((g,i)=>`<th colspan="${g.n}" style="--gc:${T2G[g.g][1]}">${T2G[g.g][0]}</th>`).join("")}</tr>
    <tr class="t2hr">${C.map((c,i)=>`<th class="g-${c.g}${i<2?" fz fz"+i:""}" style="--gc:${T2G[c.g][1]}" ${c.tip?`title="${esc(c.tip)}"`:""}>${esc(c.h)}${c.tip?' <span class="t2q">ⓘ</span>':""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>t2RowHtml(r,C)).join("")||`<tr><td colspan="${C.length}" class="muted" style="padding:18px">No projects match the filters</td></tr>`}</tbody></table></div></div>
  <datalist id="quTeams">${uniq(_rowsOf0Safe("Projects").map(r=>String(gv("Projects","AB",r)||"").trim()).filter(Boolean)).sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="quPeople">${uniq([...listFromName("L_Leader"),..._rowsOf0Safe("Projects").flatMap(x=>[gv("Projects",FP.lead,x),gv("Projects",FP.wsl,x)])].filter(Boolean)).sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist>`;
  quFilterBind(m,re);bindPview(m);const nb=$("#quNew");if(nb)nb.onclick=newProject;
  $("#t2x").onchange=e=>{UI.t2x=e.target.checked;re()};
  const fz=()=>{const a=m.querySelector("td.fz0,th.fz0");if(a)m.querySelector(".t2wrap").style.setProperty("--fz1",a.offsetWidth+"px")};fz();
  m.querySelectorAll("tr[data-t2row]").forEach(tr=>t2Bind(m,tr,C));
  m.querySelectorAll("textarea.t2t").forEach(t2Grow)}
function t2Grow(t){t.style.height="auto";t.style.height=Math.min(140,Math.max(34,t.scrollHeight+2))+"px"}
function t2Bind(m,tr,C){
  const commit=async el=>{if(el._busy)return;el._busy=true;const r=+el.dataset.t2,c=el.dataset.c,k=el.dataset.k;let v=el.value;let ok=false;
    try{
      if(c){if(el.tagName!=="SELECT")v=String(v).trim();if(c===FP.name&&!v){toast("Project name can't be empty",4000);el.value=gv("Projects",c,r);el._busy=false;return}
        if(String(gv("Projects",c,r))!==String(v)){setCell("Projects",c,r,v);if([FP.init,FP.cf,FP.proc,FP.name,"AE"].includes(c))refreshNewId("Projects",r);if(c===FP.cf){/* process list depends on CF */const pr=orgProc(gv("Projects",FP.bu,r),v).map(String);if(gv("Projects",FP.proc,r)&&pr.length&&!pr.includes(String(gv("Projects",FP.proc,r))))setCell("Projects",FP.proc,r,"")}ok=true}}
      else if(["prog","ps","pe","ovr"].includes(k))ok=await quSet(r,k,v,el);
      else if(k==="lph"){if(String(gv("Projects","AJ",r))!==v){setCell("Projects","AJ",r,v);ok=true}}
      else if(k==="ph"){ok=t2SetPhase(r,v.replace(/^[A-Z] = /,""));if(ok)toast("Phase set — earlier stages 100 %, later stages 0 %. Fine-tune in the project's tasks.",4500)}
      else if(/^app\d$/.test(k)){const a=t2Apps(r);while(a.length<3)a.push("");a[+k.slice(3)]=v.trim();const s=a.filter(Boolean).join(" / ");if(s!==String(gv("Projects","AF",r))){setCell("Projects","AF",r,s);ok=true}}
      else if(["bfreq","ba","bb","bs","bh"].includes(k)){let br=t2Ben(r);v=String(v).trim();
        const cur=k==="bfreq"?(br!=null?String(gv("Benefits","N",br)):""):k==="bh"?(br!=null?String(gv("Benefits",FB.trh,br)):""):t2Basis(br)[k.slice(1)];
        if(String(cur)!==v){if(br==null){if(!v){el._busy=false;return}br=addBenefit(r);if(br==null){el._busy=false;return}setCell("Benefits",FB.desc,br,"Time saving — "+gv("Projects",FP.name,r))}
          if(k==="bfreq")setCell("Benefits","N",br,v);
          else if(k==="bh"){const h=v===""?"":Math.max(0,+v);if(v!==""&&isNaN(h)){toast("Saving hours must be a number",4000);el._busy=false;return}setCell("Benefits",FB.trh,br,h)}
          else{const B=t2Basis(br);B[k.slice(1)]=v;const txt=B.a||B.b||B.s?`As-is ${B.a||"?"} → To-be ${B.b||"?"}${B.s?` (saving ${B.s})`:""}.`+(B.rest?" | "+B.rest:""):B.rest;setCell("Benefits",FB.basis,br,txt)}ok=true}}
      if(ok&&!["prog","ps","pe","ovr"].includes(k))quStamp(r)}catch(e){toast(e.message,6000)}
    el._busy=false;if(!ok)return;UI.qu.edited.add(r);liveCalc();const rr=m.querySelector(`tr[data-t2row="${r}"]`);if(rr){const t=document.createElement("tbody");t.innerHTML=t2RowHtml(r,C);const nr=t.firstElementChild;rr.replaceWith(nr);t2Bind(m,nr,C);nr.querySelectorAll("textarea.t2t").forEach(t2Grow);nr.classList.add("t2flash")}
    const qc=$("#quCount");if(qc)qc.textContent=quCountText();renderTabs()};
  tr.querySelectorAll("[data-t2]").forEach(el=>{if(el.tagName==="SELECT"){el.onchange=()=>commit(el);return}
    el.onchange=()=>commit(el);el.onkeydown=e=>{if(e.key==="Enter"&&(el.tagName==="INPUT"||e.ctrlKey)){e.preventDefault();el.blur()}if(e.key==="Escape"){el.value=el.defaultValue;el.blur()}};if(el.tagName==="TEXTAREA")el.oninput=()=>t2Grow(el)});
  tr.querySelectorAll("[data-t2op]").forEach(a=>a.onclick=e=>{e.preventDefault();openProject(+a.dataset.t2op)});
  tr.querySelectorAll("[data-op]").forEach(a=>a.onclick=e=>{e.preventDefault();openProject(+a.dataset.op)})}
