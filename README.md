# SALDO ZERO

Jogo narrativo satírico e fictício. Você é um banqueiro tentando sobreviver ao poder: arraste cartas, segure o caixa e fuja da Operação Saldo Zero. Roda no navegador (mobile first) como PWA: instala na tela inicial e funciona sem internet.

## Execução (web)

Requer [Bun](https://bun.sh/).

```bash
bun run start
```

O servidor monta a página em memória a partir de `game.html`, troca o Google Fonts pelas fontes locais, serve o PWA (manifesto, service worker, ícones), as páginas `/privacidade` e `/suporte` e a API (conta de jogo, loja, ranking). `./build.sh` gera um `index.html` standalone (não versionado) quando for preciso um arquivo estático.

### Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `PORT` | porta (padrão 3000) |
| `SITE_URL` | domínio público, usado nas tags de preview e no retorno do pagamento (ex.: `https://vorkaro.site`) |
| `DATA_DIR` | pasta do banco SQLite (no Railway, o volume em `/data`) |
| `ASAAS_API_KEY` | chave da API do Asaas; sem ela a loja fica desligada |
| `ASAAS_ENV` | `sandbox` (padrão) ou `production` |
| `ASAAS_WEBHOOK_TOKEN` | token configurado no webhook do Asaas (header `asaas-access-token`) |
| `ADMIN_TOKEN` | senha do painel do desenvolvedor em `/admin` (mínimo 16 caracteres) |

### Conta de jogo, loja e ranking

- Conta: apelido único (3 a 16 caracteres, sem acento) + PIN de 4 a 8 números. Sem e-mail. Guarda compras, progresso e favores.
- Favores: moeda das jogadas do Vorkaro e dos recursos no modo livre. Toda partida começa com 2; pacotes de 10 e 30 ficam na conta.
- Loja (Asaas, checkout hospedado com Pix, cartão e boleto): `POST /api/checkout` cria a cobrança, o jogador paga na página do Asaas e volta para `SITE_URL/?pedido=<ref>`; `GET /api/order/:id` confirma; `POST /api/webhook/asaas` recebe os eventos. Compras exigem login.
- Ranking diário: `POST /api/daily` grava o primeiro resultado do dia por conta; `GET /api/daily?day=` lista o top 50.
- Ajuda e suporte: menu Ajuda no jogo (como jogar, indicadores, favores, compras) com formulário de chamado (`POST /api/support`); o jogador vê a resposta no mesmo menu.
- Painel do desenvolvedor em `/admin` (token em `ADMIN_TOKEN`): receita total, do mês e do dia, vendas por produto, lista de cobranças, usuários (bloquear, excluir, dar ou tirar favores, dar ou remover produtos, trocar PIN, renomear, anotação) e chamados com resposta.
- Testes: `scripts/fake-asaas.ts` imita o Asaas; `scripts/e2e.cjs` percorre conta, compra, jogadas, recurso e ranking (Playwright).

## Arquivos

- `game.html` — todo o jogo (estilos, baralho, mecânicas, telas, ponte com o app nativo).
- `server.ts` — servidor Bun.
- `store.ts`, `auth.ts`, `admin.ts`, `db.ts` — loja (Asaas), conta de jogo e suporte, painel do desenvolvedor, banco SQLite.
- `admin.html` — painel do desenvolvedor (servido em `/admin`).
- `scripts/sim.cjs` — joga dezenas de partidas aleatórias em Chromium headless e imprime a distribuição de finais e erros de console.
- `public/` — manifesto do PWA, service worker, ícones, imagem de preview (`og.png`) e fontes.
- App iOS (xtool + StoreKit) guardado na branch `claude/ios-app`, caso a distribuição em loja volte à pauta.

## Hospedagem

Projeto Railway `master-escape`; serviço `master-game-github`, conectado à branch `main` para deploy automático.

## Nomes

- App e marca: **Saldo Zero**.
- Banco do jogo: **Banco Maxter**. Protagonista: Danilo Vorkaro.
- Obra de ficção e sátira: personagens, bancos, veículos e instituições são inventados.
