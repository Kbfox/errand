import SwiftUI

@main
struct ErrandApp: App {
    @State private var checkout = CheckoutCoordinator()

    var body: some Scene {
        WindowGroup {
            ChatView()
                .environment(checkout)
                .onOpenURL { url in checkout.handle(url) }
        }
    }
}
