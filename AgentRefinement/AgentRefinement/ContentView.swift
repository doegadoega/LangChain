import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var sidecarManager: SidecarManager

    var body: some View {
        VStack(spacing: 16) {
            Text("Agent Refinement")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text(sidecarManager.isRunning ? "Sidecar running on port \(sidecarManager.port)" : "Sidecar not running")
                .foregroundStyle(sidecarManager.isRunning ? .green : .secondary)
        }
        .padding()
        .frame(minWidth: 400, minHeight: 300)
    }
}

#Preview {
    ContentView()
        .environmentObject(SidecarManager())
}
