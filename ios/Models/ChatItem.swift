import Foundation

enum ChatItem: Identifiable, Hashable {
    case user(id: UUID = UUID(), text: String)
    case photo(id: UUID = UUID(), image: Data, text: String)
    case assistant(id: UUID = UUID(), text: String)
    case candidates(id: UUID = UUID(), items: [Candidate])
    case receipt(id: UUID = UUID(), candidate: Candidate, orderId: String, status: String, auto: Bool, reason: String)
    case watching(id: UUID = UUID(), candidate: Candidate, targetPrice: Double)
    case error(id: UUID = UUID(), text: String)

    var id: UUID {
        switch self {
        case let .user(id, _), let .photo(id, _, _), let .assistant(id, _), let .candidates(id, _), let .receipt(id, _, _, _, _, _), let .watching(id, _, _), let .error(id, _): return id
        }
    }
}
