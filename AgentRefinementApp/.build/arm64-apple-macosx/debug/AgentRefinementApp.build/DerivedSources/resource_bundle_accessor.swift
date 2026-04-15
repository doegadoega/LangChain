import Foundation

extension Foundation.Bundle {
    static let module: Bundle = {
        let mainPath = Bundle.main.bundleURL.appendingPathComponent("AgentRefinementApp_AgentRefinementApp.bundle").path
        let buildPath = "/Users/sfidante-he/workspace/LangChain/AgentRefinementApp/.build/arm64-apple-macosx/debug/AgentRefinementApp_AgentRefinementApp.bundle"

        let preferredBundle = Bundle(path: mainPath)

        guard let bundle = preferredBundle ?? Bundle(path: buildPath) else {
            // Users can write a function called fatalError themselves, we should be resilient against that.
            Swift.fatalError("could not load resource bundle: from \(mainPath) or \(buildPath)")
        }

        return bundle
    }()
}