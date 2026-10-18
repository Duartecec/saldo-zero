import Foundation

/// Ajustes de build do app. Tudo que a revisão da Apple pode pedir para mudar fica aqui.
enum AppConfig {
    /// Esquema interno usado para servir o jogo do bundle (funciona off-line).
    static let scheme = "saldozero"
    static let host = "app"
    static let entryPoint = "game.html"

    /// Link que entra no texto de compartilhamento. Troque pelo domínio curto quando existir.
    static let shareURL = "https://master-game-github-production.up.railway.app"

    /// Plano B para a revisão: `true` troca as paródias por nomes inteiramente fictícios
    /// (Vorkaro → Valente, Lulo → Guimarães, Rede Globa → TV Nacional...).
    /// Decisão atual: paródias ligadas desde a primeira versão.
    static let safeNames = false

    /// Identificadores dos produtos no App Store Connect. Precisam ser idênticos aos de `game.html`.
    static let productIDs = [
        "com.saldozero.deck.eleicao",   // não consumível: Baralho Ano Eleitoral
        "com.saldozero.capas",          // não consumível: Pacote de capas
        "com.saldozero.apoio",          // consumível: Cafezinho do banqueiro (gorjeta)
    ]
    static let consumableIDs: Set<String> = ["com.saldozero.apoio"]
}
