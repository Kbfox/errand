import SwiftUI

struct SettingsView: View {
    @State private var confirmReset = false
    @State private var me: Me?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 14).fill(Color.accentColor.gradient).frame(width: 56, height: 56)
                            .overlay(Image(systemName: "bag.fill").font(.title2).foregroundStyle(.white))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Gofer").font(.headline)
                            Text("Tell it what you need. It finds it, you approve, it pays.").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section("How it pays") {
                    Label("Payments run through PayPal. Gofer never sees card numbers.", systemImage: "lock.shield")
                    Label("Purchases inside your rules use your saved PayPal wallet. Everything else opens PayPal for approval.", systemImage: "slider.horizontal.3")
                    Label("This build uses the PayPal sandbox: no real money moves.", systemImage: "testtube.2")
                }
                .font(.footnote)
                Section("Notifications") {
                    Button("Enable purchase alerts") { PushPermission.requestIfNeeded() }
                    Text("Gofer tells you when a watched price hits and it buys, or when a purchase needs your approval.").font(.footnote).foregroundStyle(.secondary)
                    #if DEBUG
                    Button("Send test push") { Task { _ = try? await APIClient.shared.post("/debug/push", as: OK.self) } }
                    #endif
                }
                Section("Data") {
                    if let me {
                        LabeledContent("Device ID", value: String(me.userId.prefix(8)) + "…").font(.footnote)
                    }
                    Button("Reset this device", role: .destructive) { confirmReset = true }
                }
                Section("About") {
                    Link(destination: URL(string: "https://kbfox.github.io/gofer/privacy.html")!) { Label("Privacy policy", systemImage: "hand.raised") }
                    Link(destination: URL(string: "https://kbfox.github.io/gofer/support.html")!) { Label("Support", systemImage: "questionmark.circle") }
                    Link(destination: URL(string: "https://github.com/Kbfox/gofer")!) { Label("Source on GitHub", systemImage: "chevron.left.forwardslash.chevron.right") }
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                    Text("Built for the PayPal AI Hackathon 2026. Product data by Channel3. The agent runs on DeepSeek.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .task { me = try? await APIClient.shared.get("/me", as: Me.self) }
            .confirmationDialog("Reset this device?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Forget wallet, rules and history", role: .destructive) {
                    UserDefaults.standard.removeObject(forKey: "gofer.userId")
                    exit(0)
                }
            } message: {
                Text("A new device ID is created. Orders already placed with PayPal are not affected.")
            }
        }
    }
}
