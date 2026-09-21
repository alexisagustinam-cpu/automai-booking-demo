/* Panel del negocio: acceso, roles y render de secciones. */

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const AGENDA_HOURS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 20;

const SECTION_SUBTITLES = {
  resumen: 'Así va el estudio hoy.',
  midia: 'Tu agenda y tus números.',
  agenda: 'Reservas por hora y profesional.',
  clientes: 'Historial y estado de cada cliente.',
  servicios: 'Duración, precio y demanda.'
};

let session = null;
let activeSection = null;
let attempts = 0;
let lockTimer = null;
let agendaOffset = 0;

/* ---------- Acceso ---------- */

function showAlert(message) {
  $('#loginAlertText').textContent = message;
  $('#loginAlert').classList.add('show');
}

function hideAlert() {
  $('#loginAlert').classList.remove('show');
}

function setFieldError(field, message) {
  const node = $(`[data-error-for="${field}"]`);
  if (node) node.textContent = message;
  const input = $(`[name="${field}"]`);
  if (input) input.closest('.field').classList.toggle('invalid', Boolean(message));
}

function clearFieldErrors() {
  setFieldError('user', '');
  setFieldError('pass', '');
}

function lockLogin() {
  let left = LOCK_SECONDS;
  const button = $('#loginBtn');
  button.disabled = true;
  showAlert(`Demasiados intentos fallidos. Espera ${left} segundos.`);

  clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    left -= 1;
    if (left > 0) {
      showAlert(`Demasiados intentos fallidos. Espera ${left} segundos.`);
      return;
    }
    clearInterval(lockTimer);
    button.disabled = false;
    attempts = 0;
    hideAlert();
  }, 1000);
}

function handleLogin(event) {
  event.preventDefault();
  clearFieldErrors();
  hideAlert();

  const data = Object.fromEntries(new FormData(event.target));
  let invalid = false;

  if (!data.user.trim()) {
    setFieldError('user', 'Ingresa tu usuario');
    invalid = true;
  }
  if (!data.pass) {
    setFieldError('pass', 'Ingresa tu clave');
    invalid = true;
  }
  if (invalid) {
    $(`[name="${!data.user.trim() ? 'user' : 'pass'}"]`).focus();
    return;
  }

  const account = authenticate(data.user, data.pass);

  if (!account) {
    attempts += 1;
    const left = MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      lockLogin();
    } else {
      showAlert(`Usuario o clave incorrectos. Te quedan ${left} ${left === 1 ? 'intento' : 'intentos'}.`);
    }
    $('[name="pass"]').value = '';
    $('[name="pass"]').focus();
    return;
  }

  attempts = 0;
  session = account;
  Store.setSession(session);
  enterPanel();
}

function enterPanel() {
  $('#login').style.display = 'none';
  $('#panel').classList.add('show');
  $('#userName').textContent = session.name;
  $('#userRole').textContent = session.title;
  $('#todayLabel').textContent = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  renderNav();
  const first = PERMISSIONS[session.role][0];
  openSection(first);
  toast(`Sesión iniciada como ${session.title.toLowerCase()}`, 'ph-check-circle');
}

function logout() {
  Store.clearSession();
  session = null;
  activeSection = null;
  $('#panel').classList.remove('show');
  $('#login').style.display = '';
  $('#loginForm').reset();
  clearFieldErrors();
  hideAlert();
}

/* ---------- Navegación con permisos ---------- */

function renderNav() {
  $('#sideNav').innerHTML = SECTIONS.map(section => {
    const allowed = canSee(session.role, section.id);
    const hidden = section.id === 'midia' && session.role === 'admin';
    if (hidden) return '';

    return `
      <button data-section="${section.id}" class="${allowed ? '' : 'locked'}"
              ${allowed ? '' : 'aria-disabled="true"'}
              title="${allowed ? section.label : 'Solo administración'}">
        <i class="ph-light ${section.icon}" aria-hidden="true"></i>
        <span>${section.label}</span>
        ${allowed ? '' : '<i class="ph-light ph-lock-simple lock" aria-hidden="true"></i>'}
      </button>
    `;
  }).join('');
}

function openSection(id) {
  const section = SECTIONS.find(s => s.id === id);
  if (!section) return;

  if (!canSee(session.role, id)) {
    renderDenied(section);
    toast('Esa sección es solo para administración', 'ph-lock-simple');
    return;
  }

  if (id === 'agenda') agendaOffset = 0;
  activeSection = id;
  $$('#sideNav button').forEach(b => b.classList.toggle('active', b.dataset.section === id));
  $('#sectionTitle').textContent = section.label;
  $('#sectionSub').textContent = SECTION_SUBTITLES[id] || '';

  const renderers = {
    resumen: renderResumen,
    midia: renderMiDia,
    agenda: renderAgenda,
    clientes: renderClientes,
    servicios: renderServicios
  };
  renderers[id]();
}

function renderDenied(section) {
  $('#sectionTitle').textContent = section.label;
  $('#sectionSub').textContent = 'Sección restringida.';
  $('#headActions').innerHTML = '';
  $('#panelBody').innerHTML = `
    <div class="state denied">
      <i class="ph-light ph-lock-simple" aria-hidden="true"></i>
      <h3>Sin acceso</h3>
      <p>Tu cuenta de barbero no tiene permiso sobre ${section.label.toLowerCase()}. Pide a la administración del estudio que la habilite.</p>
    </div>
  `;
}

/* ---------- Datos ---------- */

function myBookings(bookings) {
  if (session.role === 'admin') return bookings;
  return bookings.filter(b => b.barber === session.barberId);
}

function upcoming(bookings, limit = 6) {
  const today = dateISO(0);
  return bookings
    .filter(b => b.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, limit);
}

function appointmentRow(b) {
  const service = getService(b.service);
  const barber = getBarber(b.barber);
  const status = b.status === 'Pendiente' ? 'wait' : 'ok';
  /* El barbero solo ve su propio dia, repetir la fecha en cada fila sobra. */
  const detail = session.role === 'admin' ? `${service.name}, ${barber.short}` : service.name;

  return `
    <div class="appointment">
      <span class="appointment-time">${b.time}</span>
      <div class="appointment-who">
        <strong>${b.name}</strong>
        <small>${detail}</small>
      </div>
      <span class="pill pill-${status}">${b.status}</span>
    </div>
  `;
}

function occupancyBars(bookings) {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const capacity = SLOTS.length * (session.role === 'admin' ? BARBERS.length : 1);

  /* getDay() devuelve 0 para domingo, aquí la semana empieza en lunes. */
  const todayIndex = (new Date().getDay() + 6) % 7;

  const counts = days.map((_, index) => {
    const iso = dateISO(index - todayIndex);
    return bookings.filter(b => b.date === iso).length;
  });

  const peak = Math.max(...counts, 1);

  /* El domingo el local cierra, incluirlo hundiria el promedio sin motivo. */
  const openDays = counts.slice(0, 6);
  const average = Math.round((openDays.reduce((a, b) => a + b, 0) / (openDays.length * capacity)) * 100);

  return { days, counts, peak, average };
}

/* ---------- Secciones ---------- */

function renderResumen() {
  const bookings = Store.bookings();
  const today = dateISO(0);
  const clients = clientsFrom(bookings);
  const bars = occupancyBars(bookings);

  /* En dia cerrado las cifras de hoy serian ceros sin informacion,
     asi que el resumen pasa a mostrar el proximo dia que abre. */
  const closedToday = isClosed(today);
  const refDate = closedToday ? nextOpenDate(0) : today;
  const refBookings = bookings.filter(b => b.date === refDate);
  const revenue = refBookings.reduce((sum, b) => sum + getService(b.service).price, 0);

  /* Ocupación del día: turnos tomados sobre la capacidad real de ese día. */
  const capacity = slotsForDate(refDate).length * BARBERS.length;
  const dayLoad = {
    taken: refBookings.length,
    capacity,
    percent: capacity ? Math.round((refBookings.length / capacity) * 100) : 0
  };

  $('#headActions').innerHTML = `
    <button class="btn btn-primary btn-sm" id="newBooking">
      <i class="ph-light ph-plus" aria-hidden="true"></i> Nueva reserva
    </button>
  `;

  $('#panelBody').innerHTML = `
    <div class="metrics">
      <div class="metric">
        <span class="metric-label">Citas ${closedToday ? 'del próximo día' : 'de hoy'}</span>
        <span class="metric-value">${refBookings.length}</span>
        <span class="metric-trend ${closedToday ? 'flat' : ''}">${closedToday ? `Hoy cerrado, ${niceDate(refDate)}` : 'Agenda en curso'}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Ingresos ${closedToday ? 'previstos' : 'del día'}</span>
        <span class="metric-value">${money(revenue)}</span>
        <span class="metric-trend flat">Estimado sobre agenda</span>
      </div>
      <div class="metric">
        <span class="metric-label">Clientes en CRM</span>
        <span class="metric-value">${clients.length}</span>
        <span class="metric-trend">${clients.filter(c => c.status === 'Nuevo').length} nuevos</span>
      </div>
      <div class="metric">
        <span class="metric-label">Ocupación semanal</span>
        <span class="metric-value">${bars.average}%</span>
        <span class="metric-trend flat">Sobre capacidad total</span>
      </div>
    </div>

    <div class="grid-2">
      <article class="block">
        <div class="block-head">
          <h3>Próximas citas</h3>
          <button class="btn btn-quiet btn-sm" data-section="agenda">Ver agenda</button>
        </div>
        <div class="block-body">
          <div class="appointments">
            ${upcoming(bookings).map(appointmentRow).join('') || emptyState('Sin citas próximas', 'Cuando entre una reserva desde el sitio aparece aquí.')}
          </div>
        </div>
      </article>

      <article class="block">
        <div class="block-head">
          <h3>Ocupación del día</h3>
          <span class="tag">${closedToday ? niceDate(refDate) : 'Hoy'}</span>
        </div>
        <div class="block-body">
          <div class="gauge">
            <div class="gauge-ring" style="--value:${dayLoad.percent}">
              <b>${dayLoad.percent}%</b>
            </div>
            <div class="gauge-copy">
              <strong>${dayLoad.taken} de ${dayLoad.capacity} turnos</strong>
              <span>${dayLoad.capacity - dayLoad.taken} espacios libres</span>
              <span>${BARBERS.length} profesionales en agenda</span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="grid-2" style="margin-top:var(--s5)">
      <article class="block">
        <div class="block-head">
          <h3>Automatizaciones</h3>
          <span class="tag">3 activas</span>
        </div>
        <div class="block-body">
          <div class="automations">
            <div class="automation">
              <div><strong>Confirmación inmediata</strong><small>WhatsApp al crear la reserva</small></div>
              <span class="pill pill-ok">Activa</span>
            </div>
            <div class="automation">
              <div><strong>Recordatorio 24 horas antes</strong><small>Reduce ausencias sin llamar</small></div>
              <span class="pill pill-ok">Activa</span>
            </div>
            <div class="automation">
              <div><strong>Recuperación a 30 días</strong><small>Reactiva clientes inactivos</small></div>
              <span class="pill pill-ok">Activa</span>
            </div>
          </div>
        </div>
      </article>

      <article class="block">
        <div class="block-head">
          <h3>Carga de la semana</h3>
          <span class="tag">${bars.average}% ocupado</span>
        </div>
        <div class="block-body">
          <div class="bars">
            ${bars.days.map((d, i) => `
              <div class="bar-col ${bars.counts[i] === bars.peak ? 'peak' : ''}">
                <i style="height:${Math.max(4, Math.round((bars.counts[i] / bars.peak) * 100))}%"></i>
                <small>${d}</small>
              </div>
            `).join('')}
          </div>
          <div class="bars-foot">
            <span>Citas por día</span>
            <b>Pico ${bars.peak}</b>
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderMiDia() {
  const all = Store.bookings();
  const mine = myBookings(all);
  const closedToday = isClosed(dateISO(0));
  const refDate = closedToday ? nextOpenDate(0) : dateISO(0);
  const refMine = mine.filter(b => b.date === refDate);
  const earned = refMine.reduce((sum, b) => sum + getService(b.service).price, 0);
  const uniqueClients = new Set(mine.map(b => b.phone)).size;
  const freeSlots = slotsForDate(refDate).filter(t => !refMine.some(b => b.time === t)).length;

  $('#headActions').innerHTML = '';

  $('#panelBody').innerHTML = `
    <div class="metrics">
      <div class="metric">
        <span class="metric-label">Mis citas ${closedToday ? 'del próximo día' : 'de hoy'}</span>
        <span class="metric-value">${refMine.length}</span>
        <span class="metric-trend">${freeSlots} espacios libres</span>
      </div>
      <div class="metric">
        <span class="metric-label">${closedToday ? 'Previsto' : 'Generado hoy'}</span>
        <span class="metric-value">${money(earned)}</span>
        <span class="metric-trend flat">${closedToday ? `Hoy cerrado, ${niceDate(refDate)}` : 'Sobre citas confirmadas'}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Mis clientes</span>
        <span class="metric-value">${uniqueClients}</span>
        <span class="metric-trend flat">Histórico en la demo</span>
      </div>
      <div class="metric">
        <span class="metric-label">Próxima cita</span>
        <span class="metric-value">${upcoming(mine, 1)[0]?.time || '--:--'}</span>
        <span class="metric-trend flat">${upcoming(mine, 1)[0]?.name || 'Sin citas'}</span>
      </div>
    </div>

    <article class="block">
      <div class="block-head">
        <h3>Mi agenda de ${niceDate(refDate)}</h3>
        <button class="btn btn-quiet btn-sm" data-section="agenda">Ver por hora</button>
      </div>
      <div class="block-body">
        <div class="appointments">
          ${refMine.sort((a, b) => a.time.localeCompare(b.time)).map(appointmentRow).join('')
            || emptyState('Ese día lo tienes libre', 'Las reservas que tomen contigo aparecerán aquí.')}
        </div>
      </div>
    </article>
  `;
}

function renderAgenda() {
  const all = Store.bookings();
  const scope = session.role === 'admin' ? BARBERS : BARBERS.filter(b => b.id === session.barberId);
  const day = dateISO(agendaOffset);
  const isToday = agendaOffset === 0;
  const columns = `70px repeat(${scope.length}, minmax(0, 1fr))`;

  $('#headActions').innerHTML = `
    <div class="agenda-nav">
      <button class="icon-btn" type="button" data-agenda-nav="-1" aria-label="Día anterior">
        <i class="ph-light ph-caret-left" aria-hidden="true"></i>
      </button>
      <span class="pill pill-plain agenda-nav-date">
        ${niceDate(day)}${isToday ? ' · hoy' : ''}, ${session.role === 'admin' ? 'todo el estudio' : 'solo tu columna'}
      </span>
      <button class="icon-btn" type="button" data-agenda-nav="1" aria-label="Día siguiente">
        <i class="ph-light ph-caret-right" aria-hidden="true"></i>
      </button>
      ${isToday ? '' : '<button class="btn btn-quiet btn-sm" type="button" data-agenda-today>Hoy</button>'}
    </div>
  `;

  if (isClosed(day)) {
    $('#panelBody').innerHTML = `
      <div class="state">
        <i class="ph-light ph-moon-stars" aria-hidden="true"></i>
        <h3>Cerrado</h3>
        <p>El estudio no abre el ${niceDate(day)}. Usa las flechas para revisar otro día.</p>
      </div>
    `;
    return;
  }

  const rows = AGENDA_HOURS.map(hour => `
    <div class="agenda-row" style="grid-template-columns:${columns}">
      <span class="agenda-hour">${hour}</span>
      ${scope.map(barber => {
        /* Las filas son por hora y los turnos de 30 minutos: en una misma
           celda pueden caer dos citas y las dos tienen que verse. */
        const slotBookings = all
          .filter(b => b.date === day && b.barber === barber.id && b.time.startsWith(hour.slice(0, 2)))
          .sort((a, b) => a.time.localeCompare(b.time));

        return `
          <div class="agenda-cell">
            ${slotBookings.map(booking => `
              <div class="agenda-block">
                <strong>${booking.name}</strong>
                <small>${booking.time} ${getService(booking.service).name}</small>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `).join('');

  $('#panelBody').innerHTML = `
    <div class="agenda">
      <div class="agenda-row head" style="grid-template-columns:${columns}">
        <span>Hora</span>
        ${scope.map(b => `<span>${b.short}</span>`).join('')}
      </div>
      ${rows}
    </div>
  `;
}

function renderClientes() {
  const clients = clientsFrom(Store.bookings());
  $('#headActions').innerHTML = `
    <button class="btn btn-secondary btn-sm" id="exportBtn">
      <i class="ph-light ph-download-simple" aria-hidden="true"></i> Exportar CSV
    </button>
  `;

  $('#panelBody').innerHTML = `
    <div class="table-tools">
      <label class="search">
        <i class="ph-light ph-magnifying-glass" aria-hidden="true"></i>
        <input id="clientSearch" placeholder="Buscar por nombre, teléfono o correo" aria-label="Buscar cliente">
      </label>
    </div>
    <div class="table-wrap" id="clientTableWrap"></div>
  `;

  drawClients(clients, '');
  $('#clientSearch').addEventListener('input', event => drawClients(clients, event.target.value));
}

function drawClients(clients, query) {
  const q = query.trim().toLowerCase();
  const rows = clients.filter(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));

  if (!rows.length) {
    $('#clientTableWrap').innerHTML = `
      <div class="state">
        <i class="ph-light ph-user-circle-dashed" aria-hidden="true"></i>
        <h3>Sin resultados</h3>
        <p>Ningún cliente coincide con "${query}". Prueba con otro nombre o número.</p>
      </div>
    `;
    return;
  }

  $('#clientTableWrap').innerHTML = `
    <table class="clients">
      <thead>
        <tr>
          <th>Cliente</th><th>Contacto</th><th>Última visita</th>
          <th>Visitas</th><th>Gasto</th><th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(c => `
          <tr>
            <td>
              <div class="client-cell">
                <span class="avatar">${initialsOf(c.name)}</span>
                <div><strong>${c.name}</strong><small>ID ${c.phone.slice(-4)}</small></div>
              </div>
            </td>
            <td>${c.phone}<br><small style="color:var(--bone-dim)">${c.email || 'Sin correo'}</small></td>
            <td class="num">${c.last}</td>
            <td class="num">${c.visits}</td>
            <td class="num">${money(c.spent)}</td>
            <td><span class="pill pill-${c.status === 'Reactivar' ? 'wait' : 'ok'}">${c.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderServicios() {
  const bookings = Store.bookings();
  $('#headActions').innerHTML = `
    <button class="btn btn-primary btn-sm" id="newService">
      <i class="ph-light ph-plus" aria-hidden="true"></i> Nuevo servicio
    </button>
  `;

  $('#panelBody').innerHTML = `
    <div class="services-admin">
      ${SERVICES.map(s => {
        const timesBooked = bookings.filter(b => b.service === s.id).length;
        return `
          <div class="service-admin-row">
            <div>
              <h3>${s.name}</h3>
              <p>${s.desc}</p>
            </div>
            <span class="num">${s.duration} min</span>
            <span class="num">${money(s.price)}</span>
            <span class="pill pill-ok">${timesBooked} reservas</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function emptyState(title, text) {
  return `
    <div class="state">
      <i class="ph-light ph-calendar-blank" aria-hidden="true"></i>
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `;
}

/* ---------- Toast ---------- */

let toastTimer;
function toast(message, icon = 'ph-check-circle') {
  const node = $('#toast');
  node.innerHTML = `<i class="ph-light ${icon}" aria-hidden="true"></i> ${message}`;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

/* ---------- Arranque ---------- */

function init() {
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#logoutBtn').addEventListener('click', logout);

  document.addEventListener('click', event => {
    const navBtn = event.target.closest('[data-agenda-nav]');
    if (navBtn && session && activeSection === 'agenda') {
      agendaOffset = Math.max(-14, Math.min(30, agendaOffset + Number(navBtn.dataset.agendaNav)));
      renderAgenda();
      return;
    }
    if (event.target.closest('[data-agenda-today]') && session && activeSection === 'agenda') {
      agendaOffset = 0;
      renderAgenda();
      return;
    }
    const target = event.target.closest('[data-section]');
    if (target && session) {
      openSection(target.dataset.section);
      return;
    }
    if (event.target.closest('#newBooking, #newService, #exportBtn')) {
      toast('Acción disponible en la versión de producción', 'ph-info');
    }
  });

  const saved = Store.session();
  if (saved) {
    session = saved;
    enterPanel();
  }
}

init();
