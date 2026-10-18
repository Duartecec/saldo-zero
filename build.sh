#!/usr/bin/env bash
# Gera index.html (standalone, para o Railway) a partir de game.html (fragmento usado também como Artifact).
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#0d1020">\n<meta name="description" content="Master Escape: sátira ficcional em que você é um banqueiro tentando sobreviver ao poder. Arraste as cartas e descubra os 10 finais.">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  cat game.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "index.html gerado ($(wc -c < index.html) bytes)"
