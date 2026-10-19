# SALDO ZERO

Jogo narrativo satírico e fictício. Você é um banqueiro tentando sobreviver ao poder: arraste cartas, segure o caixa e fuja da Operação Saldo Zero. Roda no navegador (mobile first) como PWA: instala na tela inicial e funciona sem internet.

## Execução (web)

Requer [Bun](https://bun.sh/).

```bash
bun run start
```

O servidor usa a variável `PORT` (padrão `3000`) e, opcionalmente, `SITE_URL` (domínio público usado nas tags de preview). Ele monta a página em memória a partir de `game.html`, troca o Google Fonts pelas fontes locais, serve o PWA (manifesto, service worker, ícones) e as páginas `/privacidade` e `/suporte`. `./build.sh` gera um `index.html` standalone (não versionado) quando for preciso um arquivo estático.

## Arquivos

- `game.html` — todo o jogo (estilos, baralho, mecânicas, telas, ponte com o app nativo).
- `server.ts` — servidor Bun.
- `scripts/sim.js` — joga dezenas de partidas aleatórias em Chromium headless e imprime a distribuição de finais e erros de console.
- `public/` — manifesto do PWA, service worker, ícones, imagem de preview (`og.png`) e fontes.
- App iOS (xtool + StoreKit) guardado na branch `claude/ios-app`, caso a distribuição em loja volte à pauta.

## Hospedagem

Projeto Railway `master-escape`; serviço `master-game-github`, conectado à branch `main` para deploy automático.

## Nomes

- App e marca: **Saldo Zero**.
- Banco do jogo: **Banco Maxter**. Protagonista: Danilo Vorkaro.
- Obra de ficção e sátira: personagens, bancos, veículos e instituições são inventados.
