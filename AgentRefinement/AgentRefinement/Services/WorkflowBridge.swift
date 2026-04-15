import Foundation
import WebKit

@MainActor
final class WorkflowBridge: NSObject, ObservableObject, WKScriptMessageHandler {
    @Published var selectedNodeData: [String: Any]?
    @Published var hasChanges: Bool = false

    weak var webView: WKWebView?

    nonisolated func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let event = body["event"] as? String else { return }

        Task { @MainActor in
            switch event {
            case "nodeSelected":
                self.selectedNodeData = body["data"] as? [String: Any]
            case "nodeAdded", "nodeMoved", "edgeAdded", "nodeDeleted":
                self.hasChanges = true
            default:
                break
            }
        }
    }

    func loadWorkflow(_ workflow: Workflow) {
        guard let webView else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(workflow),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("loadWorkflow(\(json))")
    }

    func getWorkflowData(completion: @escaping ([String: Any]?) -> Void) {
        guard let webView else { completion(nil); return }
        webView.evaluateJavaScript("JSON.stringify(getWorkflowData())") { result, _ in
            guard let jsonStr = result as? String,
                  let data = jsonStr.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { completion(nil); return }
            completion(json)
        }
    }

    func deleteSelectedNode() {
        webView?.evaluateJavaScript("deleteSelectedNode()")
    }
}
