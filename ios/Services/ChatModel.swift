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
    private let userId: String = {
        let k = "errand.userId"
        if let v = UserDefaults.standard.string(forKey: k) { return v }
        let v = UUID().uuidString; UserDefaults.standard.set(v, forKey: k); return v
    }()

    static let suggestions = [
        "Wired mechanical keyboard, blue switches, under $120",
        "Running shoes for wide feet, size 10, under $90",
        "A 1 L insulated water bottle that fits a car cup holder",
    ]

    func send(_ text: String, checkout: CheckoutCoordinator) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !busy else { return }
        items.append(.user(text: t))
        Task { await run(checkout: checkout) }
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
            case let .assistant(_, t): return .init(role: "assistant", content: t)
            case let .receipt(_, c, id, st): return .init(role: "assistant", content: "Order \(id) for \(c.title) is \(st).")
            default: return nil
            }
        }
    }

    private func run(checkout: CheckoutCoordinator) async {
        busy = true; status = "Thinking…"
        defer { busy = false; status = nil }
        let req = AgentClient.Request(messages: history(), candidates: Array(shown.values), userId: userId)
        do {
            for try await ev in AgentClient.stream(req) {
                switch ev {
                case let .status(s): status = s
                case let .candidates(list):
                    for c in list { shown[c.id] = c }
                    items.append(.candidates(items: list))
                case let .message(t): items.append(.assistant(text: t))
                case let .error(t): items.append(.error(text: t))
                case let .checkout(orderId, url, c):
                    status = "Waiting for PayPal…"
                    pendingCheckout = (orderId, c)
                    do {
                        try await checkout.open(url)
                        let r = checkout.lastResult
                        items.append(.receipt(candidate: c, orderId: r?.orderID ?? orderId, status: r?.status ?? "UNKNOWN"))
                    } catch {
                        items.append(.error(text: "PayPal checkout was cancelled."))
                    }
                    pendingCheckout = nil
                case .done: break
                }
            }
        } catch {
            items.append(.error(text: error.localizedDescription))
        }
    }
}
