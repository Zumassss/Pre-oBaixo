#!/bin/sh
# Mantém o bot ligado: se ele cair (internet, erro, WhatsApp desconectou de
# vez), espera 5 segundos e liga de novo. Num servidor próprio, rode este
# arquivo em vez de `npm start`.
cd "$(dirname "$0")" || exit 1
while true; do
  node --no-warnings bot.js >> bot.log 2>&1
  echo "$(date -u +%H:%M:%S) bot saiu, reiniciando em 5s" >> bot.log
  sleep 5
done
