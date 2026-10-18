import SwiftUI
import WebKit
import UIKit

/// Tela única do app: o jogo em um WKWebView de tela cheia.
struct GameScreen: View {
    @EnvironmentObject private var store: StoreManager

    var body: some View {
        GameWebView(store: store)
            .ignoresSafeArea()
    }
}

struct GameWebView: UIViewRepresentable {
    let store: StoreManager

    func makeCoordinator() -> Coordinator { Coordinator(store: store) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: AppConfig.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "native")
        controller.addUserScript(WKUserScript(source: Self.bootstrapScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.05, green: 0.063, blue: 0.125, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        context.coordinator.webView = webView

        let url = URL(string: "\(AppConfig.scheme)://\(AppConfig.host)/\(AppConfig.entryPoint)")!
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// Injetado antes do HTML: avisa o jogo que está dentro do app e registra as fontes locais
    /// (assim o jogo funciona off-line sem depender do Google Fonts).
    static var bootstrapScript: String {
        let base = "\(AppConfig.scheme)://\(AppConfig.host)"
        return """
        window.MasterEscapeNative = {
          platform: 'ios',
          store: true,
          shareURL: '\(AppConfig.shareURL)',
          safeNames: \(AppConfig.safeNames ? "true" : "false")
        };
        (function () {
          var css = "@font-face{font-family:'Anton';font-style:normal;font-weight:400;font-display:swap;src:url('\(base)/fonts/Anton.woff2') format('woff2')}" +
            "@font-face{font-family:'Rubik';font-style:normal;font-weight:300 900;font-display:swap;src:url('\(base)/fonts/Rubik.woff2') format('woff2')}" +
            "@font-face{font-family:'Rubik';font-style:italic;font-weight:300 900;font-display:swap;src:url('\(base)/fonts/Rubik-Italic.woff2') format('woff2')}" +
            "html{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}";
          var style = document.createElement('style');
          style.textContent = css;
          document.documentElement.appendChild(style);
        })();
        """
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        let store: StoreManager
        weak var webView: WKWebView?

        init(store: StoreManager) { self.store = store }

        // Mensagens vindas do jogo: window.webkit.messageHandlers.native.postMessage({...})
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "haptic":
                Haptics.play(style: body["style"] as? String ?? "medium")
            case "share":
                share(text: body["text"] as? String ?? "")
            case "store":
                handleStore(action: body["action"] as? String ?? "", id: body["id"] as? String)
            case "openURL":
                if let s = body["url"] as? String, let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") {
                    UIApplication.shared.open(url)
                }
            default:
                break
            }
        }

        private func handleStore(action: String, id: String?) {
            Task { @MainActor in
                switch action {
                case "products":
                    let list = await store.loadProducts()
                    call("onProducts", list)
                    let ids = await store.refreshEntitlements()
                    call("onEntitlements", ids)
                case "entitlements":
                    let ids = await store.refreshEntitlements()
                    call("onEntitlements", ids)
                case "buy":
                    guard let id else { return }
                    let outcome = await store.buy(id: id)
                    var payload: [String: Any] = ["id": id, "ok": outcome.ok]
                    if let error = outcome.error { payload["error"] = error }
                    call("onPurchase", payload)
                    if outcome.ok { call("onEntitlements", await store.refreshEntitlements()) }
                case "restore":
                    let count = await store.restore()
                    call("onRestore", ["count": count])
                    call("onEntitlements", Array(store.entitlements).sorted())
                default:
                    break
                }
            }
        }

        /// Chama window.MasterEscapeBridge.<fn>(payload) no jogo.
        @MainActor
        private func call(_ fn: String, _ payload: Any) {
            guard let webView,
                  let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.MasterEscapeBridge && window.MasterEscapeBridge.\(fn)(\(json));", completionHandler: nil)
        }

        private func share(text: String) {
            guard !text.isEmpty, let presenter = Self.topViewController() else { return }
            let activity = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            if let pop = activity.popoverPresentationController, let view = presenter.view {
                pop.sourceView = view
                pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
            }
            presenter.present(activity, animated: true)
        }

        private static func topViewController() -> UIViewController? {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
            var top = window?.rootViewController
            while let presented = top?.presentedViewController { top = presented }
            return top
        }

        // Links externos abrem no Safari; o jogo em si nunca navega para fora.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
            if url.scheme == AppConfig.scheme { decisionHandler(.allow); return }
            if ["http", "https", "mailto"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        // Sem janelas novas: qualquer target=_blank abre no Safari.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url { UIApplication.shared.open(url) }
            return nil
        }
    }
}

enum Haptics {
    static func play(style: String) {
        let generator: UIImpactFeedbackGenerator
        switch style {
        case "light": generator = UIImpactFeedbackGenerator(style: .light)
        case "heavy": generator = UIImpactFeedbackGenerator(style: .heavy)
        default: generator = UIImpactFeedbackGenerator(style: .medium)
        }
        generator.prepare()
        generator.impactOccurred()
    }
}
