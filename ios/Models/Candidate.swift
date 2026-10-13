import Foundation

/// Mirrors `Candidate` in worker/src/channel3.ts (plus the agent's `reason`).
struct Candidate: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let brand: String?
    let price: Double
    let compareAt: Double?
    let currency: String
    let store: String
    let availability: String
    let image: String?
    let buyUrl: String
    let features: [String]
    let attributes: [String: String]
    var reason: String?

    var priceText: String { Self.money(price, currency) }
    var compareAtText: String? { compareAt.map { Self.money($0, currency) } }

    static func money(_ v: Double, _ c: String) -> String {
        let f = NumberFormatter(); f.numberStyle = .currency; f.currencyCode = c; f.maximumFractionDigits = 2
        return f.string(from: v as NSNumber) ?? "\(c) \(v)"
    }
}

/// Mirrors `AgentEvent` in worker/src/agent.ts.
enum AgentEvent: Decodable {
    case status(String)
    case candidates([Candidate])
    case message(String)
    case checkout(orderId: String, approveUrl: URL, candidate: Candidate, reason: String)
    case purchased(orderId: String, candidate: Candidate, reason: String)
    case watching(watchId: String, candidate: Candidate, targetPrice: Double)
    case error(String)
    case done

    private enum K: String, CodingKey { case type, text, items, orderId, approveUrl, candidate, reason, watchId, targetPrice }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: K.self)
        switch try c.decode(String.self, forKey: .type) {
        case "status": self = .status(try c.decode(String.self, forKey: .text))
        case "candidates": self = .candidates(try c.decode([Candidate].self, forKey: .items))
        case "message": self = .message(try c.decode(String.self, forKey: .text))
        case "checkout": self = .checkout(orderId: try c.decode(String.self, forKey: .orderId), approveUrl: try c.decode(URL.self, forKey: .approveUrl), candidate: try c.decode(Candidate.self, forKey: .candidate), reason: (try? c.decode(String.self, forKey: .reason)) ?? "")
        case "purchased": self = .purchased(orderId: try c.decode(String.self, forKey: .orderId), candidate: try c.decode(Candidate.self, forKey: .candidate), reason: (try? c.decode(String.self, forKey: .reason)) ?? "")
        case "watching": self = .watching(watchId: try c.decode(String.self, forKey: .watchId), candidate: try c.decode(Candidate.self, forKey: .candidate), targetPrice: try c.decode(Double.self, forKey: .targetPrice))
        case "error": self = .error(try c.decode(String.self, forKey: .text))
        default: self = .done
        }
    }
}
