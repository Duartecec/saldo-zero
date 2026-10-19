# Direção de arte: cenas de fundo da tela inicial (Saldo Zero)

Projeto `saldo-zero` (EBENIX TECNOLOGIA INOVA SIMPLES (I.S.), CNPJ 68.730.443/0001-71). Marca própria, separada de RHone, AssinAPI, Arremate Score, PERPlex, YourDress e YourKids. Direção do DESIGNER, execução do EDITOR. Estado: upgrade visual aprovado pelo dono em 19/10/2026; as cenas em si passam por QA do DESIGNER antes de entrar em produção.

## Conceito (3 frases)
A tela inicial é a primeira página de um tabloide em edição extra: por trás do título, a cidade e os bastidores da história passam desfocados, como fotos de jornal em baixa resolução. Nada é foto: tudo é ilustração editorial chapada, com textura de meio-tom e papel. O fundo cria clima de plantão sem competir com o texto do menu.

## Como a tela usa as cenas
- Container: `<div id="homeScenes" aria-hidden="true"></div>`, `position:absolute; inset:0`, atrás de tudo na tela inicial.
- O CSS aplica `filter: blur(6px) brightness(.55) saturate(.9)` e um véu de tinta por cima (vinheta + ink). **Entregue as cenas nítidas**; o desfoque e o escurecimento são feitos na página. Não embuta blur nem escurecimento.
- A tela cobre de 360x640 a 1440x900. Composição pensada para recorte `object-fit: cover` em 9:16 e 16:9: **elementos de interesse no terço central e superior-central; margens de 12% sem informação**.
- Sem texto legível dentro das cenas (letras viram tarja: barras cinza). Título e marca são da página.
- Fallback sem cenas: a página já tem fundo estático (ink + silhueta de cidade + meio-tom). As cenas entram por cima com fade de 1,2 s quando carregam.

## Paleta (somente estas; tokens de `docs/DESIGN-SYSTEM.md`)
| Papel | Hex | Uso |
| --- | --- | --- |
| ink | `#101114` | fundo, sombras, silhuetas |
| ink-2 | `#1c1e24` | planos intermediários, prédios ao fundo |
| paper | `#f1e9d2` | luz, janelas acesas, papel, balões de mensagem |
| paper-2 | `#e5dac0` | meios-tons claros |
| vermelho plantão | `#d9202f` | acento único por cena (sirene, carimbo, luz de busca) |
| dourado | `#e8b23a` | acento raro (moeda, janela, lustre); no máximo 5% da área |

Regra: 3 a 4 cores por cena, chapadas. Sem gradientes de cor (exceto vinheta de ink de 0 a 60% de opacidade). Sem roxo, ciano ou neon. Sem glow.

## Estilo
Ilustração editorial chapada (flat), contorno ausente ou de 2 px em ink, formas geométricas primárias com cantos levemente irregulares (como clichê de impressão). Textura: **meio-tom** (pontos de 3 a 5 px a 45 graus, 20 a 35% de cobertura nas sombras) e **grão de papel** (ruído fino a 6 a 8% de opacidade) sobre toda a cena. Leve **desregistro de impressão**: camada vermelha deslocada 2 a 3 px da forma base, em apenas 1 elemento por cena.

## Proibições
- Pessoas reais, rostos reconhecíveis, caricaturas de políticos ou de qualquer pessoa existente. Figuras humanas só como **silhueta anônima** (sem traços faciais, sem roupa identificável).
- Logos, marcas, bandeiras, brasões, placas e nomes de jornais ou bancos reais. O banco do jogo é fictício (Maxter): se aparecer letreiro, use somente barras abstratas.
- Fotos, vídeo captado, texturas fotográficas, IA com rostos.
- Emojis, glow, lens flare, partículas brilhantes, transições glitch, gradientes genéricos azul-roxo.
- Flashes: nenhum elemento pode piscar mais de 2 vezes por segundo, nem ter mudança de luminância total maior que 20% entre quadros consecutivos (WCAG 2.3.1).

## Cenas (6)
Todas em loop perfeito (último quadro = primeiro), 8 s cada, câmera quase parada (o movimento está no cenário).

| # | Arquivo base | Cena | Elemento vermelho | Movimento (amplitude, curva) |
| --- | --- | --- | --- | --- |
| 1 | `esplanada` | Esplanada genérica ao entardecer: duas torres, uma cúpula e uma tigela estilizadas, céu em faixas chapadas, bandeiras sem emblema. | luz de aviso no topo da torre | nuvens em faixa derivam 3% da largura em 8 s, linear; luz pulsa a 0,5 Hz (ease-in-out) |
| 2 | `helicoptero` | Torre do banco (barras como letreiro) à noite, helicóptero em silhueta e cone de holofote cruzando a fachada. | cone de luz de busca | cone varre 25% da largura em 8 s, `cubic-bezier(.45,0,.55,1)`; hélice como borrão fixo (sem piscar) |
| 3 | `mala` | Mesa de madeira (plano de cima), mala aberta com maços de papel, lâmpada pendente oscilando, sombras de mãos anônimas ao fundo. | fita do maço | lâmpada balança ±4° em 4 s (ease-in-out); a sombra acompanha |
| 4 | `zapfone` | Celular em silhueta (sem marca) com balões de mensagem subindo e se dissolvendo, barras no lugar do texto. | selo de "novas" | balões sobem 18% da altura em 8 s, ease-out, escalonados em 0,8 s |
| 5 | `rotativa` | Rotativa de jornal: rolos, tiras de papel correndo, pilha de capas "EXTRA" com tarja ilegível. | faixa PLANTÃO na pilha | papel corre 40% da altura em 8 s, linear; a pilha ganha uma capa a cada 2 s |
| 6 | `jatinho` | Pista ao amanhecer, jatinho em silhueta decolando na diagonal, torre de controle genérica. | luzes de pista | jato percorre 55% da largura em 8 s, ease-in (acelera); luzes alternam a 1 Hz |

A faixa vermelha nunca ocupa mais de 8% da área. Ordem de rotação sugerida: 1, 4, 2, 5, 3, 6.

## Entrega técnica
- Local: `public/scenes/`. Nomes versionados e imutáveis: `<arquivo-base>-v1.mp4`, `<arquivo-base>-v1.jpg` (pôster, quadro 1). O servidor usa cache imutável de 1 ano: ao revisar uma cena, suba `-v2`.
- Vídeo: MP4 H.264 Main, **sem áudio**, 720x1280 (9:16), 24 a 30 fps, 8 s, até **700 KB** por cena (alvo total <= 4 MB), `faststart`. Se preferir, entregue também 1280x720 com sufixo `-wide`. Alternativa aceita: WebP animado ou SVG/CSS animado, se pesar menos.
- Pôster JPG 720x1280 (qualidade 78) para o primeiro quadro e para `prefers-reduced-motion`.
- O `server.ts` serve `video/mp4`, `webm`, `webp`, `jpg` e responde a `Range` (Safari exige).
- Snippet de integração em `docs/design/home-scenes.html`: preenche `#homeScenes` com `<video class="scene" muted loop playsinline preload="metadata" poster=...>`. O CSS da página já define `#homeScenes .scene` (`position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 1.2s`) e `.scene.on{opacity:1}`. Só uma cena toca por vez; troca a cada 8 s; sem autoplay se `prefers-reduced-motion: reduce` ou `navigator.connection.saveData` (mostrar só o pôster da cena 1).
- Pausar quando a tela inicial não está visível (`document.hidden` ou partida em andamento).

## Motion tokens
`--ease-scene: cubic-bezier(.45,0,.55,1)` (balanço), `--ease-out: cubic-bezier(.16,1,.3,1)`, fade entre cenas 1200 ms. Nenhuma animação de UI sincronizada com as cenas.

## QA do DESIGNER (após o render)
Checar: paleta (só tokens), ausência de rosto/logo/texto legível, loop sem salto, flashes dentro do limite, legibilidade do título e dos botões sobre as cenas desfocadas em 360x640 e 1440x900, peso total, pôster coerente. Resultado: lista priorizada de correções. O DESIGNER não afirma ter visto um render que não recebeu.
