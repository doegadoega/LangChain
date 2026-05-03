// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentRefinementApp",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AgentRefinementApp",
            path: "AgentRefinementApp",
            // Xcode app-only metadata files are not SwiftPM build inputs.
            exclude: [
                "Info.plist",
                "AgentRefinementApp.entitlements"
            ],
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
