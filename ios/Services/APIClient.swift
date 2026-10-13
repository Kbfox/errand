import Foundation

struct APIClient {
    static let shared = APIClient()

    static let userId: String = {
        let k = "gofer.userId"
        if let v = UserDefaults.standard.string(forKey: k) { return v }
        let v = UUID().uuidString; UserDefaults.standard.set(v, forKey: k); return v
    }()

    func request(_ path: String, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: AppConfig.apiBaseURL.appending(path: path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(AppConfig.appKey, forHTTPHeaderField: "x-app-key")
        req.setValue(Self.userId, forHTTPHeaderField: "x-user-id")
        return req
    }

    func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try await send(request(path), as: type)
    }

    func post<T: Decodable>(_ path: String, body: (some Encodable)? = Optional<String>.none, as type: T.Type) async throws -> T {
        var req = request(path, method: "POST")
        req.httpBody = try body.map { try JSONEncoder().encode($0) } ?? Data("{}".utf8)
        return try await send(req, as: type)
    }

    func put<T: Decodable>(_ path: String, body: some Encodable, as type: T.Type) async throws -> T {
        var req = request(path, method: "PUT")
        req.httpBody = try JSONEncoder().encode(body)
        return try await send(req, as: type)
    }

    private func send<T: Decodable>(_ req: URLRequest, as: T.Type) async throws -> T {
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.http((resp as? HTTPURLResponse)?.statusCode ?? -1, String(data: data, encoding: .utf8) ?? "")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    enum APIError: LocalizedError {
        case http(Int, String)
        var errorDescription: String? {
            if case let .http(code, body) = self { return "HTTP \(code): \(body)" }
            return nil
        }
    }
}

struct OK: Decodable { let ok: Bool? }
