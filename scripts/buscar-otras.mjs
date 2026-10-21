// Mientrada y Passline: revisa el listado de Mientrada y verifica los links candidatos de ambas.
// Los eventos en Fabrik se agregan a data/eventos.json con avisado:false; el aviso lo manda buscar-cobraticket.mjs.
// Uso: node scripts/buscar-otras.mjs
import { readFile, writeFile } from "node:fs/promises";
import { esFabrik } from "./parse.mjs";

const RAIZ = new URL("../", import.meta.url);
const leer = async (f, d) => { try { return JSON.parse(await readFile(new URL(f, RAIZ), "utf8")); } catch { return d; } };
const guardar = (f, d) => writeFile(new URL(f, RAIZ), JSON.stringify(d, null, 2) + "\n");
const espera = ms => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (compatible; agenda-fabrik/1.0; uso personal)";
const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

const eventos = await leer("data/eventos.json", []);
const revisados = await leer("data/revisados-otras.json", {}); // url -> "no"
const candidatos = await leer("data/candidatos.json", []);
const conocidos = new Set(eventos.flatMap(e => [e.entradas, ...(e.otros || []).map(o => o.url)]).filter(Boolean));

const esOtra = u => /^https:\/\/(www\.)?passline\.com\/eventos\/|^https:\/\/mientrada\.com\.uy\/evento\//.test(u);
const limpiar = u => String(u).split(/[?#]/)[0].replace(/\/$/, "").replace("://passline.com", "://www.passline.com");

// ---- Leer los datos del evento desde el bloque schema.org (JSON-LD) que traen las dos páginas
function parseLD(html, url) {
  const bloques = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const b of bloques) {
    let d; try { d = JSON.parse(b.trim()); } catch { continue; }
    const ev = [].concat(d).find(x => x && /Event/.test(x["@type"] || ""));
    if (!ev) continue;
    const loc = [].concat(ev.location || [])[0] || {};
    const a = loc.address || {};
    const direccion = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(", ");
    const inicio = ev.startDate || "", fin = ev.endDate || "";
    const sitio = url.includes("passline") ? "Passline" : "Mientrada";
    return {
      titulo: String(ev.name || "").replace(/\s+/g, " ").trim(),
      fecha: inicio.slice(0, 10), hora: inicio.slice(11, 16),
      horaFin: fin && fin.slice(11, 16) !== inicio.slice(11, 16) ? fin.slice(11, 16) : "",
      lugar: String(loc.name || "").trim(), direccion,
      imagen: [].concat(ev.image || [])[0] || "",
      cancelado: /Cancelled/i.test(ev.eventStatus || ""),
      fuente: sitio,
    };
  }
  return null;
}

async function bajar(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "user-agent": UA, "accept-language": "es-UY,es", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  return r;
}

// ---- Listado de Mientrada (la página trae 20; el resto se pide con "Mostrar más", que necesita las cookies)
async function listadoMientrada() {
  const links = new Set();
  try {
    const r = await bajar("https://mientrada.com.uy/agenda-geral");
    const cookies = (r.headers.getSetCookie?.() || []).map(c => c.split(";")[0]);
    const xsrf = decodeURIComponent((cookies.find(c => c.startsWith("XSRF-TOKEN=")) || "").split("=")[1] || "");
    const agregar = t => { for (const m of t.matchAll(/\/evento\/[a-z0-9-]+-\d+/gi)) links.add("https://mientrada.com.uy" + m[0]); };
    agregar(await r.text());
    for (let pag = 2; pag <= 15; pag++) {
      const rr = await fetch("https://mientrada.com.uy/ajax/agenda-geral/mostrar-mais-eventos", {
        method: "POST",
        headers: { "user-agent": UA, "content-type": "application/json", "x-requested-with": "XMLHttpRequest", "x-xsrf-token": xsrf, cookie: cookies.join("; ") },
        body: JSON.stringify({ pag, maxByConsulta: 20, "mais-visitados": 0 }),
      });
      const t = rr.ok ? await rr.text() : "";
      if (!t.trim()) break;
      agregar(t);
      await espera(500);
    }
  } catch (e) { console.log("Mientrada:", e.message); }
  return [...links];
}

const listado = await listadoMientrada();
const aRevisar = [...new Set([...candidatos.filter(esOtra).map(limpiar), ...listado])];
const pendientes = [];
let nuevos = 0;

for (const url of aRevisar) {
  if (conocidos.has(url) || revisados[url] === "no") continue;
  let ev;
  try { ev = parseLD(await (await bajar(url)).text(), url); }
  catch (e) { console.log("salteo:", e.message); if (candidatos.map(limpiar).includes(url)) pendientes.push(url); continue; }
  await espera(600);
  if (!ev) { revisados[url] = "no"; continue; }
  if (!esFabrik(ev.lugar, ev.direccion)) { revisados[url] = "no"; continue; }
  const id = (url.includes("passline") ? "pass-" : "mie-") + url.split("/").pop();
  eventos.push({
    id, ...ev, lugar: ev.lugar || "FABRIK", categoria: "Fiestas", edad: "",
    entradas: url, notas: "", otros: [], encontrado: new Date().toISOString(), avisado: false,
    ...(ev.fecha && ev.fecha < hoy ? { avisado: true } : {}),
  });
  conocidos.add(url); nuevos++;
  console.log("NUEVO:", ev.titulo, ev.fecha, url);
}

eventos.sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
await guardar("data/eventos.json", eventos);
await guardar("data/revisados-otras.json", revisados);
// Quedan sólo los candidatos de Cobraticket (los procesa el otro script) y los que no se pudieron abrir.
await guardar("data/candidatos.json", [...candidatos.filter(u => !esOtra(limpiar(u))), ...pendientes]);
console.log(JSON.stringify({ mientrada: listado.length, revisados: aRevisar.length, nuevos }));
