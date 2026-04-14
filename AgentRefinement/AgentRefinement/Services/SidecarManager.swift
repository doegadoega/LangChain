import Foundation

final class SidecarManager: ObservableObject {
    @Published private(set) var isRunning: Bool = false
    @Published private(set) var port: Int = 8000

    func start() {
        // TODO: Launch Python FastAPI sidecar process
    }

    func stop() {
        // TODO: Terminate sidecar process
    }
}
