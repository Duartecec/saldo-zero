# Saldo Zero — app iOS (xtool)

App nativo para a App Store construído com [xtool](https://github.com/xtool-org/xtool): um pacote SwiftPM que o xtool transforma em `.app`/`.ipa`, sem Xcode no dia a dia (Linux, WSL ou macOS).

## Estrutura

```
ios/
  Package.swift            pacote SwiftPM (iOS 17+, um produto: SaldoZero)
  xtool.yml                bundle ID, Info.plist e ícone
  Support/Info.plist       chaves extras (nome, orientação, criptografia, categoria)
  Resources/AppIcon.png    ícone 1024×1024
  sync-game.sh             copia ../game.html para dentro do bundle
  Sources/SaldoZero/
    SaldoZeroApp.swift     entrada SwiftUI
    AppConfig.swift        esquema interno, link de compartilhamento, safeNames, IDs dos produtos
    GameScreen.swift       WKWebView de tela cheia + ponte JS (loja, compartilhar, háptica)
    BundleSchemeHandler.swift  serve Resources/web pelo esquema saldozero://
    StoreManager.swift     StoreKit 2 (produtos, compra, direitos, restaurar)
    Resources/web/         game.html sincronizado + fontes locais
  AppStore/                guia de publicação, ficha, notas ao revisor, produtos, Products.storekit
```

## Como o jogo conversa com o app

O app injeta `window.MasterEscapeNative = {platform:'ios', store:true, shareURL, safeNames}` antes do HTML carregar. Com isso o `game.html` mostra o botão **Loja**, usa a folha de compartilhamento nativa e a háptica do iPhone. As mensagens vão por `window.webkit.messageHandlers.native.postMessage({type, ...})` e as respostas voltam por `window.MasterEscapeBridge.onProducts / onEntitlements / onPurchase / onRestore`.

No navegador comum nada disso existe e o jogo ignora a loja.

## Rodar

```bash
xtool setup            # uma vez: login (API Key) + SDK a partir do Xcode.xip
./sync-game.sh
xtool dev              # compila, assina e instala no iPhone conectado por USB
```

Publicação na App Store: veja `AppStore/README.md`.
