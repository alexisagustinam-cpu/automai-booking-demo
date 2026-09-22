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

Dirección "editorial": papel dominante, tinta casi negra, acento burdeos, fotografía real de luz de día. Aplica al sitio público y al panel del negocio por igual — ambos comparten los mismos tokens.

**Color.**

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#F2EDE5` | Fondo principal |
| `--paper-raised` | `#F8F5EF` | Superficies elevadas (cards, filas activas) |
| `--paper-sunken` | `#E8E1D5` | Superficies hundidas (placeholders, avatares) |
| `--ink` | `#1B1712` | Texto principal, fondo oscuro (nav, sidebar, hero) |
| `--ink-soft` | `#6B665E` | Texto secundario |
| `--wine` | `#4E1216` | Acento, botón primario, precios |
| `--wine-bright` | `#6E1B20` | Hover de acento |
| `--wine-glow` | `#D65B4D` | Acento legible sobre fondos oscuros (4.9:1) |

El burdeos es el único acento del sistema — reemplaza al dorado de una iteración anterior tanto en el sitio público como en el panel del negocio.

**Tipografía.** Dos tratamientos de titular, según el tono de la sección:
- **Cabinet Grotesk** (sans, 800) para declaraciones de impacto: el título del hero y el cierre ("Reserva. Llega. Disfruta.").
- **Zodiak** (serif, 700) para titulares editoriales: "Un espacio para el hombre de hoy", "Más que clientes, una comunidad" y los títulos del panel del negocio.

Interfaz en **Supreme**, datos (horarios, precios, duraciones, métricas) en **Tabular**. Las cuatro son self-hosted (`assets/fonts/`), sin dependencias de Google Fonts.

**Radios.** Botones e inputs 8 px, cards de UI 16 px, fotografía 18 px, modal de reserva 28 px, pastillas de estado 999 px.

**Superficies.** El hero, el estudio y el cierre son fotografía a sangre completa (lateral a lateral); el resto de las secciones usa el mismo margen que el navbar, sin límite de ancho central. El panel del negocio tiene sidebar oscuro (`--ink`) y canvas claro (`--paper`).

**Marca.** El wordmark es tipográfico por ahora. El marcado del header, el pie, el login y el panel ya reserva el hueco para `assets/brand/noble-logo.svg` y `assets/brand/noble-mark.svg`.

## Secciones del sitio

Hero (foto completa con turno disponible superpuesto), Servicios, Equipo, Cómo funciona, Estudio ("Un espacio para el hombre de hoy"), Cierre ("Reserva. Llega. Disfruta."), Testimonios y pie. Servicios y Equipo son secciones propias, apiladas — no comparten fila.

## Panel del negocio: qué funciona de verdad

Más allá de mostrar datos, estas acciones escriben en `localStorage` y se reflejan de inmediato en el sitio público (misma pestaña o pestañas distintas, mismo origen):

- **Nueva reserva** (Resumen, solo administración): crea una cita real — valida cliente, evita choques de horario y la deja disponible en Agenda, Clientes y las métricas al instante.
- **Nuevo servicio** (Servicios, solo administración): agrega un servicio que aparece tanto en la tabla del panel como en el paso 1 de la reserva pública.
- **Exportar CSV** (Clientes, solo administración): descarga la tabla de clientes tal como está filtrada, con BOM UTF-8 para abrir bien en Excel.
- **Agenda con navegación por día**: flechas atrás/adelante y botón "Hoy", con estado "Cerrado" cuando el día no tiene horario (domingos).

## Detalles de comportamiento

- Los horarios respetan el horario real del local: lunes a viernes hasta las 19:00, sábado hasta las 17:00, domingo cerrado. Los días cerrados aparecen deshabilitados en el selector.
- Con "Primero disponible" un turno se ofrece mientras quede al menos un barbero libre, y al confirmar se asigna al barbero libre con menos carga.
- Si el turno se ocupa desde otra pestaña entre la selección y el envío, el formulario avisa y devuelve al paso de horarios (mismo chequeo aplica a "Nueva reserva" en el panel).
- La agenda de ejemplo se genera con un PRNG de semilla fija, así las métricas son realistas y no cambian en cada recarga.
- Las visitas y el gasto de cada cliente se calculan desde las reservas, nunca se escriben a mano, para que la tabla no contradiga a la agenda.
- La agenda del panel tiene filas por hora y turnos de 30 minutos, así que cada celda muestra todas las citas de esa hora, no solo la primera.
- Las animaciones usan GSAP con ScrollTrigger: entrada del hero de unos 1,3 s, parallax de la fotografía limitado al 3% y aparición progresiva del contenido sin secuestrar el scroll. Si el CDN falla o el sistema pide movimiento reducido, el contenido se muestra estático sin quedar invisible.

## Pendiente

- Dos fotos de detalle del estudio (sección "Un espacio para el hombre de hoy") siguen como placeholder — quedan marcadas en `index.html` con un comentario.

## Stack

HTML, CSS y JavaScript sin framework. GSAP y Phosphor Icons por CDN. Persistencia en `localStorage` para las reservas y `sessionStorage` para la sesión del panel.

La versión de producción propuesta evoluciona a Next.js con TypeScript, Supabase o PostgreSQL con autenticación y RLS, más automatizaciones de WhatsApp y pagos según el cliente.

## Autor

AutomAI Labs
