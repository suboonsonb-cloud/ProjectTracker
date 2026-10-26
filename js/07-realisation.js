/* 07-realisation.js — ✓ Actuals view (realisation) */
"use strict";
/* ---- realisation ---- */
function planRowFor(bid){const pc=S.sheets.Plan_Calc;for(let r=6;r<=CFG.Benefits.last;r++){if(gv("Plan_Calc","B",r)===bid)return r}return null}
function vReal(m){if(view==="Realisation"){view="Projects";UI.pview="real";UI.proj=null;renderTabs()}
  const B=rowsOf("Benefits");const q=(UI.q.Real||"").toLowerCase();const RF=UI.realF=UI.realF||{bu:"",cf:"",p:""};
  const pv_=(pid,c)=>{const pr=projRowById(pid);return pr?(gv("Projects",c,pr)||"(blank)"):"(no project)"};const pname=pid=>{const pr=projRowById(pid);return pr?gv("Projects",FP.name,pr):""};
  const bus=uniq(B.map(r=>pv_(gv("Benefits",FB.pid,r),FP.bu)));if(RF.bu&&!bus.includes(RF.bu))RF.bu="";
  const B1=B.filter(r=>!RF.bu||pv_(gv("Benefits",FB.pid,r),FP.bu)===RF.bu);const cfs=uniq(B1.map(r=>pv_(gv("Benefits",FB.pid,r),FP.cf)));if(RF.cf&&!cfs.includes(RF.cf))RF.cf="";
  const B2=B1.filter(r=>!RF.cf||pv_(gv("Benefits",FB.pid,r),FP.cf)===RF.cf);const pids=uniq(B2.map(r=>gv("Benefits",FB.pid,r)));const pq=(RF.p||"").toLowerCase();
  const B3=B2.filter(r=>{const pid=gv("Benefits",FB.pid,r);return !pq||(pid+" "+pname(pid)).toLowerCase().includes(pq)});
  const list=B3.filter(r=>!q||(bId(r)+" "+gv("Benefits",FB.desc,r)+" "+gv("Benefits",FB.pid,r)).toLowerCase().includes(q));
  const nRF=[RF.bu,RF.cf,RF.p,q].filter(Boolean).length;
  const cur=UI.realSel&&list.includes(UI.realSel)?UI.realSel:list[0];UI.realSel=cur;
  const months=realMonths();
  let right=`<p class="muted">Select a benefit line.</p>`;
  if(cur){
    const bid=bId(cur);let rr=rowsOf("Realisation").find(x=>gv("Realisation",FR.bid,x)===bid);
    const pr=planRowFor(bid);const pcCols=[];for(let j=0;j<36;j++)pcCols.push(colLet(colIdx("M")+j));
    const _ser=benefitSeries().list.find(x=>x.id===bid);const planOf=j=>_ser?(_ser.plan[j]||0):(pr?(+gv("Plan_Calc",pcCols[j],pr)||0):0);
    const nature=gv("Benefits",FB.nature,cur)||"Recurring";
    const sumA=rr?months.reduce((a,mm)=>a+(+gv("Realisation",mm.col,rr)||0),0):0;
    right=`<div class="card pad"><h2>${esc(bid)} · ${esc(gv("Benefits",FB.desc,cur))}</h2>
      <p class="muted" style="margin-top:-4px">${esc(gv("Benefits",FB.pid,cur))} · ${esc(nature)} · start ${fmtDate(gv("Benefits",FB.start,cur))||"not set"} · actual total ${fmtNum(sumA)} THB</p>
      ${!gv("Benefits",FB.start,cur)&&gv("Benefits",FB.phase,cur)!=="Custom"?`<div class="note" style="margin-bottom:10px">◷ No Realisation Start Month — the plan uses the standard start (month after the project's forecast end). Change it in Projects ▸ project ▸ Business benefit plan.</div>`:""}
      ${trackGrid(cur,bid,months,_ser||{plan:months.map((mm,j)=>planOf(j))})}${projRowById(gv("Benefits",FB.pid,cur))?`<p style="margin:10px 0 0"><button class="btn small" id="rOpenP">Open the project's benefit plan ›</button></p>`:""}</div>`;
  }
  m.innerHTML=`${hubHead("real")}
   <div class="filterbar card dfilt rfilt"><b>Filter</b>
    <label>BU <select id="rfBU"><option value="">All</option>${bus.map(b=>`<option ${b===RF.bu?"selected":""}>${esc(b)}</option>`).join("")}</select></label>
    <label>CF <select id="rfCF"><option value="">All${RF.bu?" in "+esc(RF.bu):""}</option>${cfs.map(b=>`<option ${b===RF.cf?"selected":""}>${esc(b)}</option>`).join("")}</select></label>
    <label>Project <span style="width:320px;display:inline-block">${comboHtml("rfP",RF.p||"",[{v:"",t:`All projects${RF.cf?" in "+esc(RF.cf):RF.bu?" in "+esc(RF.bu):""} (${pids.length})`},...pids.map(pid=>({v:pid,t:pid+" — "+pname(pid)}))],{strict:false})}</span></label>
    ${nRF?`<button class="btn small" id="rfClr">✕ Clear filters (${nRF})</button>`:""}<span class="muted" style="margin-left:auto">${list.length} of ${B.length} benefit lines</span></div>
   <div class="split"><div class="card"><div class="pad" style="padding-bottom:8px"><input type="search" id="rq" placeholder="Search benefit ID / description…" value="${esc(UI.q.Real||"")}" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:7px 10px"></div>
    <div class="list">${list.map(r=>`<div class="it ${r===cur?"on":""}" data-r="${r}"><div class="t">${esc(bId(r))} · ${esc(gv("Benefits",FB.desc,r))}</div><div class="s">${esc(gv("Benefits",FB.pid,r))} · ${esc(pname(gv("Benefits",FB.pid,r)).slice(0,40))} · ${esc(gv("Benefits",FB.nature,r)||"Recurring")}</div></div>`).join("")||`<div class="pad muted">No benefits</div>`}</div></div><div>${right}</div></div>`;
  $("#rq").oninput=e=>{UI.q.Real=e.target.value;const p=e.target.selectionStart;vReal(m);const i=$("#rq");i.focus();i.setSelectionRange(p,p)};
  m.querySelectorAll(".it[data-r]").forEach(d=>d.onclick=()=>{UI.realSel=+d.dataset.r;vReal(m)});
  $("#rfBU").onchange=e=>{RF.bu=e.target.value;RF.cf="";RF.p="";UI.realSel=null;vReal(m)};$("#rfCF").onchange=e=>{RF.cf=e.target.value;RF.p="";UI.realSel=null;vReal(m)};
  $("#rfP").addEventListener("change",e=>{RF.p=e.target.value.trim();UI.realSel=null;vReal(m)});if($("#rfClr"))$("#rfClr").onclick=()=>{RF.bu=RF.cf=RF.p="";UI.q.Real="";UI.realSel=null;vReal(m)};
  if($("#delReal"))$("#delReal").onclick=()=>{const rr=rowsOf("Realisation").find(x=>gv("Realisation",FR.bid,x)===bId(cur));if(rr)askDelete("Realisation",rr)};
  if($("#mkReal"))$("#mkReal").onclick=()=>{const r=firstFree("Realisation");if(!r){toast("Realisation table is full — insert rows in Excel",5000);return}setCell("Realisation",FR.bid,r,bId(cur));vReal(m);renderTabs()};
  bindPview(m);m.querySelectorAll(".it[data-r]").forEach(d=>d.ondblclick=()=>{const pr=projRowById(gv("Benefits",FB.pid,+d.dataset.r));if(pr){openProject(pr);setTimeout(()=>{const b=document.getElementById("wsBen");if(b)b.scrollIntoView({block:"start"})},50)}});
  bindTrack(m,()=>{const y=scrollY;const k=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.k:"";vReal(m);window.scrollTo(0,y);if(k){const n=m.querySelector(`[data-k="${CSS.escape(k)}"]`);if(n){n.focus();if(n.select)n.select()}}});if($("#rOpenP"))$("#rOpenP").onclick=()=>{const pr=projRowById(gv("Benefits",FB.pid,cur));openProject(pr);setTimeout(()=>{const b=document.getElementById("wsBen");if(b)b.scrollIntoView({block:"start"})},50)};
  m.querySelectorAll(".rcell input").forEach(inp=>inp.onchange=()=>{const bid=bId(cur);const rr=rowsOf("Realisation").find(x=>gv("Realisation",FR.bid,x)===bid);
    const v=inp.value===""?"":+inp.value;if(String(v)===String(gv("Realisation",inp.dataset.c,rr)))return;setCell("Realisation",inp.dataset.c,rr,v);renderTabs()});
}

