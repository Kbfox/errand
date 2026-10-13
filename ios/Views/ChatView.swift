import SwiftUI

struct ChatView: View {
    @Environment(CheckoutCoordinator.self) private var checkout
    @State private var model = ChatModel()
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 14) {
                            if model.items.isEmpty { EmptyState { model.send($0, checkout: checkout) } }
                            ForEach(model.items) { item in
                                row(item).id(item.id)
                            }
                            if let s = model.status {
                                HStack(spacing: 8) { ProgressView(); Text(s).font(.footnote).foregroundStyle(.secondary) }
                                    .padding(.horizontal, 4).id("status")
                            }
                        }
                        .padding(16)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: model.items.count) { _, _ in
                        withAnimation { proxy.scrollTo(model.items.last?.id, anchor: .bottom) }
                    }
                    .onChange(of: model.status) { _, s in
                        if s != nil { withAnimation { proxy.scrollTo("status", anchor: .bottom) } }
                    }
                }
                inputBar
            }
            .navigationTitle("Errand")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
        }
    }

    @ViewBuilder
    private func row(_ item: ChatItem) -> some View {
        switch item {
        case let .user(_, text):
            HStack { Spacer(minLength: 48); Bubble(text: text, mine: true) }
        case let .assistant(_, text):
            HStack { Bubble(text: text, mine: false); Spacer(minLength: 48) }
        case let .candidates(_, items):
            VStack(alignment: .leading, spacing: 10) {
                ForEach(items) { c in
                    CandidateCard(candidate: c, disabled: model.busy) { model.pick(c, checkout: checkout) }
                }
            }
        case let .receipt(_, c, orderId, status, auto, reason):
            ReceiptCard(candidate: c, orderId: orderId, status: status, auto: auto, reason: reason)
        case let .watching(_, c, target):
            WatchingCard(candidate: c, targetPrice: target)
        case let .error(_, text):
            Label(text, systemImage: "exclamationmark.triangle")
                .font(.footnote).foregroundStyle(.red).padding(.horizontal, 4)
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("What do you need?", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 20))
                .focused($focused)
                .onSubmit(submit)
            Button(action: submit) {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || model.busy)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.bar)
    }

    private func submit() {
        model.send(draft, checkout: checkout)
        draft = ""
    }
}

private struct EmptyState: View {
    let tap: (String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "bag.badge.questionmark").font(.system(size: 44)).foregroundStyle(.tint)
            Text("Tell it what you need.\nIt finds it, you approve, it pays.")
                .font(.title3.weight(.semibold))
            Text(ChatModel.watchHint).font(.footnote).foregroundStyle(.secondary)
            Text("Try one:").font(.footnote).foregroundStyle(.secondary)
            ForEach(ChatModel.suggestions, id: \.self) { s in
                Button { tap(s) } label: {
                    Text(s).multilineTextAlignment(.leading)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 32)
    }
}

private struct Bubble: View {
    let text: String; let mine: Bool
    var body: some View {
        Text(text)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(mine ? Color.accentColor : Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
            .foregroundStyle(mine ? .white : .primary)
    }
}

struct CandidateCard: View {
    let candidate: Candidate
    let disabled: Bool
    let buy: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                AsyncImage(url: candidate.image.flatMap(URL.init)) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Color(.tertiarySystemFill)
                }
                .frame(width: 84, height: 84).clipShape(RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 4) {
                    if let b = candidate.brand { Text(b.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary) }
                    Text(candidate.title).font(.subheadline.weight(.medium)).lineLimit(2)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(candidate.priceText).font(.headline)
                        if let was = candidate.compareAtText, candidate.compareAt ?? 0 > candidate.price {
                            Text(was).font(.caption).strikethrough().foregroundStyle(.secondary)
                        }
                    }
                    Text(candidate.store).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let r = candidate.reason {
                Text(r).font(.footnote).foregroundStyle(.secondary)
            }
            Button(action: buy) {
                Text("Buy with PayPal").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(disabled)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct ReceiptCard: View {
    let candidate: Candidate; let orderId: String; let status: String
    var auto: Bool = false; var reason: String = ""
    var ok: Bool { status == "COMPLETED" }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(ok ? (auto ? "Bought for you with PayPal" : "Paid with PayPal") : "Payment \(status.lowercased())", systemImage: ok ? (auto ? "bolt.badge.checkmark.fill" : "checkmark.seal.fill") : "xmark.octagon.fill")
                .font(.headline).foregroundStyle(ok ? .green : .red)
            if auto, !reason.isEmpty { Text("No approval needed: \(reason.lowercased()).").font(.footnote).foregroundStyle(.secondary) }
            Text(candidate.title).font(.subheadline)
            HStack { Text(candidate.priceText).font(.subheadline.weight(.semibold)); Spacer(); Text(orderId).font(.caption.monospaced()).foregroundStyle(.secondary) }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}


struct WatchingCard: View {
    let candidate: Candidate; let targetPrice: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Watching the price", systemImage: "eye.fill").font(.headline).foregroundStyle(.orange)
            Text(candidate.title).font(.subheadline)
            Text("Now \(candidate.priceText). Errand will buy it the moment it is \(Candidate.money(targetPrice, candidate.currency)) or less, within your rules.")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
