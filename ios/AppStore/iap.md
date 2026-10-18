# Compras no app — produtos

Crie os três produtos em App Store Connect → Saldo Zero → Compras no app, com estes IDs **exatamente** (o jogo e o app referenciam por ID). Todos precisam de nome e descrição em Português (Brasil) e uma captura de tela de revisão (pode ser a tela da loja do jogo).

| ID do produto | Tipo | Nome de referência | Preço sugerido (nível) | Nome exibido | Descrição exibida |
|---|---|---|---|---|---|
| `com.saldozero.deck.eleicao` | Não consumível | Baralho Ano Eleitoral | R$ 9,90 (Tier 2) | Baralho Ano Eleitoral | 12 cartas extras no modo livre: debates, pesquisas, urnas e promessas. |
| `com.saldozero.capas` | Não consumível | Pacote de capas | R$ 4,90 (Tier 1) | Pacote de capas | Três jornais alternativos para estampar a sua capa final. |
| `com.saldozero.apoio` | Consumível | Cafezinho do banqueiro | R$ 9,90 (Tier 2) | Cafezinho do banqueiro | Apoie o jogo e ganhe o selo de apoiador na capa. |

Observações
- O baralho vale só no **modo livre**, para que o desafio diário continue igual para todo mundo. Isso está dito na descrição do produto e na loja.
- O consumível é uma gorjeta: não desbloqueia jogabilidade (diretriz 3.2.1(vii)). O jogo marca `apoiador` localmente e mostra o selo "☕ Apoiador" na capa.
- Para alterar preços ou nomes, mude também `PRODUCTS` em `game.html` (nomes e descrições da loja são renderizados pelo jogo; o preço vem do StoreKit).
- Arquivo de configuração para testes locais no simulador/Xcode: `Products.storekit` nesta pasta (Xcode → Scheme → Run → Options → StoreKit Configuration).
