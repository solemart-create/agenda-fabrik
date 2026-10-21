// Lee el HTML de una página de evento de Cobraticket y devuelve sus datos.
// Sin dependencias, para poder probarlo también en el navegador.

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","setiembre","octubre","noviembre","diciembre"];

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i");
  const m = re.exec(html);
  return m ? decodeEntities(m[1]).trim() : "";
}

export function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

export function textOf(html) {
  return decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, "\n")
  ).split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

// ¿Es en Fabrik? Se decide por el LUGAR, no por el organizador:
// la productora "FABRIK" también hace fiestas en BlackBox, Espacio Olivos y otros lugares.
// Fabrik figura como lugar "FABRIK" o con la dirección Cruz del Sur esq. Gianattassio / Cruz del Sur 7030.
export function esFabrik(lugar, direccion) {
  if (/^\s*FABRIK\s*$/i.test(lugar || "")) return true;
  const d = direccion || "";
  return /Cruz del Sur/i.test(d) && /Gia?n+at+as+io|\b7030\b|San Jos[eé] de Carrasco/i.test(d);
}

// Bloque del lugar: la línea "…, Canelones" (o Montevideo, Maldonado) y las dos anteriores.
function bloqueLugar(lineas) {
  const i = lineas.findIndex(l => /,\s*(Canelones|Montevideo|Maldonado|San Jos[eé]|Colonia|Rocha)\s*$/i.test(l));
  if (i < 2) return { lugar: "", direccion: "" };
  return { lugar: lineas[i - 2], direccion: lineas[i - 1] + ", " + lineas[i] };
}

export function parseEvento(html, url) {
  const lineas = textOf(html);
  const titulo = (meta(html, "og:title") || (/<title>([^<|]+)/i.exec(html)?.[1] || "")).trim();
  const imagen = meta(html, "og:image");
  const tiempos = [...html.matchAll(/<time[^>]*datetime="([^"]+)"/gi)].map(m => m[1]);
  const inicio = tiempos[0] || "";
  const fin = tiempos.length > 1 ? tiempos[tiempos.length - 1] : "";
  const fecha = inicio.slice(0, 10);
  const hora = inicio.slice(11, 16);
  const horaFin = fin && fin.slice(11, 16) !== hora ? fin.slice(11, 16) : "";

  const { lugar, direccion } = bloqueLugar(lineas);
  const organiza = lineas[lineas.indexOf("Organiza") + 1] || "";
  // Sólo el título o una etiqueta suelta "Cancelado"; el pie de página habla de devoluciones y no cuenta.
  const cancelado = /\b(cancelad[oa]|suspendid[oa])\b/i.test(titulo) ||
    lineas.some(l => /^(evento\s+)?(cancelad[oa]|suspendid[oa])$/i.test(l));
  const categoria = lineas.find(l => /^(Fiestas|Música|Musica|Teatro|Deportes|Otros|Congresos|Stand ?up)$/i.test(l)) || "";
  const edad = lineas.find(l => /^\+\s?\d{2}\s*años$/i.test(l)) || "";
  const id = (/-(\d{5,})\/?$/.exec(url) || [])[1] || url;

  return {
    id: "cobra-" + id,
    titulo: titulo.replace(/\s+/g, " "),
    fecha, hora, horaFin,
    categoria, edad,
    lugar, direccion, organiza, cancelado,
    imagen,
    url,
    fuente: "Cobraticket",
    esFabrik: esFabrik(lugar, direccion),
  };
}

export function fechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

export function linksDelListado(html) {
  return [...new Set([...html.matchAll(/href="(\/e\/[^"#?]+)"/g)].map(m => "https://cobraticket.uy" + m[1]))];
}
