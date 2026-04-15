import SwiftUI

@main
struct AgentRefinementAppEntry: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear {
                    appState.loadAll()
                }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1400, height: 900)
    }
}
