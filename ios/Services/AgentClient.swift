import Foundation

/// Streams `POST /agent` (server-sent events) from the Worker.
struct AgentClient {
    struct Request: Encodable {
        struct Message: Encodable { let role: String; let content: String }
        let messages: [Message]
        let candidates: [Candidate]
        let userId: String
    }

    static func stream(_ body: Request) -> AsyncThrowingStream<AgentEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var req = URLRequest(url: AppConfig.apiBaseURL.appending(path: "/agent"))
                    req.httpMethod = "POST"
                    req.timeoutInterval = 180
                    req.setValue("application/json", forHTTPHeaderField: "content-type")
                    req.setValue(AppConfig.appKey, forHTTPHeaderField: "x-app-key")
                    req.httpBody = try JSONEncoder().encode(body)
                    let (bytes, resp) = try await URLSession.shared.bytes(for: req)
                    guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
                        throw APIClient.APIError.http((resp as? HTTPURLResponse)?.statusCode ?? -1, "agent request failed")
                    }
                    let dec = JSONDecoder()
                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: "), let data = line.dropFirst(6).data(using: .utf8) else { continue }
                        let ev = try dec.decode(AgentEvent.self, from: data)
                        continuation.yield(ev)
                        if case .done = ev { break }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
