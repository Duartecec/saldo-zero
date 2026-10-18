# MASTER ESCAPE

Jogo narrativo satírico e fictício para navegador mobile. Versão 2: cartas com swipe, 4 status, baralho com consequências encadeadas, 10 finais, desafio diário e capa de jornal compartilhável.

## Execução

Requer [Bun](https://bun.sh/).

```bash
bun run start
```

O servidor utiliza a variável de ambiente `PORT` (padrão `3000`). Ele monta a página em memória a partir de `game.html`; `./build.sh` gera um `index.html` standalone (não versionado) quando for preciso um arquivo estático.

## Arquivos

- `game.html` — todo o jogo (estilos, baralho, mecânicas, telas).
- `server.ts` — servidor Bun.
- `scripts/sim.js` — joga dezenas de partidas aleatórias em Chromium headless (Playwright) e imprime a distribuição de finais e erros de console. Útil para balancear o baralho.

## Hospedagem

Projeto Railway `master-escape`; serviço de origem GitHub `master-game-github`, conectado à branch `main` para deploy automático.

## Estudo de melhorias

O diagnóstico da v1 e o roteiro de lançamento estão em `projects/master-escape/ESTUDO.md` no repositório `yourdress-design-system` (branch `claude/master-game-improvements-ttz4oc`).
