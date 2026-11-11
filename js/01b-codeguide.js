/* 01b-codeguide.js — "How project codes work": structure PROGRAMME-TYPE-BU-CF-### with the live codes from Master_Data */
"use strict";
function codeGuideHtml(o={}){const md=typeof hasMD==="function"&&hasMD();
  const pairs=(v,c)=>{const vs=md?mdList(v):listFromName(v);const cs=md?mdList(c):listFromName(c);return vs.map((x,i)=>[x,cs[i]||codeFor(v,c,x,"?")]).filter(x=>x[0])};
  const ty=pairs("L_Init","L_InitCode"),bu=pairs("L_BU","L_BUCode");let cf=[];try{cf=pairs("L_CF","L_CFCode")}catch(e){}
  const ex=(()=>{const ids=rowsOf("Projects").map(pId).filter(x=>/^(SIMP|2T|CR)-/.test(String(x)));return ids[ids.length-1]||"CR-AUT-AO-OTH-002"})();const exP=String(ex).split("-");
  const seg=(t,l,c)=>`<span class="cgseg" style="--c:${c}"><b>${esc(t)}</b><small>${l}</small></span>`;
  const tbl=(h,rows)=>`<div class="cgt"><b>${h}</b><table>${rows.map(([a,b])=>`<tr><td><code>${esc(b)}</code></td><td>${esc(a)}</td></tr>`).join("")||'<tr><td colspan="2" class="muted">none yet</td></tr>'}</table></div>`;
  return `<div class="cg${o.compact?" compact":""}">
    <div class="cgf">${seg("PROGRAMME","SIMP · 2T · CR","#7C5CFC")}<i>-</i>${seg("TYPE","project type","#2E90FA")}<i>-</i>${seg("BU","business unit","#12B76A")}<i>-</i>${seg("CF","corporate function","#F79009")}<i>-</i>${seg("###","running no.","#6E6893")}</div>
    <p class="cgex">Example <code>${esc(ex)}</code>${exP.length===5?` = ${esc(exP[0])} programme · ${esc((ty.find(x=>x[1]===exP[1])||["type "+exP[1]])[0])} · ${esc((bu.find(x=>x[1]===exP[2])||["BU "+exP[2]])[0])} · ${esc((cf.find(x=>x[1]===exP[3])||["CF "+exP[3]])[0])} · no. ${esc(exP[4])}`:""}</p>
    <ul class="cgr"><li><b>Programme</b> comes from the project's Programme tag: <code>SIMP</code> = Simplification / Deep Dives (default), <code>2T</code> = 2T Club, <code>CR</code> = Complexity Reduction. Filters on every page use this prefix.</li>
      <li><b>Type, BU and CF</b> codes come from ⚙ Settings → Lists (Master_Data). A new BU / CF added there or by Sync old file gets a suggested code you can change.</li>
      <li><b>###</b> counts up per TYPE-BU-CF, shared by all programmes — so <code>SSC-048</code> never means two projects.</li>
      <li>The code is made when the project gets its name and is <b>fixed once saved</b>. Changing a code in the lists only affects new projects.</li></ul>
    ${o.compact?"":`<div class="cggrid">${tbl("Programme",[["Simplification / Deep Dive","SIMP"],["2T Club","2T"],["Complexity Reduction","CR"]])}${tbl("Type",ty)}${tbl("BU",bu)}${tbl("CF",cf)}</div>`}</div>`}
function openCodeGuide(){choose("How project codes work",codeGuideHtml(),[["ok","Close","primary"]])}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-codeguide]");if(!b)return;e.preventDefault();e.stopPropagation();openCodeGuide()},true);
const CG_BTN=`<button type="button" class="cgbtn" data-codeguide title="How project codes work">ⓘ code guide</button>`;
