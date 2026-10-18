import SwiftUI

/// Saldo Zero — app iOS.
///
/// O jogo inteiro vive em `Resources/web/game.html` (a mesma fonte usada no site).
/// Esta camada nativa cuida do que a web não faz dentro de um app da App Store:
/// compras via StoreKit 2, folha de compartilhamento, háptica e carregamento
/// off-line pelo esquema `saldozero://`.
@main
struct SaldoZeroApp: App {
    @StateObject private var store = StoreManager()

    var body: some Scene {
        WindowGroup {
            GameScreen()
                .environmentObject(store)
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
                .background(Color(red: 0.05, green: 0.063, blue: 0.125))
        }
    }
}
