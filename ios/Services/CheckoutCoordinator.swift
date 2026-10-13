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

    @MainActor
    func open(_ url: URL) async throws {
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
