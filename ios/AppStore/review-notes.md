# Notas para o revisor (App Review Notes)

Cole o texto abaixo no campo "Notas" da versão, em inglês (o revisor normalmente não lê português).

---

Saldo Zero is a satirical, entirely fictional card game. The player is a fictional banker trying to stay out of trouble: every card is a message from a fictional senator, journalist, regulator, family member, etc., and the player swipes left or right to answer. Four stats (cash, power, image, investigation "radar") move with each choice; reaching 0 or 100 on any of them ends the run with one of 10 endings.

Content notes
- All characters, banks, media outlets and institutions are invented. Names are deliberately silly (e.g. "Banco Maxter", "Rede Globa"). A fiction/satire disclaimer is shown on the start screen and in the description. No real person is depicted, named or pictured, and no real-world claims are made.
- Humor is mild political satire suitable for 12+. No violence, sexual content, gambling or substance use.

How to test
- No account or login is required. The full game is free and works offline.
- Tap "Jogar o diário" (daily challenge) or "Modo livre" (free mode). Drag the card left/right, or tap the two buttons under the card. The run ends after roughly 20 decisions.
- The end screen shows a newspaper front page; "Copiar resultado" copies the share text, "Compartilhar" opens the iOS share sheet.

In-app purchases (StoreKit 2, sandbox-ready)
- Open "Loja · baralhos e capas" on the start screen.
- com.saldozero.deck.eleicao (non-consumable): adds 12 extra cards to free mode. After purchase, start a free-mode run; cards from the "election" deck can appear.
- com.saldozero.capas (non-consumable): unlocks 3 alternative newspaper mastheads on the end screen (chips above the front page).
- com.saldozero.apoio (consumable): optional tip; grants only a cosmetic "Apoiador" badge.
- "Restaurar compras" calls AppStore.sync() and refreshes entitlements.

Technical notes
- The game UI is HTML/CSS/JS bundled inside the app and served through an internal URL scheme; it never loads remote web content. Native features: StoreKit 2, share sheet, haptics, offline storage.
- Encryption: only standard HTTPS, exempt (ITSAppUsesNonExemptEncryption = false).

Contact: contato@vorkaro.site
