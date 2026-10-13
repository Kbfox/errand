import SwiftUI

/// Week-1 placeholder: a single "pay $12.34" button proves the PayPal round trip on device.
/// Week 2 replaces this with the agent chat.
struct ChatView: View {
    @Environment(CheckoutCoordinator.self) private var checkout
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "bag.badge.questionmark")
                    .font(.system(size: 56))
                    .foregroundStyle(.tint)
                Text("Tell it what you need.\nIt finds it, you approve, it pays.")
                    .multilineTextAlignment(.center)
                    .font(.title3.weight(.medium))
                Spacer()
                if let r = checkout.lastResult {
                    Label("\(r.status) \(r.orderID ?? "")", systemImage: r.status == "COMPLETED" ? "checkmark.seal.fill" : "xmark.octagon")
                        .font(.footnote.monospaced())
                }
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                Button {
                    Task {
                        busy = true; error = nil
                        do { try await checkout.pay(name: "Errand smoke test", usd: "12.34") } catch { self.error = error.localizedDescription }
                        busy = false
                    }
                } label: {
                    Text(busy ? "Opening PayPal…" : "Pay $12.34 (sandbox)")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy)
            }
            .padding()
            .navigationTitle("Errand")
        }
    }
}
