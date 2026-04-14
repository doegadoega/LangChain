import SwiftUI

@main
struct AgentRefinementApp: App {
    @StateObject private var sidecarManager = SidecarManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sidecarManager)
        }
    }
}
