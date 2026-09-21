const services = [
  {id:'cut', num:'01', name:'Corte clásico', duration:45, price:8, desc:'Diagnóstico, corte, acabado y styling.'},
  {id:'beard', num:'02', name:'Barba & perfilado', duration:30, price:6, desc:'Perfilado preciso, toalla caliente y acabado.'},
  {id:'combo', num:'03', name:'Corte + barba', duration:60, price:12, desc:'Servicio completo para renovar tu imagen.'},
  {id:'premium', num:'04', name:'Ritual Noble', duration:75, price:18, desc:'Corte, barba, facial express y styling premium.'}
];
const barbers = [
  {id:'mateo', initials:'MR', name:'Mateo Rojas', specialty:'Fades · textura', rating:'4.9'},
  {id:'daniel', initials:'DG', name:'Daniel Guevara', specialty:'Clásico · barba', rating:'4.9'},
  {id:'sebastian', initials:'SC', name:'Sebastián C.', specialty:'Diseño · tendencias', rating:'4.8'}
];
const baseClients = [
  {name:'Carlos Andrade', phone:'098 420 1182', email:'carlos@email.com', last:'18 sep', visits:8, spent:86, status:'Activo'},
  {name:'Diego Pozo', phone:'099 118 7702', email:'diego@email.com', last:'17 sep', visits:5, spent:54, status:'Activo'},
  {name:'Andrés Ruiz', phone:'096 721 4050', email:'', last:'14 sep', visits:3, spent:32, status:'Activo'},
  {name:'Mateo Herrera', phone:'098 332 6104', email:'', last:'26 ago', visits:6, spent:70, status:'Reactivar'},
  {name:'Luis Acosta', phone:'099 525 9130', email:'luis@email.com', last:'22 ago', visits:2, spent:20, status:'Reactivar'}
];
const seedBookings = [
  {id:'b1',name:'Carlos Andrade',phone:'098 420 1182',service:'combo',barber:'mateo',date:dateISO(0),time:'10:00',status:'Confirmada'},
  {id:'b2',name:'Diego Pozo',phone:'099 118 7702',service:'cut',barber:'daniel',date:dateISO(0),time:'11:30',status:'Confirmada'},
  {id:'b3',name:'Andrés Ruiz',phone:'096 721 4050',service:'premium',barber:'sebastian',date:dateISO(0),time:'14:00',status:'Pendiente'},
  {id:'b4',name:'Kevin López',phone:'098 911 4401',service:'beard',barber:'mateo',date:dateISO(0),time:'16:30',status:'Confirmada'},
  {id:'b5',name:'Jorge Mena',phone:'095 383 0021',service:'cut',barber:'daniel',date:dateISO(1),time:'09:30',status:'Confirmada'}
];
function dateISO(offset=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function loadBookings(){try{return JSON.parse(localStorage.getItem('noble_bookings'))||seedBookings}catch{return seedBookings}}
let bookings=loadBookings();
let bookingState={step:1,service:null,barber:null,date:null,time:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>`$${Number(n).toFixed(0)}`;
const getService=id=>services.find(s=>s.id===id);
const getBarber=id=>barbers.find(b=>b.id===id);
const niceDate=iso=>new Intl.DateTimeFormat('es-EC',{weekday:'short',day:'numeric',month:'short'}).format(new Date(iso+'T12:00:00'));
const initials=name=>name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
function renderPublic(){
  $('#serviceGrid').innerHTML=services.map(s=>`<article class="service-card"><span class="service-num">${s.num}</span><button aria-label="Reservar ${s.name}" data-book-service="${s.id}">↗</button><h3>${s.name}</h3><p>${s.desc}</p><div class="service-meta"><span>${s.duration} min</span><strong>${money(s.price)}</strong></div></article>`).join('');
  const teamImages={mateo:'assets/mateo.webp',daniel:'assets/daniel.webp',sebastian:'assets/sebastian.webp'};
  $('#teamGrid').innerHTML=barbers.map((b,i)=>`<article class="team-card"><div class="team-photo"><img src="${teamImages[b.id]}" alt="${b.name}, barbero de Noble Barber Studio"></div><div class="team-info"><div><h3>${b.name}</h3><p>${b.specialty} · ★ ${b.rating}</p></div><button aria-label="Reservar con ${b.name}" data-book-barber="${b.id}">↗</button></div></article>`).join('');
}
function renderBookingChoices(){
  $('#bookingServices').innerHTML=services.map(s=>`<button class="booking-option ${bookingState.service===s.id?'selected':''}" data-select-service="${s.id}"><span class="booking-option-icon">${s.num}</span><span class="booking-option-main"><strong>${s.name}</strong><small>${s.duration} min · ${s.desc}</small></span><span class="booking-option-price">${money(s.price)}</span></button>`).join('');
  $('#bookingBarbers').innerHTML=`<button class="booking-option ${bookingState.barber==='any'?'selected':''}" data-select-barber="any"><span class="booking-option-icon">↯</span><span class="booking-option-main"><strong>Primero disponible</strong><small>La opción con menor tiempo de espera</small></span><span class="booking-option-price">Recomendado</span></button>`+barbers.map(b=>`<button class="booking-option ${bookingState.barber===b.id?'selected':''}" data-select-barber="${b.id}"><span class="booking-option-icon">${b.initials}</span><span class="booking-option-main"><strong>${b.name}</strong><small>${b.specialty} · ★ ${b.rating}</small></span><span class="booking-option-price">Elegir</span></button>`).join('');
  renderDates();renderSummary();
}
function renderDates(){
  const dates=[...Array(7)].map((_,i)=>{const iso=dateISO(i);const d=new Date(iso+'T12:00:00');return {iso,day:new Intl.DateTimeFormat('es-EC',{weekday:'short'}).format(d),num:d.getDate()}});
  $('#dateStrip').innerHTML=dates.map(d=>`<button class="date-option ${bookingState.date===d.iso?'selected':''}" data-select-date="${d.iso}"><small>${d.day}</small><strong>${d.num}</strong></button>`).join('');
  if(bookingState.date) renderTimes(); else $('#timeGrid').innerHTML='<span class="muted">Selecciona una fecha para ver horarios.</span>';
}
function renderTimes(){
  const slots=['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];
  const barberId=bookingState.barber==='any'?null:bookingState.barber;
  const occupied=t=>bookings.some(b=>b.date===bookingState.date&&b.time===t&&(!barberId||b.barber===barberId));
  $('#timeGrid').innerHTML=slots.map(t=>`<button class="time-option ${bookingState.time===t?'selected':''}" data-select-time="${t}" ${occupied(t)?'disabled':''}>${t}</button>`).join('');
}
function renderSummary(){
  const s=getService(bookingState.service);const b=bookingState.barber==='any'?{name:'Primero disponible'}:getBarber(bookingState.barber);
  $('#bookingSummary').innerHTML=`<div class="summary-row"><span>Servicio</span><strong>${s?s.name:'—'}</strong></div><div class="summary-row"><span>Profesional</span><strong>${b?b.name:'—'}</strong></div><div class="summary-row"><span>Fecha</span><strong>${bookingState.date?niceDate(bookingState.date):'—'}</strong></div><div class="summary-row"><span>Hora</span><strong>${bookingState.time||'—'}</strong></div>${s?`<div class="summary-row"><span>Total</span><strong>${money(s.price)}</strong></div>`:''}`;
}
function showStep(step){bookingState.step=step;$$('.booking-step').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===step));$('#bookingSuccess').classList.remove('show');$('#stepCounter').textContent=`Paso ${step} de 4`;renderSummary()}
function openBooking(prefill={}){$('#crmView').classList.remove('open');$('#crmView').setAttribute('aria-hidden','true');bookingState={step:1,service:prefill.service||null,barber:prefill.barber||null,date:null,time:null};$('#bookingForm').reset();renderBookingChoices();showStep(prefill.barber?2:prefill.service?2:1);$('#bookingOverlay').classList.add('open');$('#bookingOverlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeBooking(){$('#bookingOverlay').classList.remove('open');$('#bookingOverlay').setAttribute('aria-hidden','true');document.body.style.overflow=''}
function nextFromChoice(type,id){bookingState[type]=id;if(type==='service')showStep(2);if(type==='barber'){bookingState.date=null;bookingState.time=null;renderDates();showStep(3)}renderBookingChoices()}
function resolveBarber(){if(bookingState.barber!=='any')return bookingState.barber;const counts=barbers.map(b=>({id:b.id,n:bookings.filter(x=>x.date===bookingState.date&&x.barber===b.id).length})).sort((a,b)=>a.n-b.n);return counts[0].id}
function submitBooking(e){e.preventDefault();if(!bookingState.service||!bookingState.barber||!bookingState.date||!bookingState.time)return;const data=Object.fromEntries(new FormData(e.target));const barber=resolveBarber();const newB={id:'b'+Date.now(),name:data.name.trim(),phone:data.phone.trim(),email:data.email.trim(),note:data.note.trim(),service:bookingState.service,barber,date:bookingState.date,time:bookingState.time,status:'Confirmada',createdAt:new Date().toISOString()};bookings.push(newB);localStorage.setItem('noble_bookings',JSON.stringify(bookings));$$('.booking-step').forEach(el=>el.classList.remove('active'));$('#stepCounter').textContent='Completado';$('#bookingSuccess').classList.add('show');const s=getService(newB.service),b=getBarber(newB.barber);$('#successText').textContent=`${data.name.split(' ')[0]}, tu cita quedó registrada correctamente.`;$('#successCard').innerHTML=`<div class="summary-row"><span>Servicio</span><strong>${s.name}</strong></div><div class="summary-row"><span>Con</span><strong>${b.name}</strong></div><div class="summary-row"><span>Fecha</span><strong>${niceDate(newB.date)} · ${newB.time}</strong></div><div class="summary-row"><span>Total</span><strong>${money(s.price)} · pago en local</strong></div>`;renderCRM();toast('Reserva creada y sincronizada con el CRM')}
function openCRM(){closeBooking();renderCRM();$('#crmView').classList.add('open');$('#crmView').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';switchCRMTab('dashboard')}
function closeCRM(){$('#crmView').classList.remove('open');$('#crmView').setAttribute('aria-hidden','true');document.body.style.overflow=''}
function switchCRMTab(tab){$$('[data-crm-content]').forEach(x=>x.classList.toggle('active',x.dataset.crmContent===tab));$$('.crm-sidebar [data-crm-tab]').forEach(x=>x.classList.toggle('active',x.dataset.crmTab===tab));const titles={dashboard:'Resumen',agenda:'Agenda',clients:'Clientes',services:'Servicios'};$('#crmTitle').textContent=titles[tab]||'Resumen'}
function allClients(){const map=new Map(baseClients.map(c=>[c.phone,{...c}]));bookings.forEach(b=>{const s=getService(b.service);if(map.has(b.phone)){const c=map.get(b.phone);if(b.createdAt){c.last=niceDate(b.date);c.visits+=1;c.spent+=s.price;c.status='Activo'}}else map.set(b.phone,{name:b.name,phone:b.phone,email:b.email||'',last:niceDate(b.date),visits:1,spent:s.price,status:'Nuevo'})});return [...map.values()]}
function renderCRM(){const today=dateISO(0);const todayBookings=bookings.filter(b=>b.date===today);const revenue=todayBookings.reduce((a,b)=>a+getService(b.service).price,0);const clients=allClients();$('#todayLabel').textContent=new Intl.DateTimeFormat('es-EC',{weekday:'long',day:'numeric',month:'long'}).format(new Date());const metrics=[['Citas hoy',todayBookings.length,'+2 vs. ayer','◷'],['Ingresos estimados',money(revenue),'+18%','↗'],['Clientes CRM',clients.length,'+5 este mes','◎'],['Ocupación','76%','+12%','◇']];$('#metricGrid').innerHTML=metrics.map(m=>`<article class="metric-card"><small>${m[0]}</small><div class="metric-icon">${m[3]}</div><strong>${m[1]}</strong><span class="trend">${m[2]}</span></article>`).join('');const upcoming=[...bookings].filter(b=>b.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);$('#upcomingList').innerHTML=upcoming.map(b=>`<div class="upcoming-item"><span class="upcoming-time">${b.time}</span><div class="upcoming-person"><strong>${b.name}</strong><small>${getService(b.service).name} · ${getBarber(b.barber).name}</small></div><span class="status-pill ${b.status==='Pendiente'?'pending':''}">${b.status}</span></div>`).join('')||'<p class="muted">Sin citas próximas.</p>';const heights=[48,65,54,82,72,91,63];const days=['L','M','X','J','V','S','D'];$('#barChart').innerHTML=heights.map((h,i)=>`<div class="bar-col"><i style="height:${h}%"></i><small>${days[i]}</small></div>`).join('');$('#recentCustomers').innerHTML=clients.slice(-4).reverse().map(c=>`<div class="recent-customer"><span class="mini-avatar">${initials(c.name)}</span><div><strong>${c.name}</strong><small>${c.visits} visitas · ${money(c.spent)}</small></div><span>${c.last}</span></div>`).join('');renderAgenda();renderClients(clients);renderAdminServices()}
function renderAgenda(){const hours=['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00'];const today=dateISO(0);$('#agendaGrid').innerHTML=hours.map(h=>`<div class="agenda-row"><span>${h}</span>${barbers.map(barber=>{const b=bookings.find(x=>x.date===today&&x.barber===barber.id&&x.time.startsWith(h.slice(0,2)));return `<div class="agenda-cell">${b?`<div class="booking-block"><strong>${b.time} · ${b.name}</strong><small>${getService(b.service).name}</small></div>`:''}</div>`}).join('')}</div>`).join('')}
function renderClients(clients=allClients(),query=''){const q=query.toLowerCase();const filtered=clients.filter(c=>`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));$('#clientTableBody').innerHTML=filtered.map(c=>`<tr><td><div class="client-name"><span class="mini-avatar">${initials(c.name)}</span><div><strong>${c.name}</strong><small>ID · ${c.phone.slice(-4)}</small></div></div></td><td>${c.phone}<br><small>${c.email||'Sin correo'}</small></td><td>${c.last}</td><td>${c.visits}</td><td>${money(c.spent)}</td><td><span class="status-pill ${c.status==='Reactivar'?'pending':''}">${c.status}</span></td></tr>`).join('')}
function renderAdminServices(){$('#serviceAdminGrid').innerHTML=services.map(s=>`<article class="admin-service"><span>${s.num} · ACTIVO</span><h3>${s.name}</h3><p>${s.desc}</p><footer><span>${s.duration} min</span><strong>${money(s.price)}</strong></footer></article>`).join('')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),2400)}
renderPublic();renderBookingChoices();renderCRM();
window.addEventListener('scroll',()=>$('#siteHeader').classList.toggle('scrolled',scrollY>35));
document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el)return;const action=el.dataset.action;if(action==='open-booking')openBooking();if(action==='close-booking')closeBooking();if(action==='open-crm')openCRM();if(action==='close-crm')closeCRM();if(action==='crm-new-booking')openBooking();if(action==='prev-step')showStep(Math.max(1,bookingState.step-1));if(el.dataset.bookService)openBooking({service:el.dataset.bookService});if(el.dataset.bookBarber)openBooking({barber:el.dataset.bookBarber});if(el.dataset.selectService)nextFromChoice('service',el.dataset.selectService);if(el.dataset.selectBarber)nextFromChoice('barber',el.dataset.selectBarber);if(el.dataset.selectDate){bookingState.date=el.dataset.selectDate;bookingState.time=null;renderDates();renderSummary()}if(el.dataset.selectTime){bookingState.time=el.dataset.selectTime;$$('.time-option').forEach(x=>x.classList.toggle('selected',x.dataset.selectTime===bookingState.time));renderSummary();showStep(4)}if(el.dataset.crmTab){switchCRMTab(el.dataset.crmTab)}});
$('#bookingForm').addEventListener('submit',submitBooking);
$('#clientSearch').addEventListener('input',e=>renderClients(allClients(),e.target.value));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeBooking();closeCRM()}});
