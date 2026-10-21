#!/usr/bin/env bash
# Guarda los cambios de data/ en el repo. Si otra corrida guardó al mismo tiempo,
# toma la versión más nueva, vuelve a correr la verificación (sin Tavily) y reintenta.
set -u
git config user.name "agenda-fabrik"
git config user.email "agenda-fabrik@users.noreply.github.com"
ARCH="data/eventos.json data/revisados.json data/revisados-otras.json data/seguir.json data/candidatos.json"
for intento in 1 2 3; do
  git add $ARCH
  if git diff --cached --quiet; then echo "Sin cambios"; exit 0; fi
  git commit -qm "Actualiza eventos de Fabrik"
  if git pull --rebase -q && git push -q; then echo "Guardado"; exit 0; fi
  echo "Choque con otra corrida (intento $intento). Rehago sobre la versión nueva."
  cp data/candidatos.json /tmp/cand.json 2>/dev/null || echo '[]' > /tmp/cand.json
  git rebase --abort 2>/dev/null
  git fetch -q origin main && git reset -q --hard origin/main
  node -e 'const f=require("fs");const a=JSON.parse(f.readFileSync("/tmp/cand.json"));const b=JSON.parse(f.readFileSync("data/candidatos.json"));f.writeFileSync("data/candidatos.json",JSON.stringify([...new Set([...b,...a])],null,2)+"\n")'
  node scripts/buscar-otras.mjs && node scripts/buscar-cobraticket.mjs
done
echo "No se pudo guardar después de 3 intentos"; exit 1
