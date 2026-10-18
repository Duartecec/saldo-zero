# Saldo Zero — guia de publicação na App Store

Checklist completo, na ordem em que as coisas precisam acontecer. Tudo que está marcado com **[você]** depende de conta, senha ou decisão sua; o resto já está no repositório.

## 0. O que já está pronto no código

- App nativo em `ios/` (SwiftPM + xtool), carregando o jogo off-line por esquema interno.
- Compras no app com StoreKit 2: 2 não consumíveis + 1 consumível, com "Restaurar compras".
- Páginas de privacidade e suporte servidas pelo site (`/privacidade`, `/suporte`).
- Ícone 1024×1024 sem transparência (`ios/Resources/AppIcon.png`).
- `ITSAppUsesNonExemptEncryption = false` (dispensa o formulário de criptografia a cada build).
- Textos da ficha (`listing.md`), notas para o revisor (`review-notes.md`) e produtos (`iap.md`).

## 1. Conta e identificadores [você]

1. Inscrição no [Apple Developer Program](https://developer.apple.com/programs/enroll/) (US$ 99/ano). Pessoa física ou empresa; como empresa precisa de D-U-N-S.
2. Em App Store Connect → Usuários e Acesso → Integrações → Chaves da API: crie uma **Team Key** com papel **App Manager**. Guarde o `.p8`, o Key ID e o Issuer ID. O xtool usa essa chave no `xtool setup` (modo "API Key").
3. O bundle ID do app é `com.saldozero.app` (em `ios/xtool.yml`). O xtool registra o App ID sozinho na primeira build assinada. Se preferir outro, troque antes da primeira build.

## 2. Build local com xtool (Linux ou macOS)

```bash
# Linux: siga https://xtool.sh/documentation/xtooldocs/installation-linux
#   precisa de Swift 6.4, usbmuxd e do Xcode.xip baixado da Apple.
xtool setup                       # login com a API Key + gera o SDK do Xcode.xip
cd ios
./sync-game.sh                    # copia o game.html da raiz para o bundle
xtool dev                         # compila, assina com perfil de desenvolvimento e instala no iPhone via USB
xtool dev build -c release --ipa  # gera xtool/SaldoZero.ipa (não assinado para distribuição)
```

Para testar compras no aparelho, crie um **Sandbox Tester** em App Store Connect → Usuários e Acesso → Sandbox e entre com ele em Ajustes → App Store → Conta Sandbox.

## 3. Build para a App Store

O xtool assina com perfis de **desenvolvimento**. O envio à App Store exige assinatura de **distribuição** e upload pelo Transporter, `altool` ou Xcode, que só rodam no macOS. Dois caminhos:

**A. Mac (próprio ou alugado)**
```bash
brew install xtool-org/tap/xtool
cd ios && ./sync-game.sh
xtool dev generate-xcode-project       # gera xtool/.xtool-tmp/SaldoZero.xcodeproj
open xtool/.xtool-tmp/*.xcodeproj      # Product → Archive → Distribute → App Store Connect
```

**B. GitHub Actions (runner macOS)**
O workflow `.github/workflows/ios-testflight.yml` faz exatamente isso. Ele precisa destes segredos no repositório **[você]**: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (conteúdo do .p8 em base64), `APPLE_TEAM_ID`. Rode manualmente em Actions → iOS TestFlight.

## 4. Ficha do app no App Store Connect [você]

1. Meus Apps → **+** → Novo app: plataforma iOS, nome **Saldo Zero**, idioma principal Português (Brasil), bundle ID `com.saldozero.app`, SKU `saldozero-ios`.
2. Cole os textos de `listing.md` (nome, subtítulo, descrição, palavras-chave, texto promocional).
3. URLs: suporte `https://<seu-domínio>/suporte`, privacidade `https://<seu-domínio>/privacidade` (hoje o Railway responde em `master-game-github-production.up.railway.app`).
4. Categoria principal **Jogos › Simulação**, secundária **Entretenimento**.
5. Capturas de tela: iPhone 6,9" (1320×2868) e 6,5" (1284×2778), opcionalmente iPad 13" (2064×2752). Use as telas: carta do ZapFone, status em perigo, capa de jornal final, coleção de finais, loja. Sem molduras de aparelho obrigatórias.
6. Classificação etária: responda conforme `listing.md` (resultado esperado: **12+**).
7. Privacidade do app: **Dados não coletados**. Confirme que não usa IDFA.
8. Compras no app: crie os 3 produtos de `iap.md` com os IDs exatos, preencha nome, descrição e a captura de tela de revisão de cada um, e anexe-os à versão 1.0.0 (seção "Compras no app" da versão).
9. Acordo de Apps Pagos: em Acordos, Impostos e Finanças, aceite o contrato de apps pagos e preencha dados bancários e fiscais. Sem isso, produtos não ficam "Pronto para envio".
10. Notas para o revisor: cole `review-notes.md`.
11. Envie o build (TestFlight → selecione o build na versão) e clique em **Enviar para revisão**.

## 5. Por que isto deve passar na revisão

| Diretriz | Como o app atende |
|---|---|
| 1.1.1 conteúdo ofensivo / 1.1.4 | Sátira ficcional declarada na tela inicial, nas notas e na descrição; personagens, bancos e veículos inventados; nenhum fato apresentado como real; sem imagens de pessoas reais. |
| 2.1 completude | Sem placeholders, sem "em breve", sem login. Loja funciona em sandbox. |
| 2.3 metadados precisos | Capturas são do app real; descrição não promete o que não existe. |
| 2.5.6 / 4.2 funcionalidade mínima | Não é um site empacotado: conteúdo embarcado e off-line, háptica nativa, compartilhamento nativo, compras nativas, desafio diário, 10 finais. |
| 3.1.1 compras no app | Todo conteúdo digital via StoreKit; sem links para pagamento externo; "Restaurar compras" visível. |
| 3.1.2 / 3.2.1(vii) gorjeta | O consumível é gorjeta opcional; não trava jogabilidade. |
| 4.0 design | Orientação travada, safe areas respeitadas, modo escuro. |
| 5.1.1 privacidade | Política publicada; nenhum dado pessoal coletado; sem rastreamento. |
| 5.2.1 propriedade intelectual | Nomes de banco, veículos e políticos são fictícios e satíricos. |

## 6. Se a Apple rejeitar

- **1.1.1 (conteúdo sobre pessoas identificáveis):** mude `AppConfig.safeNames` para `true` em `ios/Sources/SaldoZero/AppConfig.swift`, suba o build de novo e responda no Resolution Center dizendo que todos os nomes foram alterados. O jogo troca as paródias por nomes neutros sem outra mudança de código.
- **2.1 (não conseguiram testar compras):** confira o acordo de apps pagos e se os produtos estão "Pronto para envio" e anexados à versão.
- **4.2 (funcionalidade mínima):** responda apontando o funcionamento off-line, a háptica, a loja nativa e o desafio diário; anexe um vídeo curto.
