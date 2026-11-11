/* 01c-multisel.js — every filter dropdown can pick several values.
   A filter <select data-v="current value"> is shown as a button + checklist; the picked values are joined with "||" and
   written back into the same <select> (a matching <option> is added) with a normal "change" event, so every page's own
   handler keeps working. Filter code uses mIn(state,value) instead of state===value. */
"use strict";
const MSEP="||";
function mIn(sel,v){if(sel==null||sel==="")return true;return String(sel).split(MSEP).includes(String(v))}
function mList(sel){return sel?String(sel).split(MSEP).filter(Boolean):[]}
/* drop picked values that are no longer offered (e.g. after the BU changed) */
function mKeep(sel,avail){if(!sel)return "";const a=new Set(avail.map(String));return mList(sel).filter(x=>a.has(x)).join(MSEP)}
function mLabel(sel){const l=mList(sel);return l.length>1?`${l[0]} +${l.length-1}`:l[0]||""}
let MS_OPEN=null;
function msEnhance(root){(root||document).querySelectorAll("select[data-v]:not([data-ms])").forEach(sel=>{
  sel.dataset.ms="1";const v=sel.dataset.v||"";
  if(v&&![...sel.options].some(o=>o.value===v)){const o=document.createElement("option");o.value=v;o.textContent=mLabel(v);sel.appendChild(o)}
  sel.value=v;sel.classList.add("msnative");
  const b=document.createElement("button");b.type="button";b.className="msb"+(v?" act":"")+(sel.className?" "+sel.className.replace(/\bmsnative\b/,""):"");b.setAttribute("aria-haspopup","listbox");
  const opts=[...sel.options].filter(o=>o.value!==""&&!o.value.includes(MSEP));const first=sel.options[0]&&sel.options[0].value===""?sel.options[0].textContent:"All";
  const picked=mList(v);const txt=o=>o.textContent.replace(/\s*\(\d+\)\s*$/,"");
  const prefix=(first.match(/^([^:]+):\s*All/)||[])[1];
  b.innerHTML=`<span>${picked.length?(prefix?esc(prefix)+": ":"")+esc(picked.length===1?txt(opts.find(o=>o.value===picked[0])||{textContent:picked[0]}):`${picked.length} selected`):esc(first)}</span>${picked.length>1?`<b>${picked.length}</b>`:""}<i aria-hidden="true">▾</i>`;
  b.title=picked.length?picked.map(p=>txt(opts.find(o=>o.value===p)||{textContent:p})).join(", "):(sel.title||first);
  sel.after(b);b.onclick=e=>{e.stopPropagation();msOpen(sel,b,opts,first)}})}
function msClose(apply){const S_=MS_OPEN;if(!S_)return;MS_OPEN=null;S_.pop.remove();document.removeEventListener("mousedown",S_.out,true);window.removeEventListener("resize",S_.rz);if(apply)S_.apply()}
function msOpen(sel,b,opts,first){if(MS_OPEN){const same=MS_OPEN.sel===sel;msClose(true);if(same)return}
  const cur=new Set(mList(sel.value));const pop=document.createElement("div");pop.className="msp";pop.setAttribute("role","listbox");pop.setAttribute("aria-multiselectable","true");
  const draw=(q="")=>{const ql=q.toLowerCase();pop.querySelector(".msl").innerHTML=opts.filter(o=>!ql||o.textContent.toLowerCase().includes(ql)).map(o=>`<label class="msi"><input type="checkbox" value="${esc(o.value)}" ${cur.has(o.value)?"checked":""}><span>${esc(o.textContent)}</span></label>`).join("")||'<p class="muted" style="margin:6px">No match</p>';
    pop.querySelectorAll(".msl input").forEach(c=>c.onchange=()=>{c.checked?cur.add(c.value):cur.delete(c.value);cnt()})};
  const cnt=()=>{pop.querySelector(".msn").textContent=cur.size?`${cur.size} selected`:first};
  pop.innerHTML=`<div class="msh"><span class="msn"></span><button type="button" class="msall">All</button><button type="button" class="msnone">Clear</button></div>${opts.length>7?'<input type="search" class="mss" placeholder="Search…">':""}<div class="msl"></div><div class="msf"><button type="button" class="btn small" data-x>Cancel</button><button type="button" class="btn small primary" data-ok>Apply</button></div>`;
  document.body.appendChild(pop);draw();cnt();
  const place=()=>{const r=b.getBoundingClientRect(),z=typeof ZF==="function"?ZF():1;pop.style.left=Math.max(8,Math.min(r.left/z,innerWidth/z-pop.offsetWidth-8))+"px";const below=r.bottom/z+4;pop.style.top=(below+pop.offsetHeight>innerHeight/z-8?Math.max(8,r.top/z-pop.offsetHeight-4):below)+"px";pop.style.minWidth=Math.max(220,r.width/z)+"px"};place();
  const apply=()=>{const val=opts.map(o=>o.value).filter(x=>cur.has(x)).join(MSEP);if(val===sel.value)return;if(val&&![...sel.options].some(o=>o.value===val)){const o=document.createElement("option");o.value=val;o.textContent=mLabel(val);sel.appendChild(o)}sel.value=val;sel.dispatchEvent(new Event("input",{bubbles:true}));sel.dispatchEvent(new Event("change",{bubbles:true}))};
  const out=e=>{if(!pop.contains(e.target)&&e.target!==b&&!b.contains(e.target))msClose(true)};const rz=()=>place();
  MS_OPEN={sel,pop,apply,out,rz};setTimeout(()=>document.addEventListener("mousedown",out,true),0);window.addEventListener("resize",rz);
  pop.querySelector(".msall").onclick=()=>{opts.forEach(o=>cur.add(o.value));draw(pop.querySelector(".mss")?pop.querySelector(".mss").value:"");cnt()};
  pop.querySelector(".msnone").onclick=()=>{cur.clear();draw(pop.querySelector(".mss")?pop.querySelector(".mss").value:"");cnt()};
  pop.querySelector("[data-ok]").onclick=()=>msClose(true);pop.querySelector("[data-x]").onclick=()=>msClose(false);
  const s=pop.querySelector(".mss");if(s){s.oninput=()=>draw(s.value);setTimeout(()=>s.focus(),0)}
  pop.addEventListener("keydown",e=>{if(e.key==="Escape")msClose(false);if(e.key==="Enter"){e.preventDefault();msClose(true)}})}
new MutationObserver(()=>{if(document.querySelector("select[data-v]:not([data-ms])"))msEnhance()}).observe(document.documentElement,{childList:true,subtree:true});
