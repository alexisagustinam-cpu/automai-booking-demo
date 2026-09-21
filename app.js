/* Sitio público y flujo de reserva. */

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined';

let bookings = Store.bookings();
let flow = { step: 1, service: null, barber: null, date: null, time: null };
let lastFocused = null;

/* ---------- Disponibilidad ---------- */

const hasBooking = (date, time, barberId) =>
  bookings.some(b => b.date === date && b.time === time && b.barber === barberId);

function isTaken(date, time, barberId) {
  if (barberId) return hasBooking(date, time, barberId);
  /* Sin barbero elegido el turno sigue disponible mientras quede uno libre. */
  return BARBERS.every(b => hasBooking(date, time, b.id));
}

function freeBarberAt(date, time) {
  return BARBERS
    .filter(b => !hasBooking(date, time, b.id))
    .map(b => ({ id: b.id, load: bookings.filter(x => x.date === date && x.barber === b.id).length }))
    .sort((a, b) => a.load - b.load)[0]?.id || null;
}

function freeSlotsFor(date, barberId) {
  return slotsForDate(date).filter(t => !isTaken(date, t, barberId));
}

function nextFreeSlot() {
  const now = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const date = dateISO(offset);
    const free = freeSlotsFor(date, null).filter(t => {
      if (offset > 0) return true;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m > now.getHours() * 60 + now.getMinutes();
    });
    if (free.length) {
      const label = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : niceDate(date);
      return { date, time: free[0], label: `${label} ${free[0]}` };
    }
  }
  return null;
}

function leastBusyBarber(date) {
  return BARBERS
    .map(b => ({ id: b.id, load: bookings.filter(x => x.date === date && x.barber === b.id).length }))
    .sort((a, b) => a.load - b.load)[0].id;
}

/* ---------- Render del sitio público ---------- */

function renderServices() {
  $('#serviceList').innerHTML = SERVICES.map(s => `
    <button class="service-row reveal" data-book-service="${s.id}">
      <span class="service-name">${s.name}</span>
      <span class="service-desc">${s.desc}</span>
      <span class="service-time">${s.duration} min</span>
      <span class="service-price">${money(s.price)}</span>
      <span class="service-go" aria-hidden="true"><i class="ph ph-arrow-up-right"></i></span>
    </button>
  `).join('');
}

function renderTeam() {
  $('#teamGrid').innerHTML = BARBERS.map(b => `
    <button class="team-card reveal" data-book-barber="${b.id}" aria-label="Reservar con ${b.name}">
      <span class="team-photo">
        <img src="assets/img/${b.id}-1000.webp"
             srcset="assets/img/${b.id}-420.webp 420w, assets/img/${b.id}-640.webp 640w, assets/img/${b.id}-1000.webp 1000w"
             sizes="(max-width: 760px) 100vw, 33vw"
             width="1122" height="1402" loading="lazy" decoding="async"
             alt="${b.name}, barbero de Noble Barber Studio">
      </span>
      <span class="team-info">
        <span>
          <span class="team-name">${b.short}</span>
          <span class="mono">${b.specialty}</span>
        </span>
        <span class="team-rating">${b.rating}</span>
      </span>
    </button>
  `).join('');
}

function renderMarquee() {
  const items = [
    { icon: 'ph-star', value: '4.8', label: 'en Google' },
    { icon: 'ph-scissors', value: '1.247', label: 'citas atendidas' },
    { icon: 'ph-users-three', value: '3', label: 'barberos en agenda' },
    { icon: 'ph-lightning', value: '40s', label: 'para reservar' },
    { icon: 'ph-phone-slash', value: 'Cero', label: 'llamadas' }
  ];
  const html = items.map(i => `
    <span class="marquee-item"><i class="ph ${i.icon}"></i><b>${i.value}</b> ${i.label}</span>
  `).join('');
  $('#marqueeTrack').innerHTML = html + html;
}

function renderNextSlot() {
  const slot = nextFreeSlot();
  $('#nextSlot').textContent = slot ? slot.label : 'Agenda completa';
}

/* ---------- Reserva: render de pasos ---------- */

function renderStepServices() {
  $('#stepServices').innerHTML = SERVICES.map(s => `
    <button class="option ${flow.service === s.id ? 'selected' : ''}" data-pick-service="${s.id}">
      <span class="option-mark">${s.duration}m</span>
      <span class="option-main">
        <strong>${s.name}</strong>
        <small>${s.desc}</small>
      </span>
      <span class="option-value">${money(s.price)}</span>
    </button>
  `).join('');
}

function renderStepBarbers() {
  const date = flow.date || dateISO(0);
  const fastest = leastBusyBarber(date);
  const fastestName = getBarber(fastest).short;

  $('#stepBarbers').innerHTML = `
    <button class="option ${flow.barber === 'any' ? 'selected' : ''}" data-pick-barber="any">
      <span class="option-mark"><i class="ph ph-lightning" aria-hidden="true"></i></span>
      <span class="option-main">
        <strong>Primero disponible</strong>
        <small>Ahora mismo sería ${fastestName}</small>
      </span>
      <span class="option-value">Recomendado</span>
    </button>
  ` + BARBERS.map(b => {
    const free = freeSlotsFor(date, b.id).length;
    return `
      <button class="option ${flow.barber === b.id ? 'selected' : ''}" data-pick-barber="${b.id}">
        <span class="option-mark">${b.initials}</span>
        <span class="option-main">
          <strong>${b.name}</strong>
          <small>${b.specialty}</small>
        </span>
        <span class="option-value">${free} libres</span>
      </button>
    `;
  }).join('');
}

function renderDates() {
  const days = [...Array(7)].map((_, i) => {
    const iso = dateISO(i);
    const d = new Date(iso + 'T12:00:00');
    return {
      iso,
      day: new Intl.DateTimeFormat('es-EC', { weekday: 'short' }).format(d).replace('.', ''),
      num: d.getDate()
    };
  });

  $('#dateStrip').innerHTML = days.map(d => {
    const closed = isClosed(d.iso);
    return `
      <button class="date-btn ${flow.date === d.iso ? 'selected' : ''}" data-pick-date="${d.iso}"
              ${closed ? 'disabled aria-disabled="true" title="El local cierra este dia"' : ''}>
        <small>${d.day}</small>
        <strong>${d.num}</strong>
      </button>
    `;
  }).join('');

  renderTimes();
}

function renderTimes() {
  const wrap = $('#timeWrap');
  if (!flow.date) {
    wrap.innerHTML = '<p class="empty-hint">Selecciona una fecha para ver los horarios</p>';
    return;
  }

  if (isClosed(flow.date)) {
    wrap.innerHTML = '<p class="empty-hint">El local cierra este día. Elige otra fecha.</p>';
    return;
  }

  const barberId = flow.barber === 'any' ? null : flow.barber;
  const free = freeSlotsFor(flow.date, barberId);

  if (!free.length) {
    wrap.innerHTML = '<p class="empty-hint">Sin turnos libres este día. Prueba con otra fecha.</p>';
    return;
  }

  wrap.innerHTML = `<div class="time-grid">${slotsForDate(flow.date).map(t => {
    const taken = isTaken(flow.date, t, barberId);
    return `
      <button class="time-btn ${flow.time === t ? 'selected' : ''}" data-pick-time="${t}"
              ${taken ? 'disabled aria-disabled="true"' : ''}>${t}</button>
    `;
  }).join('')}</div>`;
}

function renderSummary(target = '#summary') {
  const service = getService(flow.service);
  const barber = flow.barber === 'any' ? { name: 'Primero disponible' } : getBarber(flow.barber);
  const node = $(target);
  if (!node) return;

  node.innerHTML = `
    <div class="summary-row"><span>Servicio</span><strong>${service ? service.name : 'Por elegir'}</strong></div>
    <div class="summary-row"><span>Barbero</span><strong>${barber ? barber.name : 'Por elegir'}</strong></div>
    <div class="summary-row"><span>Fecha</span><strong>${flow.date ? niceDate(flow.date) : 'Por elegir'}</strong></div>
    <div class="summary-row"><span>Hora</span><strong>${flow.time || 'Por elegir'}</strong></div>
    ${service ? `<div class="summary-row total"><span>Total</span><strong>${money(service.price)}</strong></div>` : ''}
  `;
}

/* ---------- Navegación entre pasos ---------- */

function goToStep(step) {
  flow.step = step;
  $$('.step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
  $('#success').classList.remove('show');
  $('#stepCount').textContent = `Paso ${step} de 4`;

  const progress = $('#progress');
  progress.setAttribute('aria-valuenow', String(step));
  $$('#progress span').forEach((bar, i) => bar.classList.toggle('done', i < step));

  renderSummary();

  const active = $(`.step[data-step="${step}"]`);
  if (active && hasGsap && !reduceMotion) {
    gsap.fromTo(active, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
  }
  $('.booking-body').scrollTop = 0;
}

function openBooking(prefill = {}) {
  lastFocused = document.activeElement;
  bookings = Store.bookings();
  flow = { step: 1, service: prefill.service || null, barber: prefill.barber || null, date: null, time: null };

  $('#bookingForm').reset();
  clearErrors();
  $('#success').classList.remove('show');

  renderStepServices();
  renderStepBarbers();
  renderDates();

  const overlay = $('#bookingOverlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  /* Si llega con servicio elegido pasa a escoger barbero.
     Si llega desde una tarjeta del equipo el barbero ya esta puesto,
     pero todavia falta el servicio, asi que empieza en el paso 1. */
  goToStep(prefill.service ? 2 : 1);
  closeMenu();

  const firstOption = $('.step.active .option, .step.active input');
  if (firstOption) firstOption.focus({ preventScroll: true });
}

function closeBooking() {
  const overlay = $('#bookingOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus({ preventScroll: true });
}

/* ---------- Validacion del formulario ---------- */

function setError(field, message) {
  const node = $(`[data-error-for="${field}"]`);
  if (node) node.textContent = message;
  const input = $(`[name="${field}"]`);
  if (input) input.closest('.field').classList.toggle('invalid', Boolean(message));
}

function clearErrors() {
  ['name', 'phone', 'email'].forEach(f => setError(f, ''));
}

function validate(data) {
  clearErrors();
  const errors = [];

  if (!data.name.trim()) {
    setError('name', 'Escribe tu nombre');
    errors.push('name');
  } else if (data.name.trim().length < 3) {
    setError('name', 'Nombre demasiado corto');
    errors.push('name');
  }

  const digits = data.phone.replace(/\D/g, '');
  if (!digits) {
    setError('phone', 'Necesitamos tu WhatsApp para confirmarte');
    errors.push('phone');
  } else if (digits.length < 9) {
    setError('phone', 'Revisa el número, faltan dígitos');
    errors.push('phone');
  }

  if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) {
    setError('email', 'Ese correo no parece válido');
    errors.push('email');
  }

  return errors;
}

function submitBooking(event) {
  event.preventDefault();

  /* Devuelve al paso que falta en vez de dar un aviso generico. */
  const missing = !flow.service ? { step: 1, message: 'Elige primero un servicio' }
    : !flow.barber ? { step: 2, message: 'Elige con quien te atiendes' }
    : !flow.date || !flow.time ? { step: 3, message: 'Elige fecha y hora' }
    : null;

  if (missing) {
    toast(missing.message, 'ph-warning');
    goToStep(missing.step);
    return;
  }

  const data = Object.fromEntries(new FormData(event.target));
  const errors = validate(data);

  if (errors.length) {
    const firstInvalid = $(`[name="${errors[0]}"]`);
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  /* El horario pudo ocuparse desde otra pestaña mientras el usuario escribía. */
  bookings = Store.bookings();
  const barber = flow.barber === 'any' ? freeBarberAt(flow.date, flow.time) : flow.barber;

  if (!barber || isTaken(flow.date, flow.time, barber)) {
    toast('Ese turno se acaba de ocupar, elige otro', 'ph-warning');
    flow.time = null;
    goToStep(3);
    renderTimes();
    return;
  }

  const booking = {
    id: 'b' + Date.now(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    note: data.note.trim(),
    service: flow.service,
    barber,
    date: flow.date,
    time: flow.time,
    status: 'Confirmada',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  Store.save(bookings);

  const service = getService(booking.service);
  $$('.step').forEach(el => el.classList.remove('active'));
  $('#stepCount').textContent = 'Reserva confirmada';
  $$('#progress span').forEach(bar => bar.classList.add('done'));
  $('#success').classList.add('show');
  $('#successText').textContent = `${booking.name.split(' ')[0]}, te esperamos el ${niceDate(booking.date)} a las ${booking.time}.`;

  $('#successSummary').innerHTML = `
    <div class="summary-row"><span>Servicio</span><strong>${service.name}</strong></div>
    <div class="summary-row"><span>Barbero</span><strong>${getBarber(booking.barber).name}</strong></div>
    <div class="summary-row"><span>Cuándo</span><strong>${niceDate(booking.date)} ${booking.time}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>${money(service.price)}</strong></div>
  `;

  if (hasGsap && !reduceMotion) {
    gsap.fromTo('#success', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  }

  renderNextSlot();
  toast('Reserva registrada en la agenda del local', 'ph-check-circle');
}

/* ---------- Menu movil ---------- */

function openMenu() {
  $('#mobileMenu').classList.add('open');
  $('#burger').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  $('#mobileMenu').classList.remove('open');
  $('#burger').setAttribute('aria-expanded', 'false');
  if (!$('#bookingOverlay').classList.contains('open')) document.body.style.overflow = '';
}

/* ---------- Toast ---------- */

let toastTimer;
function toast(message, icon = 'ph-check-circle') {
  const node = $('#toast');
  node.innerHTML = `<i class="ph ${icon}" aria-hidden="true"></i> ${message}`;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

/* ---------- Movimiento ---------- */

function initMotion() {
  if (!hasGsap || reduceMotion) {
    document.body.classList.add('no-motion');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* Estado del nav sin escuchar scroll a mano. */
  ScrollTrigger.create({
    start: 'top -40',
    end: 99999,
    onToggle: self => $('#nav').classList.toggle('is-stuck', self.isActive)
  });

  /* Entrada del hero: establece jerarquia de lectura. */
  gsap.from('.hero-copy h1', { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out' });
  gsap.from('.hero-copy .lead', { opacity: 0, y: 18, duration: 0.6, delay: 0.12, ease: 'power3.out' });
  gsap.from('.hero-actions', { opacity: 0, y: 18, duration: 0.6, delay: 0.2, ease: 'power3.out' });
  gsap.from('.slot-card', { opacity: 0, x: -20, duration: 0.6, delay: 0.42, ease: 'power3.out' });

  /* Reveals por sección: revelan el contenido en el orden en que se lee. */
  $$('.reveal').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        onComplete: () => el.classList.add('is-revealed')
      }
    );
  });
}

/* ---------- Eventos ---------- */

function handleClick(event) {
  const el = event.target.closest('button, a');
  if (!el) return;

  const action = el.dataset.action;
  if (action === 'open-booking') openBooking();
  if (action === 'close-booking') closeBooking();
  if (action === 'prev-step') goToStep(Math.max(1, flow.step - 1));
  if (action === 'close-menu') closeMenu();

  if (el.dataset.bookService) openBooking({ service: el.dataset.bookService });
  if (el.dataset.bookBarber) openBooking({ barber: el.dataset.bookBarber });

  if (el.dataset.pickService) {
    flow.service = el.dataset.pickService;
    renderStepServices();
    renderStepBarbers();
    /* El barbero puede venir ya elegido desde la seccion de equipo. */
    if (flow.barber) {
      renderDates();
      goToStep(3);
    } else {
      goToStep(2);
    }
  }

  if (el.dataset.pickBarber) {
    flow.barber = el.dataset.pickBarber;
    flow.time = null;
    renderStepBarbers();
    renderDates();
    goToStep(3);
  }

  if (el.dataset.pickDate) {
    flow.date = el.dataset.pickDate;
    flow.time = null;
    renderStepBarbers();
    renderDates();
    renderSummary();
  }

  if (el.dataset.pickTime) {
    flow.time = el.dataset.pickTime;
    renderTimes();
    renderSummary();
    goToStep(4);
  }
}

function init() {
  renderServices();
  renderTeam();
  renderMarquee();
  renderNextSlot();
  renderStepServices();
  renderStepBarbers();
  renderDates();
  renderSummary();

  document.addEventListener('click', handleClick);
  $('#bookingForm').addEventListener('submit', submitBooking);
  $('#burger').addEventListener('click', openMenu);

  $('#bookingOverlay').addEventListener('click', event => {
    if (event.target === $('#bookingOverlay')) closeBooking();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeBooking();
    closeMenu();
  });

  initMotion();
}

init();
