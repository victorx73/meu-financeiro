(() => {
'use strict';

const STORAGE_KEY = 'meuFinanceiro.v2';
const REPORT_COLLAPSED_KEY = 'meuFinanceiro.reportCollapsed';
const FOLDER_SETTINGS_KEY = 'meuFinanceiro.folderSync';
const FOLDER_NAME = 'meu-financeiro.json';
const FOLDER_HANDLE_KEY = 'meuFinanceiroFolderHandle'; // salvo no IndexedDB
const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const NAV = [
  {id:'dashboard',label:'Visão geral',icon:'⌂'},
  {id:'expenses',label:'Gastos',icon:'↗'},
  {id:'loans',label:'Empréstimos',icon:'⇄'},
  {id:'income',label:'Ganhos',icon:'▦'},
  {id:'pending',label:'Pendências',icon:'◷'},
  {id:'sync',label:'Sincronização',icon:'⟳'}
];
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const round = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);

/* ===== Utilidades ===== */
function parseMoney(value){
  let s=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
  if(!s)return NaN;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?n:NaN;
}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatDate(date){
  if(!date)return 'Data não informada';
  const d=new Date(date+'T12:00:00');
  return Number.isNaN(d.getTime())?safe(date):d.toLocaleDateString('pt-BR');
}
function formatDateTime(ts){
  if(!ts)return '—';
  const d=new Date(ts); if(Number.isNaN(d.getTime()))return '—';
  return d.toLocaleString('pt-BR');
}
function shiftMonth(year,month,offset){
  const d=new Date(year,month+offset,1);
  return {year:d.getFullYear(),month:d.getMonth()};
}
function isoToDayMonth(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  return {year:Number(m[1]),month:Number(m[2]),day:Number(m[3])};
}
function categoryKey(name){
  return String(name||'').replace(/\s*\(parcela\s+\d+\/\d+\)\s*$/i,'').trim().toLowerCase();
}
function categoryLabel(name){
  return String(name||'').replace(/\s*\(parcela\s+\d+\/\d+\)\s*$/i,'').trim();
}

/* ===== Estado ===== */
const now = new Date();
const initial = {
  month: now.getMonth(), year: now.getFullYear(),
  monthsData:{}, pending:[], loans:[], savedExpenses:[],
  lastModified: Date.now()
};

function ensureMonth(data){
  if(!data||typeof data!=='object')data={};
  if(!Number.isFinite(Number(data.balance)))data.balance=0;
  if(!Array.isArray(data.expenses))data.expenses=[];
  if(!Array.isArray(data.workDays))data.workDays=[];
  if(!Array.isArray(data.paidDays))data.paidDays=[];
  if(!Number.isFinite(Number(data.dailyRate)))data.dailyRate=0;
  if(typeof data.incomeSource!=='string')data.incomeSource='';
  data.expenses.forEach(e=>{
    if(!e.id)e.id=uid();
    if(typeof e.done!=='boolean')e.done=false;
    e.amount=Number(e.amount)||0;
    if(e.day===undefined)e.day=null;
  });
  data.workDays=[...new Set(data.workDays.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=31))].sort((a,b)=>a-b);
  data.paidDays=[...new Set(data.paidDays.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=31))].sort((a,b)=>a-b);
  data.paidDays=data.paidDays.filter(d=>data.workDays.includes(d));
  return data;
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return initial;
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object')return initial;
    if(!parsed.monthsData||typeof parsed.monthsData!=='object')parsed.monthsData={};
    if(!Array.isArray(parsed.pending))parsed.pending=[];
    if(!Array.isArray(parsed.loans))parsed.loans=[];
    if(!Array.isArray(parsed.savedExpenses))parsed.savedExpenses=[];
    if(!Number.isInteger(parsed.month)||parsed.month<0||parsed.month>11)parsed.month=now.getMonth();
    if(!Number.isInteger(parsed.year))parsed.year=now.getFullYear();
    if(!Number.isFinite(parsed.lastModified))parsed.lastModified=Date.now();
    Object.keys(parsed.monthsData).forEach(k=>parsed.monthsData[k]=ensureMonth(parsed.monthsData[k]));
    parsed.pending.forEach(p=>{if(!p.id)p.id=uid();p.amount=Number(p.amount)||0;p.done=Boolean(p.done);});
    parsed.loans.forEach(l=>{
      if(!l.id)l.id=uid();
      l.amount=Number(l.amount)||0;
      l.returned=Number(l.returned)||0;
      if(!Number.isInteger(l.originMonth))l.originMonth=now.getMonth();
      if(!Number.isInteger(l.originYear))l.originYear=now.getFullYear();
      if(typeof l.withdrawn!=='boolean')l.withdrawn=false;
    });
    parsed.savedExpenses = parsed.savedExpenses.map(s=>({id:s.id||uid(),name:String(s.name||'').trim()})).filter(s=>s.name);
    return parsed;
  }catch(error){
    console.error('Erro ao ler dados:',error);
    return initial;
  }
}
let state = loadState();
let activeView = 'dashboard';
let toastTimer;

function persist(){
  try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); return true; }
  catch(error){ console.error(error); notify('Não foi possível salvar. Verifique o espaço.'); return false; }
}
function touchState(){ state.lastModified = Date.now(); }
function notify(msg){
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

/* ===== Cálculos ===== */
function monthKey(y=state.year,m=state.month){return `${y}-${m}`;}
function monthData(y=state.year,m=state.month){
  const k=monthKey(y,m);
  if(!state.monthsData[k])state.monthsData[k]=ensureMonth({balance:0,expenses:[],dailyRate:0,incomeSource:'',workDays:[],paidDays:[]});
  state.monthsData[k]=ensureMonth(state.monthsData[k]);
  return state.monthsData[k];
}
function unpaidTotal(d=monthData()){return round(d.expenses.filter(e=>!e.done).reduce((s,e)=>s+e.amount,0));}
function paidTotal(d=monthData()){return round(d.expenses.filter(e=>e.done).reduce((s,e)=>s+e.amount,0));}
function remaining(d=monthData()){return round(d.balance-unpaidTotal(d));}
function forecast(d=monthData()){return round((d.workDays||[]).length*(Number(d.dailyRate)||0));}
function forecastPaid(d=monthData()){return round((d.paidDays||[]).length*(Number(d.dailyRate)||0));}
function forecastRemaining(d=monthData()){
  const unpaidWork=(d.workDays||[]).filter(x=>!(d.paidDays||[]).includes(x)).length;
  return round(unpaidWork*(Number(d.dailyRate)||0));
}
function loanReturned(l){return Math.min(Number(l.amount)||0,Math.max(0,Number(l.returned)||0));}
function loanDue(l){return round(Math.max(0,(Number(l.amount)||0)-loanReturned(l)));}
function loanTotals(){
  return {
    total:round(state.loans.reduce((s,l)=>s+(Number(l.amount)||0),0)),
    returned:round(state.loans.reduce((s,l)=>s+loanReturned(l),0)),
    due:round(state.loans.reduce((s,l)=>s+loanDue(l),0))
  };
}

/* ===== Relatório ===== */
let reportCollapsed=false;
try{reportCollapsed=localStorage.getItem(REPORT_COLLAPSED_KEY)==='1';}catch(e){}
function applyReportCollapsed(){
  const card=$('reportCard'),toggle=$('reportToggle');
  card.classList.toggle('collapsed',reportCollapsed);
  toggle.setAttribute('aria-expanded',String(!reportCollapsed));
}
function setReportCollapsed(v){
  reportCollapsed=!!v;
  try{localStorage.setItem(REPORT_COLLAPSED_KEY,reportCollapsed?'1':'0');}catch(e){}
  applyReportCollapsed(); renderReportSummary();
}
function categoryReport(d=monthData()){
  const map=new Map();
  d.expenses.forEach(e=>{
    const k=categoryKey(e.name),label=categoryLabel(e.name)||'(sem nome)';
    if(!map.has(k))map.set(k,{key:k,label,total:0,count:0,paid:0});
    const it=map.get(k);
    it.total=round(it.total+(Number(e.amount)||0)); it.count++;
    if(e.done)it.paid++;
  });
  const list=[...map.values()].sort((a,b)=>b.total-a.total);
  const total=round(list.reduce((s,x)=>s+x.total,0));
  return {list,total};
}
function renderReportSummary(){
  const {list,total}=categoryReport(),sum=$('reportSummary');
  if(!list.length){sum.innerHTML='<div>Nenhum gasto neste mês.</div>';return;}
  const top=list[0];
  sum.innerHTML=`<div class="report-mini-total"><span><strong>${list.length}</strong> ${list.length===1?'categoria':'categorias'} · maior: <strong>${safe(top.label)}</strong></span><span>${money(total)}</span></div>`;
}
function renderCategoryReport(){
  const {list,total}=categoryReport(),wrap=$('reportList');
  $('reportCountBadge').textContent=`${list.length} ${list.length===1?'categoria':'categorias'}`;
  if(!list.length){
    wrap.innerHTML='<div class="empty">Nenhum gasto cadastrado neste mês.</div>';
    renderReportSummary();return;
  }
  const max=Math.max(...list.map(x=>x.total),1);
  wrap.innerHTML=list.map(c=>{
    const pct=total>0?(c.total/total)*100:0,barPct=max>0?(c.total/max)*100:0;
    return `<div class="report-row"><div class="report-top"><span class="report-name">${safe(c.label)}</span><span class="report-value">${money(c.total)}</span></div><div class="report-bar"><div class="report-bar-fill" style="width:${barPct.toFixed(2)}%"></div></div><div class="report-foot"><span>${c.count} ${c.count===1?'lançamento':'lançamentos'}${c.paid?` · ${c.paid} pago${c.paid>1?'s':''}`:''}</span><span>${pct.toFixed(1)}% do total</span></div></div>`;
  }).join('')+`<div class="report-row" style="border-top:2px solid var(--line);margin-top:6px;padding-top:14px;border-bottom:0"><div class="report-top"><span class="report-name" style="color:var(--muted)">Total do mês</span><span class="report-value" style="color:var(--text)">${money(total)}</span></div></div>`;
  renderReportSummary(); applyReportCollapsed();
}

/* ===== Ajuste de saldo para empréstimos ===== */
function loanBalanceAdjust(l,delta){
  const k=monthKey(l.originYear,l.originMonth);
  if(!state.monthsData[k])state.monthsData[k]=ensureMonth({balance:0,expenses:[],dailyRate:0,incomeSource:'',workDays:[],paidDays:[]});
  state.monthsData[k].balance=round((Number(state.monthsData[k].balance)||0)+delta);
}
function withdrawLoanFromBalance(l){if(l.withdrawn)return;loanBalanceAdjust(l,-Number(l.amount||0));l.withdrawn=true;}
function restoreLoanToBalance(l){if(!l.withdrawn)return;const back=round(Number(l.amount||0)-loanReturned(l));loanBalanceAdjust(l,back);l.withdrawn=false;}

/* ===== Gastos salvos ===== */
function renderSavedExpenses(){
  const list=state.savedExpenses,wrap=$('savedList');
  if(!list.length){wrap.innerHTML='<div class="empty" style="padding:10px;font-size:12px">Nenhum nome salvo ainda.</div>';return;}
  wrap.innerHTML=list.map(s=>`<span class="saved-chip"><button type="button" class="chip-apply" data-saved-apply="${s.id}" style="border:0;background:transparent;color:inherit;padding:0;font-weight:inherit;cursor:pointer">${safe(s.name)}</button><button type="button" data-saved-del="${s.id}" title="Remover">✕</button></span>`).join('');
}
function findSaved(name){const n=String(name||'').trim().toLowerCase();return state.savedExpenses.find(s=>s.name.toLowerCase()===n);}
function addSavedExpense(name){name=String(name||'').trim();if(!name)return false;if(findSaved(name))return false;state.savedExpenses.push({id:uid(),name});return true;}
function fillExpenseForm(saved){$('expenseName').value=saved.name;$('expenseNameList').classList.remove('show');$('expenseAmount').focus();}

/* ===== Autocomplete ===== */
let acIndex=-1;
function filterSaved(term){term=String(term||'').toLowerCase().trim();let list=state.savedExpenses.slice();if(term)list=list.filter(s=>s.name.toLowerCase().includes(term));return list.slice(0,8);}
function renderAutocomplete(term){
  const list=filterSaved(term),box=$('expenseNameList');
  if(!list.length){box.classList.remove('show');box.innerHTML='';acIndex=-1;return;}
  acIndex=-1;
  box.innerHTML=list.map((s,i)=>`<div class="autocomplete-item" data-ac-index="${i}" data-ac-id="${s.id}"><span class="ac-name">${safe(s.name)}</span></div>`).join('');
  box.classList.add('show');
}
function setAcActive(i){const items=[...$('expenseNameList').querySelectorAll('.autocomplete-item')];items.forEach(it=>it.classList.toggle('active',Number(it.dataset.acIndex)===i));acIndex=i;}
function applyAcById(id){const s=state.savedExpenses.find(x=>x.id===id);if(s)fillExpenseForm(s);}

/* ===== Navegação ===== */
function moveView(id){
  if(!NAV.some(n=>n.id===id))return;
  activeView=id;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${id}`));
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));
  closeDrawer();hideDayPopover();render();window.scrollTo({top:0,behavior:'smooth'});
}
function navButton(item,compact=false){
  return `<button type="button" class="nav-btn ${activeView===item.id?'active':''}" data-nav="${item.id}" ${compact?'aria-label="'+item.label+'"':''}><span class="nav-icon">${item.icon}</span>${compact?'':` ${item.label}`}</button>`;
}
function renderNavigation(){
  $('topNav').innerHTML=NAV.map(n=>navButton(n)).join('');
  $('drawerNav').innerHTML=NAV.map(n=>navButton(n)).join('');
  $('mobileBottom').innerHTML=NAV.filter(n=>['dashboard','expenses','loans','income','sync'].includes(n.id)).map(n=>navButton(n,true)).join('');
}
function openDrawer(){$('drawer').classList.add('open');$('overlay').classList.add('show');$('menuToggle').setAttribute('aria-expanded','true');}
function closeDrawer(){$('drawer').classList.remove('open');$('overlay').classList.remove('show');$('menuToggle').setAttribute('aria-expanded','false');}
function renderMonthSelectors(){
  $('monthSelect').innerHTML=MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  $('monthSelect').value=state.month;
  const cur=new Date().getFullYear(),years=new Set();
  for(let y=cur-5;y<=cur+10;y++)years.add(y);
  years.add(state.year);
  $('yearSelect').innerHTML=[...years].sort((a,b)=>a-b).map(y=>`<option value="${y}">${y}</option>`).join('');
  $('yearSelect').value=state.year;
}
function resetForm(id){$(id).reset();const f=$(id).querySelector('input[type="hidden"]');if(f)f.value='';}
function cancelEdit(type){
  if(type==='expense'){resetForm('expenseForm');$('expenseFormTitle').textContent='Adicionar gasto';$('expenseSubmit').textContent='+ Adicionar gasto';$('cancelExpenseEdit').style.display='none';$('expenseDate').disabled=false;$('expenseDateTbd').checked=false;$('installmentEnabled').disabled=false;$('installmentCountWrap').style.display='none';$('installmentHint').textContent='Ao parcelar, a primeira parcela fica neste mês e as próximas nos meses seguintes.';$('expenseNameList').classList.remove('show');}
  if(type==='loan'){resetForm('loanForm');$('loanSubmit').textContent='+ Registrar empréstimo';$('cancelLoanEdit').style.display='none';}
  if(type==='pending'){resetForm('pendingForm');$('pendingSubmit').textContent='+ Adicionar pendência';$('cancelPendingEdit').style.display='none';$('pendingWhen').disabled=false;$('pendingDateTbd').checked=false;}
}

/* ===== Renderização ===== */
function renderSummary(){
  const d=monthData();
  const open=unpaidTotal(d),left=remaining(d),f=forecast(d),fp=forecastPaid(d),fr=forecastRemaining(d);
  $('dashBalance').textContent=money(d.balance);
  $('dashExpenses').textContent=money(open);
  $('dashExpenseCount').textContent=`${d.expenses.filter(e=>!e.done).length} gastos não pagos`;
  $('dashRemaining').textContent=money(left);
  $('dashRemaining').classList.toggle('red',left<0);$('dashRemaining').classList.toggle('green',left>=0);
  $('dashProjected').textContent=money(left+f);
  $('dashForecast').textContent=money(f);
  $('dashWorkDays').textContent=`${d.workDays.length} dias trabalhados · ${d.paidDays.length} pagos${d.incomeSource?' · '+d.incomeSource:''}`;
  $('expBalance').textContent=money(d.balance);
  $('expOpen').textContent=money(open);
  $('expPaid').textContent=money(paidTotal(d));
  $('expRemaining').textContent=money(left);
  $('expRemaining').classList.toggle('red',left<0);$('expRemaining').classList.toggle('green',left>=0);
  $('startingBalance').value=Number(d.balance).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  $('incomeDaily').textContent=money(d.dailyRate);
  $('incomeDays').textContent=String(d.workDays.length);
  $('incomeDaysFoot').textContent=`${d.paidDays.length} pagos · ${d.workDays.length-d.paidDays.length} previstos`;
  $('incomePaid').textContent=money(fp);
  $('incomeForecast').textContent=money(fr);
  $('incomeBalance').textContent=money(d.balance);
  $('incomeExpenses').textContent=money(open);
  $('incomeRemaining').textContent=money(left);
  $('incomeProjected').textContent=money(left+f);
}
function renderDashboard(){
  const d=monthData();
  const recent=d.expenses.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  $('dashboardExpenses').innerHTML=recent.length?recent.map(e=>`<div class="list-item ${e.done?'item-done':''}"><div><div class="item-title">${safe(e.name)}</div><div class="item-sub">${e.day?String(e.day).padStart(2,'0')+'/'+String(state.month+1).padStart(2,'0'):'Data a definir'}${e.installmentTotal?` · Parcela ${e.installmentIndex}/${e.installmentTotal}`:''}</div>${e.done?'<span class="status">✓ Pago</span>':''}</div><div class="item-amount ${e.done?'green':'red'}">${money(e.amount)}</div></div>`).join(''):'<div class="empty">Nenhum gasto cadastrado neste mês.</div>';
  const t=loanTotals();
  $('dashboardLoans').innerHTML=state.loans.length?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"><div><div class="metric-label">Falta receber</div><div class="metric-value blue">${money(t.due)}</div></div><div><div class="metric-label">Empréstimos abertos</div><div class="metric-value">${state.loans.filter(l=>loanDue(l)>0).length}</div></div></div><div class="item-sub" style="margin-top:12px">Acesse Empréstimos para registrar devoluções.</div>`:'<div class="empty">Você ainda não registrou empréstimos.</div>';
}
function effectiveDay(e){return e.day===null||e.day===undefined||e.day===''?999:Number(e.day)||999;}
function renderExpenses(){
  const d=monthData(),status=$('expenseStatusFilter').value,sort=$('expenseDateSort').value;
  let list=d.expenses.slice();
  if(status==='unpaid')list=list.filter(e=>!e.done);
  if(status==='paid')list=list.filter(e=>e.done);
  list.sort((a,b)=>{
    if(status==='unpaid-first'&&a.done!==b.done)return Number(a.done)-Number(b.done);
    if(status==='paid-first'&&a.done!==b.done)return Number(b.done)-Number(a.done);
    const da=Number(effectiveDay(a)),db=Number(effectiveDay(b));
    return sort==='desc'?db-da:da-db;
  });
  $('expenseCountBadge').textContent=`${list.length} ${list.length===1?'item':'itens'}`;
  $('expenseList').innerHTML=list.length?list.map(e=>`<div class="list-item ${e.done?'item-done':''}"><div><div class="item-title">${safe(e.name)}</div><div class="item-sub">${e.day?String(e.day).padStart(2,'0')+'/'+String(state.month+1).padStart(2,'0'):'Data a definir'}${e.installmentTotal?` · Parcela ${e.installmentIndex}/${e.installmentTotal}`:''}</div>${e.done?'<span class="status">✓ Pago / concluído</span>':''}<div class="item-actions" style="justify-content:flex-start"><button class="btn btn-soft" data-exp-edit="${e.id}">Editar</button><button class="btn ${e.done?'':'btn-green'}" data-exp-toggle="${e.id}">${e.done?'Desmarcar pagamento':'Marcar pago'}</button><button class="btn btn-red" data-exp-delete="${e.id}">Excluir</button></div></div><div class="item-amount ${e.done?'green':'red'}">${money(e.amount)}</div></div>`).join(''):'<div class="empty">Nenhum gasto corresponde a esse filtro.</div>';
}
function renderLoans(){
  const t=loanTotals();
  $('loanTotal').textContent=money(t.total);
  $('loanReturned').textContent=money(t.returned);
  $('loanOutstanding').textContent=money(t.due);
  $('loanCount').textContent=String(state.loans.length);
  let list=state.loans.slice();
  const filter=$('loanFilter').value,sort=$('loanSort').value;
  if(filter==='open')list=list.filter(l=>loanDue(l)>0);
  if(filter==='paid')list=list.filter(l=>loanDue(l)<=0);
  if(sort==='recent')list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(sort==='old')list.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(sort==='highest')list.sort((a,b)=>loanDue(b)-loanDue(a));
  $('loanListCount').textContent=`${list.length} ${list.length===1?'registro':'registros'}`;
  $('loanList').innerHTML=list.length?list.map(l=>{
    const paid=loanReturned(l),due=loanDue(l),done=due<=0;
    return `<div class="list-item ${done?'item-done':''}"><div><div class="item-title">${safe(l.person)}</div><div class="item-sub">Emprestado em ${formatDate(l.date)}<br>Devolvido: ${money(paid)} · Falta receber: <strong class="${due?'blue':'green'}">${money(due)}</strong>${l.note?`<br>Observação: ${safe(l.note)}`:''}</div>${done?'<span class="status">✓ Devolvido por completo</span>':''}<div class="item-actions" style="justify-content:flex-start">${due>0?`<button class="btn btn-green" data-loan-return="${l.id}">Registrar devolução</button>`:''}<button class="btn btn-soft" data-loan-edit="${l.id}">Editar</button><button class="btn btn-red" data-loan-delete="${l.id}">Excluir</button></div></div><div class="item-amount">${money(l.amount)}</div></div>`;
  }).join(''):'<div class="empty">Nenhum empréstimo nesta lista.</div>';
}
function renderCalendar(){
  const d=monthData(),grid=$('calendar');
  const full=new Date(state.year,state.month,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  $('calendarMonthLabel').textContent=full.charAt(0).toUpperCase()+full.slice(1);
  grid.innerHTML='';
  ['D','S','T','Q','Q','S','S'].forEach(day=>grid.insertAdjacentHTML('beforeend',`<div class="weekday">${day}</div>`));
  const first=new Date(state.year,state.month,1).getDay(),days=new Date(state.year,state.month+1,0).getDate();
  for(let i=0;i<first;i++)grid.insertAdjacentHTML('beforeend','<div class="day empty-day"></div>');
  for(let day=1;day<=days;day++){
    const worked=d.workDays.includes(day),paid=d.paidDays.includes(day);
    const cls=`day ${worked?'selected':''} ${paid?'paid':''}`,flag=paid?'💰':(worked?'✓':'');
    grid.insertAdjacentHTML('beforeend',`<button type="button" class="${cls}" data-day="${day}" aria-pressed="${worked}" title="Dia ${day}"><span>${day}</span>${worked?`<span class="day-amount">${safe(money(d.dailyRate))}</span>`:''}${flag?`<span class="day-flag">${flag}</span>`:''}</button>`);
  }
  const f=forecast(d),fp=forecastPaid(d),fr=forecastRemaining(d);
  $('calendarDayCount').textContent=`${d.workDays.length} dias · ${d.paidDays.length} pagos`;
  $('forecastSource').textContent=d.incomeSource||'Não informada';
  $('forecastDaysText').textContent=String(d.workDays.length);
  $('forecastPaidDaysText').textContent=String(d.paidDays.length);
  $('forecastRateText').textContent=money(d.dailyRate);
  $('forecastTotal').textContent=money(f);
  $('forecastPaidTotal').textContent=money(fp);
  $('forecastRemaining').textContent=money(fr);
}
function renderPending(){
  const all=state.pending,open=all.filter(p=>!p.done);
  $('pendingOpenCount').textContent=String(open.length);
  $('pendingDoneCount').textContent=String(all.filter(p=>p.done).length);
  $('pendingOpenTotal').textContent=money(open.reduce((s,p)=>s+p.amount,0));
  $('pendingTotal').textContent=money(all.reduce((s,p)=>s+p.amount,0));
  const filter=$('pendingFilter').value,sort=$('pendingSort').value;
  let list=all.slice();
  if(filter==='open')list.sort((a,b)=>Number(a.done)-Number(b.done));
  if(filter==='done')list=list.filter(p=>p.done);
  if(sort==='new')list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(sort==='old')list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  if(sort==='high')list.sort((a,b)=>b.amount-a.amount);
  $('pendingCount').textContent=`${list.length} ${list.length===1?'item':'itens'}`;
  $('pendingList').innerHTML=list.length?list.map(p=>`<div class="list-item ${p.done?'item-done':''}"><div><div class="item-title">${safe(p.name)}</div><div class="item-sub">${safe(p.when||'Data a definir')}</div>${p.done?'<span class="status">✓ Concluída</span>':''}<div class="item-actions" style="justify-content:flex-start"><button class="btn btn-soft" data-pending-edit="${p.id}">Editar</button><button class="btn ${p.done?'':'btn-green'}" data-pending-toggle="${p.id}">${p.done?'Reabrir':'Concluir'}</button><button class="btn btn-red" data-pending-delete="${p.id}">Excluir</button></div></div><div class="item-amount ${p.done?'green':'blue'}">${money(p.amount)}</div></div>`).join(''):'<div class="empty">Nenhuma pendência nesta lista.</div>';
}
function renderSimulatorInputs(){
  const d=monthData();
  $('dailyRate').value=d.dailyRate?Number(d.dailyRate).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  $('incomeSource').value=d.incomeSource||'';
}
function render(){
  renderMonthSelectors();renderNavigation();renderSummary();renderDashboard();
  renderExpenses();renderCategoryReport();renderLoans();renderCalendar();
  renderSimulatorInputs();renderPending();renderSavedExpenses();renderFolderStatus();
}
function saveAndRender(msg){
  touchState();persist();render();if(msg)notify(msg);
  if(getFolderSettings().syncOnSave==='on') syncNow({silent:true});
}

/* ===== Popover do calendário ===== */
let popoverDay=null;
function showDayPopover(day,anchor){
  const pop=$('dayPopover'),d=monthData();
  const worked=d.workDays.includes(day),paid=d.paidDays.includes(day);
  $('dayPopoverTitle').textContent=`Dia ${String(day).padStart(2,'0')}/${String(state.month+1).padStart(2,'0')}`;
  pop.querySelector('[data-day-action="worked"]').textContent=(worked?'✓ ':'')+'Marcar como trabalhado';
  pop.querySelector('[data-day-action="paid"]').textContent=(paid?'✓ ':'')+'Marcar como pago';
  popoverDay=day;pop.classList.add('show');
  const r=anchor.getBoundingClientRect(),pw=pop.offsetWidth||200,ph=pop.offsetHeight||150;
  let left=r.left+r.width/2-pw/2,top=r.bottom+6;
  left=Math.max(8,Math.min(window.innerWidth-pw-8,left));
  if(top+ph>window.innerHeight-8)top=Math.max(8,r.top-ph-6);
  pop.style.left=left+'px';pop.style.top=top+'px';
}
function hideDayPopover(){$('dayPopover').classList.remove('show');popoverDay=null;}

/* ===== Sincronização por pasta (File System Access API) ===== */
/* Armazena o DirectoryHandle no IndexedDB (localStorage não aceita handles) */
function idbOpen(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('meuFinanceiroFS',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('handles');
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
async function idbSet(key,val){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction('handles','readwrite');
    tx.objectStore('handles').put(val,key);
    tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);
  });
}
async function idbGet(key){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction('handles','readonly');
    const rq=tx.objectStore('handles').get(key);
    rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>rej(rq.error);
  });
}
async function idbDel(key){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction('handles','readwrite');
    tx.objectStore('handles').delete(key);
    tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);
  });
}

let dirHandle = null;

function getFolderSettings(){
  const def={syncMode:'manual',syncOnSave:'off'};
  try{
    const raw=localStorage.getItem(FOLDER_SETTINGS_KEY);
    if(!raw)return def;
    const o=JSON.parse(raw);
    return {syncMode:o.syncMode==='on-open'?'on-open':'manual',syncOnSave:o.syncOnSave==='on'?'on':'off'};
  }catch(e){return def;}
}
function saveFolderSettings(s){try{localStorage.setItem(FOLDER_SETTINGS_KEY,JSON.stringify(s));}catch(e){}}

async function restoreHandle(){
  if(!('showDirectoryPicker' in window)) return;
  try{
    const h=await idbGet(FOLDER_HANDLE_KEY);
    if(h){ dirHandle=h; await ensurePermission(h,true); }
  }catch(e){ console.warn('Não foi possível restaurar pasta:',e); }
}
async function ensurePermission(handle,request){
  const opts={mode:'readwrite'};
  if(await handle.queryPermission(opts)==='granted')return true;
  if(request && await handle.requestPermission(opts)==='granted')return true;
  return false;
}
async function pickFolder(){
  if(!('showDirectoryPicker' in window)){
    notify('Seu navegador não suporta escolher pasta. Use Chrome ou Edge.');
    return;
  }
  try{
    dirHandle = await window.showDirectoryPicker({mode:'readwrite'});
    await idbSet(FOLDER_HANDLE_KEY,dirHandle);
    notify('Pasta escolhida.');
    renderFolderStatus();
    await syncNow();
  }catch(e){
    if(e.name!=='AbortError')notify('Falha ao escolher pasta: '+e.message);
  }
}
async function forgetFolder(){
  dirHandle=null;
  try{await idbDel(FOLDER_HANDLE_KEY);}catch(e){}
  notify('Pasta esquecida.');
  renderFolderStatus();
}
async function readFileFromFolder(){
  if(!dirHandle)return null;
  try{
    const fh=await dirHandle.getFileHandle(FOLDER_NAME);
    const file=await fh.getFile();
    const text=await file.text();
    const data=JSON.parse(text);
    return {data, mtime:file.lastModified};
  }catch(e){
    if(e.name==='NotFoundError')return null;
    throw e;
  }
}
async function writeFileToFolder(obj){
  if(!dirHandle)return false;
  const fh=await dirHandle.getFileHandle(FOLDER_NAME,{create:true});
  const w=await fh.createWritable();
  await w.write(JSON.stringify(obj,null,2));
  await w.close();
  return true;
}

async function syncNow(opts={}){
  if(!dirHandle){ if(!opts.silent) notify('Escolha uma pasta primeiro.'); return; }
  if(!(await ensurePermission(dirHandle,true))){ if(!opts.silent) notify('Permissão negada para a pasta.'); return; }
  try{
    const remote=await readFileFromFolder();
    const localTime=state.lastModified||0;
    if(!remote){
      await writeFileToFolder(state);
      if(!opts.silent) notify('Arquivo criado na pasta.');
      renderFolderStatus();
      return;
    }
    const remoteTime=remote.mtime||0;
    if(remoteTime>localTime+1000){
      /* nuvem mais nova: baixa */
      if(confirm(`O arquivo da pasta é mais recente (${formatDateTime(remoteTime)}). Baixar e substituir os dados locais?`)){
        const ok=restoreStateFrom(remote.data);
        if(ok){
          state.lastModified=remoteTime;
          persist();render();
          if(!opts.silent) notify('Dados atualizados a partir da pasta.');
        }
      }
    }else if(localTime>remoteTime+1000){
      /* local mais novo: envia */
      await writeFileToFolder(state);
      if(!opts.silent) notify('Dados enviados para a pasta.');
    }else{
      if(!opts.silent) notify('Tudo sincronizado.');
    }
    renderFolderStatus();
  }catch(e){
    console.error(e);
    if(!opts.silent) notify('Erro ao sincronizar: '+e.message);
  }
}

function renderFolderStatus(){
  const st=$('folderStatus');
  const has=!!dirHandle;
  const settings=getFolderSettings();
  $('syncMode').value=settings.syncMode;
  $('syncOnSave').value=settings.syncOnSave;
  st.innerHTML=`
    <div class="status-line"><span><strong>Pasta:</strong> ${has?'escolhida ✓':'não escolhida'}</span><span class="${has?'ok':'warn'}">${has?'Ativa':'Clique em "Escolher pasta"'}</span></div>
    <div class="status-line"><span><strong>Arquivo:</strong> ${FOLDER_NAME}</span><span><strong>Última alteração local:</strong> ${formatDateTime(state.lastModified)}</span></div>
  `;
}

/* ===== Import/Export manual ===== */
function downloadJSON(filename,obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function restoreStateFrom(obj){
  if(!obj||typeof obj!=='object'||!obj.monthsData)return false;
  const next={
    month:Number.isInteger(obj.month)&&obj.month>=0&&obj.month<=11?obj.month:now.getMonth(),
    year:Number.isInteger(obj.year)?obj.year:now.getFullYear(),
    monthsData:obj.monthsData||{},
    pending:Array.isArray(obj.pending)?obj.pending:[],
    loans:Array.isArray(obj.loans)?obj.loans:[],
    savedExpenses:Array.isArray(obj.savedExpenses)?obj.savedExpenses:[],
    lastModified:Number(obj.lastModified)||Date.now()
  };
  Object.keys(next.monthsData).forEach(k=>next.monthsData[k]=ensureMonth(next.monthsData[k]));
  next.pending.forEach(p=>{if(!p.id)p.id=uid();p.amount=Number(p.amount)||0;p.done=Boolean(p.done);});
  next.loans.forEach(l=>{
    if(!l.id)l.id=uid();l.amount=Number(l.amount)||0;l.returned=Number(l.returned)||0;
    if(!Number.isInteger(l.originMonth))l.originMonth=next.month;
    if(!Number.isInteger(l.originYear))l.originYear=next.year;
    if(typeof l.withdrawn!=='boolean')l.withdrawn=false;
  });
  next.savedExpenses=next.savedExpenses.map(s=>({id:s.id||uid(),name:String(s.name||'').trim()})).filter(s=>s.name);
  state=next;persist();render();
  return true;
}

/* ===== Eventos de UI ===== */
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){moveView(nav.dataset.nav);return;}
  const go=e.target.closest('[data-go]');if(go){moveView(go.dataset.go);return;}
});
$('menuToggle').addEventListener('click',()=>$('drawer').classList.contains('open')?closeDrawer():openDrawer());
$('overlay').addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
$('monthSelect').addEventListener('change',e=>{state.month=Number(e.target.value);monthData();hideDayPopover();saveAndRender();});
$('yearSelect').addEventListener('change',e=>{state.year=Number(e.target.value);monthData();hideDayPopover();saveAndRender();});

/* Saldo */
$('saveBalance').addEventListener('click',()=>{
  const v=parseMoney($('startingBalance').value);
  if(!Number.isFinite(v)||v<0){notify('Digite um saldo válido.');return;}
  monthData().balance=round(v);saveAndRender('Saldo atualizado.');
});

/* Gastos */
$('expenseName').addEventListener('input',e=>renderAutocomplete(e.target.value));
$('expenseName').addEventListener('focus',e=>renderAutocomplete(e.target.value));
$('expenseName').addEventListener('keydown',e=>{
  const box=$('expenseNameList');if(!box.classList.contains('show'))return;
  const items=[...box.querySelectorAll('.autocomplete-item')];if(!items.length)return;
  if(e.key==='ArrowDown'){e.preventDefault();acIndex=(acIndex+1)%items.length;setAcActive(acIndex);}
  else if(e.key==='ArrowUp'){e.preventDefault();acIndex=(acIndex-1+items.length)%items.length;setAcActive(acIndex);}
  else if(e.key==='Enter'){if(acIndex>=0&&items[acIndex]){e.preventDefault();applyAcById(items[acIndex].dataset.acId);}}
  else if(e.key==='Escape'){box.classList.remove('show');}
});
$('expenseNameList').addEventListener('mousedown',e=>{
  const it=e.target.closest('.autocomplete-item');if(!it)return;e.preventDefault();applyAcById(it.dataset.acId);
});
document.addEventListener('click',e=>{if(!e.target.closest('.autocomplete-wrap'))$('expenseNameList').classList.remove('show');});
$('saveAsTemplate').addEventListener('click',()=>{
  const name=$('expenseName').value.trim();
  if(!name){notify('Digite o nome do gasto.');return;}
  const added=addSavedExpense(name);
  touchState();persist();renderSavedExpenses();
  notify(added?'Nome salvo.':'Esse nome já existe.');
});
$('savedList').addEventListener('click',e=>{
  const ap=e.target.closest('[data-saved-apply]'),del=e.target.closest('[data-saved-del]');
  if(ap){const s=state.savedExpenses.find(x=>x.id===ap.dataset.savedApply);if(s)fillExpenseForm(s);return;}
  if(del){const s=state.savedExpenses.find(x=>x.id===del.dataset.savedDel);if(!s)return;if(!confirm(`Remover "${s.name}"?`))return;state.savedExpenses=state.savedExpenses.filter(x=>x.id!==s.id);touchState();persist();renderSavedExpenses();notify('Removido.');}
});
$('expenseDateTbd').addEventListener('change',()=>{$('expenseDate').disabled=$('expenseDateTbd').checked;if($('expenseDateTbd').checked)$('expenseDate').value='';});
$('installmentEnabled').addEventListener('change',()=>{
  $('installmentCountWrap').style.display=$('installmentEnabled').checked?'block':'none';
  $('installmentHint').textContent=$('installmentEnabled').checked?'O total será dividido em parcelas mensais, começando neste mês.':'Ao parcelar, a primeira parcela fica neste mês e as próximas nos meses seguintes.';
});
$('expenseAmount').addEventListener('input',()=>{
  const v=parseMoney($('expenseAmount').value),c=Number($('installmentCount').value);
  if($('installmentEnabled').checked&&Number.isFinite(v)&&v>0&&c>=2&&c<=36)$('installmentHint').textContent=`Aproximadamente ${money(v/c)} por parcela em ${c} vezes.`;
});
$('expenseForm').addEventListener('submit',e=>{
  e.preventDefault();
  const d=monthData(),id=$('expenseEditId').value;
  const name=$('expenseName').value.trim(),amount=parseMoney($('expenseAmount').value);
  const dateTbd=$('expenseDateTbd').checked,raw=$('expenseDate').value.trim();
  const parsed=dateTbd?null:isoToDayMonth(raw);
  if(!name||!Number.isFinite(amount)||amount<=0){notify('Informe nome e valor válidos.');return;}
  if(!dateTbd&&!parsed){notify('Informe a data ou marque Data a definir.');return;}
  if(parsed){
    if(parsed.year!==state.year||(parsed.month-1)!==state.month){notify(`A data precisa pertencer ao mês selecionado (${MONTHS[state.month]}/${state.year}).`);return;}
    if(parsed.day>new Date(state.year,state.month+1,0).getDate()){notify('Dia inválido.');return;}
  }
  const isEdit=Boolean(id),addSaved=addSavedExpense(name);
  if(isEdit){
    const item=d.expenses.find(x=>x.id===id);if(!item)return;
    const next=round(amount);
    if(item.done)d.balance=round(d.balance+item.amount-next);
    item.name=name;item.amount=next;item.day=parsed?parsed.day:null;
    item.installmentGroup=null;item.installmentIndex=null;item.installmentTotal=null;
    saveAndRender(addSaved?'Gasto atualizado e nome salvo.':'Gasto atualizado.');cancelEdit('expense');render();return;
  }
  const count=$('installmentEnabled').checked?Number($('installmentCount').value):1;
  if(!Number.isInteger(count)||count<1||count>36){notify('Quantidade inválida.');return;}
  const cents=Math.round(round(amount)*100),base=Math.floor(cents/count),rem=cents%count,group=count>1?uid():null;
  for(let i=0;i<count;i++){
    const off=shiftMonth(state.year,state.month,i),tgt=monthData(off.year,off.month);
    const lastDay=new Date(off.year,off.month+1,0).getDate();
    const day=parsed?Math.min(parsed.day,lastDay):null;
    tgt.expenses.push({id:uid(),name:count>1?`${name} (parcela ${i+1}/${count})`:name,amount:(base+(i<rem?1:0))/100,day,done:false,createdAt:Date.now()+i,...(count>1?{installmentGroup:group,installmentIndex:i+1,installmentTotal:count}:{})});
  }
  let msg=count>1?`Compra dividida em ${count} parcelas.`:'Gasto adicionado.';
  if(addSaved)msg+=' Nome salvo.';
  saveAndRender(msg);cancelEdit('expense');render();
});
$('cancelExpenseEdit').addEventListener('click',()=>{cancelEdit('expense');render();});
$('expenseStatusFilter').addEventListener('change',renderExpenses);
$('expenseDateSort').addEventListener('change',renderExpenses);

function editExpense(id){
  const e=monthData().expenses.find(x=>x.id===id);if(!e)return;
  $('expenseEditId').value=e.id;$('expenseName').value=e.name;
  $('expenseAmount').value=Number(e.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  $('expenseDateTbd').checked=e.day===null||e.day===undefined;
  $('expenseDate').disabled=$('expenseDateTbd').checked;
  if(e.day){const m=String(state.month+1).padStart(2,'0'),d2=String(e.day).padStart(2,'0');$('expenseDate').value=`${state.year}-${m}-${d2}`;}
  else $('expenseDate').value='';
  $('installmentEnabled').checked=false;$('installmentEnabled').disabled=true;$('installmentCountWrap').style.display='none';
  $('expenseFormTitle').textContent='Editar gasto';$('expenseSubmit').textContent='Salvar alterações';
  $('cancelExpenseEdit').style.display='inline-block';$('expenseNameList').classList.remove('show');
  $('expenseForm').scrollIntoView({behavior:'smooth',block:'center'});$('expenseName').focus();
}
$('expenseList').addEventListener('click',e=>{
  const ed=e.target.closest('[data-exp-edit]'),tg=e.target.closest('[data-exp-toggle]'),dl=e.target.closest('[data-exp-delete]');
  const d=monthData();
  if(ed){editExpense(ed.dataset.expEdit);return;}
  if(tg){const it=d.expenses.find(x=>x.id===tg.dataset.expToggle);if(!it)return;if(!it.done){d.balance=round(d.balance-it.amount);it.done=true;}else{d.balance=round(d.balance+it.amount);it.done=false;}saveAndRender(it.done?'Gasto marcado como pago.':'Pagamento desfeito.');return;}
  if(dl){const it=d.expenses.find(x=>x.id===dl.dataset.expDelete);if(!it)return;if(!confirm(`Excluir "${it.name}"?`))return;if(it.done)d.balance=round(d.balance+it.amount);d.expenses=d.expenses.filter(x=>x.id!==it.id);saveAndRender('Gasto excluído.');}
});

/* Relatório */
$('reportToggle').addEventListener('click',()=>setReportCollapsed(!reportCollapsed));
$('reportToggle').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setReportCollapsed(!reportCollapsed);}});

/* Ganhos */
$('dailyRate').addEventListener('change',()=>{
  const v=parseMoney($('dailyRate').value);
  if(!Number.isFinite(v)||v<0){notify('Diária inválida.');renderSimulatorInputs();return;}
  monthData().dailyRate=round(v);saveAndRender();
});
$('incomeSource').addEventListener('change',()=>{monthData().incomeSource=$('incomeSource').value.trim();saveAndRender();});
$('calendar').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;showDayPopover(Number(b.dataset.day),b);});
$('clearDays').addEventListener('click',()=>{monthData().workDays=[];monthData().paidDays=[];hideDayPopover();saveAndRender('Calendário limpo.');});
$('dayPopover').addEventListener('click',e=>{
  const b=e.target.closest('[data-day-action]');if(!b||popoverDay==null)return;
  const a=b.dataset.dayAction,d=monthData(),day=popoverDay;
  if(a==='worked'){if(d.workDays.includes(day)){d.workDays=d.workDays.filter(x=>x!==day);d.paidDays=d.paidDays.filter(x=>x!==day);}else d.workDays=[...d.workDays,day].sort((x,y)=>x-y);}
  else if(a==='paid'){if(!d.workDays.includes(day))d.workDays=[...d.workDays,day].sort((x,y)=>x-y);if(d.paidDays.includes(day))d.paidDays=d.paidDays.filter(x=>x!==day);else d.paidDays=[...d.paidDays,day].sort((x,y)=>x-y);}
  else if(a==='clear'){d.workDays=d.workDays.filter(x=>x!==day);d.paidDays=d.paidDays.filter(x=>x!==day);}
  hideDayPopover();saveAndRender();
});
document.addEventListener('click',e=>{if(!e.target.closest('#dayPopover')&&!e.target.closest('#calendar'))hideDayPopover();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideDayPopover();});

/* Empréstimos */
$('loanForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=$('loanEditId').value,person=$('loanPerson').value.trim(),amount=parseMoney($('loanAmount').value),date=$('loanDate').value,note=$('loanNote').value.trim();
  if(!person||!Number.isFinite(amount)||amount<=0){notify('Informe pessoa e valor válidos.');return;}
  if(id){
    const it=state.loans.find(l=>l.id===id);if(!it)return;
    if(amount<loanReturned(it)){notify('Valor menor que o já devolvido.');return;}
    const diff=round(amount-Number(it.amount||0));
    it.person=person;it.amount=round(amount);it.date=date;it.note=note;
    if(it.withdrawn&&diff!==0)loanBalanceAdjust(it,-diff);
    saveAndRender('Empréstimo atualizado.');cancelEdit('loan');render();return;
  }
  const loan={id:uid(),person,amount:round(amount),returned:0,date,note,createdAt:Date.now(),originYear:state.year,originMonth:state.month,withdrawn:false};
  state.loans.push(loan);withdrawLoanFromBalance(loan);
  saveAndRender('Empréstimo registrado. Valor descontado do saldo.');
  cancelEdit('loan');render();
});
$('cancelLoanEdit').addEventListener('click',()=>{cancelEdit('loan');render();});
$('loanFilter').addEventListener('change',renderLoans);
$('loanSort').addEventListener('change',renderLoans);
$('loanList').addEventListener('click',e=>{
  const rt=e.target.closest('[data-loan-return]'),ed=e.target.closest('[data-loan-edit]'),dl=e.target.closest('[data-loan-delete]');
  if(rt){const l=state.loans.find(x=>x.id===rt.dataset.loanReturn);if(!l)return;const due=loanDue(l);if(due<=0){notify('Já quitado.');return;}const ans=prompt(`Quanto ${l.person} devolveu?\nFalta: ${money(due)}`,due.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));if(ans===null)return;const a=parseMoney(ans);if(!Number.isFinite(a)||a<=0||a>due+0.001){notify('Valor inválido.');return;}l.returned=round(loanReturned(l)+a);if(l.withdrawn)loanBalanceAdjust(l,a);saveAndRender(loanDue(l)<=0?'Empréstimo quitado!':'Devolução registrada.');return;}
  if(ed){const l=state.loans.find(x=>x.id===ed.dataset.loanEdit);if(!l)return;$('loanEditId').value=l.id;$('loanPerson').value=l.person;$('loanAmount').value=Number(l.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});$('loanDate').value=l.date||'';$('loanNote').value=l.note||'';$('loanSubmit').textContent='Salvar alterações';$('cancelLoanEdit').style.display='inline-block';$('loanForm').scrollIntoView({behavior:'smooth',block:'center'});$('loanPerson').focus();return;}
  if(dl){const l=state.loans.find(x=>x.id===dl.dataset.loanDelete);if(!l)return;if(!confirm(`Excluir empréstimo de ${l.person}?`))return;restoreLoanToBalance(l);state.loans=state.loans.filter(x=>x.id!==l.id);saveAndRender('Empréstimo excluído.');}
});

/* Pendências */
$('pendingDateTbd').addEventListener('change',()=>{$('pendingWhen').disabled=$('pendingDateTbd').checked;if($('pendingDateTbd').checked)$('pendingWhen').value='';});
$('pendingForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=$('pendingEditId').value,name=$('pendingName').value.trim(),amount=parseMoney($('pendingAmount').value),when=$('pendingDateTbd').checked?'Data a definir':$('pendingWhen').value.trim();
  if(!name||!when||!Number.isFinite(amount)||amount<=0){notify('Preencha os campos.');return;}
  if(id){const p=state.pending.find(x=>x.id===id);if(!p)return;p.name=name;p.amount=round(amount);p.when=when;saveAndRender('Pendência atualizada.');cancelEdit('pending');render();return;}
  state.pending.push({id:uid(),name,amount:round(amount),when,done:false,createdAt:Date.now()});
  saveAndRender('Pendência adicionada.');cancelEdit('pending');render();
});
$('cancelPendingEdit').addEventListener('click',()=>{cancelEdit('pending');render();});
$('pendingFilter').addEventListener('change',renderPending);
$('pendingSort').addEventListener('change',renderPending);
$('pendingList').addEventListener('click',e=>{
  const tg=e.target.closest('[data-pending-toggle]'),ed=e.target.closest('[data-pending-edit]'),dl=e.target.closest('[data-pending-delete]');
  if(tg){const p=state.pending.find(x=>x.id===tg.dataset.pendingToggle);if(!p)return;p.done=!p.done;saveAndRender(p.done?'Concluída.':'Reaberta.');return;}
  if(ed){const p=state.pending.find(x=>x.id===ed.dataset.pendingEdit);if(!p)return;$('pendingEditId').value=p.id;$('pendingName').value=p.name;$('pendingAmount').value=Number(p.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});$('pendingDateTbd').checked=p.when==='Data a definir';$('pendingWhen').disabled=$('pendingDateTbd').checked;$('pendingWhen').value=$('pendingDateTbd').checked?'':p.when;$('pendingSubmit').textContent='Salvar alterações';$('cancelPendingEdit').style.display='inline-block';$('pendingForm').scrollIntoView({behavior:'smooth',block:'center'});$('pendingName').focus();return;}
  if(dl){const p=state.pending.find(x=>x.id===dl.dataset.pendingDelete);if(!p)return;if(!confirm(`Excluir "${p.name}"?`))return;state.pending=state.pending.filter(x=>x.id!==p.id);saveAndRender('Pendência excluída.');}
});

/* Sincronização */
$('btnPickFolder').addEventListener('click',pickFolder);
$('btnSyncNow').addEventListener('click',()=>syncNow());
$('btnSaveToFolder').addEventListener('click',async()=>{
  if(!dirHandle){notify('Escolha uma pasta primeiro.');return;}
  if(!(await ensurePermission(dirHandle,true))){notify('Permissão negada.');return;}
  try{await writeFileToFolder(state);notify('Dados enviados para a pasta.');renderFolderStatus();}
  catch(e){notify('Erro ao gravar: '+e.message);}
});
$('btnForgetFolder').addEventListener('click',forgetFolder);
$('syncMode').addEventListener('change',()=>{const s=getFolderSettings();s.syncMode=$('syncMode').value;saveFolderSettings(s);renderFolderStatus();});
$('syncOnSave').addEventListener('change',()=>{const s=getFolderSettings();s.syncOnSave=$('syncOnSave').value;saveFolderSettings(s);renderFolderStatus();});

/* ===== Boot ===== */
applyReportCollapsed();
render();
restoreHandle().then(()=>{
  renderFolderStatus();
  if(getFolderSettings().syncMode==='on-open' && dirHandle) syncNow({silent:true});
});
})();