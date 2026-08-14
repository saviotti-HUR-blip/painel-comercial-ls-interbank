/* ============================================
   FIDC LS Interbank — Painel Comercial
   app.js — Core Logic v2 (com sistema de usuários)
============================================ */

'use strict';

// ============================================
// DATA — MANAGERS, GOALS, WEEKS
// ============================================

const MANAGER_KEYS = ['SUPERINTENDENTE','VECLAINE','RAFAELA','ANA_ADM','MARLENE','WESLEI','RICARDO'];

const MANAGER_COLORS = {
  SUPERINTENDENTE: '#3b82f6',
  VECLAINE:        '#8b5cf6',
  RAFAELA:         '#10b981',
  ANA_ADM:         '#f59e0b',
  MARLENE:         '#ef4444',
  WESLEI:          '#06b6d4',
  RICARDO:         '#ec4899',
};

const MONTH_YEAR = 'Agosto 2026';
const MONTH_NUM  = 7;
const YEAR_NUM   = 2026;

const DEFAULT_GOALS = {
  vop: {
    SUPERINTENDENTE: 59850000,
    VECLAINE:        35500000,
    RAFAELA:         34500000,
    ANA_ADM:         33500000,
    MARLENE:         31000000,
    WESLEI:           7000000,
    RICARDO:          1000000,
  },
  receita: {
    SUPERINTENDENTE: 2196735,
    VECLAINE:        1235058,
    RAFAELA:         1316372,
    ANA_ADM:          959150,
    MARLENE:         1005172,
    WESLEI:           150000,
    RICARDO:           50000,
  },
  cadastros:  20,
  ativacoes:   5,
};

const MONTH_WEEKS = [
  { id:'w1', label:'28/07–01/08', start:new Date(2026,6,28), end:new Date(2026,7,1),  short:'Sem 1' },
  { id:'w2', label:'03/08–07/08', start:new Date(2026,7,3),  end:new Date(2026,7,7),  short:'Sem 2' },
  { id:'w3', label:'10/08–14/08', start:new Date(2026,7,10), end:new Date(2026,7,14), short:'Sem 3' },
  { id:'w4', label:'17/08–21/08', start:new Date(2026,7,17), end:new Date(2026,7,21), short:'Sem 4' },
  { id:'w5', label:'24/08–28/08', start:new Date(2026,7,24), end:new Date(2026,7,28), short:'Sem 5' },
];

// ============================================
// DEFAULT USERS
// ============================================

const DEFAULT_USERS = [
  {
    id: 'u_super',
    username: 'superintendente',
    password: 'ls2026',
    displayName: 'Superintendente',
    managerKey: 'SUPERINTENDENTE',
    role: 'superintendent',
    active: true,
    createdAt: new Date().toISOString(),
  },
  { id:'u_vec',  username:'veclaine', password:'ls2026', displayName:'Veclaine',  managerKey:'VECLAINE', role:'manager', active:true, createdAt:new Date().toISOString() },
  { id:'u_raf',  username:'rafaela',  password:'ls2026', displayName:'Rafaela',   managerKey:'RAFAELA',  role:'manager', active:true, createdAt:new Date().toISOString() },
  { id:'u_ana',  username:'ana_adm',  password:'ls2026', displayName:'Ana ADM',   managerKey:'ANA_ADM',  role:'manager', active:true, createdAt:new Date().toISOString() },
  { id:'u_mar',  username:'marlene',  password:'ls2026', displayName:'Marlene',   managerKey:'MARLENE',  role:'manager', active:true, createdAt:new Date().toISOString() },
  { id:'u_wes',  username:'weslei',   password:'ls2026', displayName:'Weslei',    managerKey:'WESLEI',   role:'manager', active:true, createdAt:new Date().toISOString() },
  { id:'u_ric',  username:'ricardo',  password:'ls2026', displayName:'Ricardo',   managerKey:'RICARDO',  role:'manager', active:true, createdAt:new Date().toISOString() },
];

// ============================================
// STATE
// ============================================

let state = {
  goals:           null,
  entries:         [],
  users:           [],
  currentUser:     null,
  dashboardWeek:   'all',
  sidebarCollapsed:false,
  formType:        'previsto',
  cadTags:         [],
  atvTags:         [],
  editingUserId:   null,
};

// ============================================
// PERSISTENCE
// ============================================

function saveState() {
  localStorage.setItem('ls_goals',   JSON.stringify(state.goals));
  localStorage.setItem('ls_entries', JSON.stringify(state.entries));
  localStorage.setItem('ls_users',   JSON.stringify(state.users));
}

function loadState() {
  try { state.goals   = JSON.parse(localStorage.getItem('ls_goals'))   || JSON.parse(JSON.stringify(DEFAULT_GOALS)); }
  catch { state.goals = JSON.parse(JSON.stringify(DEFAULT_GOALS)); }

  try { state.entries = JSON.parse(localStorage.getItem('ls_entries')) || []; }
  catch { state.entries = []; }

  try {
    const saved = JSON.parse(localStorage.getItem('ls_users'));
    state.users = saved && saved.length > 0 ? saved : JSON.parse(JSON.stringify(DEFAULT_USERS));
  } catch { state.users = JSON.parse(JSON.stringify(DEFAULT_USERS)); }
}

// Session (survives page refresh within tab)
function saveSession()  { sessionStorage.setItem('ls_session', JSON.stringify({ id: state.currentUser?.id })); }
function loadSession()  {
  try {
    const s = JSON.parse(sessionStorage.getItem('ls_session'));
    if (s && s.id) return state.users.find(u => u.id === s.id && u.active) || null;
  } catch {}
  return null;
}

// ============================================
// UTILS
// ============================================

function formatBRL(v) {
  if (v == null || v === '' || isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
}
function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g,'').replace(',','.').replace(/[^0-9.]/g,'')) || 0;
}
function formatMoneyInput(input) {
  input.addEventListener('input', function() {
    let raw = this.value.replace(/\D/g,'');
    if (!raw) { this.value=''; return; }
    let num = parseInt(raw,10)/100;
    this.value = num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  });
}
function pctClass(pct) {
  if (pct==null||isNaN(pct)) return 'null';
  if (pct>=90) return 'good';
  if (pct>=60) return 'warn';
  return 'bad';
}
function getCurrentWeek() {
  const now = new Date();
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  for (const w of MONTH_WEEKS) if(today>=w.start&&today<=w.end) return w.id;
  if(today<MONTH_WEEKS[0].start) return MONTH_WEEKS[0].id;
  return MONTH_WEEKS[MONTH_WEEKS.length-1].id;
}
function getWeek(id)    { return MONTH_WEEKS.find(w=>w.id===id); }
function weekStatus(w)  {
  const today = new Date(); today.setHours(0,0,0,0);
  if(today>w.end)    return 'past';
  if(today>=w.start) return 'current';
  return 'future';
}
function isSuper()      { return state.currentUser?.role === 'superintendent'; }
function toast(msg, type='info', dur=3500) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type==='success'?'✅': type==='error'?'❌':'ℹ️';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastOut 0.3s ease forwards'; setTimeout(()=>t.remove(),300); }, dur);
}
function genId() { return 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

// ============================================
// AUTH — LOGIN / LOGOUT
// ============================================

function doLogin() {
  const uInput = document.getElementById('login-user').value.trim().toLowerCase();
  const pInput = document.getElementById('login-pass').value;
  const errEl  = document.getElementById('login-error');

  const user = state.users.find(u => u.username.toLowerCase() === uInput && u.password === pInput && u.active);
  if (!user) {
    errEl.classList.remove('hidden');
    document.getElementById('login-pass').value = '';
    setTimeout(() => errEl.classList.add('hidden'), 3000);
    return;
  }

  state.currentUser = user;
  saveSession();
  showApp();
}

function doLogout() {
  state.currentUser = null;
  sessionStorage.removeItem('ls_session');
  closeUserDropdown();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  toast('Sessão encerrada. Até logo! 👋','info');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  applyUserContext();
  renderWeekFilterBar();
  renderDashboard();
  renderSavedEntries();
  updateFormManagerDisplay();
}

function applyUserContext() {
  const u = state.currentUser;
  if (!u) return;

  // Nav chips
  const initials = u.displayName.split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('user-avatar-nav').textContent = initials;
  document.getElementById('user-name-nav').textContent   = u.displayName;
  document.getElementById('user-role-nav').textContent   = u.role==='superintendent' ? '👑 Superintendente' : '👤 Gerente';
  document.getElementById('udrop-avatar').textContent    = initials;
  document.getElementById('udrop-name').textContent      = u.displayName;
  document.getElementById('udrop-role').textContent      = u.role==='superintendent' ? '👑 Superintendente' : '👤 Gerente Comercial';

  // Show/hide Usuarios tab
  document.querySelectorAll('.super-only').forEach(el => {
    el.classList.toggle('hidden', !isSuper());
  });

  // Style avatar color
  const color = MANAGER_COLORS[u.managerKey] || '#3b82f6';
  document.getElementById('user-avatar-nav').style.background = color;
  document.getElementById('udrop-avatar').style.background = color;
}

// ============================================
// USER DROPDOWN
// ============================================

function openUserMenu() {
  const dd = document.getElementById('user-dropdown');
  dd.classList.toggle('hidden');
}
function closeUserDropdown() {
  document.getElementById('user-dropdown').classList.add('hidden');
}

// ============================================
// CHANGE PASSWORD
// ============================================

function openChangePassword() {
  closeUserDropdown();
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value     = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('change-pass-modal').classList.remove('hidden');
}
function closeChangePassword() { document.getElementById('change-pass-modal').classList.add('hidden'); }
function saveChangePassword() {
  const cur  = document.getElementById('cp-current').value;
  const nw   = document.getElementById('cp-new').value;
  const conf = document.getElementById('cp-confirm').value;
  if (cur !== state.currentUser.password) { toast('Senha atual incorreta!','error'); return; }
  if (!nw || nw.length < 4)               { toast('Nova senha muito curta (mín. 4 caracteres)','error'); return; }
  if (nw !== conf)                         { toast('As senhas não coincidem!','error'); return; }
  const idx = state.users.findIndex(u => u.id === state.currentUser.id);
  state.users[idx].password  = nw;
  state.currentUser.password = nw;
  saveState();
  closeChangePassword();
  toast('Senha alterada com sucesso! 🔑','success');
}

// ============================================
// PASS TOGGLE
// ============================================

function initPassToggle() {
  const btn   = document.getElementById('pass-toggle-btn');
  const input = document.getElementById('login-pass');
  if (!btn||!input) return;
  btn.addEventListener('click', () => {
    const isPass = input.type === 'password';
    input.type   = isPass ? 'text' : 'password';
    btn.textContent = isPass ? '🙈' : '👁';
  });
}

// ============================================
// AGGREGATION
// ============================================

function getActiveManagers() {
  return state.users.filter(u => u.active).map(u => u.managerKey);
}

function aggregateVOP(weekFilter='all') {
  const currentWIdx = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const result = {};
  for (const u of state.users.filter(u=>u.active)) {
    const m = u.managerKey;
    let previsto=0, realizado=0;
    let filteredEntries = weekFilter==='all'
      ? state.entries.filter(e => { const wi=MONTH_WEEKS.findIndex(w=>w.id===e.weekId); return e.manager===m && wi<=currentWIdx; })
      : state.entries.filter(e => e.manager===m && e.weekId===weekFilter);
    for (const e of filteredEntries) {
      if(e.type==='previsto')  previsto  += e.vopTotal||0;
      if(e.type==='realizado') realizado += e.vopTotal||0;
    }
    result[m] = { previsto, realizado };
  }
  return result;
}

function aggregateCadAtv(weekFilter='all') {
  const currentWIdx = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  let cadPrev=0,cadReal=0,atvPrev=0,atvReal=0;
  const byManager = {};
  for (const u of state.users) byManager[u.managerKey] = {cadPrev:0,cadReal:0,atvPrev:0,atvReal:0};

  const filtered = weekFilter==='all'
    ? state.entries.filter(e=>{ const wi=MONTH_WEEKS.findIndex(w=>w.id===e.weekId); return wi<=currentWIdx; })
    : state.entries.filter(e=>e.weekId===weekFilter);

  for (const e of filtered) {
    if(!byManager[e.manager]) byManager[e.manager]={cadPrev:0,cadReal:0,atvPrev:0,atvReal:0};
    if(e.type==='previsto')  { cadPrev+=(e.cadastros||[]).length; atvPrev+=(e.ativacoes||[]).length; byManager[e.manager].cadPrev+=(e.cadastros||[]).length; byManager[e.manager].atvPrev+=(e.ativacoes||[]).length; }
    else                      { cadReal+=(e.cadastros||[]).length; atvReal+=(e.ativacoes||[]).length; byManager[e.manager].cadReal+=(e.cadastros||[]).length; byManager[e.manager].atvReal+=(e.ativacoes||[]).length; }
  }
  return { cadPrev,cadReal,atvPrev,atvReal,byManager };
}

function getAllCedentes(weekFilter='all') {
  const currentWIdx = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const filtered = weekFilter==='all'
    ? state.entries.filter(e=>{ const wi=MONTH_WEEKS.findIndex(w=>w.id===e.weekId); return wi<=currentWIdx; })
    : state.entries.filter(e=>e.weekId===weekFilter);
  const result=[];
  for(const e of filtered) for(const c of (e.cedentes||[])) result.push({manager:e.manager,weekId:e.weekId,type:e.type,nome:c.nome,valor:c.valor});
  return result;
}

// ============================================
// WEEK FILTER BAR
// ============================================

function renderWeekFilterBar() {
  const chips    = document.getElementById('week-chips');
  chips.innerHTML= '';
  const currentWId = getCurrentWeek();

  const allChip = document.createElement('button');
  allChip.className = `week-chip ${state.dashboardWeek==='all'?'active':''}`;
  allChip.textContent = '📊 Acumulado';
  allChip.onclick = ()=>setDashboardWeek('all');
  chips.appendChild(allChip);

  for (const w of MONTH_WEEKS) {
    const st   = weekStatus(w);
    const chip = document.createElement('button');
    chip.className = `week-chip ${st==='past'?'past':''} ${st==='future'?'future':''} ${state.dashboardWeek===w.id?'active':''}`;
    chip.textContent = `${w.short}: ${w.label}${w.id===currentWId?' 📍':''}`;
    chip.onclick = ()=>setDashboardWeek(w.id);
    chips.appendChild(chip);
  }

  // Month progress
  const now       = new Date();
  const monthStart= new Date(YEAR_NUM,MONTH_NUM,1);
  const monthEnd  = new Date(YEAR_NUM,MONTH_NUM+1,0);
  const pct = Math.min(100,Math.round(((now-monthStart)/(monthEnd-monthStart))*100));
  document.getElementById('month-progress-bar').style.width = pct+'%';
  document.getElementById('month-progress-pct').textContent = pct+'%';

  const cw = getWeek(currentWId);
  document.getElementById('week-label-nav').textContent = cw?cw.label:'Atual';
}

function setDashboardWeek(id) {
  state.dashboardWeek=id;
  renderWeekFilterBar();
  renderDashboard();
}

// ============================================
// KPI ROW
// ============================================

function renderKPIRow() {
  const vops = aggregateVOP(state.dashboardWeek);
  const ca   = aggregateCadAtv(state.dashboardWeek);

  const totalVOPGoal  = Object.values(state.goals.vop).reduce((a,b)=>a+b,0);
  const totalVOPPrev  = Object.values(vops).reduce((a,v)=>a+v.previsto,0);
  const totalVOPReal  = Object.values(vops).reduce((a,v)=>a+v.realizado,0);

  const currentWIdx   = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const weeksElapsed  = currentWIdx+1;
  const weekProp      = state.dashboardWeek==='all' ? weeksElapsed/MONTH_WEEKS.length : 1/MONTH_WEEKS.length;
  const vopGoalProp   = totalVOPGoal*weekProp;

  const vopRealPct  = vopGoalProp >0 ? Math.round((totalVOPReal /vopGoalProp)*100) : null;
  const assertPct   = totalVOPPrev>0 ? Math.round((totalVOPReal /totalVOPPrev)*100) : null;

  const kpis = [
    { label:'VOP Realizado',       value:formatBRL(totalVOPReal),  sub:`Meta: ${formatBRL(totalVOPGoal)}`,                    pct:Math.min(100,totalVOPGoal>0?(totalVOPReal/totalVOPGoal)*100:0),       badge:vopRealPct!=null?vopRealPct+'%':'—', badgeClass:pctClass(vopRealPct), color:'blue'   },
    { label:'VOP Previsto (Equipe)',value:formatBRL(totalVOPPrev),  sub:`Acumulado — sem. ${weeksElapsed} de ${MONTH_WEEKS.length}`, pct:Math.min(100,totalVOPGoal>0?(totalVOPPrev/totalVOPGoal)*100:0), badge:totalVOPGoal>0?Math.round((totalVOPPrev/totalVOPGoal)*100)+'%':'—', badgeClass:'neutral', color:'purple' },
    { label:'Cadastros Realizados', value:ca.cadReal,               sub:`Meta: ${state.goals.cadastros} · Previsto: ${ca.cadPrev}`, pct:Math.min(100,state.goals.cadastros>0?(ca.cadReal/state.goals.cadastros)*100:0), badge:state.goals.cadastros>0?Math.round((ca.cadReal/state.goals.cadastros)*100)+'%':'—', badgeClass:pctClass(state.goals.cadastros>0?Math.round((ca.cadReal/state.goals.cadastros)*100):null), color:'green' },
    { label:'Ativações Realizadas', value:ca.atvReal,               sub:`Meta: ${state.goals.ativacoes} · Previsto: ${ca.atvPrev}`, pct:Math.min(100,state.goals.ativacoes>0?(ca.atvReal/state.goals.ativacoes)*100:0), badge:state.goals.ativacoes>0?Math.round((ca.atvReal/state.goals.ativacoes)*100)+'%':'—', badgeClass:pctClass(state.goals.ativacoes>0?Math.round((ca.atvReal/state.goals.ativacoes)*100):null), color:'amber' },
    { label:'Assertividade VOP',    value:assertPct!=null?assertPct+'%':'—', sub:'Realizado ÷ Previsto pela equipe', pct:Math.min(100,assertPct||0), badge:assertPct!=null?(assertPct>=80?'✓ Boa':'⚠ Baixa'):'—', badgeClass:assertPct!=null?pctClass(assertPct):'null', color:'cyan' },
  ];

  document.getElementById('kpi-row').innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.color}">
      <div class="kpi-badge ${k.badgeClass}">${k.badge}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${k.pct}%"></div></div>
    </div>`).join('');
}

// ============================================
// VOP TABLE
// ============================================

function renderVOPTable() {
  const vops = aggregateVOP(state.dashboardWeek);
  document.getElementById('vop-week-label').textContent = state.dashboardWeek==='all' ? 'Acumulado' : (getWeek(state.dashboardWeek)?.label||'');
  const currentWIdx  = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const weekProp     = state.dashboardWeek==='all' ? (currentWIdx+1)/MONTH_WEEKS.length : 1/MONTH_WEEKS.length;

  const activeUsers  = state.users.filter(u=>u.active);
  const rows         = activeUsers.map(u => {
    const m        = u.managerKey;
    const goalFull = state.goals.vop[m]||0;
    const prev     = vops[m]?.previsto||0;
    const real     = vops[m]?.realizado||0;
    const pctMeta  = goalFull>0 ? Math.round((real/goalFull)*100) : null;
    const assertiv = prev>0     ? Math.round((real/prev)*100)     : null;
    const barWidth = goalFull>0 ? Math.min(100,(real/goalFull)*100) : 0;
    return { m, goalFull, prev, real, pctMeta, assertiv, barWidth, color: MANAGER_COLORS[m]||'#3b82f6', displayName:u.displayName };
  }).sort((a,b)=>b.real-a.real);

  document.getElementById('vop-tbody').innerHTML = rows.map(r=>`
    <tr>
      <td><div class="manager-chip"><div class="manager-dot" style="background:${r.color}"></div>${r.displayName}</div></td>
      <td style="color:var(--text-2);font-size:11px">${formatBRL(r.goalFull)}</td>
      <td style="color:var(--text-2)">${r.prev>0?formatBRL(r.prev):'—'}</td>
      <td><div style="display:flex;align-items:center;gap:6px">
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${r.barWidth}%;background:${r.color}"></div></div>
        <span style="font-weight:600;color:${r.real>0?'var(--text-1)':'var(--text-3)'}">${r.real>0?formatBRL(r.real):'—'}</span>
      </div></td>
      <td><span class="pct-badge ${pctClass(r.pctMeta)}">${r.pctMeta!=null?r.pctMeta+'%':'—'}</span></td>
      <td><span class="pct-badge ${pctClass(r.assertiv)}">${r.assertiv!=null?r.assertiv+'%':'—'}</span></td>
    </tr>`).join('');
}

// ============================================
// GAUGE
// ============================================

function drawGauge(canvasId, value, max, color) {
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx=W/2, cy=H-10, R=Math.min(W,H)*0.85;
  const pct = max>0?Math.min(1,value/max):0;
  ctx.beginPath(); ctx.arc(cx,cy,R/2,Math.PI,2*Math.PI); ctx.lineWidth=14; ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineCap='round'; ctx.stroke();
  if(pct>0){
    const g=ctx.createLinearGradient(cx-R/2,cy,cx+R/2,cy);
    g.addColorStop(0,color+'cc'); g.addColorStop(1,color);
    ctx.beginPath(); ctx.arc(cx,cy,R/2,Math.PI,Math.PI+pct*Math.PI); ctx.lineWidth=14; ctx.strokeStyle=g; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.textAlign='center';
  ctx.font=`800 22px 'Outfit',sans-serif`; ctx.fillStyle='#f1f5f9';
  ctx.fillText(Math.round(pct*100)+'%', cx, cy-R/2+6);
}

function renderGauges() {
  const ca = aggregateCadAtv(state.dashboardWeek);
  document.getElementById('cad-realizado').textContent = ca.cadReal;
  document.getElementById('cad-previsto').textContent  = ca.cadPrev;
  document.getElementById('cad-meta').textContent      = state.goals.cadastros;
  document.getElementById('atv-realizado').textContent = ca.atvReal;
  document.getElementById('atv-previsto').textContent  = ca.atvPrev;
  document.getElementById('atv-meta').textContent      = state.goals.ativacoes;
  drawGauge('gauge-cadastros', ca.cadReal, state.goals.cadastros, '#10b981');
  drawGauge('gauge-ativacoes', ca.atvReal, state.goals.ativacoes, '#f59e0b');
  renderManagerBars('cad-manager-list', ca.byManager, 'cad', state.goals.cadastros);
  renderManagerBars('atv-manager-list', ca.byManager, 'atv', state.goals.ativacoes);
}

function renderManagerBars(containerId, byManager, key, totalGoal) {
  const container = document.getElementById(containerId);
  if(!container) return;
  const rKey = key+'Real';
  const pKey = key+'Prev';
  const sorted = state.users.filter(u=>u.active).sort((a,b)=>(byManager[b.managerKey]?.[rKey]||0)-(byManager[a.managerKey]?.[rKey]||0));
  const items = sorted.filter(u => (byManager[u.managerKey]?.[rKey]||0)>0 || (byManager[u.managerKey]?.[pKey]||0)>0);
  container.innerHTML = items.length===0
    ? '<div style="color:var(--text-3);font-size:11px;text-align:center;padding:8px">Sem registros</div>'
    : items.map(u=>{
        const val=byManager[u.managerKey]?.[rKey]||0;
        const pct=totalGoal>0?Math.min(100,(val/totalGoal)*100):0;
        return `<div class="mgr-tag-row">
          <span class="mgr-tag-name">${u.displayName}</span>
          <div class="mgr-tag-bar"><div class="mgr-tag-fill" style="width:${pct}%;background:${MANAGER_COLORS[u.managerKey]||'#3b82f6'}"></div></div>
          <span class="mgr-tag-val">${val}</span>
        </div>`;
      }).join('');
}

// ============================================
// CEDENTES
// ============================================

function renderCedentesList() {
  const list     = document.getElementById('cedentes-list');
  const selMgr   = document.getElementById('cedentes-manager-filter')?.value || 'all';
  let cedentes   = getAllCedentes(state.dashboardWeek);
  if(selMgr!=='all') cedentes=cedentes.filter(c=>c.manager===selMgr);
  if(!list) return;
  if(cedentes.length===0){
    list.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-title">Nenhum cedente cadastrado</div><div class="empty-state-desc">Adicione cedentes via Formulário</div></div>`;
    return;
  }
  cedentes.sort((a,b)=>b.valor-a.valor);
  list.innerHTML=cedentes.map(c=>`
    <div class="cedente-item">
      <div>
        <div class="ci-manager">${getUserByManager(c.manager)?.displayName||c.manager} · ${getWeek(c.weekId)?.short||''} · ${c.type}</div>
        <div class="ci-name">${c.nome||'Cedente'}</div>
      </div>
      <div style="text-align:right"><div class="ci-value">${formatBRL(c.valor)}</div></div>
    </div>`).join('');
}

function getUserByManager(mk) { return state.users.find(u=>u.managerKey===mk); }

function initCedentesFilter() {
  const filter = document.getElementById('cedentes-manager-filter');
  if(!filter) return;
  filter.innerHTML = '<option value="all">Todos</option>' +
    state.users.filter(u=>u.active).map(u=>`<option value="${u.managerKey}">${u.displayName}</option>`).join('');
  filter.onchange = renderCedentesList;
}

// ============================================
// ASSERTIVIDADE CHART
// ============================================

function renderAssertividadeChart() {
  const canvas = document.getElementById('chart-assertividade');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth||400;
  canvas.width=W;
  const H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const currentWIdx = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const weeks = MONTH_WEEKS.slice(0,currentWIdx+1);
  if(weeks.length===0) return;
  const data = weeks.map(w=>{
    let prev=0,real=0;
    for(const e of state.entries){
      if(e.weekId!==w.id) continue;
      if(e.type==='previsto')  prev+=e.vopTotal||0;
      if(e.type==='realizado') real+=e.vopTotal||0;
    }
    return{label:w.short,prev,real};
  });
  const maxVal=Math.max(...data.flatMap(d=>[d.prev,d.real]),1);
  const padL=36,padR=16,padT=20,padB=32;
  const chartW=W-padL-padR, chartH=H-padT-padB;
  const barW=Math.min(40,(chartW/data.length)*0.35), groupW=chartW/data.length;
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=padT+(chartH/4)*i;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    ctx.fillStyle='rgba(148,163,184,0.6)'; ctx.font='9px Inter'; ctx.textAlign='right';
    ctx.fillText(formatBRL(maxVal*(1-i/4)).replace('R$','').trim(), padL-3, y+3);
  }
  data.forEach((d,i)=>{
    const cx=padL+i*groupW+groupW/2;
    const pH=maxVal>0?(d.prev/maxVal)*chartH:0, rH=maxVal>0?(d.real/maxVal)*chartH:0;
    const gP=ctx.createLinearGradient(0,padT+chartH-pH,0,padT+chartH);
    gP.addColorStop(0,'#8b5cf6'); gP.addColorStop(1,'#6366f1aa');
    ctx.fillStyle=gP; ctx.beginPath(); ctx.roundRect(cx-barW-2,padT+chartH-pH,barW,pH,[3,3,0,0]); ctx.fill();
    const gR=ctx.createLinearGradient(0,padT+chartH-rH,0,padT+chartH);
    gR.addColorStop(0,'#10b981'); gR.addColorStop(1,'#06b6d4aa');
    ctx.fillStyle=gR; ctx.beginPath(); ctx.roundRect(cx+2,padT+chartH-rH,barW,rH,[3,3,0,0]); ctx.fill();
    ctx.fillStyle='rgba(148,163,184,0.8)'; ctx.font='10px Inter'; ctx.textAlign='center';
    ctx.fillText(d.label, cx, H-6);
  });
  document.getElementById('assert-legend').innerHTML=`
    <div class="assert-leg-item"><div class="assert-leg-dot" style="background:#8b5cf6"></div> Previsto</div>
    <div class="assert-leg-item"><div class="assert-leg-dot" style="background:#10b981"></div> Realizado</div>`;
}

// ============================================
// HISTORY SIDEBAR
// ============================================

function renderHistorySidebar() {
  const list = document.getElementById('history-list');
  const currentWIdx = MONTH_WEEKS.findIndex(w=>w.id===getCurrentWeek());
  const weeks = MONTH_WEEKS.slice(0,currentWIdx+1).reverse();
  if(weeks.length===0){ list.innerHTML='<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Sem histórico</div></div>'; return; }
  list.innerHTML=weeks.map(w=>{
    const vops=aggregateVOP(w.id), ca=aggregateCadAtv(w.id);
    const totalReal=Object.values(vops).reduce((a,v)=>a+v.realizado,0);
    const totalPrev=Object.values(vops).reduce((a,v)=>a+v.previsto,0);
    const ec=state.entries.filter(e=>e.weekId===w.id).length;
    return `<div class="history-item ${state.dashboardWeek===w.id?'active':''}" onclick="setDashboardWeek('${w.id}')">
      <div class="hi-week">${w.short} · ${w.label}</div>
      <div class="hi-vop">${formatBRL(totalReal)}</div>
      <div class="hi-sub">Previsto: ${formatBRL(totalPrev)} · ${ec} entradas</div>
      <div class="hi-stats">
        <div class="hi-stat"><div class="hi-stat-val">${ca.cadReal}</div><div class="hi-stat-lbl">Cad.</div></div>
        <div class="hi-stat"><div class="hi-stat-val">${ca.atvReal}</div><div class="hi-stat-lbl">Atv.</div></div>
        <div class="hi-stat"><div class="hi-stat-val">${totalPrev>0?Math.round((totalReal/totalPrev)*100)+'%':'—'}</div><div class="hi-stat-lbl">Assert.</div></div>
      </div>
    </div>`;
  }).join('');
}

// ============================================
// SIDEBAR TOGGLE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const btn     = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.history-sidebar');
  if(btn&&sidebar) btn.addEventListener('click', () => {
    state.sidebarCollapsed=!state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    btn.textContent = state.sidebarCollapsed?'›':'‹';
  });
});

// ============================================
// FULL DASHBOARD RENDER
// ============================================

function renderDashboard() {
  renderKPIRow();
  renderVOPTable();
  renderGauges();
  renderCedentesList();
  renderAssertividadeChart();
  renderHistorySidebar();
}

// ============================================
// FORM
// ============================================

function updateFormManagerDisplay() {
  const u = state.currentUser;
  if(!u) return;
  const el = document.getElementById('manager-locked-name');
  const dot= document.getElementById('manager-dot-big');
  if(el)  el.textContent = u.displayName;
  if(dot) dot.style.background = MANAGER_COLORS[u.managerKey]||'#3b82f6';
}

function initFormWeeks() {
  const sel = document.getElementById('f-week');
  sel.innerHTML='<option value="">Selecione a semana...</option>';
  const cWId = getCurrentWeek();
  MONTH_WEEKS.forEach(w=>{
    const o=document.createElement('option');
    o.value=w.id; o.textContent=`${w.short}: ${w.label}`;
    if(w.id===cWId) o.selected=true;
    sel.appendChild(o);
  });
}

function initFormToggle() {
  document.querySelectorAll('.toggle-btn').forEach(btn=>{
    btn.addEventListener('click',function(){
      document.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      state.formType=this.dataset.type;
      updatePreview();
    });
  });
}

function initMoneyInputs() { document.querySelectorAll('.money-input').forEach(inp=>formatMoneyInput(inp)); }

function addCedente() {
  const list=document.getElementById('cedentes-input-list');
  const row=document.createElement('div');
  row.className='cedente-row'; row.dataset.idx=list.children.length;
  row.innerHTML=`<input type="text" class="form-input cedente-nome" placeholder="Nome do cedente" oninput="updatePreview()"/>
    <input type="text" class="form-input cedente-valor money-input" placeholder="Valor (R$)" oninput="updatePreview()"/>
    <button class="btn-rm-cedente" onclick="removeCedente(this)">✕</button>`;
  list.appendChild(row);
  const mi=row.querySelector('.money-input');
  formatMoneyInput(mi); mi.addEventListener('input',updatePreview);
  row.querySelector('.cedente-nome').addEventListener('input',updatePreview);
}

function removeCedente(btn) { btn.closest('.cedente-row').remove(); updatePreview(); }

function initTagsInput(wrapId, inputId, tags) {
  const input=document.getElementById(inputId), wrap=document.getElementById(wrapId);
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'||e.key===','){
      e.preventDefault();
      const val=input.value.trim();
      if(val){ tags.push(val); input.value=''; renderTags(wrapId,inputId,tags); updatePreview(); }
    } else if(e.key==='Backspace'&&!input.value&&tags.length>0){
      tags.pop(); renderTags(wrapId,inputId,tags); updatePreview();
    }
  });
  wrap.addEventListener('click',()=>input.focus());
}

function renderTags(wrapId, inputId, tags) {
  const wrap=document.getElementById(wrapId), input=document.getElementById(inputId);
  wrap.querySelectorAll('.tag-chip').forEach(c=>c.remove());
  tags.forEach((tag,i)=>{
    const chip=document.createElement('div');
    chip.className='tag-chip';
    chip.innerHTML=`${tag}<button onclick="removeTag('${wrapId}','${inputId}',${i})">✕</button>`;
    wrap.insertBefore(chip,input);
  });
}

function removeTag(wrapId, inputId, idx) {
  const tags = wrapId==='cad-tags-wrap' ? state.cadTags : state.atvTags;
  tags.splice(idx,1);
  renderTags(wrapId,inputId,tags);
  updatePreview();
}

function getCedentesFromForm() {
  return [...document.querySelectorAll('#cedentes-input-list .cedente-row')].map(row=>({
    nome:  row.querySelector('.cedente-nome')?.value?.trim()||'',
    valor: parseBRL(row.querySelector('.cedente-valor')?.value||''),
  })).filter(c=>c.nome||c.valor);
}

function updatePreview() {
  const weekId   = document.getElementById('f-week').value;
  const vop      = parseBRL(document.getElementById('f-vop-total').value);
  const cedentes = getCedentesFromForm();
  const preview  = document.getElementById('preview-body');
  if(!state.currentUser){ preview.innerHTML='<div class="preview-empty">Faça login primeiro</div>'; return; }
  const rows=[
    ['Gerente',    state.currentUser.displayName],
    ['Semana',     weekId?getWeek(weekId)?.label:'—'],
    ['Tipo',       state.formType==='previsto'?'📊 Previsto':'✅ Realizado'],
    ['VOP Total',  vop>0?formatBRL(vop):'—'],
    ...(cedentes.length>0?[['Cedentes', cedentes.map(c=>c.nome||(formatBRL(c.valor))).join(', ')]]:[] ),
    ['Cadastros',  state.cadTags.length>0?state.cadTags.join(', '):'—'],
    ['Ativações',  state.atvTags.length>0?state.atvTags.join(', '):'—'],
  ];
  preview.innerHTML=rows.map(([k,v])=>`<div class="prev-row"><span class="prev-key">${k}</span><span class="prev-val">${v}</span></div>`).join('');
}

function resetForm() {
  document.getElementById('f-week').value = getCurrentWeek();
  document.getElementById('f-vop-total').value='';
  document.getElementById('cedentes-input-list').innerHTML=`
    <div class="cedente-row" data-idx="0">
      <input type="text" class="form-input cedente-nome" placeholder="Nome do cedente" oninput="updatePreview()"/>
      <input type="text" class="form-input cedente-valor money-input" placeholder="Valor (R$)" oninput="updatePreview()"/>
      <button class="btn-rm-cedente" onclick="removeCedente(this)">✕</button>
    </div>`;
  initMoneyInputs();
  state.cadTags=[]; state.atvTags=[];
  renderTags('cad-tags-wrap','cad-tags-input',state.cadTags);
  renderTags('atv-tags-wrap','atv-tags-input',state.atvTags);
  state.formType='previsto';
  document.querySelectorAll('.toggle-btn').forEach(b=>b.classList.toggle('active',b.dataset.type==='previsto'));
  updatePreview();
}

function submitForm() {
  if(!state.currentUser){ toast('Faça login primeiro!','error'); return; }
  const weekId=document.getElementById('f-week').value;
  const vop   =parseBRL(document.getElementById('f-vop-total').value);
  if(!weekId){ toast('Selecione a semana! (Campo obrigatório ⚠️)','error'); return; }
  const entry={
    id: Date.now().toString(),
    manager:   state.currentUser.managerKey,
    weekId,
    type:      state.formType,
    vopTotal:  vop,
    cedentes:  getCedentesFromForm(),
    cadastros: [...state.cadTags],
    ativacoes: [...state.atvTags],
    createdAt: new Date().toISOString(),
  };
  state.entries.push(entry);
  saveState();
  renderSavedEntries();
  renderDashboard();
  renderHistoricoPage();
  toast(`✅ Previsão salva — ${state.currentUser.displayName} · ${getWeek(weekId)?.label}`,'success');
  resetForm();
}

function renderSavedEntries() {
  const list   = document.getElementById('saved-entries-list');
  const mKey   = state.currentUser?.managerKey;
  // Managers see only their own; superintendent sees all
  const recent = isSuper()
    ? [...state.entries].reverse().slice(0,10)
    : [...state.entries].filter(e=>e.manager===mKey).reverse().slice(0,10);
  if(recent.length===0){ list.innerHTML='<div class="preview-empty">Nenhuma entrada salva ainda</div>'; return; }
  list.innerHTML=recent.map(e=>`
    <div class="saved-entry-item">
      <div class="sei-left">
        <span class="sei-manager">${getUserByManager(e.manager)?.displayName||e.manager}</span>
        <span class="sei-week">${getWeek(e.weekId)?.label||e.weekId}</span>
      </div>
      <span class="sei-type ${e.type}">${e.type==='previsto'?'📊 Previsto':'✅ Realizado'}</span>
      <div class="sei-actions">
        <button class="sei-btn" onclick="openDetailEntry('${e.id}')">👁</button>
        ${isSuper()||e.manager===mKey?`<button class="sei-btn del" onclick="deleteEntry('${e.id}')">🗑</button>`:''}
      </div>
    </div>`).join('');
}

function deleteEntry(id) {
  if(!confirm('Excluir este registro?')) return;
  state.entries=state.entries.filter(e=>e.id!==id);
  saveState(); renderSavedEntries(); renderDashboard(); renderHistoricoPage();
  toast('Entrada removida','info');
}

function openDetailEntry(id) {
  const e=state.entries.find(x=>x.id===id);
  if(!e) return;
  const modal=document.getElementById('detail-modal');
  document.getElementById('detail-modal-title').textContent=`${getUserByManager(e.manager)?.displayName||e.manager} · ${getWeek(e.weekId)?.label} · ${e.type}`;
  document.getElementById('detail-modal-body').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
      <div class="prev-row"><span class="prev-key">Gerente</span><span class="prev-val">${getUserByManager(e.manager)?.displayName||e.manager}</span></div>
      <div class="prev-row"><span class="prev-key">Semana</span><span class="prev-val">${getWeek(e.weekId)?.label}</span></div>
      <div class="prev-row"><span class="prev-key">Tipo</span><span class="prev-val">${e.type}</span></div>
      <div class="prev-row"><span class="prev-key">VOP Total</span><span class="prev-val">${formatBRL(e.vopTotal)}</span></div>
      <div class="prev-row"><span class="prev-key">Cedentes</span><span class="prev-val">${e.cedentes?.length>0?e.cedentes.map(c=>`${c.nome}: ${formatBRL(c.valor)}`).join('<br>'):'—'}</span></div>
      <div class="prev-row"><span class="prev-key">Cadastros</span><span class="prev-val">${e.cadastros?.join(', ')||'—'}</span></div>
      <div class="prev-row"><span class="prev-key">Ativações</span><span class="prev-val">${e.ativacoes?.join(', ')||'—'}</span></div>
      <div class="prev-row"><span class="prev-key">Registrado em</span><span class="prev-val">${new Date(e.createdAt).toLocaleString('pt-BR')}</span></div>
    </div>`;
  modal.classList.remove('hidden');
}
function closeDetailModal() { document.getElementById('detail-modal').classList.add('hidden'); }

// ============================================
// HISTORICO PAGE
// ============================================

function renderHistoricoPage() {
  const grid  = document.getElementById('hist-grid');
  const fMgr  = document.getElementById('hist-filter-manager')?.value||'all';
  const fWeek = document.getElementById('hist-filter-week')?.value||'all';
  const fType = document.getElementById('hist-filter-type')?.value||'all';
  let entries = [...state.entries].reverse();
  // Non-superintendent managers can still see all in history (read-only) — or restrict:
  if(fMgr!=='all')  entries=entries.filter(e=>e.manager===fMgr);
  if(fWeek!=='all') entries=entries.filter(e=>e.weekId===fWeek);
  if(fType!=='all') entries=entries.filter(e=>e.type===fType);
  if(entries.length===0){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📭</div><div class="empty-state-title">Nenhum registro encontrado</div><div class="empty-state-desc">Adicione entradas via Formulário</div></div>`;
    return;
  }
  grid.innerHTML=entries.map(e=>{
    const cedChips=(e.cedentes||[]).slice(0,4).map(c=>`<span class="hist-cedente-chip">${c.nome||'Cedente'}: ${formatBRL(c.valor)}</span>`).join('');
    const more=(e.cedentes||[]).length>4?`<span class="hist-cedente-chip">+${e.cedentes.length-4} mais</span>`:'';
    const mgrColor=MANAGER_COLORS[e.manager]||'#3b82f6';
    return `<div class="hist-card" onclick="openDetailEntry('${e.id}')">
      <div class="hist-card-header">
        <div>
          <div class="hist-card-manager" style="color:${mgrColor}">${getUserByManager(e.manager)?.displayName||e.manager}</div>
          <div class="hist-card-week">${getWeek(e.weekId)?.label||e.weekId}</div>
        </div>
        <span class="hist-card-type ${e.type}">${e.type==='previsto'?'📊 Previsto':'✅ Realizado'}</span>
      </div>
      <div class="hist-metrics">
        <div class="hm"><div class="hm-val">${formatBRL(e.vopTotal)}</div><div class="hm-lbl">VOP</div></div>
        <div class="hm"><div class="hm-val">${(e.cadastros||[]).length}</div><div class="hm-lbl">Cadastros</div></div>
        <div class="hm"><div class="hm-val">${(e.ativacoes||[]).length}</div><div class="hm-lbl">Ativações</div></div>
      </div>
      ${(e.cedentes||[]).length>0?`<div class="hist-cedentes"><div class="hist-cedentes-title">Cedentes</div>${cedChips}${more}</div>`:''}
    </div>`;
  }).join('');
}

function initHistoricoFilters() {
  const fMgr  = document.getElementById('hist-filter-manager');
  const fWeek = document.getElementById('hist-filter-week');
  const fType = document.getElementById('hist-filter-type');
  if(!fMgr) return;
  fMgr.innerHTML='<option value="all">Todos os Gerentes</option>'+
    state.users.filter(u=>u.active).map(u=>`<option value="${u.managerKey}">${u.displayName}</option>`).join('');
  fWeek.innerHTML='<option value="all">Todas as Semanas</option>'+
    MONTH_WEEKS.map(w=>`<option value="${w.id}">${w.short}: ${w.label}</option>`).join('');
  [fMgr,fWeek,fType].forEach(el=>el.addEventListener('change',renderHistoricoPage));
}

// ============================================
// METAS PAGE
// ============================================

function renderMetasPage() {
  const grid = document.getElementById('metas-grid');
  if(!grid) return;
  const vops = aggregateVOP('all');
  const ca   = aggregateCadAtv('all');
  document.querySelectorAll('.super-only').forEach(el=>el.classList.toggle('hidden',!isSuper()));

  const cards=[
    { icon:'💰', title:'Meta VOP — Agosto 2026', sub:'Volume de Operações por Gerente', type:'vop_breakdown' },
    { icon:'🆕', title:'Meta Cadastros', sub:'Total no mês', value:state.goals.cadastros, realizado:ca.cadReal, type:'simple', color:'#10b981' },
    { icon:'⚡', title:'Meta Ativações', sub:'Total no mês', value:state.goals.ativacoes, realizado:ca.atvReal, type:'simple', color:'#f59e0b' },
    { icon:'💼', title:'Meta Receita — Agosto 2026', sub:'Receita por Gerente', type:'receita_breakdown' },
  ];
  grid.innerHTML=cards.map(c=>{
    if(c.type==='simple'){
      const pct=c.value>0?Math.min(100,(c.realizado/c.value)*100):0;
      return `<div class="meta-card">
        <div class="meta-card-header"><div class="meta-card-icon">${c.icon}</div><div><div class="meta-card-title">${c.title}</div><div class="meta-card-sub">${c.sub}</div></div></div>
        <div class="meta-value-big">${c.value}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <div style="flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${c.color};border-radius:99px;transition:width 1s"></div></div>
          <span style="font-size:12px;font-weight:700;color:${c.color}">${Math.round(pct)}%</span>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">${c.realizado} realizados</div>
      </div>`;
    }
    const isVop=c.type==='vop_breakdown';
    const goalObj=isVop?state.goals.vop:state.goals.receita;
    const totalGoal=Object.values(goalObj).reduce((a,b)=>a+b,0);
    const rows=state.users.filter(u=>u.active).map(u=>{
      const m=u.managerKey;
      const g=goalObj[m]||0;
      const r=isVop?(vops[m]?.realizado||0):0;
      const pct=g>0?Math.min(100,(r/g)*100):0;
      return `<div class="meta-prog-row">
        <span class="meta-prog-name">${u.displayName}</span>
        <div class="meta-prog-bar"><div class="meta-prog-fill" style="width:${pct}%;background:${MANAGER_COLORS[m]||'#3b82f6'}"></div></div>
        <span class="meta-prog-pct" style="color:${MANAGER_COLORS[m]||'#3b82f6'}">${formatBRL(g)}</span>
      </div>`;
    }).join('');
    return `<div class="meta-card">
      <div class="meta-card-header"><div class="meta-card-icon">${c.icon}</div><div><div class="meta-card-title">${c.title}</div><div class="meta-card-sub">${c.sub}</div></div></div>
      <div class="meta-value-big" style="font-size:22px">${formatBRL(totalGoal)}</div>
      <div class="meta-progress-wrap" style="margin-top:10px">${rows}</div>
    </div>`;
  }).join('');
}

function openMetasEdit() {
  if(!isSuper()){ toast('Apenas o Superintendente pode editar metas','error'); return; }
  const body=document.getElementById('metas-modal-body');
  body.innerHTML=`
    <div class="meta-edit-row"><label class="meta-edit-label">Meta Cadastros (mês)</label><input type="number" class="form-input" id="me-cadastros" value="${state.goals.cadastros}"/></div>
    <div class="meta-edit-row"><label class="meta-edit-label">Meta Ativações (mês)</label><input type="number" class="form-input" id="me-ativacoes" value="${state.goals.ativacoes}"/></div>
    <hr style="border-color:var(--border);margin:4px 0"/>
    <div style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Meta VOP por Gerente (mês)</div>
    ${state.users.filter(u=>u.active).map(u=>`
      <div class="meta-edit-row">
        <label class="meta-edit-label" style="color:${MANAGER_COLORS[u.managerKey]||'#3b82f6'}">${u.displayName}</label>
        <input type="text" class="form-input money-input" id="me-vop-${u.managerKey}" value="${(state.goals.vop[u.managerKey]||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}"/>
      </div>`).join('')}`;
  initMoneyInputs();
  document.getElementById('metas-modal').classList.remove('hidden');
}
function closeMetasEdit() { document.getElementById('metas-modal').classList.add('hidden'); }
function saveMetasEdit() {
  state.goals.cadastros=parseInt(document.getElementById('me-cadastros').value)||20;
  state.goals.ativacoes=parseInt(document.getElementById('me-ativacoes').value)||5;
  state.users.filter(u=>u.active).forEach(u=>{
    const inp=document.getElementById(`me-vop-${u.managerKey}`);
    if(inp) state.goals.vop[u.managerKey]=parseBRL(inp.value);
  });
  saveState(); closeMetasEdit(); renderDashboard(); renderMetasPage();
  toast('Metas atualizadas com sucesso! 🎯','success');
}

// ============================================
// USUARIOS PAGE
// ============================================

function renderUsuariosPage() {
  if(!isSuper()) return;
  const grid = document.getElementById('users-grid');
  if(!grid) return;
  const activeUsers  = state.users.filter(u=>u.active);
  const inactiveUsers= state.users.filter(u=>!u.active);

  function renderCard(u) {
    const color = MANAGER_COLORS[u.managerKey]||'#3b82f6';
    const initials = u.displayName.split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2);
    const entriesCount = state.entries.filter(e=>e.manager===u.managerKey).length;
    const lastEntry    = [...state.entries].filter(e=>e.manager===u.managerKey).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
    return `<div class="user-card ${u.active?'active':'inactive'}">
      ${!u.active?'<span class="inactive-badge">⊘ Inativo</span>':''}
      <div class="user-card-header">
        <div class="user-card-avatar" style="background:${color}">${initials}</div>
        <div>
          <div class="user-card-name">${u.displayName}</div>
          <div class="user-card-username">@${u.username}</div>
        </div>
        <span class="user-card-role-badge ${u.role}">${u.role==='superintendent'?'👑 Super':'👤 Gerente'}</span>
      </div>
      <div class="user-card-stats">
        <div class="ucs"><div class="ucs-val">${entriesCount}</div><div class="ucs-lbl">Entradas</div></div>
        <div class="ucs"><div class="ucs-val">${lastEntry?new Date(lastEntry.createdAt).toLocaleDateString('pt-BR'):'—'}</div><div class="ucs-lbl">Último envio</div></div>
      </div>
      <div class="user-card-actions">
        <button class="uca-btn" onclick="openEditUserModal('${u.id}')">✏️ Editar</button>
        <button class="uca-btn" onclick="resetUserPassword('${u.id}')">🔑 Senha</button>
        ${u.id!==state.currentUser?.id
          ? `<button class="uca-btn danger" onclick="toggleUserActive('${u.id}')">${u.active?'⊘ Desativar':'✓ Ativar'}</button>`
          : '<button class="uca-btn" disabled style="opacity:0.3">Você</button>'}
      </div>
    </div>`;
  }

  grid.innerHTML = [...activeUsers, ...inactiveUsers].map(renderCard).join('');
}

// ============================================
// USER MODAL (New / Edit)
// ============================================

function openNewUserModal() {
  state.editingUserId = null;
  document.getElementById('user-modal-title').textContent = '➕ Novo Usuário';
  populateUserModalBody(null);
  document.getElementById('user-modal').classList.remove('hidden');
}

function openEditUserModal(id) {
  state.editingUserId = id;
  const u = state.users.find(x=>x.id===id);
  document.getElementById('user-modal-title').textContent = `✏️ Editar — ${u?.displayName}`;
  populateUserModalBody(u);
  document.getElementById('user-modal').classList.remove('hidden');
}

function populateUserModalBody(u) {
  const body = document.getElementById('user-modal-body');
  body.innerHTML = `
    <div class="form-group">
      <label class="meta-edit-label">Nome de Exibição <span class="req">*</span></label>
      <input type="text" class="form-input" id="um-displayName" value="${u?.displayName||''}" placeholder="Ex: Veclaine"/>
    </div>
    <div class="form-group">
      <label class="meta-edit-label">Usuário (login) <span class="req">*</span></label>
      <input type="text" class="form-input" id="um-username" value="${u?.username||''}" placeholder="Ex: veclaine"/>
    </div>
    ${!u ? `<div class="form-group">
      <label class="meta-edit-label">Senha Inicial <span class="req">*</span></label>
      <input type="password" class="form-input" id="um-password" value="" placeholder="Mínimo 4 caracteres"/>
    </div>` : ''}
    <div class="form-group">
      <label class="meta-edit-label">Perfil / Função <span class="req">*</span></label>
      <select class="form-select" id="um-role">
        <option value="manager" ${u?.role==='manager'?'selected':''}>👤 Gerente Comercial</option>
        <option value="superintendent" ${u?.role==='superintendent'?'selected':''}>👑 Superintendente</option>
      </select>
    </div>
    <div class="form-group">
      <label class="meta-edit-label">Carteira/Gerente Vinculado <span class="req">*</span></label>
      <select class="form-select" id="um-managerKey">
        ${MANAGER_KEYS.map(k=>`<option value="${k}" ${u?.managerKey===k?'selected':''}>${k}</option>`).join('')}
        <option value="CUSTOM" ${u&&!MANAGER_KEYS.includes(u.managerKey)?'selected':''}>Personalizado...</option>
      </select>
    </div>
    <div class="form-group" id="um-custom-key-group" style="${u&&!MANAGER_KEYS.includes(u.managerKey)?'':'display:none'}">
      <label class="meta-edit-label">Chave Personalizada</label>
      <input type="text" class="form-input" id="um-custom-key" value="${u&&!MANAGER_KEYS.includes(u.managerKey)?u.managerKey:''}" placeholder="EX: NOVO_GERENTE"/>
    </div>`;

  document.getElementById('um-managerKey').addEventListener('change', function() {
    document.getElementById('um-custom-key-group').style.display = this.value==='CUSTOM'?'':'none';
  });
}

function closeUserModal() { document.getElementById('user-modal').classList.add('hidden'); }

function saveUserModal() {
  const displayName = document.getElementById('um-displayName')?.value?.trim();
  const username    = document.getElementById('um-username')?.value?.trim().toLowerCase();
  const role        = document.getElementById('um-role')?.value;
  let   managerKey  = document.getElementById('um-managerKey')?.value;
  if(managerKey==='CUSTOM') managerKey=(document.getElementById('um-custom-key')?.value?.trim().toUpperCase())||'CUSTOM';

  if(!displayName||!username||!managerKey){ toast('Preencha todos os campos obrigatórios!','error'); return; }

  if(state.editingUserId) {
    // Edit
    const idx=state.users.findIndex(u=>u.id===state.editingUserId);
    if(idx<0) return;
    state.users[idx].displayName = displayName;
    state.users[idx].username    = username;
    state.users[idx].role        = role;
    state.users[idx].managerKey  = managerKey;
    if(state.currentUser?.id===state.editingUserId) state.currentUser={...state.users[idx]};
    toast(`Usuário "${displayName}" atualizado!`,'success');
  } else {
    // New
    const password = document.getElementById('um-password')?.value;
    if(!password||password.length<4){ toast('Senha muito curta (mín. 4 caracteres)','error'); return; }
    if(state.users.find(u=>u.username===username)){ toast('Usuário já existe!','error'); return; }
    state.users.push({ id:genId(), username, password, displayName, managerKey, role, active:true, createdAt:new Date().toISOString() });
    // Ensure goal entry for new manager
    if(!state.goals.vop[managerKey])     state.goals.vop[managerKey]     = 0;
    if(!state.goals.receita[managerKey]) state.goals.receita[managerKey] = 0;
    toast(`Usuário "${displayName}" criado com sucesso! 🎉`,'success');
  }
  saveState();
  closeUserModal();
  renderUsuariosPage();
  applyUserContext();
}

function toggleUserActive(id) {
  const idx=state.users.findIndex(u=>u.id===id);
  if(idx<0) return;
  state.users[idx].active=!state.users[idx].active;
  saveState(); renderUsuariosPage();
  toast(`Usuário ${state.users[idx].active?'ativado':'desativado'} com sucesso`,'info');
}

function resetUserPassword(id) {
  const u=state.users.find(x=>x.id===id);
  if(!u) return;
  const np = prompt(`Digite a nova senha para "${u.displayName}" (mín. 4 caracteres):`);
  if(!np) return;
  if(np.length<4){ toast('Senha muito curta!','error'); return; }
  const idx=state.users.findIndex(x=>x.id===id);
  state.users[idx].password=np;
  saveState(); renderUsuariosPage();
  toast(`Senha de "${u.displayName}" redefinida com sucesso! 🔑`,'success');
}

// ============================================
// TAB NAVIGATION
// ============================================

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', function(){
      const tab=this.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      document.getElementById(`tab-content-${tab}`).classList.add('active');
      if(tab==='dashboard')  renderDashboard();
      if(tab==='form')       { updateFormManagerDisplay(); renderSavedEntries(); updatePreview(); }
      if(tab==='historico')  renderHistoricoPage();
      if(tab==='metas')      renderMetasPage();
      if(tab==='usuarios')   renderUsuariosPage();
    });
  });
}

// Close dropdown on outside click
document.addEventListener('click', e=>{
  const dd=document.getElementById('user-dropdown');
  const chip=document.getElementById('user-chip-btn');
  if(dd&&!dd.contains(e.target)&&chip&&!chip.contains(e.target)) dd.classList.add('hidden');
});

// Enter key on login
document.addEventListener('DOMContentLoaded', () => {
  const passInput = document.getElementById('login-pass');
  if(passInput) passInput.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  const userInput = document.getElementById('login-user');
  if(userInput) userInput.addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('login-pass').focus(); });
});

// ============================================
// FORM LISTENERS
// ============================================

function attachFormListeners() {
  ['f-week','f-vop-total'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.addEventListener('input',updatePreview); el.addEventListener('change',updatePreview); }
  });
}

// ============================================
// DEMO DATA
// ============================================

function seedDemoData() {
  if(state.entries.length>0) return;
  const demos=[
    { manager:'SUPERINTENDENTE', weekId:'w2', type:'previsto',  vopTotal:12000000, cedentes:[{nome:'Empresa Alfa',valor:7000000},{nome:'Empresa Beta',valor:5000000}], cadastros:['Cliente A','Cliente B','Cliente C'], ativacoes:['Ativação X'] },
    { manager:'VECLAINE',        weekId:'w2', type:'previsto',  vopTotal:8000000,  cedentes:[{nome:'Gama Corp',valor:8000000}], cadastros:['Empresa 1'], ativacoes:[] },
    { manager:'RAFAELA',         weekId:'w2', type:'previsto',  vopTotal:7000000,  cedentes:[{nome:'Delta SA',valor:7000000}], cadastros:['Empresa 2','Empresa 3'], ativacoes:['Ativação Y'] },
    { manager:'SUPERINTENDENTE', weekId:'w2', type:'realizado', vopTotal:10500000, cedentes:[{nome:'Empresa Alfa',valor:6500000},{nome:'Empresa Beta',valor:4000000}], cadastros:['Cliente A','Cliente B'], ativacoes:['Ativação X'] },
    { manager:'VECLAINE',        weekId:'w2', type:'realizado', vopTotal:7200000,  cedentes:[{nome:'Gama Corp',valor:7200000}], cadastros:['Empresa 1'], ativacoes:[] },
    { manager:'RAFAELA',         weekId:'w2', type:'realizado', vopTotal:6800000,  cedentes:[{nome:'Delta SA',valor:6800000}], cadastros:['Empresa 2'], ativacoes:['Ativação Y'] },
    { manager:'SUPERINTENDENTE', weekId:'w3', type:'previsto',  vopTotal:13000000, cedentes:[{nome:'Omega Ltda',valor:8000000},{nome:'Sigma SA',valor:5000000}], cadastros:['Cliente D','Cliente E'], ativacoes:['Ativação Z'] },
    { manager:'MARLENE',         weekId:'w3', type:'previsto',  vopTotal:6000000,  cedentes:[{nome:'Theta Inc',valor:6000000}], cadastros:['Empresa 4'], ativacoes:[] },
    { manager:'ANA_ADM',         weekId:'w3', type:'previsto',  vopTotal:8000000,  cedentes:[{nome:'Kappa Corp',valor:8000000}], cadastros:['Empresa 5','Empresa 6'], ativacoes:['Ativação W'] },
    { manager:'SUPERINTENDENTE', weekId:'w3', type:'realizado', vopTotal:11000000, cedentes:[{nome:'Omega Ltda',valor:7000000},{nome:'Sigma SA',valor:4000000}], cadastros:['Cliente D'], ativacoes:['Ativação Z'] },
    { manager:'MARLENE',         weekId:'w3', type:'realizado', vopTotal:5500000,  cedentes:[{nome:'Theta Inc',valor:5500000}], cadastros:['Empresa 4'], ativacoes:[] },
  ];
  demos.forEach(e=>state.entries.push({...e, id:Date.now().toString()+Math.random(), createdAt:new Date().toISOString()}));
  saveState();
}

// ============================================
// INIT
// ============================================

function init() {
  loadState();
  seedDemoData();

  state.dashboardWeek = 'all';

  initPassToggle();
  initTabs();
  initFormWeeks();
  initFormToggle();
  initMoneyInputs();
  initTagsInput('cad-tags-wrap','cad-tags-input',state.cadTags);
  initTagsInput('atv-tags-wrap','atv-tags-input',state.atvTags);
  initCedentesFilter();
  initHistoricoFilters();
  attachFormListeners();

  // Try auto-login from session
  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    loader.style.opacity='0';
    setTimeout(()=>{
      loader.classList.add('hidden');
      const sessionUser = loadSession();
      if(sessionUser){
        state.currentUser=sessionUser;
        showApp();
      } else {
        document.getElementById('login-screen').classList.remove('hidden');
      }
    }, 500);
  }, 1100);
}

let resizeTimer;
window.addEventListener('resize',()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>renderAssertividadeChart(),150); });

document.addEventListener('DOMContentLoaded', init);
