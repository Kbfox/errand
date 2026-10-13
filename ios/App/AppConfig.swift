import Foundation

enum AppConfig {
    static var apiBaseURL: URL {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String) ?? "http://localhost:8787"
        return URL(string: raw)!
    }
    static var appKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "APP_KEY") as? String) ?? ""
    }
}
