import SwiftUI

struct OrdersView: View {
    @Environment(CheckoutCoordinator.self) private var checkout
    @State private var orders: [Order] = []
    @State private var watches: [Watch] = []
    @State private var error: String?
    @State private var busyId: String?
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable, Identifiable {
        case all = "All", approved = "Approved", auto = "Automatic", watch = "Price drop"
        var id: String { rawValue }
        func matches(_ o: Order) -> Bool {
            switch self { case .all: return true; case .approved: return o.mode == "approved"; case .auto: return o.mode == "auto"; case .watch: return o.mode == "watch" }
        }
    }

    private var grouped: [(String, [Order])] {
        let parse: (String) -> Date? = { str in
            let df = DateFormatter(); df.locale = Locale(identifier: "en_US_POSIX"); df.timeZone = TimeZone(identifier: "UTC"); df.dateFormat = "yyyy-MM-dd HH:mm:ss"
            return df.date(from: str)
        }
        let rows = orders.filter(filter.matches)
        let dict = Dictionary(grouping: rows) { o -> String in
            guard let d = parse(o.created_at) else { return "Earlier" }
            if Calendar.current.isDateInToday(d) { return "Today" }
            if Calendar.current.isDateInYesterday(d) { return "Yesterday" }
            return d.formatted(.dateTime.month(.wide).day())
        }
        let order = ["Today", "Yesterday"]
        return dict.sorted { a, b in
            let ia = order.firstIndex(of: a.key) ?? 99, ib = order.firstIndex(of: b.key) ?? 99
            return ia != ib ? ia < ib : a.key > b.key
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                let active = watches.filter { $0.status == "active" || $0.status == "needs_approval" }
                if !active.isEmpty {
                    Section("Watching") {
                        ForEach(active) { w in WatchRow(watch: w, busy: busyId == w.id, approve: { approve(w) }, cancel: { cancel(w) }, simulate: { simulate(w) }) }
                    }
                }
                if orders.isEmpty {
                    Section {
                        ContentUnavailableView("No orders yet", systemImage: "shippingbox", description: Text("Ask Gofer for something on the first tab. Every purchase, and how it was authorised, shows up here."))
                    }
                } else {
                    Section {
                        Picker("Filter", selection: $filter) { ForEach(Filter.allCases) { Text($0.rawValue).tag($0) } }
                            .pickerStyle(.segmented)
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets())
                    }
                    ForEach(grouped, id: \.0) { title, rows in
                        Section(title) { ForEach(rows) { o in OrderRow(order: o) } }
                    }
                }
            }
            .navigationTitle("Orders")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            async let o = APIClient.shared.get("/orders", as: [Order].self)
            async let w = APIClient.shared.get("/watches", as: [Watch].self)
            orders = try await o; watches = try await w; error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func cancel(_ w: Watch) {
        Task { _ = try? await APIClient.shared.post("/watches/\(w.id)/cancel", as: OK.self); await load() }
    }

    /// Debug-only: runs the real price-watch evaluation on the server with the target price forced.
    private func simulate(_ w: Watch) {
        busyId = w.id
        Task {
            defer { busyId = nil }
            struct R: Decodable { let result: String; let detail: String? }
            do {
                let r = try await APIClient.shared.post("/debug/watches/\(w.id)/simulate", as: R.self)
                if r.result == "error" { error = r.detail }
            } catch { self.error = error.localizedDescription }
            await load()
        }
    }

    private func approve(_ w: Watch) {
        busyId = w.id
        Task {
            defer { busyId = nil }
            struct R: Decodable { let orderId: String; let approveUrl: URL? }
            do {
                let r = try await APIClient.shared.post("/watches/\(w.id)/approve", as: R.self)
                if let url = r.approveUrl { try await checkout.open(url) }
            } catch { self.error = error.localizedDescription }
            await load()
        }
    }
}

private struct WatchRow: View {
    let watch: Watch; let busy: Bool
    let approve: () -> Void; let cancel: () -> Void; let simulate: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                Thumb(url: watch.candidate.image)
                VStack(alignment: .leading, spacing: 3) {
                    Text(watch.candidate.title).font(.subheadline.weight(.medium)).lineLimit(2)
                    Text("Now \(Candidate.money(watch.last_price ?? watch.candidate.price, watch.candidate.currency)) · buy at \(Candidate.money(watch.target_price, watch.candidate.currency))")
                        .font(.caption).foregroundStyle(.secondary)
                    if watch.status == "needs_approval" {
                        Text("Price hit, but it is outside your rules. Approve to buy.").font(.caption).foregroundStyle(.orange)
                    }
                }
            }
            HStack {
                if watch.status == "needs_approval" {
                    Button("Approve in PayPal", action: approve).buttonStyle(.borderedProminent).controlSize(.small)
                }
                #if DEBUG
                if watch.status == "active" {
                    Button(busy ? "Simulating…" : "Simulate price drop", action: simulate).buttonStyle(.bordered).controlSize(.small).disabled(busy)
                }
                #endif
                Spacer()
                Button("Stop watching", role: .destructive, action: cancel).buttonStyle(.borderless).controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct OrderRow: View {
    let order: Order
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Thumb(url: order.candidate.image)
            VStack(alignment: .leading, spacing: 3) {
                Text(order.candidate.title).font(.subheadline.weight(.medium)).lineLimit(2)
                HStack(spacing: 6) {
                    Image(systemName: order.mode == "approved" ? "checkmark.seal.fill" : "bolt.badge.checkmark.fill")
                    Text(order.modeLabel)
                }
                .font(.caption).foregroundStyle(order.mode == "approved" ? .green : .orange)
                HStack {
                    Text(order.amountText).font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(order.status == "SHIPPED" ? "Shipped · \(order.tracking_number ?? "")" : order.status.capitalized)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct Thumb: View {
    let url: String?
    var body: some View {
        AsyncImage(url: url.flatMap(URL.init)) { $0.resizable().scaledToFill() } placeholder: { Color(.tertiarySystemFill) }
            .frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
