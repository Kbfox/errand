import SwiftUI

/// Spending rules. The server enforces them; this screen only edits them.
struct RulesView: View {
    @State private var me: Me?
    @State private var autoUnder: Double = 0
    @State private var monthlyCap: Double = 0
    @State private var saving = false
    @State private var error: String?

    private let autoSteps: [Double] = [0, 25, 50, 100, 200, 500]
    private let capSteps: [Double] = [0, 100, 250, 500, 1000, 2000]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Label("PayPal wallet", systemImage: "wallet.pass.fill")
                        Spacer()
                        Text(me?.walletSaved == true ? "Saved" : "Not saved yet").foregroundStyle(me?.walletSaved == true ? .green : .secondary)
                    }
                } footer: {
                    Text(me?.walletSaved == true
                         ? "Errand can pay with your saved PayPal wallet without opening PayPal, as long as the purchase fits the rules below."
                         : "Approve one purchase in PayPal and Errand will save the wallet for unattended buys that fit your rules.")
                }

                Section {
                    Picker("Buy without asking under", selection: $autoUnder) {
                        ForEach(autoSteps, id: \.self) { v in Text(v == 0 ? "Always ask" : "$\(Int(v))").tag(v) }
                    }
                    Picker("Monthly cap", selection: $monthlyCap) {
                        ForEach(capSteps, id: \.self) { v in Text(v == 0 ? "No cap" : "$\(Int(v))").tag(v) }
                    }
                } header: {
                    Text("Rules")
                } footer: {
                    Text("Anything over the limit, or that would break the cap, opens PayPal for your approval instead. Price watches follow the same rules.")
                }

                if let me {
                    Section("This month") {
                        HStack { Text("Spent"); Spacer(); Text(Candidate.money(me.monthSpent, "USD")) }
                        if me.rules.monthly_cap_usd > 0 {
                            ProgressView(value: min(me.monthSpent / me.rules.monthly_cap_usd, 1))
                        }
                    }
                }

                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            }
            .navigationTitle("Rules")
            .toolbar {
                if changed {
                    Button(saving ? "Saving…" : "Save") { save() }.disabled(saving)
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private var changed: Bool {
        guard let me else { return false }
        return me.rules.auto_under_usd != autoUnder || me.rules.monthly_cap_usd != monthlyCap
    }

    private func load() async {
        do {
            let m = try await APIClient.shared.get("/me", as: Me.self)
            me = m; autoUnder = m.rules.auto_under_usd; monthlyCap = m.rules.monthly_cap_usd; error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() {
        saving = true
        Task {
            defer { saving = false }
            do {
                _ = try await APIClient.shared.put("/rules", body: Rules(auto_under_usd: autoUnder, monthly_cap_usd: monthlyCap), as: Rules.self)
                await load()
            } catch { self.error = error.localizedDescription }
        }
    }
}
