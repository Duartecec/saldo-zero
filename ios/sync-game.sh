#!/usr/bin/env bash
# Copia o jogo (game.html, fonte única na raiz do repositório) para dentro do bundle do app.
set -e
cd "$(dirname "$0")"
cp ../game.html Sources/SaldoZero/Resources/web/game.html
echo "game.html sincronizado em Sources/SaldoZero/Resources/web/"
