// Lee el HTML de una página de evento de Cobraticket y devuelve sus datos.
// Sin dependencias, para poder probarlo también en el navegador.

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

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

// ¿Es en Fabrik? Nombre del lugar u organizador, o la esquina Cruz del Sur y Giannattasio.
export function esFabrik(lineas) {
  const t = lineas.join(" | ");
  if (/\bFABRIK\b/i.test(t)) return true;
  // Fabrik también figura como "Cruz del Sur 7030 (San José de Carrasco)".
  return /Cruz del Sur/i.test(t) && /Gia?n+at+as+io|\b7030\b|San Jos[eé] de Carrasco/i.test(t);
}

export function parseEvento(html, url) {
  const lineas = textOf(html);
  const titulo = meta(html, "og:title") || (/<title>([^<|]+)/i.exec(html)?.[1] || "").trim();
  const imagen = meta(html, "og:image");
  const tiempos = [...html.matchAll(/<time[^>]*datetime="([^"]+)"/gi)].map(m => m[1]);
  const inicio = tiempos[0] || "";
  const fin = tiempos.length > 1 ? tiempos[tiempos.length - 1] : "";
  const fecha = inicio.slice(0, 10);
  const hora = inicio.slice(11, 16);
  const horaFin = fin && fin.slice(11, 16) !== hora ? fin.slice(11, 16) : "";

  // Lugar: la línea en mayúsculas seguida de la dirección, cerca del pin del mapa.
  let lugar = "", direccion = "";
  const iDir = lineas.findIndex(l => /Cruz del Sur|Gia?n+at+as+io/i.test(l));
  if (iDir > 0) { lugar = lineas[iDir - 1]; direccion = [lineas[iDir], lineas[iDir + 1]].filter(Boolean).join(", "); }
  else {
    const iCiudad = lineas.findIndex(l => /Ciudad de la Costa/i.test(l));
    if (iCiudad > 1) { lugar = lineas[iCiudad - 2]; direccion = lineas[iCiudad - 1] + ", " + lineas[iCiudad]; }
  }
  const categoria = lineas.find(l => /^(Fiestas|Música|Musica|Teatro|Deportes|Otros|Congresos|Stand ?up)$/i.test(l)) || "";
  const edad = lineas.find(l => /^\+\s?\d{2}\s*años$/i.test(l)) || "";
  const id = (/-(\d{5,})\/?$/.exec(url) || [])[1] || url;

  return {
    id: "cobra-" + id,
    titulo: titulo.replace(/\s+/g, " "),
    fecha, hora, horaFin,
    categoria, edad,
    lugar, direccion,
    imagen,
    url,
    fuente: "Cobraticket",
    esFabrik: esFabrik(lineas),
  };
}

export function fechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

export function linksDelListado(html) {
  return [...new Set([...html.matchAll(/href="(\/e\/[^"#?]+)"/g)].map(m => "https://cobraticket.uy" + m[1]))];
}
