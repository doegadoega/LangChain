import SwiftUI

@main
struct AgentRefinementApp: App {
    @StateObject private var sidecarManager = SidecarManager()
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sidecarManager)
                .environmentObject(appState)
                .onAppear {
                    sidecarManager.start()
                    appState.loadAll()
                }
                .onDisappear {
                    sidecarManager.stop()
                }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1400, height: 900)
    }
}
