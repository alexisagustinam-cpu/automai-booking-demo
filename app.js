/* Sitio público y flujo de reserva. La lógica de disponibilidad no cambia:
   solo la presentación y el movimiento. */

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

function freeSlotsFor(date, barberId) {
  return slotsForDate(date).filter(t => !isTaken(date, t, barberId));
}

function freeBarberAt(date, time) {
  return BARBERS
    .filter(b => !hasBooking(date, time, b.id))
    .map(b => ({ id: b.id, load: bookings.filter(x => x.date === date && x.barber === b.id).length }))
    .sort((a, b) => a.load - b.load)[0]?.id || null;
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
      return { date, time: free[0], label: `${label} · ${free[0]}` };
    }
  }
  return null;
}

function leastBusyBarber(date) {
  return BARBERS
    .map(b => ({ id: b.id, load: bookings.filter(x => x.date === date && x.barber === b.id).length }))
    .sort((a, b) => a.load - b.load)[0].id;
}

/* Estado de agenda de cada profesional, calculado con datos reales. */
function availabilityFor(barberId) {
  const today = dateISO(0);
  const day = isClosed(today) ? nextOpenDate(0) : today;
  const free = freeSlotsFor(day, barberId).length;

  if (!free) return { label: 'Agenda completa', cls: 'pill-busy' };
  if (day === today) return { label: 'Disponible hoy', cls: 'pill-free' };
  if (day === dateISO(1)) return { label: 'Disponible mañana', cls: 'pill-soon' };
  return { label: `Disponible ${niceDate(day)}`, cls: 'pill-soon' };
}

/* ---------- Render del sitio público ---------- */

function renderServices() {
  $('#serviceList').innerHTML = SERVICES.map((s, i) => `
    <button class="service-row reveal" data-book-service="${s.id}">
      <span class="service-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="service-name">${s.name}</span>
      <span class="service-desc">${s.desc}</span>
      <span class="service-time">${s.duration} min</span>
      <span class="service-price">${money(s.price)}</span>
      <span class="service-go" aria-hidden="true"><i class="ph-light ph-arrow-up-right"></i></span>
    </button>
  `).join('');
}

function renderTeam() {
  $('#teamGrid').innerHTML = BARBERS.map(b => {
    const state = availabilityFor(b.id);
    return `
      <button class="team-card reveal" data-book-barber="${b.id}" aria-label="Ver disponibilidad de ${b.name}">
        <span class="team-photo">
          <img src="assets/img/${b.id}-1000.webp"
               srcset="assets/img/${b.id}-420.webp 420w, assets/img/${b.id}-640.webp 640w, assets/img/${b.id}-1000.webp 1000w"
               sizes="(max-width: 768px) 100vw, 33vw"
               width="1122" height="1402" loading="lazy" decoding="async"
               alt="${b.name}, barbero de Noble Barber Studio">
        </span>
        <span class="team-body">
          <span class="team-name">${b.name}</span>
          <span class="team-meta">
            ${b.specialty}
            <span class="team-rating">${b.rating} ★</span>
          </span>
          <span class="team-foot">
            <span class="pill ${state.cls}"><i class="dot" aria-hidden="true"></i> ${state.label}</span>
            <span class="link-gold">Ver disponibilidad <i class="ph-light ph-arrow-right" aria-hidden="true"></i></span>
          </span>
        </span>
      </button>
    `;
  }).join('');
}

function renderNextSlot() {
  const slot = nextFreeSlot();
  $('#nextSlot').textContent = slot ? slot.label : 'Agenda completa';
}

/* ---------- Reserva: render de pasos ---------- */

function renderStepServices() {
  $('#stepServices').innerHTML = SERVICES.map(s => `
    <button class="option ${flow.service === s.id ? 'selected' : ''}" data-pick-service="${s.id}">
      <span class="option-main">
        <strong>${s.name}</strong>
        <small>${s.desc}</small>
      </span>
      <span class="option-side">
        <span class="option-time">${s.duration} min</span>
        <span class="option-price">${money(s.price)}</span>
      </span>
    </button>
  `).join('');
}

function renderStepBarbers() {
  const date = flow.date || (isClosed(dateISO(0)) ? nextOpenDate(0) : dateISO(0));
  const fastest = leastBusyBarber(date);

  $('#stepBarbers').innerHTML = `
    <button class="option ${flow.barber === 'any' ? 'selected' : ''}" data-pick-barber="any">
      <span class="option-main">
        <strong>El primero disponible</strong>
        <small>Ahora mismo sería ${getBarber(fastest).short}</small>
      </span>
      <span class="option-side">
        <span class="option-tag">Recomendado</span>
      </span>
    </button>
  ` + BARBERS.map(b => {
    const free = freeSlotsFor(date, b.id).length;
    return `
      <button class="option ${flow.barber === b.id ? 'selected' : ''}" data-pick-barber="${b.id}">
        <span class="option-main">
          <strong>${b.name}</strong>
          <small>${b.specialty}</small>
        </span>
        <span class="option-side">
          <span class="option-time">${free} libres</span>
          <span class="option-price">${b.rating} ★</span>
        </span>
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
              ${closed ? 'disabled aria-disabled="true" title="El estudio cierra este día"' : ''}>
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
    wrap.innerHTML = '<p class="empty-hint">Selecciona una fecha para ver los horarios disponibles.</p>';
    return;
  }

  if (isClosed(flow.date)) {
    wrap.innerHTML = '<p class="empty-hint">El estudio cierra este día. Elige otra fecha.</p>';
    return;
  }

  const barberId = flow.barber === 'any' ? null : flow.barber;
  const free = freeSlotsFor(flow.date, barberId);

  if (!free.length) {
    wrap.innerHTML = '<p class="empty-hint">Sin turnos libres este día. Prueba con otra fecha.</p>';
    return;
  }

  const who = flow.barber === 'any' ? 'el equipo' : getBarber(flow.barber).short;

  wrap.innerHTML = `
    <div class="time-label">
      <span>${niceDate(flow.date)}, con ${who}</span>
      <span>${free.length} horarios libres</span>
    </div>
    <div class="time-grid">
      ${slotsForDate(flow.date).map(t => {
        const taken = isTaken(flow.date, t, barberId);
        return `
          <button class="time-btn ${flow.time === t ? 'selected' : ''}" data-pick-time="${t}"
                  ${taken ? 'disabled aria-disabled="true"' : ''}>${t}</button>
        `;
      }).join('')}
    </div>
  `;
}

function renderSummary() {
  const service = getService(flow.service);
  const barber = flow.barber === 'any' ? { name: 'El primero disponible' } : getBarber(flow.barber);

  const rows = [
    ['Servicio', service ? service.name : null],
    ['Duración', service ? `${service.duration} min` : null],
    ['Profesional', barber ? barber.name : null],
    ['Fecha', flow.date ? niceDate(flow.date) : null],
    ['Hora', flow.time || null]
  ];

  $('#summary').innerHTML = rows.map(([label, value]) => `
    <div class="summary-row ${value ? '' : 'is-empty'}">
      <span>${label}</span>
      <strong>${value || 'Por elegir'}</strong>
    </div>
  `).join('') + (service ? `
    <div class="summary-row total">
      <span>Total</span>
      <strong>${money(service.price)}</strong>
    </div>
  ` : '');
}

/* ---------- Navegación entre pasos ---------- */

function goToStep(step) {
  flow.step = step;
  $$('.step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
  $('#success').classList.remove('show');

  const progress = $('#progress');
  progress.setAttribute('aria-valuenow', String(step));
  $$('.progress-step').forEach(el => {
    const index = Number(el.dataset.progress);
    el.classList.toggle('done', index < step);
    el.classList.toggle('active', index === step);
  });
  $$('.progress-line').forEach((line, i) => line.classList.toggle('done', i < step - 1));

  renderSummary();

  const active = $(`.step[data-step="${step}"]`);
  if (active && hasGsap && !reduceMotion) {
    gsap.fromTo(active, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
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

  /* Si llega con servicio elegido pasa a escoger profesional.
     Desde una tarjeta del equipo el profesional ya está puesto,
     pero todavía falta el servicio, así que empieza en el paso 1. */
  goToStep(prefill.service ? 2 : 1);
  closeMenu();

  /* El foco va al contenedor: si cayera en la primera opción, su anillo
     de foco se confundiría con una selección ya hecha. */
  $('#bookingBody').focus({ preventScroll: true });
}

function closeBooking() {
  const overlay = $('#bookingOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus({ preventScroll: true });
}

/* ---------- Validación ---------- */

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

  /* Devuelve al paso que falta en vez de dar un aviso genérico. */
  const missing = !flow.service ? { step: 1, message: 'Elige primero un servicio' }
    : !flow.barber ? { step: 2, message: 'Elige con quién te atiendes' }
    : !flow.date || !flow.time ? { step: 3, message: 'Elige fecha y hora' }
    : null;

  if (missing) {
    toast(missing.message, 'ph-warning-circle');
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
    toast('Ese turno se acaba de ocupar, elige otro', 'ph-warning-circle');
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
  $$('.progress-step').forEach(el => { el.classList.add('done'); el.classList.remove('active'); });
  $$('.progress-line').forEach(line => line.classList.add('done'));
  $('#success').classList.add('show');
  $('#successText').textContent = `${booking.name.split(' ')[0]}, te esperamos el ${niceDate(booking.date)} a las ${booking.time}.`;

  $('#successSummary').innerHTML = `
    <div class="summary-row"><span>Servicio</span><strong>${service.name}</strong></div>
    <div class="summary-row"><span>Profesional</span><strong>${getBarber(booking.barber).name}</strong></div>
    <div class="summary-row"><span>Cuándo</span><strong>${niceDate(booking.date)} · ${booking.time}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>${money(service.price)}</strong></div>
  `;

  if (hasGsap && !reduceMotion) {
    gsap.fromTo('#success', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
  }

  renderNextSlot();
  renderTeam();
  toast('Cita confirmada y enviada a la agenda del estudio', 'ph-check-circle');
}

/* ---------- Menú móvil ---------- */

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
  node.innerHTML = `<i class="ph-light ${icon}" aria-hidden="true"></i> ${message}`;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3400);
}

/* ---------- Movimiento ---------- */

function initMotion() {
  if (!hasGsap || reduceMotion) {
    document.body.classList.add('no-motion');
    $('#stickyCta').classList.add('show');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* Entrada del hero, aproximadamente 1.35s en total. */
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .from('#nav', { opacity: 0, duration: 0.5 }, 0)
    .from('#heroEyebrow', { opacity: 0, y: 8, duration: 0.5 }, 0.1)
    .from('.hero-title .line > span', { yPercent: 108, duration: 0.8, stagger: 0.08 }, 0.15)
    .fromTo('#heroPhoto',
      { clipPath: 'inset(0% 0% 100% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9 }, 0.22)
    .from('#heroLead', { opacity: 0, y: 10, duration: 0.5 }, 0.62)
    .from('#heroActions', { opacity: 0, y: 10, duration: 0.5 }, 0.72)
    .from('#heroStats', { opacity: 0, y: 10, duration: 0.5 }, 0.8)
    .from('#slotCard', { opacity: 0, y: 12, duration: 0.5 }, 0.86);

  /* Estado del header sin escuchar scroll a mano. */
  ScrollTrigger.create({
    start: 'top -40',
    end: 99999,
    onToggle: self => $('#nav').classList.toggle('is-stuck', self.isActive)
  });

  /* Parallax contenido: 3% como máximo. */
  gsap.to('#heroPhoto img', {
    yPercent: 3,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  /* Reservar cita fijo en móvil, una vez pasado el hero. */
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'bottom 70%',
    end: 'max',
    toggleClass: { targets: '#stickyCta', className: 'show' }
  });

  /* El ritual resalta el momento que estás leyendo, sin secuestrar el scroll. */
  $$('.ritual-step').forEach(step => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 72%',
      end: 'bottom 45%',
      toggleClass: { targets: step, className: 'is-active' }
    });
  });

  /* Reveals por sección, en el orden en que se lee. */
  $$('.reveal').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
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
    /* El profesional puede venir ya elegido desde la sección de equipo. */
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
