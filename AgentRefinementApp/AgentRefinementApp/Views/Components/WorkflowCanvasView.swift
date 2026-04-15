import SwiftUI
import WebKit

struct WorkflowCanvasView: NSViewRepresentable {
    @ObservedObject var bridge: WorkflowBridge

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(bridge, name: "workflowBridge")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        bridge.webView = webView

        if let htmlURL = Bundle.main.url(forResource: "canvas", withExtension: "html", subdirectory: "workflow-canvas") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }

        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
