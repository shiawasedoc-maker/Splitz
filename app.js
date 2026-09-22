"use strict";
/* ============ constants ============ */
const CATS = {
  stay:  {icon:'🏨', label:'ค่าที่พัก', short:'ที่พัก', ph:'เช่น โรงแรมคืนแรก'},
  travel:{icon:'🚗', label:'ค่าเดินทาง', short:'เดินทาง', ph:'เช่น แท็กซี่ไปสนามบิน'},
  food:  {icon:'🍜', label:'ค่าอาหาร', short:'อาหาร', ph:'เช่น ราเมนมื้อเย็น'},
  ticket:{icon:'🎟️', label:'ค่าเข้าที่เที่ยว', short:'ที่เที่ยว', ph:'เช่น บัตรเข้าพิพิธภัณฑ์'},
  other: {icon:'📦', label:'ค่าอื่นๆ', short:'อื่นๆ', ph:'เช่น ซิมการ์ด'}
};
const CAT_ORDER = ['stay','travel','food','ticket','other'];
const CURRENCIES = [
  ['THB','฿',2,'บาท'],['JPY','¥',0,'เยน'],['KRW','₩',0,'วอน'],['USD','$',2,'ดอลลาร์สหรัฐ'],
  ['EUR','€',2,'ยูโร'],['GBP','£',2,'ปอนด์'],['CNY','CN¥',2,'หยวน'],['TWD','NT$',0,'ดอลลาร์ไต้หวัน'],
  ['HKD','HK$',2,'ดอลลาร์ฮ่องกง'],['SGD','S$',2,'ดอลลาร์สิงคโปร์'],['MYR','RM',2,'ริงกิต'],['VND','₫',0,'ด่ง'],
  ['LAK','₭',0,'กีบ'],['IDR','Rp',0,'รูเปียห์'],['PHP','₱',2,'เปโซ'],['AUD','A$',2,'ดอลลาร์ออสเตรเลีย']
];
const PALETTE = ['#F2862E','#3B7DF0','#9B5DE5','#E0529C','#1FA58C','#E1A70B','#5B6B8C','#B8693A','#44AEE3','#78AB2E','#EF6A55','#34507F'];
const ANIMALS = ['🐻','🐱','🦊','🐼','🐸','🐯','🐧','🦁','🐨','🐵','🐷','🐰','🐶','🐮','🐙','🦄','🐳','🐢','🦉','🐝','🦒','🐹'];
const MAX_MEMBERS = 12;
const LEGACY_LS_KEY = 'tripsplit.v1';   // older versions kept data in localStorage; migrated once into IndexedDB, then removed
// Export libraries are bundled with the app (same origin, cached for offline). Nothing is loaded from a CDN.
const LIB = { h2c:'./vendor/html2canvas.min.js', pdf:'./vendor/jspdf.umd.min.js', xlsx:'./vendor/xlsx.full.min.js' };

/* ============ helpers ============ */
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const sum = arr => arr.reduce((a,b)=>a+b,0);
const cur = code => CURRENCIES.find(c=>c[0]===code) || CURRENCIES[0];
const isDark = () => { const t=document.documentElement.dataset.theme; return t ? t==='dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
function hexRgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function tint(h,a){ const [r,g,b]=hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(h,target,amt){ const a=hexRgb(h), b=hexRgb(target); return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*amt).toString(16).padStart(2,'0')).join(''); }
function lum(h){ const [r,g,b]=hexRgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*r+.7152*g+.0722*b; }
const inkOn = h => lum(h) > .42 ? '#172031' : '#FFFFFF';
const deep = h => isDark() ? mix(h,'#FFFFFF',.25) : mix(h,'#000000',.28);
const tintA = () => isDark() ? .30 : .20;
const mvars = m => `--c:${m.color};--tint:${tint(m.color,tintA())};--cd:${deep(m.color)};--ci:${inkOn(m.color)}`;
const face = (m, cls='') => `<span class="face ${cls}" style="${mvars(m)}" aria-hidden="true">${m.emoji}</span>`;

/* money: stored in minor units (satang/cents). Equal splits are kept exact
   (e.g. 100/3) and only rounded when shown. */
function fmt(minor, code, opt={}){
  const [,sym,dec] = cur(code);
  let v = Math.round(minor);
  const neg = v < 0; v = Math.abs(v);
  const hasFrac = dec > 0 && v % (10**dec) !== 0;
  const s = (v / 10**dec).toLocaleString('en-US',{minimumFractionDigits:hasFrac?dec:0, maximumFractionDigits:dec});
  return (neg?'-':'') + (opt.noSym?'':sym) + s;
}
function parseAmt(str, code){
  const dec = cur(code)[2];
  const s = String(str ?? '').replace(/[,\s]/g,'');
  if (!s || s==='.' || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 10**dec) : null;
}
function toInput(minor, code){ if (minor == null) return ''; const dec=cur(code)[2]; return String(Number((minor/10**dec).toFixed(dec))); }
function splitInt(total, ids){ const out={}, n=ids.length; if(!n) return out; const base=Math.floor(total/n), r=total-base*n; ids.forEach((id,i)=>{ out[id]=base+(i>=n-r?1:0); }); return out; }
const isZero = v => Math.abs(v) < 0.5;
const pad = n => String(n).padStart(2,'0');
function toLocalInput(ms){ const d=new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function shortDate(ms){ const d=new Date(ms); return `${d.getDate()} ${TH_MON[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dayDate(ms){ const d=new Date(ms); return `${d.getDate()} ${TH_MON[d.getMonth()]} ${d.getFullYear()+543}`; }
function rel(ms){ const s=(Date.now()-ms)/1000; if(s<60) return 'เมื่อสักครู่'; if(s<3600) return `${Math.floor(s/60)} นาทีที่แล้ว`; if(s<86400) return `${Math.floor(s/3600)} ชม. ที่แล้ว`; if(s<604800) return `${Math.floor(s/86400)} วันที่แล้ว`; return dayDate(ms); }
const ICON = {
  back:'<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  close:'<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>'
};

/* ============ state & storage (this device only) ============ */
const state = { trips:[], lastTripId:null, view:'home', tripId:null, tab:'table', q:'', filter:'all', searchOpen:false, scrollTo:null, scrollBottom:false, setup:null, _keepScroll:null };
let flow = null, modalCtx = null;

function migrateTrip(t){
  for (const e of t.expenses) {
    if (!e.fixed) { e.fixed = {}; e.eq = []; if (e.shares) { Object.entries(e.shares).forEach(([k,v])=>{ if (v>0) e.fixed[k]=v; }); } }
    if (!Array.isArray(e.eq)) e.eq = [];
    delete e.shares;
  }
  return t;
}
/* All user data lives in IndexedDB (see db.js). `state.trips` is only an in-memory copy for rendering;
   every change is written to IndexedDB before the app says it is saved. */
function persistTrip(t){
  t.updatedAt = Date.now();
  return DB.putTrip(t).then(()=>true, err=>{ toast('บันทึกลงเครื่องไม่สำเร็จ ลองอีกครั้ง', 4000); console.error(err); return false; });
}
async function migrateLegacy(){
  let raw=null;
  try { raw = localStorage.getItem(LEGACY_LS_KEY); } catch(_) { return; }
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    const trips = (Array.isArray(d.trips)?d.trips:[]).map(migrateTrip);
    const existing = new Map((await DB.getAllTrips()).map(t=>[t.id,t]));
    const toPut = trips.filter(t=>!existing.has(t.id) || (t.updatedAt||0)>(existing.get(t.id).updatedAt||0));
    if (toPut.length) await DB.putTrips(toPut);
    if (d.lastTripId && !(await DB.getMeta('lastTripId'))) await DB.setMeta('lastTripId', d.lastTripId);
    const ids = new Set((await DB.getAllTrips()).map(t=>t.id));
    if (trips.every(t=>ids.has(t.id))) localStorage.removeItem(LEGACY_LS_KEY);   // only after everything is safely in IndexedDB
  } catch(e) { console.error('migration', e); }
}
const curTrip = () => state.trips.find(t=>t.id===state.tripId);
const memberOf = (t,id) => t.members.find(m=>m.id===id);
function openTripView(id){
  state.tripId = id; state.lastTripId = id; state.view='trip'; state.tab='table'; state.q=''; state.filter='all'; state.searchOpen=false; state.scrollBottom=true;
  DB.setMeta('lastTripId', id).catch(()=>{});
}

/* ============ calculations ============ */
function sortedExpenses(t){ return [...t.expenses].sort((a,b)=>(a.at-b.at)||(a.createdAt-b.createdAt)); }
function expShares(e){
  const out = {...e.fixed};
  const fx = sum(Object.values(e.fixed));
  if (e.eq.length) { const each = (e.amount - fx) / e.eq.length; e.eq.forEach(id=>{ out[id] = (out[id]||0) + each; }); }
  return out;
}
function tripCalc(t){
  const owe={}, paid={};
  t.members.forEach(m=>{owe[m.id]=0; paid[m.id]=0;});
  let total=0;
  for (const e of t.expenses) {
    total += e.amount;
    for (const [id,v] of Object.entries(expShares(e))) if (id in owe) owe[id]+=v;
    for (const [id,v] of Object.entries(e.payers)) if (id in paid) paid[id]+=v;
  }
  const net={};
  t.members.forEach(m=>{ net[m.id] = paid[m.id]-owe[m.id]; if (isZero(net[m.id])) net[m.id]=0; });
  return {total, owe, paid, net};
}
function settle(net){
  const cr=[], db=[];
  for (const [id,v] of Object.entries(net)) { const r=Math.round(v); if (r>0) cr.push([id,r]); else if (r<0) db.push([id,-r]); }
  cr.sort((a,b)=>b[1]-a[1]); db.sort((a,b)=>b[1]-a[1]);
  const out=[]; let i=0,j=0;
  while (i<db.length && j<cr.length) {
    const x=Math.min(db[i][1],cr[j][1]);
    if (x>1) out.push({from:db[i][0], to:cr[j][0], amt:x});
    db[i][1]-=x; cr[j][1]-=x;
    if (db[i][1]<=1) i++;
    if (cr[j][1]<=1) j++;
  }
  return out;
}
const expName = e => e.name || CATS[e.cat].label;

/* ============ toast & modal ============ */
let toastT;
function toast(msg, ms=1400){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'), ms); }
function openModal(html, ctx={}){
  modalCtx = ctx;
  const root = $('#modal');
  root.innerHTML = `<div class="scrim" data-act="m:cancel"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  const f = root.querySelector('[autofocus]');
  if (f) setTimeout(()=>{ f.focus(); if (f.select) f.select(); }, 60);
}
function closeModal(){ const r=$('#modal'); r.hidden=true; r.innerHTML=''; modalCtx=null; }
function confirmDialog({title, body='', ok='ตกลง', danger=false}){
  return new Promise(res=>{
    openModal(`<h3>${esc(title)}</h3>${body}<div class="acts"><button class="btn btn-ghost" data-act="m:cancel">ยกเลิก</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-act="m:ok">${esc(ok)}</button></div>`,
      {ok:()=>{closeModal();res(true);}, cancel:()=>{closeModal();res(false);}});
  });
}

/* ============ render root ============ */
function render(){
  const app = $('#app');
  if (state.view==='trip' && !curTrip()) state.view = state.trips.length ? 'home' : 'setup';
  if (state.view==='home' && !state.trips.length) state.view = 'setup';
  if (state.view==='privacy') { app.innerHTML = renderPrivacy(); fillPrivacyStatus(); return; }
  if (state.view==='setup' && !state.setup) startSetup();
  app.innerHTML = state.view==='setup' ? renderSetup() : state.view==='trip' ? renderTrip() : state.view==='privacy' ? renderPrivacy() : renderHome();
  afterRender();
}
function afterRender(){
  if (state.view==='setup') { const f=$('#app [autofocus]'); if (f) setTimeout(()=>f.focus(),30); }
  if (state.view!=='trip') return;
  const gs = $('#gridScroll');
  if (gs) {
    if (state.scrollTo) {
      const row = gs.querySelector(`tr[data-id="${state.scrollTo}"]`);
      if (row) {
        const gr=gs.getBoundingClientRect(), rr=row.getBoundingClientRect();
        gs.scrollTop += rr.top - gr.top - gs.clientHeight/2 + row.offsetHeight/2 + 40;
        row.classList.add('flash');
      }
    } else if (state.scrollBottom) gs.scrollTop = gs.scrollHeight;
    else if (state._keepScroll != null) gs.scrollTop = state._keepScroll;
  }
  state.scrollTo=null; state.scrollBottom=false; state._keepScroll=null;
}

/* ============ home ============ */
function renderHome(){
  const trips = [...state.trips].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  return `<section class="home">
    <header class="home-head row"><div class="grow"><h1>ทริปทั้งหมด</h1><p>🔒 ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p></div><button class="icon-btn" data-act="privacy" aria-label="ข้อมูลและความเป็นส่วนตัว" style="font-size:20px">🔒</button></header>
    <div class="trip-list">${trips.map(t=>{
      const c=tripCalc(t); const last=Math.max(t.updatedAt||0, ...t.expenses.map(e=>e.createdAt||0));
      return `<button class="trip-card" data-act="openTrip" data-id="${t.id}"><h2>${esc(t.name)}</h2>
        <div class="meta">${t.members.length} คน · ${cur(t.currency)[0]} · ${t.expenses.length} รายการ</div>
        <div class="total num">${fmt(c.total,t.currency)}</div>
        <div class="row" style="justify-content:space-between;align-items:flex-end"><div class="stack">${t.members.map(m=>face(m,'sm')).join('')}</div><span class="muted" style="font-size:13px">ล่าสุด ${rel(last)}</span></div></button>`;
    }).join('')}</div>
    <div class="home-foot"><button class="btn btn-primary" data-act="newTrip">＋ เริ่มทริปใหม่</button><button class="linkbtn" data-act="importBackup">กู้คืนจากไฟล์สำรอง</button></div>
  </section>`;
}

/* ============ setup ============ */
function startSetup(){ state.setup = {step:'name', name:'', currency:'THB', count:3, members:[], idx:0, err:''}; syncSetupMembers(); }
function syncSetupMembers(){ const s=state.setup; while (s.members.length<s.count){ const i=s.members.length; s.members.push({name:'', emoji:ANIMALS[i%ANIMALS.length], color:PALETTE[i%PALETTE.length]}); } s.members.length=s.count; }
function renderSetup(){
  const s=state.setup, steps=['name','currency','count','members'], si=steps.indexOf(s.step);
  const canBack = si>0 || state.trips.length>0;
  let body='', foot='';
  if (s.step==='name') {
    body = `<h1>ทริปนี้ชื่ออะไรดี?</h1><p class="lead">ตั้งชื่อให้จำง่าย เช่น เกียวโตหน้าใบไม้แดง</p>
      <input class="field" id="tripName" data-inp="tripName" maxlength="40" placeholder="ชื่อทริป" value="${esc(s.name)}" autofocus enterkeyhint="next">
      <div class="err">${esc(s.err)}</div>
      ${!state.trips.length?`<button class="linkbtn" data-act="importBackup" style="margin-top:18px">มีไฟล์สำรองอยู่แล้ว? กู้คืนที่นี่</button>`:''}`;
    foot = `<button class="btn btn-primary" data-act="setupNext" id="setupNextBtn" ${s.name.trim()?'':'disabled'}>ถัดไป</button>`;
  } else if (s.step==='currency') {
    body = `<h1>ใช้เงินสกุลไหน?</h1><p class="lead">ทั้งทริปใช้สกุลเดียว ไม่ต้องแปลงค่าเงิน</p>
      <div class="cur-grid">${CURRENCIES.map(c=>`<button class="cur ${s.currency===c[0]?'on':''}" data-act="setCur" data-c="${c[0]}"><b>${c[1]} ${c[0]}</b><span>${c[3]}</span></button>`).join('')}</div>`;
    foot = `<button class="btn btn-primary" data-act="setupNext">ถัดไป</button>`;
  } else if (s.step==='count') {
    body = `<h1>ไปกันกี่คน?</h1><p class="lead">นับตัวเองด้วยนะ (2–${MAX_MEMBERS} คน)</p>
      <div class="stepper"><button data-act="cnt" data-d="-1" aria-label="ลดจำนวน">−</button><output class="num" id="cntOut">${s.count}</output><button data-act="cnt" data-d="1" aria-label="เพิ่มจำนวน">＋</button></div>`;
    foot = `<button class="btn btn-primary" data-act="setupNext">ถัดไป</button>`;
  } else {
    const m=s.members[s.idx], last=s.idx===s.count-1;
    body = `<h1>คนที่ ${s.idx+1} จาก ${s.count} ชื่ออะไร?</h1>
      <div class="member-setup">${face(m,'lg')}<button class="swap" data-act="swapAnimal">เปลี่ยนตัวการ์ตูน</button></div>
      <input class="field" id="memName" data-inp="memName" maxlength="20" placeholder="ชื่อเล่น" value="${esc(m.name)}" autofocus enterkeyhint="${last?'done':'next'}">
      <div class="err">${esc(s.err)}</div>
      <div class="mini-row">${s.members.map((x,i)=>`<div class="mini ${x.name?'done':''} ${i===s.idx?'cur-m':''}">${face(x,'sm')}<span>${esc(x.name)||'&nbsp;'}</span></div>`).join('')}</div>`;
    foot = `<button class="btn btn-primary" data-act="setupNext" id="setupNextBtn" ${m.name.trim()?'':'disabled'}>${last?'เริ่มใช้งาน':'ถัดไป'}</button>`;
  }
  return `<section class="setup">
    <div class="setup-top">${canBack?`<button class="icon-btn" data-act="setupBack" aria-label="ย้อนกลับ">${ICON.back}</button>`:'<span style="width:44px"></span>'}<div class="dots">${steps.map((_,i)=>`<i class="${i<=si?'on':''}"></i>`).join('')}</div><span style="width:44px"></span></div>
    <div class="setup-body">${body}</div><div class="setup-foot">${foot}</div></section>`;
}
function setupNext(){
  const s=state.setup; s.err='';
  if (s.step==='name') { if (!s.name.trim()) return; s.step='currency'; }
  else if (s.step==='currency') s.step='count';
  else if (s.step==='count') { syncSetupMembers(); s.idx=0; s.step='members'; }
  else {
    const m=s.members[s.idx], nm=m.name.trim();
    if (!nm) return;
    if (s.members.some((x,i)=>i!==s.idx && x.name.trim().toLowerCase()===nm.toLowerCase())) { s.err='ชื่อนี้มีแล้ว ลองชื่ออื่นหรือเติมตัวอักษรให้ต่างกัน'; render(); return; }
    m.name=nm;
    if (s.idx<s.count-1) s.idx++; else { createTrip(); return; }
  }
  render();
}
function setupBack(){
  const s=state.setup; s.err='';
  if (s.step==='members' && s.idx>0) s.idx--;
  else if (s.step==='members') s.step='count';
  else if (s.step==='count') s.step='currency';
  else if (s.step==='currency') s.step='name';
  else { state.setup=null; if (state.lastTripId && state.trips.some(t=>t.id===state.lastTripId)) openTripView(state.lastTripId); else state.view='home'; }
  render();
}
function createTrip(){
  const s=state.setup, now=Date.now();
  const t={id:newId('t'), name:s.name.trim(), currency:s.currency, members:s.members.map(m=>({id:newId('m'), name:m.name.trim(), emoji:m.emoji, color:m.color})), expenses:[], createdAt:now, updatedAt:now};
  state.trips.push(t); state.setup=null;
  openTripView(t.id); persistTrip(t); render();
}
function nextAnimal(used, current){ const st=ANIMALS.indexOf(current); for (let k=1;k<=ANIMALS.length;k++){ const a=ANIMALS[(st+k)%ANIMALS.length]; if(!used.includes(a)) return a; } return current; }

/* ============ trip dashboard ============ */
function tableDims(n){
  const appW = Math.min(document.documentElement.clientWidth || window.innerWidth, 560);
  const avail = appW - 14;
  const vis = Math.min(n, 4);              // up to 4 people always fit on screen; more scroll sideways
  const P = {2:{a:.36,b:.22,fs:15,rh:44}, 3:{a:.285,b:.19,fs:appW<370?12:13,rh:34}, 4:{a:.235,b:.165,fs:appW<370?10.5:11.5,rh:30}}[vis];
  const A=Math.round(avail*P.a), B=Math.round(avail*P.b), M=Math.floor((avail-A-B)/vis);
  return {vars:`--wa:${A}px;--wb:${B}px;--wm:${M}px;--fs:${P.fs}px;--rh:${P.rh}px`, width:A+B+M*n};
}
function renderTrip(){
  const t=curTrip(), c=tripCalc(t), has=t.expenses.length>0;
  const main = !has ? renderEmpty(t) : state.tab==='settle' ? renderSettle(t,c) : renderLedger(t,c);
  const filtering = state.filter!=='all' || state.q.trim();
  return `<section class="trip">
    <header class="tbar">
      <button class="icon-btn" data-act="home" aria-label="ทริปทั้งหมด">${ICON.back}</button>
      <div class="tt"><h1>${esc(t.name)}</h1><p>${t.members.length} คน · ใช้ไปแล้ว <b class="num">${fmt(c.total,t.currency)}</b></p></div>
      ${has?`<button class="icon-btn" data-act="toggleSearch" aria-label="ค้นหาและกรอง" ${state.searchOpen?'style="background:var(--surface2)"':''}>${ICON.search}</button>`:''}
      <button class="icon-btn" data-act="tripMenu" aria-label="เมนู">${ICON.more}</button>
    </header>
    ${has?`<div class="seg" role="tablist"><button role="tab" class="${state.tab==='table'?'on':''}" data-act="tab" data-t="table">ตาราง</button><button role="tab" class="${state.tab==='settle'?'on':''}" data-act="tab" data-t="settle">ใครโอนให้ใคร</button></div>`:''}
    ${has && state.searchOpen && state.tab==='table' ? `<div class="searchbar"><input class="field" type="search" data-inp="q" placeholder="ค้นหาชื่อรายการ" value="${esc(state.q)}">
      <div class="chips"><button class="chip ${state.filter==='all'?'on':''}" data-act="filter" data-f="all">ทั้งหมด</button>${CAT_ORDER.map(k=>`<button class="chip ${state.filter===k?'on':''}" data-act="filter" data-f="${k}">${CATS[k].icon} ${CATS[k].short}</button>`).join('')}</div></div>`:''}
    ${has && state.tab==='table' && (state.searchOpen||filtering) ? `<div class="filter-note" id="filterNote" ${filtering?'':'hidden'}></div>`:''}
    <div class="tmain" id="tmain">${main}</div>
    <nav class="dock" aria-label="เพิ่มค่าใช้จ่าย">${CAT_ORDER.map(k=>`<button class="catbtn" data-act="newExp" data-cat="${k}"><span class="e">${CATS[k].icon}</span>＋${CATS[k].short}</button>`).join('')}</nav>
  </section>`;
}
function renderEmpty(t){
  return `<div class="empty"><div class="faces">${t.members.map(m=>`<div>${face(m)}<span>${esc(m.name)}</span></div>`).join('')}</div>
    <h2>ยังไม่มีค่าใช้จ่าย</h2><p>จ่ายอะไรไป กดหมวดด้านล่างได้เลย ที่เหลือแอปคิดเลขให้เอง</p></div>`;
}
function payerBg(t,e,bar=true){
  const cols = Object.keys(e.payers).filter(id=>e.payers[id]>0).map(id=>memberOf(t,id)).filter(Boolean).map(m=>m.color);
  const a = isDark()?.34:.26;
  if (!cols.length) return 'var(--surface)';
  if (cols.length===1) return bar ? `linear-gradient(90deg,${cols[0]} 0 3px,${tint(cols[0],a)} 3px),var(--surface)` : `linear-gradient(${tint(cols[0],a)},${tint(cols[0],a)}),var(--surface)`;
  return `linear-gradient(90deg,${cols.map((c,i)=>`${tint(c,a)} ${Math.round(i/(cols.length-1)*100)}%`).join(',')}),var(--surface)`;
}
function renderLedger(t,c){
  const code=t.currency, q=state.q.trim().toLowerCase(), all=sortedExpenses(t);
  const rows = all.filter(e=>(state.filter==='all'||e.cat===state.filter) && (!q || expName(e).toLowerCase().includes(q)));
  const N = {noSym:true};
  const body = rows.map(e=>{
    const sh = expShares(e); const multi = Object.keys(e.payers).length > 1;
    return `<tr data-act="showExp" data-id="${e.id}">
      <td class="sa" style="background:${payerBg(t,e)}"><div class="xa"><span class="ic">${CATS[e.cat].icon}</span><span class="nm ${e.name?'':'unnamed'}">${esc(expName(e))}</span></div></td>
      <td class="sb cb-v num" style="background:${payerBg(t,e,false)}">${e.orig?`<span class="fx-mark">${esc(cur(e.orig.cur)[1])}</span>`:''}${fmt(e.amount,code,N)}</td>
      ${t.members.map(m=>{ const v=sh[m.id]||0, p=e.payers[m.id]||0;
        return `<td class="num"><div class="cell"><span class="${isZero(v)?'zero':''}">${isZero(v)?'–':fmt(v,code,N)}</span>${p>0&&multi?`<span class="paid" style="color:${deep(m.color)}">ออก ${fmt(p,code,N)}</span>`:''}</div></td>`; }).join('')}
    </tr>`;
  }).join('') || `<tr><td class="sa" colspan="2" style="background:var(--surface);color:var(--muted);white-space:normal">ไม่พบรายการ</td>${t.members.map(()=>'<td></td>').join('')}</tr>`;
  const netCell = v => v>0 ? `<span class="net pos"><small>ได้คืน</small>${fmt(v,code,N)}</span>` : v<0 ? `<span class="net neg"><small>จ่ายเพิ่ม</small>${fmt(-v,code,N)}</span>` : `<span class="net nil"><small>พอดี</small>0</span>`;
  setTimeout(()=>{ const n=$('#filterNote'); if(!n) return; const on=!!(q||state.filter!=='all'); n.hidden=!on; if(on) n.textContent=`แสดง ${rows.length} จาก ${all.length} รายการ · ยอดสรุปยังคิดจากทั้งทริป`; },0);
  const dims = tableDims(t.members.length);
  return `<div class="grid-scroll" id="gridScroll" style="${dims.vars}"><table class="ledger" style="width:${dims.width}px">
    <colgroup><col class="ca"><col class="cb">${t.members.map(()=>'<col class="cm">').join('')}</colgroup>
    <thead><tr><th class="sa">รายการ</th><th class="sb">รวม (${esc(cur(code)[1])})</th>
      ${t.members.map(m=>`<th class="m"><div class="mh" style="background:${tint(m.color,isDark()?.34:.24)};border-bottom:3px solid ${m.color}"><span class="e">${m.emoji}</span><span class="n">${esc(m.name)}</span></div></th>`).join('')}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot>
      <tr><td class="sa">รวมใช้ไป</td><td class="sb num">${fmt(c.total,code,N)}</td>${t.members.map(m=>`<td class="num">${fmt(c.owe[m.id],code,N)}</td>`).join('')}</tr>
      <tr><td class="sa">ออกให้ไปก่อน</td><td class="sb num">${fmt(c.total,code,N)}</td>${t.members.map(m=>`<td class="num">${fmt(c.paid[m.id],code,N)}</td>`).join('')}</tr>
      <tr><td class="sa"><span class="lbl-good">ได้คืน</span>หรือ<span class="lbl-bad">จ่ายเพิ่ม</span></td><td class="sb"></td>${t.members.map(m=>`<td class="num">${netCell(c.net[m.id])}</td>`).join('')}</tr>
    </tfoot></table></div>`;
}
function renderSettle(t,c){
  const code=t.currency, xs=settle(c.net);
  return `<div class="settle"><h3>💸 โอนกันแบบนี้ก็จบ</h3>
    ${xs.length ? xs.map(x=>{ const a=memberOf(t,x.from), b=memberOf(t,x.to);
      return `<div class="xfer"><div class="p">${face(a)}<span>${esc(a.name)}</span></div><div class="mid"><b class="num">${fmt(x.amt,code)}</b><div class="ar"></div><small>โอนให้</small></div><div class="p">${face(b)}<span>${esc(b.name)}</span></div></div>`; }).join('')
      : `<div class="done-note">ทุกคนเคลียร์กันครบแล้ว ไม่ต้องโอนเพิ่ม 🎉</div>`}
    <h3>ยอดของแต่ละคน</h3>
    ${t.members.map(m=>{ const v=c.net[m.id];
      const pill = v>0?`<span class="pill pos num"><small>ได้คืน</small>${fmt(v,code)}</span>`:v<0?`<span class="pill neg num"><small>จ่ายเพิ่ม</small>${fmt(-v,code)}</span>`:`<span class="pill nil num"><small>พอดี</small>${fmt(0,code)}</span>`;
      return `<div class="bal">${face(m,'sm')}<div class="grow"><div class="who">${esc(m.name)}</div><div class="sub num">ใช้ไป ${fmt(c.owe[m.id],code)} · ออกก่อน ${fmt(c.paid[m.id],code)}</div></div>${pill}</div>`; }).join('')}
  </div>`;
}

/* ============ expense detail (tap a row) ============ */
function showExp(id){
  const t=curTrip(), e=t.expenses.find(x=>x.id===id); if(!e) return;
  const code=t.currency, sh=expShares(e);
  const payL = Object.keys(e.payers).map(pid=>{ const m=memberOf(t,pid); return m?`<div class="line">${face(m,'xs')}<span class="n">${esc(m.name)}</span><b class="num">${fmt(e.payers[pid],code)}</b></div>`:''; }).join('');
  const shL = t.members.filter(m=>!isZero(sh[m.id]||0)).map(m=>`<div class="line">${face(m,'xs')}<span class="n">${esc(m.name)}</span><b class="num">${fmt(sh[m.id],code)}</b></div>`).join('');
  openModal(`<h3>${CATS[e.cat].icon} ${esc(expName(e))}</h3>
    <div style="font-family:var(--display);font-size:32px;font-weight:500" class="num">${fmt(e.amount,code)}</div>
    ${e.orig?`<div class="muted num" style="font-size:14px;margin-top:-2px">จ่ายไป ${fmt(e.orig.amount,e.orig.cur)} · เรท 1 ${esc(cur(e.orig.cur)[1])} = ${e.orig.rate} ${esc(cur(code)[1])}</div>`:''}
    <div class="dsec pay"><div class="dh">💳 จ่ายเงินไปก่อน</div>${payL}</div>
    <div class="dsec split"><div class="dh">🧾 หารกัน</div>${shL}</div>
    <label style="display:block;margin-top:12px;font-size:13px;color:var(--muted);font-weight:600">วันเวลา (ใช้เรียงลำดับในตาราง)<input class="dtf" type="datetime-local" id="dAt" value="${toLocalInput(e.at)}"></label>
    <div class="acts"><button class="btn btn-danger" data-act="m:del">ลบ</button><button class="btn btn-primary" data-act="m:edit">แก้ไข</button></div>`,
  {
    cancel:()=>{ saveAt(); closeModal(); },
    edit:()=>{ saveAt(); closeModal(); editFlow(id); },
    del:async()=>{ closeModal(); const ok=await confirmDialog({title:'ลบรายการนี้?', body:`<div class="xl-sum"><b>${CATS[e.cat].icon} ${esc(expName(e))}</b><br><span class="num">${fmt(e.amount,code)}</span></div><p style="margin-top:10px">ยอดของทุกคนจะคำนวณใหม่ทันที</p>`, ok:'ลบ', danger:true});
      if (!ok) return; t.expenses=t.expenses.filter(x=>x.id!==id); persistTrip(t); state._keepScroll=$('#gridScroll')?.scrollTop??null; render(); toast('ลบแล้ว'); }
  });
  function saveAt(){ const inp=$('#dAt'); if(!inp) return; const ms=new Date(inp.value).getTime(); if (isFinite(ms) && ms!==e.at){ e.at=ms; persistTrip(t); state.scrollTo=e.id; render(); } }
}

/* ============ add / edit flow ============
   Step 1 (amber): category, name, amount, WHO PAID
   Step 1b (amber): how much each payer paid (only if 2+ payers)
   Step 2 (blue):  WHO SHARES the cost → save                      */
function newFlow(cat){
  flow = {mode:'new', id:null, cat, name:'', amountStr:'', amount:0, at:null, createdAt:null, multi:false, cur:curTrip().currency, rateStr:'',
    payerSel:[], payers:{}, sel:[], fixed:{}, preview:false, pick:false, step:'pay', stampNew:{}};
  renderFlow();
}
function editFlow(id){
  const t=curTrip(), e=t.expenses.find(x=>x.id===id); if(!e) return;
  const order=t.members.map(m=>m.id);
  const payerSel = order.filter(mid=>(e.payers[mid]||0)>0);
  const o = e.orig;   // expense entered in another currency: edit it in that currency
  const fc = o ? o.cur : t.currency;
  flow = {mode:'edit', id:e.id, cat:e.cat, name:e.name||'', cur:fc, rateStr:o?String(o.rate):'', amountStr:toInput(o?o.amount:e.amount,fc), amount:o?o.amount:e.amount, at:e.at, createdAt:e.createdAt, multi:payerSel.length>1,
    payerSel, payers:{...(o?o.payers:e.payers)}, sel:[...e.eq], fixed:{...(o?o.fixed:e.fixed)}, preview:true, pick:false, step:'pay', stampNew:{}};
  renderFlow();
}
const flowSteps = () => flow.payerSel.length>=2 ? ['pay','payamt','split'] : ['pay','split'];
function goStep(s){ flow.step=s; flow.pick=false; renderFlow(); }
function flowBack(){ const s=flowSteps(), i=s.indexOf(flow.step); if (i<=0) { maybeDiscard(); return; } goStep(s[i-1]); }
async function maybeDiscard(){
  if (flow.mode==='new' && (flow.name || flow.amountStr)) {
    const ok = await confirmDialog({title:'ทิ้งรายการนี้?', body:'<p>ข้อมูลที่กรอกไว้จะหายไป</p>', ok:'ทิ้ง', danger:true});
    if (!ok) return;
  }
  closeFlow();
}
function closeFlow(){ flow=null; const f=$('#flow'); f.hidden=true; f.innerHTML=''; }

function splitCalc(){
  const t=curTrip(), total=flow.amount;
  const fixedIds=Object.keys(flow.fixed), fixedSum=sum(fixedIds.map(i=>flow.fixed[i]));
  const remaining = total - fixedSum;
  const others = t.members.map(m=>m.id).filter(id=>flow.sel.includes(id) && !(id in flow.fixed));
  const shares = {...flow.fixed};
  let ok=false, err='';
  if (fixedSum > total) err = `ใส่เกินยอดไป ${fmt(fixedSum-total,flow.cur)}`;
  else if (flow.preview) {
    if (others.length) { others.forEach(id=>shares[id]=remaining/others.length); ok=true; }
    else if (remaining===0 && fixedIds.length) ok=true;
    else if (fixedIds.length) err=`ยังเหลือ ${fmt(remaining,flow.cur)} เลือกคนหารเพิ่ม`;
  } else if (remaining===0 && fixedIds.length && !others.length) ok=true;
  return {shares, remaining, others, ok, err, fixedSum, total};
}

function renderFlow(){
  const t=curTrip(), root=$('#flow'); root.hidden=false;
  const cat=CATS[flow.cat], code=flow.cur, sym=cur(code)[1];
  const steps=flowSteps(), idx=steps.indexOf(flow.step);
  let body='', foot='';
  if (flow.step==='pay') {
    const ready = parseAmt(flow.amountStr,code) > 0 && rateOk();
    body = `<div class="catpick" role="radiogroup" aria-label="หมวด">${CAT_ORDER.map(k=>`<button class="${flow.cat===k?'on':''}" data-act="setCat" data-cat="${k}">${CATS[k].icon} ${CATS[k].short}</button>`).join('')}</div>
      <input class="field" data-inp="expName" maxlength="40" placeholder="ชื่อรายการ (ไม่ใส่ก็ได้) ${esc(cat.ph)}" value="${esc(flow.name)}" enterkeyhint="next" ${flow.mode==='new'?'autofocus':''}>
      <div class="bigamt"><button class="sym curbtn" data-act="pickCur" aria-label="เปลี่ยนสกุลเงิน (ตอนนี้ ${flow.cur})">${esc(sym)}<small>${flow.cur}▾</small></button><input data-inp="amount" id="amtIn" inputmode="decimal" placeholder="0" value="${esc(flow.amountStr)}" autocomplete="off" aria-label="จำนวนเงิน" enterkeyhint="done"></div>
      ${flow.cur!==t.currency?`<div class="rate"><span>เรท 1 ${esc(sym)} =</span><input data-inp="rate" inputmode="decimal" placeholder="0.00" value="${esc(flow.rateStr)}" aria-label="อัตราแลกเปลี่ยน"><span>${esc(cur(t.currency)[1])}</span><b class="num" id="rateEq"></b></div>`:''}
      <section class="paysec">
        <div class="sec-hd"><h2>💳 ใครควักเงินจ่ายไปก่อน?<small>${flow.multi?'เลือกทุกคนที่ช่วยกันจ่าย แล้วกดถัดไป':'แตะคนที่จ่าย แล้วไปต่อทันที'}</small></h2>
          <button class="multi ${flow.multi?'on':''}" data-act="toggleMulti" aria-pressed="${flow.multi}">👥 ช่วยกันจ่าย</button></div>
        <div class="plist">${t.members.map(m=>{ const on=flow.payerSel.includes(m.id);
          return `<button class="payrow ${on?'on':''} ${flow.multi?'multi-mode':''}" style="${mvars(m)}" data-act="tapPayer" data-id="${m.id}" aria-pressed="${on}">${face(m,'sm')}<span class="n">${esc(m.name)}</span><span class="mark">${on?'✓':''}</span></button>`; }).join('')}</div>
      </section>
      <div class="status bad" id="amtStatus"></div>`;
    foot = `<button class="btn btn-pay grow-btn" data-act="payNext" id="payNextBtn" ${ready&&flow.payerSel.length?'':'disabled'}>ถัดไป: ใครต้องหาร</button>`;
  }
  else if (flow.step==='payamt') {
    if (flow.payerSel.length===2) {
      const [a,b]=flow.payerSel.map(id=>memberOf(t,id));
      const va=flow.payers[a.id]||0, vb=flow.amount-va, p=flow.amount?va/flow.amount*100:50;
      body = `<div class="payhead">💳 ช่วยกันจ่าย ${fmt(flow.amount,code)} คนละเท่าไหร่?</div>
        <p class="hint" style="margin:0 0 8px">ลากขึ้นลง ตัวเลขจะดูดเข้าหาเลขกลมๆ เอง · แตะตัวเลขเพื่อพิมพ์</p>
        <div class="vs">
          <button class="vs-end" style="${mvars(a)}" data-act="typePayer" data-id="${a.id}">${face(a,'sm')}<span class="n">${esc(a.name)}</span><span><b class="num" id="vsA">${fmt(va,code)}</b><span class="ed">แตะเพื่อพิมพ์</span></span></button>
          <div class="vs-track" id="vsTrack" role="slider" tabindex="0" aria-label="แบ่งยอดระหว่าง ${esc(a.name)} กับ ${esc(b.name)}" aria-valuemin="0" aria-valuemax="${flow.amount}" aria-valuenow="${va}">
            <div class="vs-fill a" id="vsFa" style="height:${p}%;background:${a.color}"></div>
            <div class="vs-fill b" id="vsFb" style="height:${100-p}%;background:${b.color}"></div>
            <div class="vs-thumb" id="vsThumb" style="top:${p}%">⇕</div>
          </div>
          <button class="vs-end" style="${mvars(b)}" data-act="typePayer" data-id="${b.id}">${face(b,'sm')}<span class="n">${esc(b.name)}</span><span><b class="num" id="vsB">${fmt(vb,code)}</b><span class="ed">แตะเพื่อพิมพ์</span></span></button>
        </div>
        <div class="quick"><button data-act="payHalf">แบ่งครึ่ง</button></div>`;
      foot = `<button class="btn btn-ghost" data-act="flowBack">ย้อนกลับ</button><button class="btn btn-pay grow-btn" data-act="payamtOk">ถัดไป: ใครต้องหาร</button>`;
    } else {
      body = `<div class="payhead">💳 ช่วยกันจ่าย ${fmt(flow.amount,code)} คนละเท่าไหร่?</div>
        <div class="plist" style="gap:8px">${flow.payerSel.map(id=>{ const m=memberOf(t,id); return `<div class="pinrow" style="${mvars(m)}">${face(m,'sm')}<span class="n">${esc(m.name)}</span><input data-inp="payerAmt" data-id="${m.id}" inputmode="decimal" placeholder="0" value="${esc(flow.payers[m.id]?toInput(flow.payers[m.id],code):'')}" aria-label="${esc(m.name)} จ่ายไป"></div>`; }).join('')}</div>
        <div class="quick" style="margin-top:10px"><button data-act="payEven">แบ่งเท่าๆ กัน</button></div>
        <div class="status" id="payStatus"></div>`;
      foot = `<button class="btn btn-ghost" data-act="flowBack">ย้อนกลับ</button><button class="btn btn-pay grow-btn" data-act="payamtOk" id="payamtOkBtn">ถัดไป: ใครต้องหาร</button>`;
    }
  }
  else {
    const r=splitCalc(), fixedCount=Object.keys(flow.fixed).length, directOk=!flow.preview && r.ok;
    const payers = flow.payerSel.map(id=>memberOf(t,id)).filter(Boolean);
    body = `<div class="splithead"><h2>🧾 ใครต้องหารค่านี้บ้าง?</h2>
        <div class="big num">${fmt(Math.max(r.remaining,0),code)}</div>
        <div class="of">${fixedCount?`เหลือให้หาร จากทั้งหมด ${fmt(flow.amount,code)}`:`${cat.icon} ${esc(flow.name||cat.label)}`}</div>
        ${flow.cur!==t.currency?`<div class="of">≈ ${fmt(toTrip(Math.max(r.remaining,0)),t.currency)} (เรท ${esc(flow.rateStr)})</div>`:''}
        <div class="by">${payers.map(m=>face(m,'xs')).join('')} ${payers.map(m=>esc(m.name)).join(', ')} จ่ายไปก่อนแล้ว</div></div>
      <div class="sgrid">${t.members.map(m=>{
        const isFixed = m.id in flow.fixed, inSel=flow.sel.includes(m.id);
        const v = r.shares[m.id]||0;
        const showStamp = isFixed || (flow.preview && inSel);
        const off = !isFixed && !inSel && (flow.preview || flow.sel.length || fixedCount);
        return `<button class="sp ${isFixed||inSel?'sel':''} ${off?'off':''} ${flow.pick?'pickable':''}" style="${mvars(m)}" data-act="splitTap" data-id="${m.id}" aria-pressed="${isFixed||inSel}">${face(m)}<span class="stampslot"><span class="stamp num ${isFixed?'fx':''} ${showStamp?'':'ghost'} ${showStamp&&flow.stampNew[m.id]?'new':''}">${fmt(v,code)}</span></span><span class="n">${esc(m.name)}</span></button>`;
      }).join('')}</div>
      <div class="status ${r.err?'bad':''}">${esc(r.err)}</div>
      <p class="hint" style="margin-top:2px">${flow.pick?'แตะคนที่ต้องจ่ายไม่เท่าคนอื่น':flow.preview?'แตะคนเพื่อเพิ่ม/เอาออก แล้วกดบันทึก':'แตะเลือกคนที่ต้องหาร แล้วกด “หารเท่า”<br>ไม่เลือกใครเลย = ทุกคนหารเท่ากัน'}</p>`;
    flow.stampNew = {};
    foot = `<button class="icon-btn" data-act="flowBack" aria-label="ย้อนกลับ" style="border:1px solid var(--line);background:var(--surface2);width:52px;height:52px">${ICON.back}</button>
      <div class="splitbtns"><button class="btn-uneq ${flow.pick?'on':''}" data-act="uneq">หารไม่เท่า</button>
      <button class="btn-eq ${flow.preview||directOk?'armed':''}" data-act="eq">${flow.preview||directOk?'บันทึก ✓':'หารเท่า'}</button></div>`;
  }
  root.innerHTML = `<div class="flow">
    <div class="fbar"><button class="icon-btn" data-act="flowBack" aria-label="ย้อนกลับ">${ICON.back}</button>
      <div class="ft">${flow.mode==='edit'?'แก้ไขรายการ':'รายการใหม่'} · ขั้น ${idx+1}/${steps.length}</div>
      <button class="icon-btn" data-act="flowClose" aria-label="ปิด">${ICON.close}</button></div>
    <div class="fbody">${body}</div><div class="ffoot">${foot}</div></div>`;
  const f=root.querySelector('[autofocus]'); if (f) setTimeout(()=>{ const a=document.activeElement; if (!a || a===document.body || !root.contains(a)) f.focus(); },40);
  if (flow.step==='pay') updateRateEq();
  if (flow.step==='payamt' && flow.payerSel.length===2) bindSlider();
  if (flow.step==='payamt' && flow.payerSel.length>2) updatePayStatus();
}
function rateOk(){ if (flow.cur===curTrip().currency) return true; const r=Number(flow.rateStr); return isFinite(r) && r>0; }
function toTrip(minorF){
  const t=curTrip(); if (flow.cur===t.currency) return minorF;
  return Math.round(minorF / 10**cur(flow.cur)[2] * Number(flow.rateStr) * 10**cur(t.currency)[2]);
}
function updateRateEq(){
  const el=$('#rateEq'); if(!el) return; const v=parseAmt(flow.amountStr, flow.cur);
  el.textContent = (v>0 && rateOk()) ? `≈ ${fmt(toTrip(v), curTrip().currency)}` : '';
}
function pickCur(){
  const t=curTrip();
  const list=[cur(t.currency), ...CURRENCIES.filter(c=>c[0]!==t.currency)];
  openModal(`<h3>จ่ายเป็นเงินสกุลไหน?</h3><p>ใส่เรทเองครั้งแรก แอปจะจำไว้ แล้วแปลงเป็น ${esc(t.currency)} ให้ในตาราง</p>
    <div class="cur-grid">${list.map(c=>`<button class="cur ${flow.cur===c[0]?'on':''}" data-act="m:pick" data-c="${c[0]}"><b>${c[1]} ${c[0]}</b><span>${c[0]===t.currency?'สกุลหลักของทริป':c[3]}</span></button>`).join('')}</div>`,
  { cancel:closeModal,
    pick:async el=>{
      closeModal(); const code=el.dataset.c; if (code===flow.cur) return;
      flow.cur=code; flow.payers={}; flow.fixed={}; flow.rateStr='';
      if (code!==t.currency) {
        const known=(t.rates||{})[code];   // rate typed earlier in this trip; there is no online lookup
        if (known) flow.rateStr=String(known);
      }
      renderFlowKeep(); updatePayNext(); updateRateEq(); $('#amtIn')?.focus();
    } });
}
function updatePayNext(msg){
  const btn=$('#payNextBtn'); if(!btn) return;
  const v=parseAmt(flow.amountStr, flow.cur);
  btn.disabled = !(v>0 && flow.payerSel.length && rateOk());
  const st=$('#amtStatus');
  if (st) st.textContent = msg!=null ? msg : (flow.amountStr && !(v>0) ? 'ใส่จำนวนเงินให้ถูกต้อง' : (v>0 && !rateOk() ? 'ใส่เรทแลกเงินก่อน' : ''));
}
function tapPayer(el){
  const id=el.dataset.id;
  if (flow.multi) {
    const i=flow.payerSel.indexOf(id);
    if (i>=0) flow.payerSel.splice(i,1); else flow.payerSel.push(id);
    renderFlowKeep(); return;
  }
  flow.payerSel=[id];
  const v=parseAmt(flow.amountStr, flow.cur);
  if (v>0 && rateOk()) { payNext(); return; }
  if (v>0) { renderFlowKeep(); updatePayNext('ใส่เรทแลกเงินก่อน แล้วแตะคนจ่ายอีกครั้ง'); return; }
  renderFlowKeep();
  updatePayNext('ใส่จำนวนเงินก่อน แล้วแตะคนจ่ายอีกครั้ง');
  const a=$('#amtIn'); if (a) a.focus();
}
function renderFlowKeep(){ const y=$('.fbody')?.scrollTop||0; renderFlow(); const b=$('.fbody'); if(b) b.scrollTop=y; }
function payNext(){
  const t=curTrip(), v=parseAmt(flow.amountStr,flow.cur);
  if (!(v>0)) { updatePayNext('ใส่จำนวนเงินก่อน'); return; }
  if (!rateOk()) { updatePayNext('ใส่เรทแลกเงินก่อน'); return; }
  if (!flow.payerSel.length) { updatePayNext('แตะเลือกคนที่จ่ายไปก่อน'); return; }
  const changed = v!==flow.amount;
  flow.amount=v;
  const order=t.members.map(m=>m.id);
  flow.payerSel = order.filter(id=>flow.payerSel.includes(id));
  const keys=Object.keys(flow.payers).filter(k=>flow.payers[k]>0);
  const matches = keys.length===flow.payerSel.length && keys.every(k=>flow.payerSel.includes(k)) && sum(keys.map(k=>flow.payers[k]))===v;
  if (flow.payerSel.length===1) flow.payers={[flow.payerSel[0]]:v};
  else if (!matches) flow.payers = splitInt(v, flow.payerSel);
  if (changed && flow.mode==='edit' && Object.keys(flow.fixed).length && sum(Object.values(flow.fixed))>v) flow.fixed={};
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  goStep(flow.payerSel.length>=2 ? 'payamt' : 'split');
}
function updatePayStatus(){
  const code=flow.cur, st=$('#payStatus'), btn=$('#payamtOkBtn'); if(!st) return;
  const bad=flow.payerSel.some(id=>flow.payers[id]===null);
  const d=flow.amount - sum(flow.payerSel.map(id=>flow.payers[id]||0));
  if (bad) { st.className='status bad'; st.textContent='มีช่องที่ตัวเลขไม่ถูกต้อง'; }
  else if (d>0) { st.className='status bad'; st.textContent=`ยังขาดอีก ${fmt(d,code)}`; }
  else if (d<0) { st.className='status bad'; st.textContent=`เกินยอดไป ${fmt(-d,code)}`; }
  else { st.className='status ok'; st.textContent='ครบพอดี ✓'; }
  btn.disabled = bad || d!==0;
}
function payamtOk(){
  if (sum(flow.payerSel.map(id=>flow.payers[id]||0))!==flow.amount) { toast('ยอดที่ช่วยกันจ่ายยังไม่ตรงกับยอดรวม'); return; }
  const c={}; flow.payerSel.forEach(id=>{ if(flow.payers[id]>0) c[id]=flow.payers[id]; });
  flow.payers=c; goStep('split');
}

/* two-payer slider with snapping to round numbers */
function bindSlider(){
  const t=curTrip(), track=$('#vsTrack'), [aId,bId]=flow.payerSel;
  const unit = 10**cur(flow.cur)[2];
  const total = flow.amount;
  const steps = [100000,50000,10000,5000,1000,500,100,50,10,5,1].map(s=>s*unit).filter(s=>s<total);
  let last = flow.payers[aId]||0;
  const setVal = va => {
    va=Math.max(0,Math.min(total,va));
    flow.payers={[aId]:va,[bId]:total-va};
    const p = total ? va/total*100 : 50;
    $('#vsFa').style.height=p+'%'; $('#vsFb').style.height=(100-p)+'%'; $('#vsThumb').style.top=p+'%';
    $('#vsA').textContent=fmt(va,flow.cur); $('#vsB').textContent=fmt(total-va,flow.cur);
    track.setAttribute('aria-valuenow',va);
    if (va!==last && navigator.vibrate) { try{navigator.vibrate(5);}catch(_){} }
    last=va;
  };
  const snap = (raw, pxTol) => {
    for (const s of steps) {
      const tol = Math.min(pxTol, s*0.15);     // big round numbers pull harder, but never swallow the finer ones
      const n1=Math.round(raw/s)*s;            // round number for A
      if (Math.abs(n1-raw)<=tol && n1>=0 && n1<=total) return n1;
      const n2=total-Math.round((total-raw)/s)*s; // round number for B
      if (Math.abs(n2-raw)<=tol && n2>=0 && n2<=total) return n2;
    }
    return Math.round(raw/unit)*unit;
  };
  const fromY = y => {
    const r=track.getBoundingClientRect();
    const p=Math.max(0,Math.min(1,(y-r.top)/r.height));
    if (p<=0.005) return setVal(0);
    if (p>=0.995) return setVal(total);
    const raw=p*total, tol=total*(9/r.height);
    setVal(snap(raw,tol));
  };
  let drag=false;
  track.addEventListener('pointerdown',e=>{ drag=true; track.setPointerCapture(e.pointerId); fromY(e.clientY); e.preventDefault(); });
  track.addEventListener('pointermove',e=>{ if(drag) fromY(e.clientY); });
  const end=()=>{drag=false;};
  track.addEventListener('pointerup',end); track.addEventListener('pointercancel',end);
  track.addEventListener('keydown',e=>{
    const st = steps.find(s=>s<=total/10) || unit;
    const va=flow.payers[aId]||0;
    if (e.key==='ArrowDown'||e.key==='ArrowRight'){ setVal(Math.round((va+st)/st)*st); e.preventDefault(); }
    if (e.key==='ArrowUp'||e.key==='ArrowLeft'){ setVal(Math.round((va-st)/st)*st); e.preventDefault(); }
  });
}

function promptAmount({title, sub='', value='', canRemove=false}){
  return new Promise(res=>{
    const code=flow.cur;
    openModal(`<h3>${title}</h3>${sub?`<p>${sub}</p>`:''}
      <label class="bigamt" style="margin-bottom:6px"><span class="sym">${esc(cur(code)[1])}</span><input id="mAmt" inputmode="decimal" placeholder="0" value="${esc(value)}" autocomplete="off" autofocus></label>
      <div class="err" id="mErr"></div>
      <div class="acts">${canRemove?`<button class="btn btn-danger" data-act="m:remove">เอาออก</button>`:`<button class="btn btn-ghost" data-act="m:cancel">ยกเลิก</button>`}<button class="btn btn-primary" data-act="m:ok">ตกลง</button></div>`,
    { ok:()=>{ const v=parseAmt($('#mAmt').value,code); if(v==null||v<0){ $('#mErr').textContent='ใส่ตัวเลขให้ถูกต้อง'; return; } closeModal(); res({action:'ok',value:v}); },
      cancel:()=>{ closeModal(); res(null); }, remove:()=>{ closeModal(); res({action:'remove'}); } });
  });
}
async function splitTap(id){
  const t=curTrip(), m=memberOf(t,id), r=splitCalc();
  if (flow.pick || (id in flow.fixed)) {
    const existing = id in flow.fixed;
    const avail = r.remaining + (existing?flow.fixed[id]:0);
    const res = await promptAmount({title:`${m.emoji} ${esc(m.name)} ต้องจ่ายเท่าไหร่?`, sub:`ยังเหลือให้หาร ${fmt(avail,flow.cur)}`, value:existing?toInput(flow.fixed[id],flow.cur):'', canRemove:existing});
    if (!flow) return;
    if (res && res.action==='ok') { if (res.value>0) { flow.fixed[id]=res.value; flow.stampNew[id]=true; flow.sel=flow.sel.filter(x=>x!==id); } else delete flow.fixed[id]; }
    else if (res && res.action==='remove') delete flow.fixed[id];
    flow.pick=false; renderFlow(); return;
  }
  if (flow.sel.includes(id)) flow.sel=flow.sel.filter(x=>x!==id);
  else { flow.sel.push(id); if (flow.preview) flow.stampNew[id]=true; }
  if (!flow.sel.length && !Object.keys(flow.fixed).length) flow.preview=false;
  renderFlow();
}
function eqPress(){
  const t=curTrip(), r=splitCalc();
  if (r.fixedSum>r.total) { toast(r.err); return; }
  if (flow.preview || r.ok) { if (r.ok) saveExp(); else toast(r.err||'ยังแบ่งไม่ครบ'); return; }
  if (!r.others.length && r.remaining>0) flow.sel = t.members.map(m=>m.id).filter(id=>!(id in flow.fixed));
  flow.preview=true;
  const r2=splitCalc(); Object.keys(r2.shares).forEach(id=>flow.stampNew[id]=true);
  renderFlow();
}
function saveExp(){
  const t=curTrip(), r=splitCalc();
  if (!(flow.amount>0) || sum(Object.values(flow.payers))!==flow.amount) { toast('ยอดคนจ่ายไม่ตรงกับยอดรวม'); return; }
  if (!rateOk()) { toast('ใส่เรทแลกเงินก่อน'); return; }
  if (!r.ok) { toast(r.err||'ยังแบ่งไม่ครบ'); return; }
  let fixed={}; Object.entries(flow.fixed).forEach(([k,v])=>{ if(v>0) fixed[k]=v; });
  const eq = r.others.slice();
  let payers={}; Object.entries(flow.payers).forEach(([k,v])=>{ if(v>0) payers[k]=v; });
  let amount=flow.amount, orig=null;
  if (flow.cur!==t.currency) {
    // keep what was typed, convert to the trip currency for the table
    orig={cur:flow.cur, rate:Number(flow.rateStr), amount:flow.amount, payers:{...payers}, fixed:{...fixed}};
    amount=toTrip(flow.amount);
    const conv = (map, mustTotal) => { const out={}; Object.entries(map).forEach(([k,v])=>out[k]=toTrip(v)); const ks=Object.keys(out);
      if (mustTotal && ks.length) { const diff=amount-sum(Object.values(out)); const big=ks.sort((a,b)=>out[b]-out[a])[0]; out[big]+=diff; } return out; };
    payers=conv(payers,true); fixed=conv(fixed, !eq.length);
    if (sum(Object.values(fixed))>amount) { const ks=Object.keys(fixed); fixed[ks[0]]-=sum(Object.values(fixed))-amount; }
    t.rates = t.rates || {}; t.rates[flow.cur]=orig.rate;
  }
  const now=Date.now();
  const e={id:flow.id||newId('e'), cat:flow.cat, name:flow.name.trim(), amount, at:flow.at||now, createdAt:flow.createdAt||now, payers, fixed, eq};
  if (orig) e.orig=orig;
  const i=t.expenses.findIndex(x=>x.id===e.id);
  if (i>=0) t.expenses[i]=e; else t.expenses.push(e);
  const wasEdit = flow.mode==='edit';
  closeFlow();
  state.tab='table'; state.scrollTo=e.id; render();
  persistTrip(t).then(ok=>{ if (ok) toast(wasEdit?'แก้ไขแล้ว':'บันทึกแล้ว ✓'); });
}

/* ============ menu, settings, backup ============ */
function tripMenu(){
  const t=curTrip(), has=t.expenses.length>0;
  openModal(`<h3>${esc(t.name)}</h3><div class="menu">
      ${has?`<button data-act="m:img"><span class="e">🖼️</span>รูปสรุปไว้ส่งในแชท</button>
      <button data-act="m:pdf"><span class="e">📄</span>ส่งออกเป็น PDF</button>
      <button data-act="m:xlsx"><span class="e">📊</span>ส่งออกเป็น Excel</button><hr>`:''}
      <button data-act="m:edit"><span class="e">✏️</span>แก้ชื่อทริปและสมาชิก</button>
      <button data-act="m:new"><span class="e">🧳</span>เริ่มทริปใหม่</button>
      <button data-act="m:privacy"><span class="e">🔒</span>ข้อมูลและความเป็นส่วนตัว</button>
      <button data-act="m:del" class="danger"><span class="e">🗑️</span>ลบทริปนี้</button></div>`,
  { cancel:closeModal,
    pdf:()=>{closeModal(); exportPDF();}, xlsx:()=>{closeModal(); exportXLSX();}, img:()=>{closeModal(); exportImage();},
    edit:()=>{closeModal(); editTrip();},
    new:()=>{closeModal(); startSetup(); state.view='setup'; render();},
    privacy:()=>{closeModal(); openPrivacy();},
    del:async()=>{ closeModal(); const ok=await confirmDialog({title:`ลบทริป “${t.name}”?`, body:`<p>รายการทั้งหมด ${t.expenses.length} รายการจะหายไปและกู้คืนไม่ได้</p>`, ok:'ลบทริป', danger:true});
      if (!ok) return;
      try { await DB.deleteTrip(t.id); if (state.lastTripId===t.id) { state.lastTripId=null; await DB.deleteMeta('lastTripId'); } }
      catch(e) { toast('ลบไม่สำเร็จ ลองอีกครั้ง', 3000); return; }
      state.trips=state.trips.filter(x=>x.id!==t.id); state.view='home'; state.tripId=null; render(); toast('ลบทริปแล้ว'); }
  });
}
let editDraft=null;
function editTrip(){ const t=curTrip(); editDraft={name:t.name, members:t.members.map(m=>({...m}))}; renderEditTrip(); }
function renderEditTrip(){
  const d=editDraft;
  openModal(`<h3>แก้ชื่อทริปและสมาชิก</h3>
    <input class="field" id="etName" maxlength="40" value="${esc(d.name)}" aria-label="ชื่อทริป">
    <div class="medit">${d.members.map((m,i)=>`<div class="row"><button data-act="m:emoji" data-i="${i}" aria-label="เปลี่ยนตัวการ์ตูน">${face(m)}</button><input class="field grow" data-et="${i}" maxlength="20" value="${esc(m.name)}" aria-label="ชื่อสมาชิก"></div>`).join('')}</div>
    ${d.members.length<MAX_MEMBERS?`<button class="btn btn-ghost" style="width:100%" data-act="m:add">＋ เพิ่มสมาชิก</button>`:''}
    <div class="err" id="etErr"></div>
    <div class="acts"><button class="btn btn-ghost" data-act="m:cancel">ยกเลิก</button><button class="btn btn-primary" data-act="m:ok">บันทึก</button></div>`,
  { cancel:()=>{editDraft=null; closeModal();},
    emoji:el=>{ readEdit(); const i=+el.dataset.i; d.members[i].emoji=nextAnimal(d.members.map(x=>x.emoji), d.members[i].emoji); renderEditTrip(); },
    add:()=>{ readEdit(); const used=d.members.map(x=>x.color), i=d.members.length; d.members.push({id:newId('m'), name:'', emoji:nextAnimal(d.members.map(x=>x.emoji), ANIMALS[i%ANIMALS.length]), color:PALETTE.find(c=>!used.includes(c))||PALETTE[i%PALETTE.length]}); renderEditTrip(); },
    ok:()=>{ readEdit();
      if (!d.name.trim()) { $('#etErr').textContent='ใส่ชื่อทริปด้วยนะ'; return; }
      const names=d.members.map(m=>m.name.trim());
      if (names.some(n=>!n)) { $('#etErr').textContent='ใส่ชื่อสมาชิกให้ครบ'; return; }
      if (new Set(names.map(n=>n.toLowerCase())).size!==names.length) { $('#etErr').textContent='มีชื่อซ้ำกัน'; return; }
      const t=curTrip(); t.name=d.name.trim(); t.members=d.members.map(m=>({...m,name:m.name.trim()}));
      persistTrip(t); editDraft=null; closeModal(); render(); toast('บันทึกแล้ว'); }
  });
}
function readEdit(){ const n=$('#etName'); if(n) editDraft.name=n.value; document.querySelectorAll('[data-et]').forEach(i=>{ editDraft.members[+i.dataset.et].name=i.value; }); }
function exportBackup(){
  const d=new Date();
  const data = JSON.stringify({app:'tripsplit', version:3, exportedAt:d.toISOString(), trips:state.trips}, null, 1);
  offerFile(`หารค่าทริป-สำรอง-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`, new Blob([data],{type:'application/json'}));
}
function importBackup(){ const f=$('#importFile'); f.value=''; f.click(); }
$('#importFile').addEventListener('change', async e=>{
  const file=e.target.files && e.target.files[0]; if(!file) return;
  try {
    const d=JSON.parse(await file.text());
    if (!d || !Array.isArray(d.trips)) throw 0;
    const valid = d.trips.filter(t=>t && typeof t.id==='string' && typeof t.name==='string' && Array.isArray(t.members) && Array.isArray(t.expenses)).map(migrateTrip);
    const changed = valid.filter(t=>{ const cur=state.trips.find(x=>x.id===t.id); return !cur || (t.updatedAt||0)>(cur.updatedAt||0); });
    if (!changed.length) { toast('ไม่มีข้อมูลใหม่ในไฟล์นี้', 2500); return; }
    await DB.putTrips(changed);   // written to this device only; the file is read locally and never uploaded
    const added = changed.filter(t=>!state.trips.some(x=>x.id===t.id)).length, updated = changed.length-added;
    changed.forEach(t=>{ const i=state.trips.findIndex(x=>x.id===t.id); if (i<0) state.trips.push(t); else state.trips[i]=t; });
    const newest=[...state.trips].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
    state.setup=null; openTripView(newest.id); render();
    toast(`นำเข้าแล้ว: ทริปใหม่ ${added} · อัปเดต ${updated}`, 2500);
  } catch(_) { toast('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์สำรองจากแอปนี้', 3000); }
});

/* ============ export ============ */
const loaded={};
function loadScript(src){ if(!loaded[src]) loaded[src]=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>{ delete loaded[src]; rej(new Error('load')); }; document.head.appendChild(s); }); return loaded[src]; }
const safeName = s => (s||'trip').replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,60) || 'trip';
/* Hands a file to the user on this device: the iOS/Android share sheet if available, otherwise a normal download.
   The file never goes anywhere unless the user picks a destination in the share sheet. */
async function offerFile(filename, blob){
  try { const file=new File([blob], filename, {type:blob.type}); if (navigator.canShare && navigator.canShare({files:[file]})) { await navigator.share({files:[file], title:filename}); return; } }
  catch(e) { if (e && e.name==='AbortError') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
const RP={ink:'#172031', muted:'#667085', line:'#DCE1EA', good:'#0F8A55', bad:'#CC3434', soft:'#F4F6FA'};
const rFace=(m,size)=>`<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${tint(m.color,.2)};border:${Math.max(2,size/14)}px solid ${m.color};font-size:${Math.round(size*.55)}px;line-height:1;flex:none">${m.emoji}</span>`;
function reportPages(t,W,H){
  const code=t.currency, c=tripCalc(t), xs=settle(c.net), exps=sortedExpenses(t);
  const font=`font-family:Anuphan,'Noto Sans Thai',sans-serif;color:${RP.ink}`, dfont=`font-family:Mitr,Anuphan,sans-serif;font-weight:500`;
  const range = exps.length?`${dayDate(exps[0].at)} – ${dayDate(exps[exps.length-1].at)}`:'';
  const page=(inner,n,of)=>`<div style="${font};width:${W}px;height:${H}px;background:#fff;padding:44px 48px;box-sizing:border-box;position:relative;overflow:hidden">${inner}<div style="position:absolute;left:48px;right:48px;bottom:24px;display:flex;justify-content:space-between;font-size:12px;color:${RP.muted}"><span>${esc(t.name)}</span><span>หน้า ${n}/${of}</span></div></div>`;
  const netTxt=v=>v>0?`<span style="color:${RP.good};font-weight:700">ได้คืน ${fmt(v,code)}</span>`:v<0?`<span style="color:${RP.bad};font-weight:700">จ่ายเพิ่ม ${fmt(-v,code)}</span>`:`<span style="color:${RP.muted}">พอดี</span>`;
  const catTot={}; exps.forEach(e=>catTot[e.cat]=(catTot[e.cat]||0)+e.amount);
  const summary=`<div style="${dfont};font-size:34px;line-height:1.2">${esc(t.name)}</div>
    <div style="color:${RP.muted};margin-top:4px;font-size:15px">${range} · ${t.members.length} คน · ${exps.length} รายการ · ${cur(code)[0]}</div>
    <div style="margin-top:22px;padding:18px 22px;border-radius:18px;background:${RP.soft};display:flex;justify-content:space-between;align-items:center"><span style="font-size:16px;color:${RP.muted}">ใช้ไปทั้งทริป</span><span style="${dfont};font-size:34px">${fmt(c.total,code)}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${CAT_ORDER.filter(k=>catTot[k]).map(k=>`<span style="padding:6px 12px;border-radius:999px;border:1px solid ${RP.line};font-size:13px">${CATS[k].icon} ${CATS[k].short} ${fmt(catTot[k],code)}</span>`).join('')}</div>
    <div style="${dfont};font-size:20px;margin:26px 0 10px">สรุปรายคน</div>
    <table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="color:${RP.muted};font-size:13px"><td style="padding:6px 0">สมาชิก</td><td style="text-align:right">รวมใช้ไป</td><td style="text-align:right">ออกให้ไปก่อน</td><td style="text-align:right">ได้คืน / จ่ายเพิ่ม</td></tr>
    ${t.members.map(m=>`<tr style="border-top:1px solid ${RP.line}"><td style="padding:9px 0"><span style="display:inline-flex;align-items:center;gap:10px">${rFace(m,30)}<b>${esc(m.name)}</b></span></td><td style="text-align:right">${fmt(c.owe[m.id],code)}</td><td style="text-align:right">${fmt(c.paid[m.id],code)}</td><td style="text-align:right">${netTxt(c.net[m.id])}</td></tr>`).join('')}</table>
    <div style="${dfont};font-size:20px;margin:26px 0 10px">โอนเงินเพื่อเคลียร์</div>
    ${xs.length?xs.map(x=>{const a=memberOf(t,x.from),b=memberOf(t,x.to);return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid ${RP.line};font-size:15px">${rFace(a,28)}<b>${esc(a.name)}</b><span style="color:${RP.muted}">โอนให้</span>${rFace(b,28)}<b>${esc(b.name)}</b><span style="margin-left:auto;${dfont};font-size:19px">${fmt(x.amt,code)}</span></div>`;}).join(''):`<div style="color:${RP.muted}">ทุกคนเคลียร์กันครบแล้ว</div>`}`;
  const wA=W>=1000?300:250, wB=100, wM=Math.floor((W-96-wA-wB)/t.members.length), fs=t.members.length>8?11:13;
  const cs=`padding:0 6px;height:30px;border-bottom:1px solid ${RP.line};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:${fs}px`;
  const head=`<tr style="font-size:12px"><th style="${cs};text-align:left;width:${wA}px;font-weight:600">รายการ</th><th style="${cs};width:${wB}px;font-weight:600">รวม</th>${t.members.map(m=>`<th style="${cs};width:${wM}px;background:${tint(m.color,.22)};border-bottom:3px solid ${m.color};font-weight:600">${m.emoji} ${esc(m.name)}</th>`).join('')}</tr>`;
  const rows=exps.map(e=>{ const sh=expShares(e); const pc=Object.keys(e.payers).map(id=>memberOf(t,id)).filter(Boolean).map(m=>m.color);
    const bg=pc.length===1?tint(pc[0],.22):`linear-gradient(90deg,${pc.map(x=>tint(x,.26)).join(',')})`;
    return `<tr><td style="${cs};text-align:left;background:${bg};border-left:4px solid ${pc[0]||'#ccc'}">${CATS[e.cat].icon} ${esc(expName(e))}</td><td style="${cs};font-weight:700;background:${bg}">${fmt(e.amount,code)}</td>${t.members.map(m=>{const v=sh[m.id]||0;return `<td style="${cs}">${isZero(v)?'<span style="color:#bbb">–</span>':fmt(v,code)}</td>`;}).join('')}</tr>`; });
  const bt=`border-top:3.5px solid ${RP.ink}`;
  const foot=[
    `<tr style="background:${RP.soft};font-weight:700"><td style="${cs};${bt};text-align:left">รวมใช้ไป</td><td style="${cs};${bt}">${fmt(c.total,code)}</td>${t.members.map(m=>`<td style="${cs};${bt}">${fmt(c.owe[m.id],code)}</td>`).join('')}</tr>`,
    `<tr style="background:${RP.soft};font-weight:700"><td style="${cs};text-align:left">ออกให้ไปก่อน</td><td style="${cs}">${fmt(c.total,code)}</td>${t.members.map(m=>`<td style="${cs}">${fmt(c.paid[m.id],code)}</td>`).join('')}</tr>`,
    `<tr style="background:${RP.soft};font-weight:700"><td style="${cs};text-align:left"><span style="color:${RP.good}">ได้คืน</span>หรือ<span style="color:${RP.bad}">จ่ายเพิ่ม</span></td><td style="${cs}"></td>${t.members.map(m=>{const v=c.net[m.id];return `<td style="${cs};color:${v>0?RP.good:v<0?RP.bad:RP.muted}">${v>0?'+':v<0?'−':''}${fmt(Math.abs(v),code)}</td>`;}).join('')}</tr>`];
  const all=rows.concat(foot), per=Math.floor((H-188)/31), chunks=[];
  for (let i=0;i<all.length;i+=per) chunks.push(all.slice(i,i+per));
  const total=1+chunks.length, pages=[page(summary,1,total)];
  chunks.forEach((ch,i)=>pages.push(page(`<div style="${dfont};font-size:20px;margin-bottom:12px">รายการค่าใช้จ่าย</div><table style="width:100%;border-collapse:collapse;table-layout:fixed">${head}${ch.join('')}</table>`,i+2,total)));
  return pages;
}
async function renderToCanvas(html,opts={}){
  const host=document.createElement('div'); host.style.cssText='position:fixed;left:-30000px;top:0;z-index:-1'; host.innerHTML=html; document.body.appendChild(host);
  try { await document.fonts.ready; return await window.html2canvas(host.firstElementChild,{scale:opts.scale||2, backgroundColor:'#ffffff', logging:false}); }
  finally { host.remove(); }
}
async function exportPDF(){
  const t=curTrip(); toast('กำลังสร้าง PDF…',8000);
  try {
    await loadScript(LIB.h2c); await loadScript(LIB.pdf);
    const land=t.members.length>4, W=land?1123:794, H=land?794:1123;
    const pages=reportPages(t,W,H);
    const pdf=new window.jspdf.jsPDF({orientation:land?'landscape':'portrait', unit:'pt', format:'a4'});
    const pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight();
    for (let i=0;i<pages.length;i++){ const cv=await renderToCanvas(pages[i]); if(i) pdf.addPage('a4',land?'landscape':'portrait'); pdf.addImage(cv.toDataURL('image/jpeg',.92),'JPEG',0,0,pw,ph); }
    await offerFile(`${safeName(t.name)}.pdf`, pdf.output('blob'));
  } catch(e) { toast('สร้าง PDF ไม่สำเร็จ ต้องต่ออินเทอร์เน็ตครั้งแรกที่ใช้', 3000); }
}
async function exportXLSX(){
  const t=curTrip(), code=t.currency, d=10**cur(code)[2];
  const r2 = v => Math.round(v)/d;
  toast('กำลังสร้างไฟล์ Excel…',6000);
  try {
    await loadScript(LIB.xlsx);
    const X=window.XLSX, c=tripCalc(t), exps=sortedExpenses(t), nm=id=>memberOf(t,id)?.name||'?';
    const head=['วันที่','เวลา','ประเภท','รายการ','ยอดรวม','จ่ายเป็นสกุลอื่น','คนจ่ายไปก่อน',...t.members.map(m=>`${m.name} ต้องจ่าย`),...t.members.map(m=>`${m.name} จ่ายไปก่อน`)];
    const rows=[head];
    exps.forEach(e=>{ const dt=new Date(e.at), sh=expShares(e);
      rows.push([`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`,`${pad(dt.getHours())}:${pad(dt.getMinutes())}`,CATS[e.cat].label,e.name||'',r2(e.amount), e.orig?`${e.orig.cur} ${fmt(e.orig.amount,e.orig.cur,{noSym:true})} @ ${e.orig.rate}`:'',
        Object.entries(e.payers).map(([id,v])=>`${nm(id)} ${fmt(v,code,{noSym:true})}`).join(', '), ...t.members.map(m=>r2(sh[m.id]||0)), ...t.members.map(m=>r2(e.payers[m.id]||0))]); });
    rows.push([]);
    rows.push(['รวมใช้ไป','','','',r2(c.total),'','',...t.members.map(m=>r2(c.owe[m.id])),...t.members.map(()=>'')]);
    rows.push(['จ่ายไปก่อน','','','',r2(c.total),'','',...t.members.map(()=>''),...t.members.map(m=>r2(c.paid[m.id]))]);
    const ws1=X.utils.aoa_to_sheet(rows); ws1['!cols']=head.map((h,i)=>({wch:i===3?26:i===5?22:i===6?24:Math.max(10,h.length+2)}));
    const s2=[['สมาชิก','ตัวการ์ตูน','รวมใช้ไป','จ่ายไปก่อน','ยอดสุทธิ (+ได้คืน / −จ่ายเพิ่ม)','สถานะ']];
    t.members.forEach(m=>{ const v=c.net[m.id]; s2.push([m.name,m.emoji,r2(c.owe[m.id]),r2(c.paid[m.id]),r2(v),v>0?'ได้คืน':v<0?'จ่ายเพิ่ม':'พอดี']); });
    s2.push([]); s2.push(['ทริป',t.name]); s2.push(['สกุลเงิน',code]); s2.push(['ใช้ไปทั้งทริป',r2(c.total)]);
    const ws2=X.utils.aoa_to_sheet(s2); ws2['!cols']=[{wch:16},{wch:10},{wch:14},{wch:14},{wch:26},{wch:10}];
    const s3=[['จาก','โอนให้','จำนวน']]; settle(c.net).forEach(x=>s3.push([nm(x.from),nm(x.to),r2(x.amt)]));
    const ws3=X.utils.aoa_to_sheet(s3); ws3['!cols']=[{wch:16},{wch:16},{wch:12}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws1,'รายการ'); X.utils.book_append_sheet(wb,ws2,'สรุปรายคน'); X.utils.book_append_sheet(wb,ws3,'โอนเงิน');
    const out=X.write(wb,{bookType:'xlsx',type:'array'});
    await offerFile(`${safeName(t.name)}.xlsx`, new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  } catch(e) { toast('สร้างไฟล์ Excel ไม่สำเร็จ ต้องต่ออินเทอร์เน็ตครั้งแรกที่ใช้', 3000); }
}
async function exportImage(){
  const t=curTrip(), code=t.currency, c=tripCalc(t), xs=settle(c.net);
  toast('กำลังสร้างรูป…',6000);
  try {
    await loadScript(LIB.h2c);
    const dfont=`font-family:Mitr,Anuphan,sans-serif;font-weight:500`;
    const html=`<div style="width:1080px;padding:72px 72px 60px;box-sizing:border-box;background:#E9EDF3;font-family:Anuphan,'Noto Sans Thai',sans-serif;color:${RP.ink}"><div style="background:#fff;border-radius:48px;padding:56px 56px 44px">
      <div style="${dfont};font-size:58px;line-height:1.15">${esc(t.name)}</div>
      <div style="font-size:28px;color:${RP.muted};margin-top:6px">${t.members.length} คน · ${t.expenses.length} รายการ</div>
      <div style="margin-top:34px;font-size:26px;color:${RP.muted}">ใช้ไปทั้งทริป</div><div style="${dfont};font-size:96px;line-height:1.05">${fmt(c.total,code)}</div>
      <div style="margin-top:36px;display:flex;flex-direction:column;gap:14px">${t.members.map(m=>{const v=c.net[m.id],col=v>0?RP.good:v<0?RP.bad:RP.muted,bg=v>0?'#DBF3E6':v<0?'#FBE2E0':RP.soft;return `<div style="display:flex;align-items:center;gap:20px;padding:14px 20px;border-radius:26px;background:${tint(m.color,.14)}">${rFace(m,64)}<span style="font-size:32px;font-weight:600;flex:1">${esc(m.name)}</span><span style="background:${bg};color:${col};padding:10px 22px;border-radius:999px;font-size:30px;font-weight:700">${v>0?'ได้คืน ':v<0?'จ่ายเพิ่ม ':'พอดี '}${fmt(Math.abs(v),code)}</span></div>`;}).join('')}</div>
      ${xs.length?`<div style="${dfont};font-size:34px;margin:40px 0 14px">💸 โอนแบบนี้ก็จบ</div>${xs.map(x=>{const a=memberOf(t,x.from),b=memberOf(t,x.to);return `<div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-top:2px solid ${RP.line};font-size:30px">${rFace(a,52)}<b>${esc(a.name)}</b><span style="color:${RP.muted}">➜</span>${rFace(b,52)}<b>${esc(b.name)}</b><span style="margin-left:auto;${dfont};font-size:38px">${fmt(x.amt,code)}</span></div>`;}).join('')}`:''}
      </div><div style="text-align:center;color:${RP.muted};font-size:22px;margin-top:26px">สรุปเมื่อ ${dayDate(Date.now())}</div></div>`;
    const cv=await renderToCanvas(html,{scale:1});
    const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
    await offerFile(`${safeName(t.name)}-สรุป.png`, blob);
  } catch(e) { toast('สร้างรูปไม่สำเร็จ ต้องต่ออินเทอร์เน็ตครั้งแรกที่ใช้', 3000); }
}

/* ============ events ============ */
const ACT = {
  newTrip(){ startSetup(); state.view='setup'; render(); },
  openTrip(el){ openTripView(el.dataset.id); render(); },
  home(){ state.view='home'; state.tripId=null; render(); },
  setupNext, setupBack, importBackup,
  setCur(el){ state.setup.currency=el.dataset.c; render(); },
  cnt(el){ const s=state.setup; s.count=Math.max(2,Math.min(MAX_MEMBERS,s.count+(+el.dataset.d))); $('#cntOut').textContent=s.count; },
  swapAnimal(){ const s=state.setup, m=s.members[s.idx], inp=$('#memName'); if(inp) m.name=inp.value; m.emoji=nextAnimal(s.members.map(x=>x.emoji), m.emoji); render(); },
  tab(el){ state.tab=el.dataset.t; state.scrollBottom=true; render(); },
  toggleSearch(){ state.searchOpen=!state.searchOpen; if(!state.searchOpen){ state.q=''; state.filter='all'; } state._keepScroll=$('#gridScroll')?.scrollTop??null; state.tab='table'; render(); if(state.searchOpen) setTimeout(()=>$('[data-inp="q"]')?.focus(),40); },
  filter(el){ state.filter=el.dataset.f; state.scrollBottom=true; render(); },
  tripMenu,
  newExp(el){ newFlow(el.dataset.cat); },
  showExp(el){ showExp(el.dataset.id); },
  flowBack, flowClose(){ if (flow && flow.mode==='edit') closeFlow(); else maybeDiscard(); },
  setCat(el){ flow.cat=el.dataset.cat; document.querySelectorAll('.catpick button').forEach(b=>b.classList.toggle('on', b.dataset.cat===flow.cat)); const n=$('[data-inp="expName"]'); if(n) n.placeholder=`ชื่อรายการ (ไม่ใส่ก็ได้) ${CATS[flow.cat].ph}`; },
  toggleMulti(){ flow.multi=!flow.multi; if(!flow.multi && flow.payerSel.length>1) flow.payerSel=[flow.payerSel[0]]; renderFlowKeep(); updatePayNext(); },
  tapPayer, payNext, payamtOk, pickCur,
  payHalf(){ flow.payers=splitInt(flow.amount, flow.payerSel); renderFlow(); },
  payEven(){ flow.payers=splitInt(flow.amount, flow.payerSel); renderFlow(); },
  async typePayer(el){ const t=curTrip(), id=el.dataset.id, m=memberOf(t,id), [a,b]=flow.payerSel;
    const res=await promptAmount({title:`${m.emoji} ${esc(m.name)} จ่ายไปเท่าไหร่?`, sub:`จากทั้งหมด ${fmt(flow.amount,flow.cur)}`, value:toInput(flow.payers[id]||0,flow.cur)});
    if(!res||!flow) return; if(res.value>flow.amount){ toast('เกินยอดรวมไม่ได้'); return; }
    const other=id===a?b:a; flow.payers={[id]:res.value,[other]:flow.amount-res.value}; renderFlow(); },
  splitTap(el){ splitTap(el.dataset.id); },
  uneq(){ flow.pick=!flow.pick; renderFlow(); },
  eq: eqPress
};
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-act]'); if(!el) return;
  const act=el.dataset.act;
  if (act.startsWith('m:')) { const k=act.slice(2); if (modalCtx && modalCtx[k]) modalCtx[k](el); else closeModal(); return; }
  if (ACT[act]) ACT[act](el,e);
});
document.addEventListener('input', e=>{
  const el=e.target, k=el.dataset && el.dataset.inp; if(!k) return;
  if (k==='tripName') { state.setup.name=el.value; $('#setupNextBtn').disabled=!el.value.trim(); }
  else if (k==='memName') { state.setup.members[state.setup.idx].name=el.value; $('#setupNextBtn').disabled=!el.value.trim(); }
  else if (k==='q') { state.q=el.value; const tm=$('#tmain'), t=curTrip(); if(tm&&t) tm.innerHTML=renderLedger(t,tripCalc(t)); }
  else if (k==='expName') flow.name=el.value;
  else if (k==='amount') { flow.amountStr=el.value; updatePayNext(); updateRateEq(); }
  else if (k==='rate') { flow.rateStr=el.value; updatePayNext(); updateRateEq(); }
  else if (k==='payerAmt') { flow.payers[el.dataset.id] = el.value.trim() ? parseAmt(el.value, flow.cur) : 0; updatePayStatus(); }
});
document.addEventListener('keydown', e=>{
  if (e.key==='Escape') { if (modalCtx) (modalCtx.cancel||closeModal)(); return; }
  if (e.key!=='Enter') return;
  const el=e.target; if (!el || el.tagName!=='INPUT') return;
  if (el.id==='mAmt' && modalCtx && modalCtx.ok) { e.preventDefault(); modalCtx.ok(); return; }
  const k=el.dataset.inp;
  if (k==='tripName'||k==='memName') { e.preventDefault(); setupNext(); }
  else if (k==='expName') { e.preventDefault(); $('#amtIn')?.focus(); }
  else if (k==='amount') { e.preventDefault(); if (flow.payerSel.length) payNext(); else el.blur(); }
  else if (k==='payerAmt') { e.preventDefault(); if (!$('#payamtOkBtn').disabled) payamtOk(); }
});
let rsT; window.addEventListener('resize', ()=>{ clearTimeout(rsT); rsT=setTimeout(()=>{ if (state.view==='trip' && !flow) { state._keepScroll=$('#gridScroll')?.scrollTop??null; const tm=$('#tmain'); if (tm && document.activeElement?.dataset?.inp!=='q') render(); } },200); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', ()=>{ if (flow) renderFlow(); else render(); });

/* ============ privacy & data page ============ */
let privacyFrom = 'home';
function openPrivacy(){ if (state.view!=='privacy') privacyFrom = state.view==='trip' ? 'trip' : 'home'; state.view='privacy'; render(); fillPrivacyStatus(); }
function renderPrivacy(){
  const nTrips=state.trips.length, nExp=sum(state.trips.map(t=>t.expenses.length));
  const item=(th,en)=>`<li><span class="ok">✓</span><div><b>${th}</b><small>${en}</small></div></li>`;
  return `<section class="page">
    <header class="tbar"><button class="icon-btn" data-act="privacyBack" aria-label="ย้อนกลับ">${ICON.back}</button><div class="tt"><h1>ข้อมูลและความเป็นส่วนตัว</h1></div></header>
    <div class="page-body">
      <ul class="plist-priv">
        ${item('ข้อมูลเก็บอยู่ในเครื่องนี้เท่านั้น','Data is stored locally on this device.')}
        ${item('ไม่มีการส่งข้อมูลทริปหรือค่าใช้จ่ายไปยังเซิร์ฟเวอร์','No trip or expense data is sent to a server.')}
        ${item('ใช้งานได้แม้ไม่มีอินเทอร์เน็ต','The app works offline.')}
        ${item('ข้อมูลจะไม่ถูกซิงก์ขึ้นคลาวด์อัตโนมัติ','Data will not be synchronized to the cloud automatically.')}
      </ul>
      <p class="note">ทุกอย่างเก็บในฐานข้อมูล IndexedDB ของเบราว์เซอร์ในเครื่องนี้ การคำนวณทั้งหมดทำในเครื่อง หน้าแอปถูกตั้งให้เบราว์เซอร์บล็อกการเชื่อมต่อออกไปข้างนอก (Content-Security-Policy <code>connect-src 'none'</code>) อินเทอร์เน็ตใช้แค่ตอนดาวน์โหลดและอัปเดตตัวแอปเท่านั้น ไม่มีการส่งข้อมูลที่คุณกรอกไปด้วย</p>
      <h2 class="ph">พื้นที่ในเครื่อง</h2>
      <div class="stat">
        <div><span class="head">ข้อมูลของคุณ</span><b class="num">${fmtBytes(tripsBytes())}</b></div>
        <div class="sub-row"><span>${nTrips} ทริป · ${nExp} รายการ</span><span>IndexedDB “tripsplit”</span></div>
        ${[...state.trips].sort((x,y)=>tripBytes(y)-tripBytes(x)).map(t=>`<div class="sub-row"><span>${esc(t.name)} (${t.expenses.length} รายการ)</span><b class="num">${fmtBytes(tripBytes(t))}</b></div>`).join('')}
        <div><span class="head">ไฟล์ตัวแอป</span><b class="num" id="stApp">…</b></div>
        <div class="sub-row"><span>โค้ด ฟอนต์ ไลบรารี (ขนาดคงที่ ไม่โตตามจำนวนรายการ)</span><span>Cache Storage</span></div>
        <div><span>รวมที่เบราว์เซอร์นับ<br><small style="font-size:11.5px">มักมากกว่าผลรวมข้างบน เพราะเบราว์เซอร์นับพื้นที่เผื่อไว้ด้วย</small></span><b class="num" id="stUsage">…</b></div>
      </div>
      <p class="note">ไฟล์ที่ export (PDF / Excel / รูป / JSON) เป็นสำเนาที่อยู่ในที่ที่คุณเลือกตอนแชร์ เช่นแอป Files แอปนี้ไม่ได้จัดการไฟล์เหล่านั้น</p>
      <div class="stat">
        <div><span>ป้องกันเบราว์เซอร์ลบข้อมูลเอง</span><b id="stPersist">…</b></div>
        <div><span>พร้อมใช้แบบออฟไลน์</span><b id="stOffline">…</b></div>
      </div>
      <h2 class="ph">สำรองและกู้คืน</h2>
      <div class="menu">
        <button data-act="exportData"><span class="e">💾</span><span>Export Data<small>บันทึกทุกทริปเป็นไฟล์ JSON เก็บไว้เอง</small></span></button>
        <button data-act="importBackup"><span class="e">📂</span><span>Import Data<small>เลือกไฟล์ JSON ที่เคย export ไว้ (อ่านในเครื่อง ไม่อัปโหลด)</small></span></button>
        <button data-act="deleteAll" class="danger"><span class="e">🗑️</span><span>Delete All Data<small>ลบทุกทริปออกจากเครื่องนี้</small></span></button>
      </div>
      <p class="note">ข้อมูลไม่มีสำรองที่อื่น ถ้าลบแอปออกจากหน้าจอโฮม ล้างข้อมูลเว็บไซต์ หรือเปลี่ยนเครื่อง ข้อมูลจะหายไป ควร Export Data เก็บไว้เป็นระยะ<br>บน iPhone: ให้เปิดจากไอคอนบนหน้าจอโฮมเสมอ เพราะข้อมูลในไอคอนหน้าจอโฮมกับใน Safari แยกกัน</p>
    </div></section>`;
}
const tripBytes = t => new Blob([JSON.stringify(t)]).size;
const tripsBytes = () => sum(state.trips.map(tripBytes));
function fmtBytes(n){ if (n==null) return 'ไม่ทราบ'; if (n<1024) return n+' B'; if (n<1048576) return (n/1024).toFixed(n<10240?1:0)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
async function appCacheBytes(){
  // reads sizes of the app files already in this device's cache (no network)
  let total=0;
  for (const k of await caches.keys()) { const c=await caches.open(k); for (const r of await c.keys()) { const res=await c.match(r); if (res) total += (await res.blob()).size; } }
  return total;
}
async function fillPrivacyStatus(){
  const set=(id,v)=>{ const el=$('#'+id); if (el) el.textContent=v; };
  try { set('stApp', 'caches' in window ? fmtBytes(await appCacheBytes()) : 'ไม่มี'); } catch(_) { set('stApp','ไม่ทราบ'); }
  try { const e=await navigator.storage.estimate(); set('stUsage', fmtBytes(e.usage)); } catch(_) { set('stUsage','ไม่ทราบ'); }
  try { set('stPersist', (await navigator.storage.persisted()) ? 'เปิดอยู่' : 'เบราว์เซอร์ยังไม่อนุญาต'); } catch(_) { set('stPersist','ไม่รองรับ'); }
  set('stOffline', navigator.serviceWorker && navigator.serviceWorker.controller ? 'พร้อม' : 'ยัง (เปิดแอปอีกครั้งตอนมีเน็ต)');
}
async function deleteAllData(){
  const n=state.trips.length;
  const ok = await new Promise(res=>{
    openModal(`<h3>ลบข้อมูลทั้งหมด?</h3><p>ทุกทริป (${n} ทริป) และทุกรายการในเครื่องนี้จะถูกลบถาวร กู้คืนไม่ได้ ถ้ายังไม่ได้ Export Data ไว้ ควรทำก่อน</p>
      <label style="font-size:14px;font-weight:600">พิมพ์คำว่า <b>ลบ</b> เพื่อยืนยัน<input class="field" id="delConfirm" autocomplete="off" style="margin-top:6px"></label>
      <div class="acts"><button class="btn btn-ghost" data-act="m:cancel">ยกเลิก</button><button class="btn btn-danger" data-act="m:ok">ลบทั้งหมด</button></div>`,
    { ok:()=>{ if ($('#delConfirm').value.trim()!=='ลบ') { $('#delConfirm').focus(); toast('พิมพ์คำว่า ลบ ก่อน'); return; } closeModal(); res(true); },
      cancel:()=>{ closeModal(); res(false); } });
  });
  if (!ok) return;
  try { await DB.clearAll(); try { localStorage.removeItem(LEGACY_LS_KEY); } catch(_) {} }
  catch(e) { toast('ลบไม่สำเร็จ ลองอีกครั้ง', 3000); return; }
  state.trips=[]; state.lastTripId=null; state.tripId=null; flow=null; startSetup(); state.view='setup'; render();
  toast('ลบข้อมูลทั้งหมดแล้ว', 2500);
}
Object.assign(ACT, {
  privacy: openPrivacy,
  privacyBack(){ state.view = (privacyFrom==='trip' && curTrip()) ? 'trip' : 'home'; render(); },
  exportData: exportBackup,
  deleteAll: deleteAllData
});

/* ============ boot: reopen the trip you were on ============ */
async function boot(){
  try { await DB.open(); }
  catch(e) {
    $('#app').innerHTML = `<div class="empty"><h2>เปิดฐานข้อมูลในเครื่องไม่ได้</h2><p>เบราว์เซอร์นี้ไม่อนุญาตให้เก็บข้อมูล (เช่น โหมดส่วนตัว) ลองเปิดแบบปกติ หรือเปิดจากไอคอนบนหน้าจอโฮม</p></div>`;
    return;
  }
  await migrateLegacy();
  try {
    state.trips = (await DB.getAllTrips()).map(migrateTrip);
    state.lastTripId = (await DB.getMeta('lastTripId')) || null;
  } catch(e) { state.trips = []; }
  if (state.trips.length) {
    const last = state.trips.find(t=>t.id===state.lastTripId) || [...state.trips].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
    openTripView(last.id);
  } else { startSetup(); state.view='setup'; }
  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(_) {}
}
boot();
// Offline support. The service worker only caches this app's own files (see sw.js).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
