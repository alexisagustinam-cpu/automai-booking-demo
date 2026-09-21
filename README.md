# Noble Barber Studio, demo de reservas y CRM

Demo conceptual de un sistema de reservas online con panel de negocio, presentada con una barbería ficticia como caso de uso. Proyecto de portafolio de AutomAI Labs.

## Cómo correrla

No necesita build ni dependencias. Basta servir la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080`.

## Estructura

| Archivo | Rol |
|---|---|
| `index.html` | Sitio público y flujo de reserva en 4 pasos |
| `negocio.html` | Acceso del equipo y panel del negocio |
| `styles.css` | Tokens del sistema visual, sitio público y modal de reserva |
| `crm.css` | Panel del negocio, hereda los tokens de `styles.css` |
| `data.js` | Modelo, horarios, permisos y persistencia compartidos |
| `app.js` | Render del sitio público, reserva y animaciones |
| `crm.js` | Acceso, roles y render de las secciones del panel |
| `assets/img/` | Fotografía en WebP con tres anchos para `srcset` |
| `_backup-v1/` | Versión anterior del diseño, por si se necesita comparar |

## Acceso al panel

El panel no está enlazado desde la navegación pública. Se llega por `negocio.html`, con enlace discreto en el pie bajo "Acceso equipo".

| Usuario | Clave | Rol |
|---|---|---|
| `admin` | `admin123` | Administración |
| `mateo` | `mateo123` | Barbero |
| `daniel` | `daniel123` | Barbero |
| `sebastian` | `sebastian123` | Barbero |

### Permisos

| Sección | Administración | Barbero |
|---|---|---|
| Resumen del negocio | Sí | Bloqueada |
| Mi día | No aplica | Sí |
| Agenda | Todas las columnas | Solo su columna |
| Clientes | Sí | Bloqueada |
| Servicios y precios | Sí | Bloqueada |

Las secciones sin permiso siguen visibles en la barra lateral, con candado y deshabilitadas, y al intentar abrirlas muestran un estado explicando que corresponden a administración.

El acceso incluye validación por campo, contador de intentos restantes y bloqueo temporal de 20 segundos tras tres fallos. Es una simulación de frontend: en producción la autenticación vive en el backend con claves hasheadas y sesión firmada.

## Sistema de marca

Aplica el Brand System aprobado de Noble Barber Studio: editorial masculino, sobrio y cálido.

**Color.** Proporción aproximada 80% negro y carbón, 15% hueso y champagne, 5% oro. El dorado es acento y nunca ocupa bloques grandes.

| Token | Valor | Uso |
|---|---|---|
| `--noble-black` | `#090909` | Fondo principal |
| `--noble-obsidian` | `#12110F` | Superficies y sidebar |
| `--noble-charcoal` | `#211E1A` | Superficies elevadas |
| `--noble-gold` | `#B49352` | Acento, botón primario |
| `--noble-champagne` | `#D4C19A` | Texto de énfasis, filetes |
| `--noble-bone` | `#EEE9DF` | Texto sobre oscuro, zona de reserva |
| `--noble-gray` | `#989188` | Texto secundario |
| `--noble-status` | `#728674` | Estado de disponibilidad |

Sobre superficies claras el oro y el verde no alcanzan contraste como texto (2.9:1 y 3.9:1), así que existen `--gold-ink` (`#8A6E32`) y `--status-ink` (`#4F6352`) para ese caso.

**Tipografía.** Cormorant Garamond para titulares y frases editoriales, Manrope para interfaz y formularios, Geist Mono solo para datos: horarios, precios, duraciones y métricas.

**Radios.** Botones e inputs 8 px, cards de UI 10 px, fotografía 14 px, modal de reserva 18 px, pastillas de estado 999 px.

**Superficies.** El sitio público es oscuro; la zona de interacción de la reserva y el panel del negocio son claros (`#EEE9DF` y `#F2EFE8`) con sidebar oscuro.

**Marca.** El wordmark es tipográfico por ahora. El marcado del header, el pie, el login y el panel ya reserva el hueco para `assets/brand/noble-logo.svg` y `assets/brand/noble-mark.svg`.

Contraste verificado: todo el texto cumple WCAG AA en el sitio, el modal de reserva, el login y el panel.

## Secciones del sitio

Hero, The Noble Experience, Servicios en filas, Equipo, The Noble Ritual y cierre fotográfico. The Noble Ritual es una sección de marca: el flujo real de reserva se explica dentro del modal.

## Detalles de comportamiento

- Los horarios respetan el horario real del local: lunes a viernes hasta las 19:00, sábado hasta las 17:00, domingo cerrado. Los días cerrados aparecen deshabilitados en el selector.
- Con "Primero disponible" un turno se ofrece mientras quede al menos un barbero libre, y al confirmar se asigna al barbero libre con menos carga.
- Si el turno se ocupa desde otra pestaña entre la selección y el envío, el formulario avisa y devuelve al paso de horarios.
- La agenda de ejemplo se genera con un PRNG de semilla fija, así las métricas son realistas y no cambian en cada recarga.
- Las visitas y el gasto de cada cliente se calculan desde las reservas, nunca se escriben a mano, para que la tabla no contradiga a la agenda.
- La agenda del panel tiene filas por hora y turnos de 30 minutos, así que cada celda muestra todas las citas de esa hora, no solo la primera.
- Las animaciones usan GSAP con ScrollTrigger: entrada del hero de unos 1,3 s, parallax de la fotografía limitado al 3% y resaltado progresivo del ritual sin secuestrar el scroll. Si el CDN falla o el sistema pide movimiento reducido, el contenido se muestra estático sin quedar invisible.

## Stack

HTML, CSS y JavaScript sin framework. GSAP y Phosphor Icons por CDN. Persistencia en `localStorage` para las reservas y `sessionStorage` para la sesión del panel.

La versión de producción propuesta evoluciona a Next.js con TypeScript, Supabase o PostgreSQL con autenticación y RLS, más automatizaciones de WhatsApp y pagos según el cliente.

## Autor

AutomAI Labs
