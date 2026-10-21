// Busca links escondidos de Cobraticket con Tavily y los deja en data/candidatos.json.
// Lo corre el workflow cada 3 horas, sólo si existe el secreto TAVILY_API_KEY.
// Plan gratis: 1.000 búsquedas por mes. 4 búsquedas x 8 veces por día = ~960 por mes.
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.TAVILY_API_KEY;
if (!KEY) { console.log("Sin TAVILY_API_KEY: no se busca en la web."); process.exit(0); }

const RAIZ = new URL("../", import.meta.url);
const leer = async (f, d) => { try { return JSON.parse(await readFile(new URL(f, RAIZ), "utf8")); } catch { return d; } };

const BUSQUEDAS = [
  "cobraticket FABRIK Cruz del Sur Gianattassio Ciudad de la Costa",
  "fiesta FABRIK \"Ciudad de la Costa\" entradas cobraticket",
  "cobraticket \"Cruz del sur 7030\" San José de Carrasco",
  "passline fiesta FABRIK \"Ciudad de la Costa\" Uruguay",
];

const conocidos = new Set([
  ...(await leer("data/seguir.json", [])),
  ...(await leer("data/eventos.json", [])).map(e => e.entradas).filter(Boolean),
]);
const revisados = await leer("data/revisados.json", {});
const candidatos = new Set(await leer("data/candidatos.json", []));

for (const query of BUSQUEDAS) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
    body: JSON.stringify({ query, max_results: 20, search_depth: "basic" }),
  });
  if (!r.ok) { console.log("Tavily respondió", r.status); continue; }
  const { results = [] } = await r.json();
  for (const { url = "", content = "" } of results) {
    for (const m of (url + " " + content).matchAll(/https?:\/\/(?:www\.)?cobraticket\.uy\/e\/([a-z0-9-]+-(\d{5,}))/gi)) {
      const link = "https://cobraticket.uy/e/" + m[1].toLowerCase();
      if (!conocidos.has(link) && revisados[m[2]] !== "no") candidatos.add(link);
    }
    for (const m of (url + " " + content).matchAll(/https?:\/\/(?:www\.)?(passline\.com\/eventos\/[a-z0-9-]+|mientrada\.com\.uy\/evento\/[a-z0-9-]+-\d+)/gi)) {
      const link = "https://" + (m[1].startsWith("passline") ? "www." : "") + m[1].toLowerCase();
      if (!conocidos.has(link)) candidatos.add(link);
    }
  }
}
await writeFile(new URL("data/candidatos.json", RAIZ), JSON.stringify([...candidatos], null, 2) + "\n");
console.log("candidatos:", candidatos.size);
