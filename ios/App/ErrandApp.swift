import SwiftUI

@main
struct ErrandApp: App {
    @State private var checkout = CheckoutCoordinator()

    var body: some Scene {
        WindowGroup {
            TabView {
                ChatView().tabItem { Label("Errand", systemImage: "bubble.left.and.text.bubble.right.fill") }
                OrdersView().tabItem { Label("Orders", systemImage: "shippingbox.fill") }
                RulesView().tabItem { Label("Rules", systemImage: "slider.horizontal.3") }
            }
            .environment(checkout)
            .onOpenURL { url in checkout.handle(url) }
        }
    }
}
