import Foundation

struct APIClient {
    static let shared = APIClient()

    func post<T: Decodable>(_ path: String, body: some Encodable, as type: T.Type) async throws -> T {
        var req = URLRequest(url: AppConfig.apiBaseURL.appending(path: path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(AppConfig.appKey, forHTTPHeaderField: "x-app-key")
        req.httpBody = try JSONEncoder().encode(body)
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
