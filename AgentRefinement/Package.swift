// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentRefinement",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "AgentRefinement",
            path: "AgentRefinement",
            resources: [
                .copy("Views/workflow-canvas")
            ]
        ),
        .testTarget(
            name: "AgentRefinementTests",
            dependencies: ["AgentRefinement"],
            path: "AgentRefinementTests"
        )
    ]
)
