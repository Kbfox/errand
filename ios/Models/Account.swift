import Foundation

struct Rules: Codable, Equatable {
    var auto_under_usd: Double
    var monthly_cap_usd: Double
}

struct Me: Codable {
    let userId: String
    let walletSaved: Bool
    let rules: Rules
    let monthSpent: Double
}

struct Order: Codable, Identifiable, Hashable {
    let id: String
    let candidate: Candidate
    let amount: Double
    let currency: String
    let status: String
    let mode: String            // approved | auto | watch
    let capture_id: String?
    let tracking_number: String?
    let created_at: String

    var amountText: String { Candidate.money(amount, currency) }
    var modeLabel: String {
        switch mode {
        case "auto": return "Bought automatically"
        case "watch": return "Bought on price drop"
        default: return "Approved in PayPal"
        }
    }
}

struct Watch: Codable, Identifiable, Hashable {
    let id: String
    let candidate: Candidate
    let target_price: Double
    let last_price: Double?
    let status: String          // active | bought | needs_approval | cancelled
    let order_id: String?
    let created_at: String
}
