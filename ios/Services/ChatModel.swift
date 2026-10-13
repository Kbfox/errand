import Foundation
import Observation

@MainActor
@Observable
final class ChatModel {
    var items: [ChatItem] = []
    var status: String? = nil
    var busy = false
    var pendingCheckout: (orderId: String, candidate: Candidate)? = nil

    private var shown: [String: Candidate] = [:]   // candidates the user has seen, keyed by id
    private let userId = APIClient.userId

    static let suggestions = [
        "Wired mechanical keyboard, blue switches, under $120",
        "Running shoes for wide feet, size 10, under $90",
        "A 1 L insulated water bottle that fits a car cup holder",
    ]
    static let watchHint = "Tip: say \"buy it if it drops under $60\" and Gofer will watch the price."

    func send(_ text: String, checkout: CheckoutCoordinator) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !busy else { return }
        items.append(.user(text: t))
        Task { await run(checkout: checkout) }
    }

    func sendPhoto(_ jpeg: Data, caption: String, checkout: CheckoutCoordinator) {
        guard !busy else { return }
        items.append(.photo(image: jpeg, text: caption.isEmpty ? "Find this" : caption))
        Task { await run(checkout: checkout, imageBase64: jpeg.base64EncodedString()) }
    }

    func pick(_ c: Candidate, checkout: CheckoutCoordinator) {
        guard !busy else { return }
        items.append(.user(text: "I'll take the \(c.brand.map { "\($0) " } ?? "")\(c.title) for \(c.priceText). (id \(c.id))"))
        Task { await run(checkout: checkout) }
    }

    private func history() -> [AgentClient.Request.Message] {
        items.compactMap {
            switch $0 {
            case let .user(_, t): return .init(role: "user", content: t)
            case let .photo(_, _, t): return .init(role: "user", content: t + " (photo attached)")
            case let .assistant(_, t): return .init(role: "assistant", content: t)
            case let .receipt(_, c, id, st, auto, _): return .init(role: "assistant", content: "\(auto ? "Bought automatically" : "Order") \(id) for \(c.title): \(st).")
            case let .watching(_, c, t): return .init(role: "assistant", content: "Watching \(c.title); will buy at or under $\(t).")
            default: return nil
            }
        }
    }

    private func run(checkout: CheckoutCoordinator, imageBase64: String? = nil) async {
        busy = true; status = "Thinking…"
        defer { busy = false; status = nil }
        let req = AgentClient.Request(messages: history(), candidates: Array(shown.values), userId: userId, imageBase64: imageBase64)
        do {
            for try await ev in AgentClient.stream(req) {
                switch ev {
                case let .status(s): status = s
                case let .candidates(list):
                    for c in list { shown[c.id] = c }
                    items.append(.candidates(items: list))
                case let .message(t): items.append(.assistant(text: t))
                case let .error(t): items.append(.error(text: t))
                case let .checkout(orderId, url, c, reason):
                    status = "Waiting for PayPal…"
                    pendingCheckout = (orderId, c)
                    do {
                        try await checkout.open(url)
                        let r = checkout.lastResult
                        items.append(.receipt(candidate: c, orderId: r?.orderID ?? orderId, status: r?.status ?? "UNKNOWN", auto: false, reason: reason))
                    } catch {
                        items.append(.error(text: "PayPal checkout was cancelled."))
                    }
                    pendingCheckout = nil
                case let .purchased(orderId, c, reason):
                    items.append(.receipt(candidate: c, orderId: orderId, status: "COMPLETED", auto: true, reason: reason))
                case let .watching(_, c, target):
                    items.append(.watching(candidate: c, targetPrice: target))
                case .done: break
                }
            }
        } catch {
            items.append(.error(text: error.localizedDescription))
        }
    }
}
