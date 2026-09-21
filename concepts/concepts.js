/* =========================================================
   Lógica compartida de los conceptos.
   Solo LEE data.js: disponibilidad, horarios y servicios salen
   del mismo sitio que el producto, sin duplicar reglas.
   ========================================================= */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const concept = document.body.dataset.concept;

/* ---------- Lectura de datos ---------- */

const bookings = Store.bookings();

const busy = (date, time, barberId) =>
  bookings.some(b => b.date === date && b.time === time && b.barber === barberId);

/* Sin profesional elegido, el turno existe mientras quede uno libre. */
const freeTimes = date =>
  slotsForDate(date).filter(t => !BARBERS.every(b => busy(date, t, b.id)));

function upcomingTimes(limit = 5) {
  const now = new Date();
  const out = [];
  for (let offset = 0; offset < 7 && out.length < limit; offset++) {
    const date = dateISO(offset);
    const times = freeTimes(date).filter(t => {
      if (offset > 0) return true;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m > now.getHours() * 60 + now.getMinutes();
    });
    const label = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : niceDate(date);
    times.forEach(t => out.length < limit && out.push({ date, time: t, label }));
  }
  return out;
}

const next = upcomingTimes(1)[0] || null;
const nextText = next ? `${next.label} · ${next.time}` : 'Agenda completa';
const num = i => String(i + 1).padStart(2, '0');

/* ---------- Concepto A, editorial ---------- */

function renderEditorial() {
  document.getElementById('edSlot').textContent = nextText;

  document.getElementById('edRows').innerHTML = SERVICES.map((s, i) => `
    <button class="ed-row cut-host" data-service="${s.id}" data-label="${s.name}">
      <span class="ed-row-num">${num(i)}</span>
      <span class="ed-row-name">${s.name}</span>
      <span class="cut" aria-hidden="true"></span>
      <span class="ed-row-time">${s.duration} min</span>
      <span class="ed-row-price">$${s.price}</span>
      <span class="ed-row-go" aria-hidden="true">
        <svg viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M0 6h19M15.5 2.5 19 6l-3.5 3.5"/>
        </svg>
      </span>
    </button>
  `).join('');

  /* Al recorrer la lista, la fotografía de apoyo cambia de encuadre.
     Cuando existan fotos por servicio, este es el punto de entrada. */
  const figure = document.getElementById('edFigure');
  const label = document.getElementById('edFigureLabel');
  const crops = { cut: '38% 40%', beard: '62% 46%', combo: '50% 38%', premium: '70% 52%' };

  document.querySelectorAll('.ed-row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      if (!figure) return;
      figure.style.objectPosition = crops[row.dataset.service] || '50% 45%';
      label.textContent = row.dataset.label;
    });
  });
}

/* ---------- Concepto B, craft ---------- */

function renderCraft() {
  document.getElementById('cfSlot').textContent = nextText;

  document.getElementById('cfRows').innerHTML = SERVICES.map((s, i) => `
    <button class="cf-row cut-host" data-service="${s.id}">
      <span class="cf-row-ficha">Ficha ${num(i)}</span>
      <span class="cf-row-main">
        <span class="cf-row-name">${s.name}</span>
        <span class="cf-row-desc">${s.desc}</span>
      </span>
      <span class="cut" aria-hidden="true"></span>
      <span class="cf-row-meta">
        <span>${s.duration} min</span>
        <b>$${s.price}</b>
      </span>
    </button>
  `).join('');
}

/* ---------- Concepto C, club ---------- */

function renderClub() {
  const slots = upcomingTimes(6);

  document.getElementById('clSlot').textContent = next ? next.time : '--:--';
  document.getElementById('clSlotDay').textContent = next ? next.label : 'Sin turnos';

  /* La disponibilidad real es parte del lenguaje visual del hero. */
  document.getElementById('clStrip').innerHTML = slots.map((s, i) => `
    <button class="cl-time ${i === 0 ? 'is-next' : ''}">
      <small>${s.label}</small>
      <b>${s.time}</b>
    </button>
  `).join('');

  const day = isClosed(dateISO(0)) ? nextOpenDate(0) : dateISO(0);
  const total = slotsForDate(day).length * BARBERS.length;
  const free = freeTimes(day).length;

  document.getElementById('clMeta').innerHTML = `
    <span><i>Libres</i><b>${free}</b></span>
    <span><i>Capacidad</i><b>${total}</b></span>
    <span><i>Profesionales</i><b>${BARBERS.length}</b></span>
  `;

  document.getElementById('clRows').innerHTML = SERVICES.map((s, i) => {
    const pct = Math.round((s.duration / 90) * 100);
    return `
      <button class="cl-row" data-service="${s.id}">
        <span class="cl-row-num">${num(i)}</span>
        <span class="cl-row-name">${s.name}</span>
        <span class="cl-row-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="cl-row-time">${s.duration}<em>min</em></span>
        <span class="cl-row-price">$${s.price}</span>
      </button>
    `;
  }).join('');

  /* La barra mide la duración del servicio: se dibuja una sola vez,
     cuando la fila entra en vista. */
  const rows = [...document.querySelectorAll('.cl-row')];
  if (reduce) {
    rows.forEach(r => r.classList.add('is-measured'));
  } else {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = `${rows.indexOf(entry.target) * 90}ms`;
        entry.target.classList.add('is-measured');
        o.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    rows.forEach(r => obs.observe(r));
  }
}

/* ---------- Movimiento ----------
   Nada de fade-up global: cada concepto tiene un gesto propio.
   A: la tipografía se revela con máscara.
   B: la fotografía se descubre como una cortina.
   C: la línea del tiempo se dibuja y los turnos entran en secuencia.
   ========================================================= */

function initMotion() {
  if (reduce) {
    document.querySelectorAll('.cut-draw').forEach(el => el.classList.add('is-cut'));
    document.querySelectorAll('.reveal-mask, .reveal-clip, .reveal-seq > *')
      .forEach(el => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      if (el.classList.contains('reveal-seq')) {
        [...el.children].forEach((child, i) => {
          child.style.transitionDelay = `${i * 70}ms`;
          child.classList.add('is-in');
        });
      } else {
        el.classList.add('is-in', 'is-cut');
      }
      obs.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('.cut-draw, .reveal-mask, .reveal-clip, .reveal-seq')
    .forEach(el => observer.observe(el));
}

/* ---------- Arranque ---------- */

const renderers = { editorial: renderEditorial, craft: renderCraft, club: renderClub };
if (renderers[concept]) renderers[concept]();
initMotion();
