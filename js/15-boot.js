/* 15-boot.js — wire up buttons and first render */
"use strict";
/* ---------------- wire up ---------------- */
$("#btnOpen").onclick=openFile;$("#btnSave").onclick=()=>save(false);$("#btnCopy").onclick=()=>save(true);
$("#btnSet").onclick=()=>{if(!S.zip){toast("Open the workbook first");return}view="Settings";UI.rulesBase=null;render();window.scrollTo(0,0)};
$("#btnHelp").onclick=()=>$("#help").classList.add("on");$("#helpClose").onclick=()=>$("#help").classList.remove("on");
if(!("DecompressionStream" in window)){document.body.insertAdjacentHTML("afterbegin",`<div class="warnbox" style="margin:10px">This browser is too old for this app. Please use a current Microsoft Edge or Google Chrome.</div>`)}
(()=>{const sel=$("#tzSel");const list=TZ_LIST.includes(TZ)?TZ_LIST:[TZ,...TZ_LIST];sel.innerHTML=list.map(z=>`<option${z===TZ?" selected":""}>${z}</option>`).join("");sel.onchange=()=>setTZ(sel.value);paintClock()})();
render();envCheck();$("#connChip").onclick=connMenu;paintConn();(async()=>{if(!(await bootSpConnect()))await bootConnect()})();
