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
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 8).fill(Color(red: 0, green: 0.19, blue: 0.53)).frame(width: 36, height: 36)
                            .overlay(Text("P").font(.headline.bold()).foregroundStyle(.white))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PayPal wallet").font(.body)
                            Text(me?.walletSaved == true ? "Saved for unattended purchases" : "Approve one purchase to save it").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: me?.walletSaved == true ? "checkmark.circle.fill" : "circle.dashed")
                            .foregroundStyle(me?.walletSaved == true ? .green : .secondary)
                    }
                } footer: {
                    Text(me?.walletSaved == true
                         ? "Gofer can pay with your saved PayPal wallet without opening PayPal, as long as the purchase fits the rules below."
                         : "Approve one purchase in PayPal and Gofer will save the wallet for unattended buys that fit your rules.")
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
                        HStack { Text("Spent"); Spacer(); Text(Candidate.money(me.monthSpent, "USD")).font(.body.weight(.semibold)) }
                        if me.rules.monthly_cap_usd > 0 {
                            let frac = min(me.monthSpent / me.rules.monthly_cap_usd, 1)
                            VStack(alignment: .leading, spacing: 6) {
                                ProgressView(value: frac).tint(frac > 0.85 ? .red : frac > 0.6 ? .orange : .accentColor)
                                Text("\(Candidate.money(max(me.rules.monthly_cap_usd - me.monthSpent, 0), "USD")) left of your \(Candidate.money(me.rules.monthly_cap_usd, "USD")) cap")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
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
