import Foundation
import AuthenticationServices
import Observation

/// Opens the PayPal approval page and receives the `errand://paypal/return` deep link.
@Observable
final class CheckoutCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    var lastResult: Result? = nil

    struct Result: Equatable {
        let status: String
        let orderID: String?
    }

    struct CreateOrderRequest: Encodable {
        struct Item: Encodable {
            struct Amount: Encodable { let currency_code: String; let value: String }
            let name: String
            let unit_amount: Amount
            let quantity: String
        }
        let items: [Item]
    }

    struct CreateOrderResponse: Decodable {
        let id: String
        let status: String
        let approve: String?
    }

    func pay(name: String, usd: String) async throws {
        let body = CreateOrderRequest(items: [.init(name: name, unit_amount: .init(currency_code: "USD", value: usd), quantity: "1")])
        let res = try await APIClient.shared.post("/paypal/orders", body: body, as: CreateOrderResponse.self)
        guard let approve = res.approve, let url = URL(string: approve) else { throw APIClient.APIError.http(-2, "no approve link") }
        try await open(url)
    }

    @MainActor
    private func open(_ url: URL) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "errand") { [weak self] cb, err in
                if let cb { self?.handle(cb) }
                if let err { cont.resume(throwing: err) } else { cont.resume() }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    func handle(_ url: URL) {
        guard url.scheme == "errand", url.host == "paypal" else { return }
        let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let v = { (k: String) in q.first(where: { $0.name == k })?.value }
        lastResult = .init(status: v("status") ?? "unknown", orderID: v("order"))
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
}
