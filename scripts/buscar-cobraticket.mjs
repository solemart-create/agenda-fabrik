// Revisa Cobraticket y mantiene data/eventos.json al día.
// Después avisa por ntfy de todo evento que todavía no se avisó (venga de Cobraticket o lo haya agregado Claude).
// Uso: node scripts/buscar-cobraticket.mjs
import { readFile, writeFile } from "node:fs/promises";
import { parseEvento, linksDelListado, fechaLarga } from "./parse.mjs";

const RAIZ = new URL("../", import.meta.url);
const ARCH_EVENTOS = new URL("data/eventos.json", RAIZ);
const ARCH_REVISADOS = new URL("data/revisados.json", RAIZ);
const ARCH_SEGUIR = new URL("data/seguir.json", RAIZ);
const TOPIC = process.env.NTFY_TOPIC || "";
const SITIO = (process.env.SITIO_URL || "").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; agenda-fabrik/1.0; uso personal)";

const leer = async (u, def) => { try { return JSON.parse(await readFile(u, "utf8")); } catch { return def; } };
const guardar = (u, d) => writeFile(u, JSON.stringify(d, null, 2) + "\n");
const espera = ms => new Promise(r => setTimeout(r, ms));
const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // Montevideo

async function bajar(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "es-UY,es" } });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  return r.text();
}

async function avisar(ev) {
  const cuando = [ev.fecha && fechaLarga(ev.fecha), ev.hora && ev.hora + " h"].filter(Boolean).join(" · ");
  const body = {
    topic: TOPIC,
    title: "Nuevo en Fabrik: " + ev.titulo,
    message: [cuando, ev.direccion].filter(Boolean).join("\n") || "Apareció un evento nuevo.",
    click: SITIO ? `${SITIO}/#${ev.id}` : (ev.entradas || undefined),
    tags: ["tada"],
    actions: ev.entradas ? [{ action: "view", label: "Entradas", url: ev.entradas }] : [],
  };
  const r = await fetch("https://ntfy.sh/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  console.log("aviso", r.status, ev.titulo);
  return r.ok;
}

const eventos = await leer(ARCH_EVENTOS, []);
const revisados = await leer(ARCH_REVISADOS, {}); // id de Cobraticket -> "no" cuando no es en Fabrik
const seguir = await leer(ARCH_SEGUIR, []);       // links ocultos que ya sabemos que son de Fabrik
const ARCH_CAND = new URL("data/candidatos.json", RAIZ);
const candidatos = (await leer(ARCH_CAND, [])).map(u => String(u).split(/[?#]/)[0]).filter(u => /^https:\/\/cobraticket\.uy\/e\/[^/]+$/.test(u)); // links que encontró Claude y hay que verificar

const listado = linksDelListado(await bajar("https://cobraticket.uy/eventos"));
// Los eventos de Fabrik que ya pasaron no se vuelven a pedir.
const vigentes = eventos.filter(e => !e.fecha || e.fecha >= hoy).map(e => e.entradas).filter(u => u && u.includes("cobraticket.uy/e/"));
const aRevisar = [...new Set([...candidatos, ...seguir, ...vigentes, ...listado])];

let nuevos = 0;
for (const url of aRevisar) {
  const idc = (/-(\d{5,})\/?$/.exec(url) || [])[1];
  const yaSabido = seguir.includes(url) || vigentes.includes(url) || candidatos.includes(url);
  if (revisados[idc] === "no" && !yaSabido) continue;
  let ev;
  try { ev = parseEvento(await bajar(url), url); } catch (e) { console.log("salteo:", e.message); continue; }
  await espera(600);
  if (!ev.esFabrik) { if (idc && !seguir.includes(url)) revisados[idc] = "no"; continue; }
  // Un link escondido confirmado queda vigilado para siempre.
  if (!listado.includes(url) && !seguir.includes(url)) seguir.push(url);

  const datos = {
    id: ev.id, titulo: ev.titulo, fecha: ev.fecha, hora: ev.hora, horaFin: ev.horaFin,
    lugar: ev.lugar || "FABRIK", direccion: ev.direccion, categoria: ev.categoria, edad: ev.edad,
    imagen: ev.imagen, entradas: url, cancelado: ev.cancelado || undefined,
  };
  const existente = eventos.find(e => e.id === ev.id || e.entradas === url);
  if (!existente) {
    eventos.push({ ...datos, notas: "", otros: [], fuente: "Cobraticket", encontrado: new Date().toISOString(), avisado: false });
    nuevos++;
    console.log("NUEVO:", ev.titulo, ev.fecha);
  } else {
    // Sólo se pisan los datos que vienen de Cobraticket; notas y links extra quedan como están.
    for (const [k, v] of Object.entries(datos)) if (v) existente[k] = v;
  }
}

// Avisos pendientes (incluye lo que haya cargado Claude desde Instagram u otras fuentes).
for (const ev of eventos) {
  if (ev.avisado === false && !ev.descartado) {
    if (!TOPIC) { console.log("sin NTFY_TOPIC, no aviso:", ev.titulo); continue; }
    if (await avisar(ev)) ev.avisado = true;
  }
}

eventos.sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
await guardar(ARCH_EVENTOS, eventos);
await guardar(ARCH_REVISADOS, revisados);
await guardar(ARCH_SEGUIR, seguir);
// Se vacían los de Cobraticket; los de otras ticketeras que no se pudieron abrir quedan para la próxima.
await guardar(ARCH_CAND, (await leer(ARCH_CAND, [])).filter(u => !/cobraticket\.uy\/e\//.test(String(u))));
console.log(JSON.stringify({ revisados: aRevisar.length, nuevos }));
