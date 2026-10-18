# SALDO ZERO

Jogo narrativo satírico e fictício. Você é um banqueiro tentando sobreviver ao poder: arraste cartas, segure o caixa e fuja da Operação Saldo Zero. Roda no navegador (mobile first) e como app iOS.

## Execução (web)

Requer [Bun](https://bun.sh/).

```bash
bun run start
```

O servidor usa a variável `PORT` (padrão `3000`). Ele monta a página em memória a partir de `game.html` e serve também `/privacidade` e `/suporte` (páginas exigidas pela App Store). `./build.sh` gera um `index.html` standalone (não versionado) quando for preciso um arquivo estático.

## Arquivos

- `game.html` — todo o jogo (estilos, baralho, mecânicas, telas, ponte com o app nativo).
- `server.ts` — servidor Bun.
- `scripts/sim.js` — joga dezenas de partidas aleatórias em Chromium headless e imprime a distribuição de finais e erros de console.
- `ios/` — app iOS para a App Store, construído com xtool. Guia de publicação em `ios/AppStore/README.md`.
- `.github/workflows/ios-testflight.yml` — build de distribuição e upload ao App Store Connect em runner macOS.

## Hospedagem

Projeto Railway `master-escape`; serviço `master-game-github`, conectado à branch `main` para deploy automático.

## Nomes

- App e marca: **Saldo Zero**.
- Banco do jogo: **Banco Maxter**. Protagonista: Danilo Vorkaro.
- Obra de ficção e sátira: personagens, bancos, veículos e instituições são inventados.
