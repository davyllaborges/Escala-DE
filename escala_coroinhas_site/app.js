const $ = id => document.getElementById(id);
const weekdays = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const defaults = {
  month:10, year:2026, staffMode:'auto', fixedCount:4,
  services:[
    {day:0,on:true,times:['07:00','09:00','19:00']},
    {day:2,on:true,times:['19:00']},
    {day:3,on:true,times:['19:00']},
    {day:4,on:true,times:['19:00']},
    {day:5,on:true,times:['19:00']}
  ],
  members:['Ana','Beatriz','Carlos','Daniel','Eduarda','Felipe','Gabriela','Heitor','Isabela','João','Larissa','Mateus'].map(name=>({name,blockedDays:[],sundayTime:'any'})),
  specials:[]
};
let state = loadState();
let assignments = [];
let rotation = 0;
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){try{const x=JSON.parse(localStorage.getItem('escalaCoroinhas'));return x?({...clone(defaults),...x}):clone(defaults)}catch(e){return clone(defaults)}}
function save(){localStorage.setItem('escalaCoroinhas',JSON.stringify(state))}
function dateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function initForm(){
 $('month').value=state.month;$('year').value=state.year;$('staffMode').value=state.staffMode;$('fixedCount').value=state.fixedCount;
 $('fixedWrap').classList.toggle('hidden',state.staffMode!=='fixed');
 renderServices();renderMembers();renderSpecials();
}
function renderServices(){
 $('serviceDays').innerHTML=state.services.map((s,i)=>`<div class="service-row ${s.on?'':'off'}">
 <input type="checkbox" aria-label="Ativar ${weekdays[s.day]}" data-service="${i}" ${s.on?'checked':''}>
 <span class="day">${weekdays[s.day]}</span>
 <input type="text" aria-label="Horários de ${weekdays[s.day]}" data-times="${i}" value="${esc(s.times.join(', '))}" placeholder="19:00">
 </div>`).join('');
 $('serviceDays').querySelectorAll('[data-service]').forEach(el=>el.addEventListener('change',()=>{state.services[+el.dataset.service].on=el.checked;save();renderServices()}));
 $('serviceDays').querySelectorAll('[data-times]').forEach(el=>el.addEventListener('change',()=>{state.services[+el.dataset.times].times=el.value.split(',').map(t=>t.trim()).filter(Boolean);save()}));
}
function renderMembers(){
 $('memberCount').textContent=`${state.members.length} nomes`;
 $('members').innerHTML=state.members.map((m,i)=>`<div class="member-card">
 <div class="member-top"><strong>${esc(m.name)}</strong><button class="mini-btn" data-remove="${i}" aria-label="Remover ${esc(m.name)}">Remover</button></div>
 <div class="member-restrictions">
 <label>Horário de domingo<select data-sunday="${i}"><option value="any" ${m.sundayTime==='any'?'selected':''}>Qualquer horário</option>${getSundayTimes().map(t=>`<option value="${esc(t)}" ${m.sundayTime===t?'selected':''}>Somente ${esc(t)}</option>`).join('')}</select></label>
 <label>Dias do mês em que não pode<input data-blocked="${i}" value="${(m.blockedDays||[]).join(', ')}" placeholder="Ex.: 4, 12, 25"></label>
 </div></div>`).join('');
 $('members').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{state.members.splice(+b.dataset.remove,1);save();renderMembers()}));
 $('members').querySelectorAll('[data-sunday]').forEach(s=>s.addEventListener('change',()=>{state.members[+s.dataset.sunday].sundayTime=s.value;save()}));
 $('members').querySelectorAll('[data-blocked]').forEach(s=>s.addEventListener('change',()=>{state.members[+s.dataset.blocked].blockedDays=s.value.split(',').map(v=>parseInt(v.trim(),10)).filter(v=>v>=1&&v<=31);save()}));
}
function getSundayTimes(){return state.services.find(s=>s.day===0)?.times||['07:00','09:00','19:00']}
function renderSpecials(){
 $('specialList').innerHTML=state.specials.length?state.specials.map((s,i)=>`<div class="special-item"><span class="pill">${s.type==='holiday'?'Feriado':'Solenidade'}</span><span><b>${esc(s.name)}</b><br><small>${parseDate(s.date).toLocaleDateString('pt-BR')}</small></span><button class="mini-btn" data-special-remove="${i}">Remover</button></div>`).join(''):'<p class="muted">Nenhuma data especial adicionada.</p>';
 $('specialList').querySelectorAll('[data-special-remove]').forEach(b=>b.addEventListener('click',()=>{state.specials.splice(+b.dataset.specialRemove,1);save();renderSpecials()}));
}
function readForm(){state.month=+$('month').value;state.year=+$('year').value;state.staffMode=$('staffMode').value;state.fixedCount=Math.max(1,+$('fixedCount').value||1);save()}
function activeServices(){return state.services.filter(s=>s.on&&s.times.length).flatMap(s=>s.times.map(time=>({day:s.day,time,label:weekdays[s.day]})))}
function serviceOnDate(date){return activeServices().filter(s=>s.day===date.getDay())}
function getSpecial(date){return state.specials.filter(s=>s.date===dateKey(date.getFullYear(),date.getMonth(),date.getDate()))}
function buildSchedule(){
 readForm();assignments=[];const warnings=[];
 if(!state.members.length){$('configMessage').textContent='Adicione pelo menos um coroinha antes de gerar a escala.';return}
 const nDays=new Date(state.year,state.month+1,0).getDate();
 const allDates=Array.from({length:nDays},(_,i)=>new Date(state.year,state.month,i+1));
 const sundays=allDates.filter(d=>d.getDay()===0);
 const eligible=(date,svc)=>state.members.filter(m=>!(m.blockedDays||[]).includes(date.getDate())&&(!(date.getDay()===0)||m.sundayTime==='any'||m.sundayTime===svc.time));
 const countFor=(date,svc)=>{
   if(date.getDay()===0){const n=sundays.length;return Math.max(1,state.members.length-Math.floor(state.members.length/n));}
   if(getSpecial(date).some(s=>s.type==='holiday'))return state.members.length;
   if(state.staffMode==='fixed')return Math.min(state.members.length,state.fixedCount);
   const weekly=state.members.length/Math.max(1,activeServices().length);
   return Math.max(1,Math.ceil(weekly));
 };
 // Spread weekday duties first, respecting weekly minimum as closely as possible.
 const weeklyCount={};state.members.forEach(m=>weeklyCount[m.name]=0);
 let cursor=rotation;
 for(const date of allDates){
   const svcs=serviceOnDate(date);
   if(!svcs.length)continue;
   const specials=getSpecial(date);
   const dayEntries=[];
   for(const svc of svcs){
     const pool=eligible(date,svc);
     let target=countFor(date,svc);
     if(date.getDay()===0) target=Math.min(pool.length,Math.max(1,state.members.length- Math.ceil(state.members.length/Math.max(1,sundays.length))));
     if(specials.some(s=>s.type==='solemnity')&&date.getDay()===0) target=Math.min(pool.length,state.members.length);
     if(specials.some(s=>s.type==='holiday')) target=Math.min(pool.length,state.members.length);
     // Rotate candidates with preference for those with fewer assignments.
     const ranked=pool.map((m,i)=>({m,i,score:(weeklyCount[m.name]||0)*10 + ((state.members.indexOf(m)-cursor+state.members.length)%Math.max(1,state.members.length))}))
       .sort((a,b)=>a.score-b.score);
     let chosen=ranked.slice(0,target).map(x=>x.m);
     // On Sunday spread attendance so everyone misses one Sunday, when possible.
     if(date.getDay()===0 && !specials.some(s=>s.type==='solemnity')){
       const expected=Math.max(1,state.members.length- Math.ceil(state.members.length/Math.max(1,sundays.length)));
       chosen=ranked.slice(0,Math.min(expected,pool.length)).map(x=>x.m);
     }
     chosen.forEach(m=>weeklyCount[m.name]=(weeklyCount[m.name]||0)+1);
     dayEntries.push({svc,chosen,all:pool});
     cursor=(cursor+Math.max(1,chosen.length))%state.members.length;
     if(pool.length<target)warnings.push(`${date.toLocaleDateString('pt-BR')}, ${svc.time}: há ${pool.length} pessoa(s) disponível(is), mas a meta era ${target}.`);
   }
   // Solenities on Sunday: ensure everyone appears in at least one mass.
   if(date.getDay()===0&&specials.some(s=>s.type==='solemnity')){
     const seen=new Set(dayEntries.flatMap(e=>e.chosen.map(m=>m.name)));
     const missing=state.members.filter(m=>!seen.has(m.name)&&!(m.blockedDays||[]).includes(date.getDate()));
     missing.forEach((m,i)=>{if(dayEntries.length)dayEntries[i%dayEntries.length].chosen.push(m)});
   }
   assignments.push({date,svcs:dayEntries,specials});
 }
 // Sundays: aim for each person to have one Sunday off (unless month constraints make impossible).
 const sundayDates=assignments.filter(a=>a.date.getDay()===0);
 const offByMember={};state.members.forEach(m=>offByMember[m.name]=0);
 sundayDates.forEach(day=>state.members.forEach(m=>{if(!day.svcs.some(e=>e.chosen.some(x=>x.name===m.name)))offByMember[m.name]++}));
 state.members.forEach(m=>{if(sundayDates.length>1&&offByMember[m.name]===0)warnings.push(`${m.name}: não foi possível garantir uma folga dominical com as restrições atuais.`)});
 // Week-level check for members with no assignment in a calendar week.
 const weekKeys={};state.members.forEach(m=>weekKeys[m.name]=new Set());
 assignments.forEach(a=>a.svcs.forEach(e=>e.chosen.forEach(m=>weekKeys[m.name].add(weekKey(a.date)))));
 state.members.forEach(m=>{if(weekKeys[m.name].size===0)warnings.push(`${m.name}: não recebeu nenhuma escala. Confira as restrições.`)});
 $('configMessage').textContent='Escala gerada! Confira as folgas e os avisos antes de compartilhar.';
 renderSchedule(warnings);renderSummary();activateTab('escala');
}
function weekKey(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`}
function liturgicalText(month){if(month===11)return 'Tempo do Advento e Natal (conforme as datas litúrgicas).';if(month===2)return 'Tempo da Quaresma (verifique o início conforme o ano).';if(month===3)return 'Tempo Pascal (verifique as datas móveis).';if(month===10)return 'Tempo Comum e início do Advento no fim do mês (confira o calendário litúrgico).';return 'Tempo litúrgico: confira as datas no calendário da paróquia.'}
function renderSchedule(warnings=[]){
 $('scheduleTitle').textContent=`${monthNames[state.month]} de ${state.year}`;$('liturgical').textContent=liturgicalText(state.month);
 const html=assignments.map(a=>{
  const d=a.date, specials=a.specials;
  const cls=(d.getDay()===0?' sunday':'')+(specials.length?' special':'');
  const dot=specials.length?'purple':d.getDay()===0?'gold':'green';
  return `<article class="day-card${cls}"><div class="day-head"><span class="date-num">${d.getDate()}</span><span class="dot ${dot}"></span><span class="date-meta"><strong>${weekdays[d.getDay()]}</strong><small>${specials.map(s=>esc(s.name)).join(' · ')||'Celebrações do dia'}</small></span></div>
  ${a.svcs.length?a.svcs.map(e=>`<div class="mass"><div class="mass-title">${esc(e.svc.time)}${e.svc.day===0?' · Missa de domingo':''}</div><div class="names">${e.chosen.length?e.chosen.map(m=>esc(m.name)).join(', '):'<span class="offname">Sem coroinhas disponíveis</span>'}</div></div>`).join(''):'<div class="mass"><span class="muted">Sem celebração configurada</span></div>'}
  ${d.getDay()===0?`<div class="mass"><div class="mass-title">Folga dominical</div><div class="names offname">${state.members.filter(m=>!a.svcs.some(e=>e.chosen.some(x=>x.name===m.name))).map(m=>esc(m.name)).join(', ')||'Nenhuma folga identificada'}</div></div>`:''}</article>`;
 }).join('');
 $('schedule').innerHTML=html||'<div class="schedule-empty">Ative pelo menos um dia de celebração em Configurar.</div>';
 $('warnings').innerHTML=warnings.length?`<h3>⚠️ Atenção a estes pontos</h3>${[...new Set(warnings)].map(w=>`<div class="warning">${esc(w)}</div>`).join('')}`:'<div class="check ok"><b>✓ Nenhum aviso automático</b>Confira a escala com a coordenação antes de divulgar.</div>';
 const sel=$('copyMember');const old=sel.value;sel.innerHTML='<option value="all">Todos os coroinhas</option>'+state.members.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function renderSummary(){
 const totals={};const sundayTotals={};const weekdayWeeks={};state.members.forEach(m=>{totals[m.name]=0;sundayTotals[m.name]=0;weekdayWeeks[m.name]=new Set()});
 assignments.forEach(a=>a.svcs.forEach(e=>e.chosen.forEach(m=>{totals[m.name]++;if(a.date.getDay()===0)sundayTotals[m.name]++;weekdayWeeks[m.name].add(weekKey(a.date))})));
 $('summary').innerHTML=state.members.map(m=>`<div class="summary-card"><div class="summary-top"><strong>${esc(m.name)}</strong><span class="summary-number">${totals[m.name]||0}×</span></div><p>${sundayTotals[m.name]} missa(s) aos domingos · ${weekdayWeeks[m.name].size} semana(s) com escala</p></div>`).join('');
 const nSundays=assignments.filter(a=>a.date.getDay()===0).length;
 const sundayOkay=state.members.every(m=>sundayTotals[m.name]>=Math.max(0,nSundays-1));
 const weeklyOkay=state.members.every(m=>weekdayWeeks[m.name].size>0);
 const specialSunday=assignments.filter(a=>a.date.getDay()===0&&a.specials.some(s=>s.type==='solemnity'));
 const allSolemnity=specialSunday.every(a=>state.members.every(m=>a.svcs.some(e=>e.chosen.some(x=>x.name===m.name))));
 $('ruleChecks').innerHTML=[
  [weeklyOkay,'Participação semanal','Cada coroinha aparece em pelo menos uma semana.','Algum coroinha ficou sem escala; confira os avisos.'],
  [sundayOkay,'Folga dominical','A meta é participar de todos os domingos menos um.','Nem todos alcançaram a meta de domingos; confira restrições e distribuição.'],
  [allSolemnity,'Solenidade no domingo','Conferência de participação em solenidades dominicais.','Há solenidade dominical que precisa de conferência manual.'],
  [true,'Restrições pessoais','A escala evita datas bloqueadas e horários dominicais incompatíveis.','']
 ].map(x=>`<div class="check ${x[0]?'ok':'warn'}"><b>${x[0]?'✓':'⚠'} ${x[1]}</b>${x[0]?x[2]:x[3]}</div>`).join('');
}
function activateTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${name}`))}
function makeShareText(){
 const chosen=$('copyMember').value;let lines=[`*ESCALA DOS COROINHAS — ${monthNames[state.month].toUpperCase()} DE ${state.year}*`];
 assignments.forEach(a=>{
  const parts=[];
  a.svcs.forEach(e=>{
   let names=e.chosen.map(m=>m.name);
   if(chosen!=='all')names=names.filter(n=>n===chosen);
   if(names.length)parts.push(`${e.svc.time}: ${names.join(', ')}`);
  });
  if(parts.length)lines.push(`\n*${a.date.toLocaleDateString('pt-BR')} — ${weekdays[a.date.getDay()]}*${a.specials.length?' · '+a.specials.map(s=>s.name).join(', '):''}\n${parts.join('\n')}`);
  if(chosen==='all'&&a.date.getDay()===0){const off=state.members.filter(m=>!a.svcs.some(e=>e.chosen.some(x=>x.name===m.name))).map(m=>m.name);if(off.length)lines.push(`Folga dominical: ${off.join(', ')}`)}
 });
 return lines.join('\n');
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
$('month').addEventListener('change',()=>{readForm();save()});$('year').addEventListener('change',()=>{readForm();save()});
$('staffMode').addEventListener('change',()=>{readForm();$('fixedWrap').classList.toggle('hidden',state.staffMode!=='fixed')});
$('fixedCount').addEventListener('change',readForm);
$('addMember').addEventListener('click',()=>{const name=$('newMember').value.trim();if(!name)return;if(state.members.some(m=>m.name.toLowerCase()===name.toLowerCase())){$('configMessage').textContent='Esse nome já está na lista.';return}state.members.push({name,blockedDays:[],sundayTime:'any'});$('newMember').value='';save();renderMembers()});
$('newMember').addEventListener('keydown',e=>{if(e.key==='Enter')$('addMember').click()});
$('addTime').addEventListener('click',()=>{let s=state.services.find(x=>x.day===0);if(!s){s={day:0,on:true,times:[]};state.services.push(s)}s.times.push('');save();renderServices()});
$('addSpecial').addEventListener('click',()=>{const date=$('specialDate').value,name=$('specialName').value.trim(),type=$('specialType').value;if(!date||!name){$('configMessage').textContent='Informe a data e a descrição da data especial.';return}state.specials.push({date,name,type});state.specials.sort((a,b)=>a.date.localeCompare(b.date));save();renderSpecials();$('specialName').value='';$('specialDate').value=''});
$('generate').addEventListener('click',buildSchedule);
$('rotate').addEventListener('click',()=>{rotation=(rotation+1)%Math.max(1,state.members.length);buildSchedule()});
$('copyWhatsApp').addEventListener('click',async()=>{const text=makeShareText();try{await navigator.clipboard.writeText(text);$('shareMessage').textContent='Escala copiada! Agora é só colar no WhatsApp.'}catch(e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();$('shareMessage').textContent=ok?'Escala copiada! Agora é só colar no WhatsApp.':'Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.';if(!ok)alert(text)}});
$('reset').addEventListener('click',()=>{if(confirm('Restaurar os nomes e horários de exemplo? Suas alterações atuais serão substituídas.')){state=clone(defaults);rotation=0;save();initForm();$('configMessage').textContent='Exemplos restaurados.'}});
initForm();
buildSchedule();
