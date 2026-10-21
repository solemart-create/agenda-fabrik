# Agenda Fabrik

Calendario de fiestas y eventos en Fabrik (Cruz del Sur y Giannattasio, Ciudad de la Costa).

- `index.html` es el sitio que publica Vercel. Lee los eventos de `data/eventos.json`.
- `scripts/buscar-cobraticket.mjs` revisa Cobraticket cada hora (GitHub Actions, `.github/workflows/buscar.yml`), agrega los eventos de Fabrik y manda una notificación push por ntfy.
- `data/seguir.json` tiene links de Cobraticket que no aparecen en el listado público pero ya sabemos que son de Fabrik.
- Para corregir o agregar algo a mano: editar `data/eventos.json`. Campos: `titulo`, `fecha` (AAAA-MM-DD), `hora`, `horaFin`, `direccion`, `notas`, `entradas` (link de compra), `otros` (lista de `{nombre, url}`), `imagen`. Con `"avisado": false` se manda la notificación en la próxima corrida; con `"descartado": true` el evento se oculta.

Configuración (Settings → Secrets and variables → Actions → Variables):
- `NTFY_TOPIC`: canal de ntfy al que está suscripto el celular.
- `SITIO_URL`: dirección del sitio en Vercel, para que la notificación abra la tarjeta del evento.
