import SwiftUI

@main
struct GoferApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var checkout = CheckoutCoordinator()

    var body: some Scene {
        WindowGroup {
            TabView {
                ChatView().tabItem { Label("Gofer", systemImage: "bubble.left.and.text.bubble.right.fill") }
                OrdersView().tabItem { Label("Orders", systemImage: "shippingbox.fill") }
                RulesView().tabItem { Label("Rules", systemImage: "slider.horizontal.3") }
                SettingsView().tabItem { Label("Settings", systemImage: "gearshape.fill") }
            }
            .environment(checkout)
            .onOpenURL { url in checkout.handle(url) }
        }
    }
}
