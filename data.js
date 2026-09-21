/* Modelo y persistencia compartidos entre el sitio público y el panel del negocio. */

/* Los ids no cambian: la persistencia y las reservas guardadas dependen de ellos. */
const SERVICES = [
  { id: 'cut',     name: 'Signature Cut', duration: 45, price: 8,  desc: 'Diagnóstico, corte y styling.' },
  { id: 'beard',   name: 'Beard Ritual',  duration: 30, price: 6,  desc: 'Perfilado, toalla caliente y acabado.' },
  { id: 'combo',   name: 'Cut + Beard',   duration: 60, price: 12, desc: 'El servicio completo, en una sola visita.' },
  { id: 'premium', name: 'Noble Ritual',  duration: 75, price: 18, desc: 'Corte, barba, facial express y styling.' }
];

const BARBERS = [
  { id: 'mateo',     name: 'Mateo Rojas',     short: 'Mateo',     initials: 'MR', specialty: 'Fades · Texture',        rating: '4.9' },
  { id: 'daniel',    name: 'Daniel Guevara',  short: 'Daniel',    initials: 'DG', specialty: 'Barba · Estilo clásico', rating: '4.9' },
  { id: 'sebastian', name: 'Sebastián Cueva', short: 'Sebastián', initials: 'SC', specialty: 'Estilo moderno',         rating: '4.8' }
];

const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'];

/* Credenciales de la demo. En producción esto vive en el backend con hash y sesion firmada. */
const ACCOUNTS = [
  { user: 'admin',     pass: 'admin123',     role: 'admin',   name: 'Andrés Noble',   barberId: null,          title: 'Administración' },
  { user: 'mateo',     pass: 'mateo123',     role: 'barbero', name: 'Mateo Rojas',    barberId: 'mateo',       title: 'Barbero' },
  { user: 'daniel',    pass: 'daniel123',    role: 'barbero', name: 'Daniel Guevara', barberId: 'daniel',      title: 'Barbero' },
  { user: 'sebastian', pass: 'sebastian123', role: 'barbero', name: 'Sebastián Cueva', barberId: 'sebastian',  title: 'Barbero' }
];

const PERMISSIONS = {
  admin:   ['resumen', 'agenda', 'clientes', 'servicios'],
  barbero: ['midia', 'agenda']
};

const SECTIONS = [
  { id: 'resumen',   label: 'Resumen',    icon: 'ph-chart-bar',    adminOnly: true  },
  { id: 'midia',     label: 'Mi día',     icon: 'ph-user-focus',   adminOnly: false },
  { id: 'agenda',    label: 'Agenda',     icon: 'ph-calendar-dots', adminOnly: false },
  { id: 'clientes',  label: 'Clientes',   icon: 'ph-users-three',  adminOnly: true  },
  { id: 'servicios', label: 'Servicios',  icon: 'ph-tag',          adminOnly: true  }
];

/* Clientes de la demo. Las visitas y el gasto no se escriben a mano:
   se calculan desde las reservas, asi la tabla nunca contradice a la agenda. */
const CLIENT_POOL = [
  { name: 'Carlos Andrade',   phone: '098 420 1182', email: 'carlos.andrade@gmail.com' },
  { name: 'Diego Pozo',       phone: '099 118 7702', email: 'dpozo@outlook.com' },
  { name: 'Andrés Ruiz',      phone: '096 721 4050', email: '' },
  { name: 'Mateo Herrera',    phone: '098 332 6104', email: 'mherrera.ib@gmail.com' },
  { name: 'Luis Acosta',      phone: '099 525 9130', email: 'lacosta.ec@gmail.com' },
  { name: 'Kevin López',      phone: '098 911 4401', email: '' },
  { name: 'Jorge Mena',       phone: '095 383 0021', email: 'jorge.mena@hotmail.com' },
  { name: 'Iván Chamorro',    phone: '098 774 2216', email: '' },
  { name: 'Santiago Vaca',    phone: '096 118 9043', email: 'svaca@gmail.com' },
  { name: 'Joel Benalcázar',  phone: '099 204 7715', email: '' },
  { name: 'Marco Terán',      phone: '098 553 1290', email: 'marcoteran@outlook.com' },
  { name: 'Bryan Quelal',     phone: '096 880 3324', email: '' },
  { name: 'Alexis Portilla',  phone: '099 671 4408', email: 'aportilla@gmail.com' },
  { name: 'Danilo Yépez',     phone: '098 145 6672', email: '' },
  { name: 'Fernando Calderón', phone: '095 730 2218', email: 'fcalderon.ec@gmail.com' },
  { name: 'Wilson Imbaquingo', phone: '096 442 8815', email: '' },
  { name: 'Patricio Cuásquer', phone: '099 318 5527', email: 'pcuasquer@hotmail.com' },
  { name: 'Ariel Montenegro', phone: '098 067 9931', email: '' },
  { name: 'Jefferson Pineda', phone: '096 209 6640', email: 'jpineda@gmail.com' },
  { name: 'Byron Tulcanaza',  phone: '099 884 2103', email: '' }
];

/* Horario real del local, el mismo que anuncia el sitio:
   lunes a viernes 09:00 a 19:00, sabado hasta 17:00, domingo cerrado. */
function slotsForDate(iso) {
  const day = new Date(iso + 'T12:00:00').getDay();
  if (day === 0) return [];
  if (day === 6) return SLOTS.filter(time => time < '17:00');
  return SLOTS;
}

const isClosed = iso => slotsForDate(iso).length === 0;

function nextOpenDate(fromOffset = 0) {
  for (let offset = fromOffset; offset < fromOffset + 7; offset++) {
    const iso = dateISO(offset);
    if (!isClosed(iso)) return iso;
  }
  return dateISO(fromOffset);
}

function dateISO(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* Generador determinista de la agenda de ejemplo.
   Un local real llega a la mitad de su capacidad, y con seis reservas sueltas
   las metricas de ocupacion salen en 1% y el panel parece roto. La semilla usa
   un PRNG con valor fijo para que los numeros no cambien en cada recarga. */
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeedBookings() {
  const rand = mulberry32(20260921);
  const out = [];
  const mondayOffset = -((new Date().getDay() + 6) % 7);
  let counter = 0;

  for (let offset = mondayOffset; offset <= mondayOffset + 13; offset++) {
    const date = dateISO(offset);
    if (isClosed(date)) continue;

    BARBERS.forEach(barber => {
      slotsForDate(date).forEach(time => {
        /* Los dias futuros se van llenando, los pasados ya estan cerrados. */
        const load = offset < 0 ? 0.62 : offset <= 2 ? 0.58 : 0.34;
        if (rand() > load) return;

        const client = CLIENT_POOL[Math.floor(rand() * CLIENT_POOL.length)];
        const service = SERVICES[Math.floor(rand() * SERVICES.length)];

        out.push({
          id: 's' + (++counter),
          name: client.name,
          phone: client.phone,
          email: client.email,
          service: service.id,
          barber: barber.id,
          date,
          time,
          status: offset >= 0 && rand() > 0.88 ? 'Pendiente' : 'Confirmada'
        });
      });
    });
  }

  return out;
}

const STORE_KEY = 'noble_bookings';
const SESSION_KEY = 'noble_session';

let seedCache = null;
const seedBookings = () => (seedCache || (seedCache = buildSeedBookings())).slice();

const Store = {
  bookings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(raw) && raw.length ? raw : seedBookings();
    } catch {
      return seedBookings();
    }
  },
  save(bookings) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(bookings));
    } catch {
      /* Modo privado o almacenamiento lleno: la demo sigue en memoria. */
    }
  },
  session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  },
  setSession(session) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* Sin almacenamiento la sesion dura lo que dure la pagina. */
    }
  },
  clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Nada que limpiar. */
    }
  }
};

const getService = id => SERVICES.find(s => s.id === id);
const getBarber = id => BARBERS.find(b => b.id === id);
const money = n => '$' + Number(n).toFixed(0);
const initialsOf = name => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const niceDate = iso => new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso + 'T12:00:00'));
const canSee = (role, section) => (PERMISSIONS[role] || []).includes(section);

function authenticate(user, pass) {
  const account = ACCOUNTS.find(a => a.user === user.trim().toLowerCase());
  if (!account || account.pass !== pass) return null;
  return { user: account.user, role: account.role, name: account.name, barberId: account.barberId, title: account.title };
}

function clientsFrom(bookings) {
  const today = dateISO(0);
  const map = new Map();

  bookings.forEach(booking => {
    const service = getService(booking.service);
    if (!service) return;

    const client = map.get(booking.phone) || {
      name: booking.name,
      phone: booking.phone,
      email: booking.email || '',
      visits: 0,
      spent: 0,
      lastVisit: null,
      nextVisit: null,
      isNew: false
    };

    client.visits += 1;
    client.spent += service.price;
    if (!client.email && booking.email) client.email = booking.email;
    if (booking.createdAt) client.isNew = true;

    if (booking.date <= today) {
      if (!client.lastVisit || booking.date > client.lastVisit) client.lastVisit = booking.date;
    } else if (!client.nextVisit || booking.date < client.nextVisit) {
      client.nextVisit = booking.date;
    }

    map.set(booking.phone, client);
  });

  const dayMs = 86400000;
  return [...map.values()].map(client => {
    const daysSince = client.lastVisit
      ? Math.round((new Date(today) - new Date(client.lastVisit)) / dayMs)
      : null;

    let status = 'Activo';
    if (client.isNew && client.visits === 1) status = 'Nuevo';
    else if (daysSince === null) status = 'Agendado';
    else if (daysSince > 21) status = 'Reactivar';

    return {
      ...client,
      last: client.lastVisit ? niceDate(client.lastVisit) : 'Sin visitas',
      status
    };
  });
}
