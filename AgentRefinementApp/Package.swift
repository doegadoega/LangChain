// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentRefinementApp",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AgentRefinementApp",
            path: "AgentRefinementApp",
            resources: [
                .copy("Resources/workflow-canvas")
            ]
        ),
        .testTarget(
            name: "AgentRefinementAppTests",
            dependencies: ["AgentRefinementApp"],
            path: "AgentRefinementAppTests"
        ),
    ]
)
