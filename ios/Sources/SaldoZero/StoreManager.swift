import Foundation
import StoreKit

/// Compras no app com StoreKit 2.
///
/// Regras seguidas para a revisão da Apple (3.1.1 e 3.1.2):
/// - todo conteúdo digital é vendido só por compra no app;
/// - itens não consumíveis podem ser restaurados ("Restaurar compras" na loja do jogo);
/// - a gorjeta (consumível) não desbloqueia jogabilidade, só um selo cosmético;
/// - toda transação verificada é finalizada com `finish()`.
@MainActor
final class StoreManager: ObservableObject {
    @Published private(set) var products: [Product] = []
    @Published private(set) var entitlements: Set<String> = []

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    await self.refreshEntitlements()
                }
            }
        }
        Task { await refreshEntitlements() }
    }

    deinit { updatesTask?.cancel() }

    // MARK: Produtos

    /// Carrega os produtos no App Store Connect. Retorna o formato que `game.html` espera em `onProducts`.
    func loadProducts() async -> [[String: String]] {
        if products.isEmpty {
            products = (try? await Product.products(for: AppConfig.productIDs)) ?? []
        }
        return products.map {
            ["id": $0.id, "title": $0.displayName, "price": $0.displayPrice, "description": $0.description]
        }
    }

    // MARK: Direitos

    @discardableResult
    func refreshEntitlements() async -> [String] {
        var ids = Set<String>()
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil {
                ids.insert(transaction.productID)
            }
        }
        entitlements = ids
        return Array(ids).sorted()
    }

    // MARK: Compra

    struct PurchaseOutcome {
        var ok: Bool
        var error: String?
    }

    func buy(id: String) async -> PurchaseOutcome {
        if products.isEmpty { _ = await loadProducts() }
        guard let product = products.first(where: { $0.id == id }) else {
            return PurchaseOutcome(ok: false, error: "produto indisponível")
        }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transaction.finish()
                    if !AppConfig.consumableIDs.contains(id) {
                        entitlements.insert(id)
                    }
                    return PurchaseOutcome(ok: true)
                case .unverified:
                    return PurchaseOutcome(ok: false, error: "não foi possível verificar a compra")
                }
            case .userCancelled:
                return PurchaseOutcome(ok: false, error: "cancelled")
            case .pending:
                return PurchaseOutcome(ok: false, error: "compra pendente de aprovação")
            @unknown default:
                return PurchaseOutcome(ok: false, error: "resultado desconhecido")
            }
        } catch {
            return PurchaseOutcome(ok: false, error: error.localizedDescription)
        }
    }

    // MARK: Restaurar

    func restore() async -> Int {
        try? await AppStore.sync()
        let ids = await refreshEntitlements()
        return ids.count
    }
}
