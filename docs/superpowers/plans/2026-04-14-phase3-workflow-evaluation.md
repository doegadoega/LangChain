# Phase 3: ワークフローエディタ + 評価システム

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the node-based workflow editor using WKWebView canvas, the agent evaluation system, real execution integration with FastAPI streaming, and preset workflow templates.

**Architecture:** The workflow editor is an HTML/JS canvas rendered in WKWebView. Swift ↔ JS communication uses `WKScriptMessageHandler` (JS→Swift) and `evaluateJavaScript` (Swift→JS). The evaluation system adds scoring flows to AppState and the Python backend. Execution integration connects RequirementsScreen to the real FastAPI streaming API.

**Tech Stack:** Swift/SwiftUI, WKWebView, WebKit, HTML5 Canvas/SVG, vanilla JS, Python FastAPI

---

## File Structure

### New Files

```
AgentRefinement/AgentRefinement/
├── Views/
│   ├── Screens/
│   │   └── WorkflowScreen.swift                — ワークフローエディタ画面
│   ├── Components/
│   │   ├── WorkflowCanvasView.swift            — WKWebView wrapper
│   │   ├── WorkflowPropertiesPanel.swift       — 右パネル: ノードプロパティ
│   │   ├── EvaluationView.swift                — 評価入力UI
│   │   └── AgentHistoryView.swift              — エージェント案件履歴
│   └── workflow-canvas/
│       ├── canvas.html                         — WKWebView用HTMLキャンバス
│       ├── canvas.css                          — キャンバススタイル
│       └── canvas.js                           — ノード/エッジ描画+操作ロジック
├── Services/
│   └── WorkflowBridge.swift                    — Swift↔JS ブリッジ

app/
├── evaluation.py                               — NEW: 評価ロジック
tests/
├── test_evaluation.py                          — NEW: 評価テスト
```

### Modified Files

```
AgentRefinement/AgentRefinement/
├── AppState.swift                              — Workflow CRUD, evaluation methods, execution
├── Views/MainTabView.swift                     — Wire WorkflowScreen
├── Views/DetailPanelView.swift                 — Add evaluation display + history tab
├── Views/Screens/RequirementsScreen.swift       — Real execution via APIClient

app/
├── main.py                                     — Add evaluation endpoints
├── models.py                                   — Add evaluation request/response models
├── orchestrator.py                             — Add evaluation hooks post-execution
```

---

### Task 1: Workflow Canvas HTML/CSS/JS

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.html`
- Create: `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.css`
- Create: `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.js`

This is the core visual editor that runs inside WKWebView. It renders nodes on an SVG overlay and handles drag, connect, select interactions.

- [ ] **Step 1: Create canvas.html**

Create `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="canvas.css">
</head>
<body>
<div id="canvas-container">
  <svg id="edge-layer"></svg>
  <div id="node-layer"></div>
</div>
<div id="palette">
  <div class="palette-title">ノード</div>
  <div class="palette-item" draggable="true" data-type="slot">📦 スロット</div>
  <div class="palette-item" draggable="true" data-type="gate">⛩ ゲート</div>
  <div class="palette-item" draggable="true" data-type="loop">🔁 ループ</div>
  <div class="palette-item" draggable="true" data-type="fork">⑃ 並列</div>
  <div class="palette-title">テンプレート</div>
  <div class="palette-item template" draggable="true" data-type="pdca">🔄 PDCAサイクル</div>
  <div class="palette-item template" draggable="true" data-type="review-loop">📝 レビューループ</div>
</div>
<script src="canvas.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create canvas.css**

Create `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1e1e2e; color: #cdd6f4; font-family: -apple-system, sans-serif; font-size: 12px; display: flex; height: 100vh; overflow: hidden; }

#canvas-container { flex: 1; position: relative; overflow: auto; background: radial-gradient(circle, #313244 1px, transparent 1px); background-size: 20px 20px; }
#edge-layer { position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; pointer-events: none; }
#node-layer { position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; }

#palette { width: 150px; min-width: 150px; background: #181825; border-left: 1px solid #313244; padding: 10px; overflow-y: auto; }
.palette-title { font-size: 10px; font-weight: 700; color: #a6adc8; text-transform: uppercase; margin: 8px 0 6px; }
.palette-item { padding: 8px 10px; margin-bottom: 4px; border: 1px solid #45475a; border-radius: 8px; background: #313244; cursor: grab; font-size: 11px; transition: border-color 0.15s; }
.palette-item:hover { border-color: #89b4fa; }
.palette-item.template { border-color: #a6e3a1; }

.wf-node { position: absolute; min-width: 120px; padding: 10px 14px; border-radius: 10px; text-align: center; cursor: move; box-shadow: 0 2px 8px rgba(0,0,0,0.3); user-select: none; }
.wf-node .node-icon { font-size: 16px; }
.wf-node .node-label { font-weight: 700; font-size: 11px; margin-top: 2px; }
.wf-node .node-detail { font-size: 9px; opacity: 0.7; margin-top: 2px; }
.wf-node.selected { outline: 2px solid #89b4fa; outline-offset: 2px; }

.wf-node.type-start { background: #a6e3a1; color: #1e1e2e; border-radius: 20px; min-width: 80px; }
.wf-node.type-end { background: #f38ba8; color: #1e1e2e; border-radius: 20px; min-width: 80px; }
.wf-node.type-slot { background: #313244; border: 2px solid #45475a; }
.wf-node.type-gate { background: rgba(249,226,175,0.15); border: 2px solid #f9e2af; color: #f9e2af; }
.wf-node.type-loop { background: rgba(203,166,247,0.15); border: 2px solid #cba6f7; color: #cba6f7; }
.wf-node.type-fork, .wf-node.type-join { background: rgba(137,180,250,0.15); border: 2px solid #89b4fa; color: #89b4fa; }

.edge { stroke: #585b70; stroke-width: 2; fill: none; }
.edge.pass { stroke: #a6e3a1; }
.edge.rework { stroke: #f38ba8; stroke-dasharray: 6 4; }
.edge-label { font-size: 9px; font-weight: 600; fill: #a6adc8; }

.connector { width: 10px; height: 10px; border-radius: 50%; background: #585b70; position: absolute; bottom: -5px; left: calc(50% - 5px); cursor: crosshair; }
.connector:hover { background: #89b4fa; }
.connector.input { top: -5px; bottom: auto; }
```

- [ ] **Step 3: Create canvas.js**

Create `AgentRefinement/AgentRefinement/Views/workflow-canvas/canvas.js`:

```javascript
const state = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  dragging: null,
  connecting: null,
  nextId: 1
}

const nodeLayer = document.getElementById('node-layer')
const edgeLayer = document.getElementById('edge-layer')

function createNodeId() {
  return `node-${state.nextId++}`
}

function addNode(type, x, y, label, detail) {
  const id = createNodeId()
  const node = { id, type, x, y, label: label || defaultLabel(type), detail: detail || '', config: {} }
  state.nodes.push(node)
  renderNode(node)
  notifySwift('nodeAdded', node)
  return node
}

function defaultLabel(type) {
  const labels = { start: '▶ 開始', end: '⏹ 終了', slot: 'スロット', gate: 'ゲート', loop: 'ループ', fork: '並列開始', join: '合流' }
  return labels[type] || type
}

function renderNode(node) {
  const el = document.createElement('div')
  el.className = `wf-node type-${node.type}`
  el.id = `node-${node.id}`
  el.style.left = `${node.x}px`
  el.style.top = `${node.y}px`
  el.innerHTML = `
    <div class="node-icon">${nodeIcon(node.type)}</div>
    <div class="node-label">${node.label}</div>
    ${node.detail ? `<div class="node-detail">${node.detail}</div>` : ''}
    <div class="connector input" data-node="${node.id}" data-dir="in"></div>
    <div class="connector" data-node="${node.id}" data-dir="out"></div>
  `
  el.addEventListener('mousedown', (e) => startDrag(e, node))
  el.addEventListener('click', (e) => { e.stopPropagation(); selectNode(node.id) })
  nodeLayer.appendChild(el)
}

function nodeIcon(type) {
  const icons = { start: '▶', end: '⏹', slot: '📦', gate: '⛩', loop: '🔁', fork: '⑃', join: '⑃' }
  return icons[type] || '📦'
}

function selectNode(id) {
  document.querySelectorAll('.wf-node').forEach(n => n.classList.remove('selected'))
  state.selectedNodeId = id
  const el = document.getElementById(`node-${id}`)
  if (el) el.classList.add('selected')
  const node = state.nodes.find(n => n.id === id)
  if (node) notifySwift('nodeSelected', node)
}

function startDrag(e, node) {
  if (e.target.classList.contains('connector')) return
  state.dragging = { node, offsetX: e.offsetX, offsetY: e.offsetY }
  e.preventDefault()
}

document.addEventListener('mousemove', (e) => {
  if (!state.dragging) return
  const { node, offsetX, offsetY } = state.dragging
  const rect = nodeLayer.getBoundingClientRect()
  node.x = e.clientX - rect.left - offsetX
  node.y = e.clientY - rect.top - offsetY
  const el = document.getElementById(`node-${node.id}`)
  if (el) {
    el.style.left = `${node.x}px`
    el.style.top = `${node.y}px`
  }
  renderEdges()
})

document.addEventListener('mouseup', () => {
  if (state.dragging) {
    notifySwift('nodeMoved', state.dragging.node)
    state.dragging = null
  }
})

document.getElementById('canvas-container').addEventListener('click', () => {
  selectNode(null)
})

// Edge rendering
function addEdge(sourceId, targetId, conditionLabel) {
  const edge = { id: `edge-${state.nextId++}`, sourceId, targetId, conditionLabel }
  state.edges.push(edge)
  renderEdges()
  notifySwift('edgeAdded', edge)
}

function renderEdges() {
  edgeLayer.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill="#585b70"/>
      </marker>
    </defs>
  `
  state.edges.forEach(edge => {
    const source = state.nodes.find(n => n.id === edge.sourceId)
    const target = state.nodes.find(n => n.id === edge.targetId)
    if (!source || !target) return

    const sx = source.x + 60, sy = source.y + 60
    const tx = target.x + 60, ty = target.y
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const midY = (sy + ty) / 2
    path.setAttribute('d', `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`)
    path.setAttribute('class', `edge ${edge.conditionLabel === 'REWORK' ? 'rework' : edge.conditionLabel === 'PASS' ? 'pass' : ''}`)
    path.setAttribute('marker-end', 'url(#arrow)')
    edgeLayer.appendChild(path)

    if (edge.conditionLabel) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', (sx + tx) / 2)
      text.setAttribute('y', midY - 5)
      text.setAttribute('class', 'edge-label')
      text.textContent = edge.conditionLabel
      edgeLayer.appendChild(text)
    }
  })
}

// Connector drag for creating edges
nodeLayer.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('connector') && e.target.dataset.dir === 'out') {
    state.connecting = { sourceId: e.target.dataset.node }
    e.preventDefault()
    e.stopPropagation()
  }
})

nodeLayer.addEventListener('mouseup', (e) => {
  if (state.connecting && e.target.classList.contains('connector') && e.target.dataset.dir === 'in') {
    const targetId = e.target.dataset.node
    if (targetId !== state.connecting.sourceId) {
      addEdge(state.connecting.sourceId, targetId, null)
    }
  }
  state.connecting = null
})

// Palette drag-and-drop
document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('nodeType', item.dataset.type)
  })
})

document.getElementById('canvas-container').addEventListener('dragover', (e) => e.preventDefault())
document.getElementById('canvas-container').addEventListener('drop', (e) => {
  e.preventDefault()
  const type = e.dataTransfer.getData('nodeType')
  if (!type) return
  const rect = nodeLayer.getBoundingClientRect()
  const x = e.clientX - rect.left - 60
  const y = e.clientY - rect.top - 20

  if (type === 'pdca') {
    addPDCATemplate(x, y)
  } else if (type === 'review-loop') {
    addReviewLoopTemplate(x, y)
  } else {
    addNode(type, x, y)
  }
})

function addPDCATemplate(x, y) {
  const plan = addNode('slot', x, y, 'Manager: Plan', 'タスク分解')
  const fork = addNode('fork', x, y + 90, '並列開始', '')
  const w1 = addNode('slot', x - 130, y + 180, 'Worker 1', '実装')
  const w2 = addNode('slot', x, y + 180, 'Worker 2', '実装')
  const w3 = addNode('slot', x + 130, y + 180, 'Worker 3', '実装')
  const join = addNode('join', x, y + 270, '合流', '')
  const qa = addNode('slot', x, y + 360, 'QA: Check', '品質検証')
  const gate = addNode('gate', x, y + 450, '品質ゲート', 'PASS/REWORK')
  const act = addNode('slot', x + 200, y + 450, 'CEO: Act', '最終承認')

  addEdge(plan.id, fork.id)
  addEdge(fork.id, w1.id)
  addEdge(fork.id, w2.id)
  addEdge(fork.id, w3.id)
  addEdge(w1.id, join.id)
  addEdge(w2.id, join.id)
  addEdge(w3.id, join.id)
  addEdge(join.id, qa.id)
  addEdge(qa.id, gate.id)
  addEdge(gate.id, act.id, 'PASS')
  addEdge(gate.id, fork.id, 'REWORK')
}

function addReviewLoopTemplate(x, y) {
  const impl = addNode('slot', x, y, 'Worker: 実装', '実装')
  const review = addNode('slot', x, y + 100, 'Reviewer: レビュー', 'レビュー')
  const gate = addNode('gate', x, y + 200, 'レビューゲート', 'OK/修正要')
  const fix = addNode('slot', x + 180, y + 200, 'Worker: 修正', '修正')

  addEdge(impl.id, review.id)
  addEdge(review.id, gate.id)
  addEdge(gate.id, fix.id, 'REWORK')
  addEdge(fix.id, review.id)
}

// Swift bridge
function notifySwift(event, data) {
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.workflowBridge) {
    window.webkit.messageHandlers.workflowBridge.postMessage({ event, data })
  }
}

// API called from Swift
function loadWorkflow(workflow) {
  state.nodes = []
  state.edges = []
  nodeLayer.innerHTML = ''
  edgeLayer.innerHTML = ''
  state.nextId = 1

  if (workflow.nodes) {
    workflow.nodes.forEach(n => {
      const node = { id: n.id || createNodeId(), type: n.type, x: n.position.x, y: n.position.y, label: n.label, detail: '', config: n.config || {} }
      state.nodes.push(node)
      renderNode(node)
      if (parseInt(node.id.replace('node-', '')) >= state.nextId) {
        state.nextId = parseInt(node.id.replace('node-', '')) + 1
      }
    })
  }
  if (workflow.edges) {
    workflow.edges.forEach(e => {
      state.edges.push({ id: e.id || `edge-${state.nextId++}`, sourceId: e.sourceNodeId, targetId: e.targetNodeId, conditionLabel: e.conditionLabel })
    })
    renderEdges()
  }
}

function getWorkflowData() {
  return {
    nodes: state.nodes.map(n => ({
      id: n.id, type: n.type, position: { x: n.x, y: n.y }, label: n.label, config: n.config
    })),
    edges: state.edges.map(e => ({
      id: e.id, sourceNodeId: e.sourceId, targetNodeId: e.targetId, conditionLabel: e.conditionLabel
    }))
  }
}

function deleteSelectedNode() {
  if (!state.selectedNodeId) return
  const id = state.selectedNodeId
  state.nodes = state.nodes.filter(n => n.id !== id)
  state.edges = state.edges.filter(e => e.sourceId !== id && e.targetId !== id)
  const el = document.getElementById(`node-${id}`)
  if (el) el.remove()
  renderEdges()
  state.selectedNodeId = null
  notifySwift('nodeDeleted', { id })
}
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinement/AgentRefinement/Views/workflow-canvas/
git commit -m "feat: add workflow canvas HTML/CSS/JS for WKWebView"
```

---

### Task 2: WorkflowBridge — Swift ↔ JS Communication

**Files:**
- Create: `AgentRefinement/AgentRefinement/Services/WorkflowBridge.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/WorkflowCanvasView.swift`

- [ ] **Step 1: Create WorkflowBridge**

Create `AgentRefinement/AgentRefinement/Services/WorkflowBridge.swift`:

```swift
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
                selectedNodeData = body["data"] as? [String: Any]
            case "nodeAdded", "nodeMoved", "edgeAdded", "nodeDeleted":
                hasChanges = true
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
```

- [ ] **Step 2: Create WorkflowCanvasView**

Create `AgentRefinement/AgentRefinement/Views/Components/WorkflowCanvasView.swift`:

```swift
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

        if let htmlURL = Bundle.main.url(forResource: "canvas", withExtension: "html", subdirectory: "Views/workflow-canvas") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }

        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
```

- [ ] **Step 3: Build and verify**

```bash
swift build
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add WorkflowBridge and WorkflowCanvasView for WKWebView integration"
```

---

### Task 3: WorkflowScreen — Full Editor UI

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Screens/WorkflowScreen.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/WorkflowPropertiesPanel.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/MainTabView.swift` — wire .workflow
- Modify: `AgentRefinement/AgentRefinement/AppState.swift` — add workflow CRUD

- [ ] **Step 1: Add workflow CRUD to AppState**

Add to `AppState.swift`:

```swift
// MARK: - Workflow CRUD
@Published var selectedWorkflowId: UUID?

var selectedWorkflow: Workflow? {
    workflows.first { $0.id == selectedWorkflowId }
}

func addWorkflow(name: String) {
    let startNode = WorkflowNode(type: .start, position: Position(x: 100, y: 30), label: "▶ 開始")
    let endNode = WorkflowNode(type: .end, position: Position(x: 100, y: 400), label: "⏹ 終了")
    let workflow = Workflow(name: name, nodes: [startNode, endNode])
    workflows.append(workflow)
    try? dataStore.saveWorkflow(workflow)
    selectedWorkflowId = workflow.id
}

func updateWorkflow(_ workflow: Workflow) {
    workflows = workflows.map { $0.id == workflow.id ? workflow : $0 }
    try? dataStore.saveWorkflow(workflow)
}

func deleteWorkflow(id: UUID) {
    workflows = workflows.filter { $0.id != id }
    if selectedWorkflowId == id { selectedWorkflowId = nil }
    try? dataStore.deleteWorkflow(id: id)
}
```

- [ ] **Step 2: Create WorkflowPropertiesPanel**

Create `AgentRefinement/AgentRefinement/Views/Components/WorkflowPropertiesPanel.swift`:

```swift
import SwiftUI

struct WorkflowPropertiesPanel: View {
    let nodeData: [String: Any]?
    let onDelete: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if let data = nodeData {
                    nodeProperties(data)
                } else {
                    Text("ノードを選択してください")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding(12)
        }
        .frame(width: 220)
    }

    private func nodeProperties(_ data: [String: Any]) -> some View {
        let type = data["type"] as? String ?? "unknown"
        let label = data["label"] as? String ?? ""

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(nodeIcon(type)).font(.system(size: 16))
                VStack(alignment: .leading) {
                    Text(label).font(.system(size: 12, weight: .bold))
                    Text(type).font(.system(size: 9)).foregroundStyle(.tertiary)
                }
            }

            Divider()

            Text("ノードタイプ: \(type)")
                .font(.system(size: 10)).foregroundStyle(.secondary)

            if let x = data["x"] as? Double, let y = data["y"] as? Double {
                Text("位置: (\(Int(x)), \(Int(y)))")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
            }

            Divider()

            Button(action: onDelete) {
                Text("🗑 ノードを削除")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.red.opacity(0.5)))
            }
            .buttonStyle(.plain)
        }
    }

    private func nodeIcon(_ type: String) -> String {
        let icons = ["start": "▶", "end": "⏹", "slot": "📦", "gate": "⛩", "loop": "🔁", "fork": "⑃", "join": "⑃"]
        return icons[type] ?? "📦"
    }
}
```

- [ ] **Step 3: Create WorkflowScreen**

Create `AgentRefinement/AgentRefinement/Views/Screens/WorkflowScreen.swift`:

```swift
import SwiftUI

struct WorkflowScreen: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var bridge = WorkflowBridge()
    @State private var showWorkflowPicker = false

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            HSplitView {
                WorkflowCanvasView(bridge: bridge)
                WorkflowPropertiesPanel(
                    nodeData: bridge.selectedNodeData,
                    onDelete: { bridge.deleteSelectedNode() }
                )
            }
        }
        .onChange(of: appState.selectedWorkflowId) { loadSelected() }
        .onAppear { loadSelected() }
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button { showWorkflowPicker.toggle() } label: {
                HStack(spacing: 4) {
                    Text("🔀")
                    Text(appState.selectedWorkflow?.name ?? "ワークフロー選択")
                        .font(.system(size: 11, weight: .semibold))
                    Text("▾").foregroundStyle(.secondary)
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showWorkflowPicker) {
                workflowPickerPopover
            }

            Spacer()

            Button {
                bridge.deleteSelectedNode()
            } label: {
                Text("🗑").font(.system(size: 11))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button { saveWorkflow() } label: {
                Text("📋 保存").font(.system(size: 10, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button {} label: {
                Text("▶ このフローで実行")
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 14).padding(.vertical, 5)
                    .background(Color.accentColor).foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
    }

    private var workflowPickerPopover: some View {
        VStack(spacing: 0) {
            HStack {
                Text("ワークフロー").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)
                Spacer()
                Button {
                    appState.addWorkflow(name: "新規ワークフロー")
                    showWorkflowPicker = false
                } label: {
                    Text("+ 新規").font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.accentColor).foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(10)
            Divider()

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(appState.workflows) { wf in
                        Button {
                            appState.selectedWorkflowId = wf.id
                            showWorkflowPicker = false
                        } label: {
                            HStack {
                                Text(wf.name).font(.system(size: 11))
                                Spacer()
                                if wf.id == appState.selectedWorkflowId {
                                    Text("使用中").font(.system(size: 8)).foregroundStyle(.blue)
                                }
                            }
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(wf.id == appState.selectedWorkflowId ? Color.accentColor.opacity(0.1) : Color.clear)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(width: 250, maxHeight: 300)
        }
    }

    private func loadSelected() {
        if let workflow = appState.selectedWorkflow {
            bridge.loadWorkflow(workflow)
        }
    }

    private func saveWorkflow() {
        bridge.getWorkflowData { data in
            guard let data, var workflow = appState.selectedWorkflow else { return }
            // Parse nodes and edges from JS data back to Swift models
            workflow.updatedAt = Date()
            Task { @MainActor in
                appState.updateWorkflow(workflow)
            }
        }
    }
}
```

- [ ] **Step 4: Wire into MainTabView**

Replace `.workflow` case:
```swift
case .workflow:
    WorkflowScreen()
```

- [ ] **Step 5: Build and verify**

```bash
swift build
```

- [ ] **Step 6: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add WorkflowScreen with canvas editor and properties panel"
```

---

### Task 4: Evaluation System — Models + UI

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Components/EvaluationView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/AgentHistoryView.swift`
- Modify: `AgentRefinement/AgentRefinement/AppState.swift` — add evaluation methods

- [ ] **Step 1: Add evaluation methods to AppState**

Add to `AppState.swift`:

```swift
// MARK: - Evaluation

func addEvaluation(
    agentSnapshotId: UUID,
    projectId: UUID,
    evaluatorRole: EvaluatorRole,
    score: Int,
    comment: String?,
    roundNumber: Int?,
    isFinal: Bool
) {
    let evaluation = Evaluation(
        evaluatorRole: evaluatorRole,
        score: score,
        comment: comment,
        roundNumber: roundNumber,
        isFinal: isFinal
    )

    projects = projects.map { project in
        guard project.id == projectId else { return project }
        var updated = project
        updated.agentSnapshots = updated.agentSnapshots.map { snapshot in
            guard snapshot.id == agentSnapshotId else { return snapshot }
            var s = snapshot
            s.evaluations.append(evaluation)
            return s
        }
        updated.updatedAt = Date()
        return updated
    }

    if let project = projects.first(where: { $0.id == projectId }) {
        try? dataStore.saveProject(project)
    }
}
```

- [ ] **Step 2: Create EvaluationView**

Create `AgentRefinement/AgentRefinement/Views/Components/EvaluationView.swift`:

```swift
import SwiftUI

struct EvaluationView: View {
    let evaluations: [Evaluation]
    let onSubmit: (EvaluatorRole, Int, String?) -> Void

    @State private var selectedRole: EvaluatorRole = .ceo
    @State private var score: Int = 7
    @State private var comment: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("⭐ 評価").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)

            if !evaluations.isEmpty {
                existingEvaluations
            }

            Divider()

            newEvaluationForm
        }
    }

    private var existingEvaluations: some View {
        VStack(spacing: 6) {
            ForEach(evaluations) { eval in
                HStack(spacing: 8) {
                    Text(roleIcon(eval.evaluatorRole))
                        .font(.system(size: 14))
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(eval.evaluatorRole.rawValue.uppercased())
                                .font(.system(size: 9, weight: .bold))
                            Spacer()
                            Text("\(eval.score)/10")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(scoreColor(eval.score))
                        }
                        if let comment = eval.comment, !comment.isEmpty {
                            Text(comment)
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    private var newEvaluationForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("新規評価").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)

            Picker("評価者", selection: $selectedRole) {
                Text("👑 CEO").tag(EvaluatorRole.ceo)
                Text("📊 Manager").tag(EvaluatorRole.manager)
                Text("📋 PMO").tag(EvaluatorRole.pmo)
            }
            .pickerStyle(.segmented)
            .font(.system(size: 10))

            HStack {
                Text("スコア: \(score)/10").font(.system(size: 10))
                Slider(value: Binding(
                    get: { Double(score) },
                    set: { score = Int($0) }
                ), in: 1...10, step: 1)
            }

            TextField("コメント（任意）", text: $comment)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 10))

            Button {
                onSubmit(selectedRole, score, comment.isEmpty ? nil : comment)
                comment = ""
                score = 7
            } label: {
                Text("評価を送信")
                    .font(.system(size: 10, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
    }

    private func roleIcon(_ role: EvaluatorRole) -> String {
        switch role {
        case .ceo: "👑"
        case .manager: "📊"
        case .pmo: "📋"
        }
    }

    private func scoreColor(_ score: Int) -> Color {
        if score >= 8 { return .green }
        if score >= 5 { return .orange }
        return .red
    }
}
```

- [ ] **Step 3: Create AgentHistoryView**

Create `AgentRefinement/AgentRefinement/Views/Components/AgentHistoryView.swift`:

```swift
import SwiftUI

struct AgentHistoryView: View {
    let agent: MasterAgent
    let projects: [Project]

    private var participatedProjects: [(Project, AgentSnapshot)] {
        projects.compactMap { project in
            if let snapshot = project.agentSnapshots.first(where: { $0.masterAgentId == agent.id }) {
                return (project, snapshot)
            }
            return nil
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("📁 案件履歴").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)

            if participatedProjects.isEmpty {
                Text("まだ案件に参加していません")
                    .font(.system(size: 10)).foregroundStyle(.tertiary)
            } else {
                ForEach(participatedProjects, id: \.1.id) { project, snapshot in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(project.name)
                                .font(.system(size: 10, weight: .semibold))
                            Spacer()
                            if let avg = snapshot.averageScore {
                                Text("⭐ \(String(format: "%.1f", avg))")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.orange)
                            }
                        }
                        Text("参加: \(snapshot.createdAt.formatted(.dateTime.month().day()))")
                            .font(.system(size: 9)).foregroundStyle(.tertiary)

                        if !snapshot.evaluations.isEmpty {
                            HStack(spacing: 4) {
                                ForEach(snapshot.evaluations) { eval in
                                    Text("\(eval.evaluatorRole.rawValue): \(eval.score)")
                                        .font(.system(size: 8))
                                        .padding(.horizontal, 4).padding(.vertical, 1)
                                        .background(Color(nsColor: .controlBackgroundColor))
                                        .clipShape(Capsule())
                                }
                            }
                        }

                        Button {
                            // スナップショットから新規エージェント作成
                        } label: {
                            Text("📋 この設定で新規作成")
                                .font(.system(size: 9))
                                .foregroundStyle(.blue)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
                }
            }
        }
    }
}
```

- [ ] **Step 4: Build and verify**

```bash
swift build
```

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add evaluation system UI and agent history view"
```

---

### Task 5: Python Backend — Evaluation Endpoints

**Files:**
- Create: `app/evaluation.py`
- Create: `tests/test_evaluation.py`
- Modify: `app/main.py` — add evaluation endpoints

- [ ] **Step 1: Write failing test**

Create `tests/test_evaluation.py`:

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app, get_store
from app.store import FileStore


@pytest.fixture
def client(tmp_path):
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_submit_evaluation(client):
    project = {
        "id": "proj-1",
        "name": "Test",
        "working_directory": "/tmp",
        "status": "active",
        "agent_snapshots": [
            {
                "id": "snap-1",
                "master_agent_id": "worker-1",
                "config": {"id": "worker-1", "name": "Worker"},
                "project_id": "proj-1",
                "evaluations": [],
            }
        ],
    }
    client.post("/api/projects", json=project)

    eval_data = {
        "project_id": "proj-1",
        "snapshot_id": "snap-1",
        "evaluator_role": "ceo",
        "score": 8,
        "comment": "Good work",
        "is_final": False,
    }
    resp = client.post("/api/evaluations", json=eval_data)
    assert resp.status_code == 201

    projects = client.get("/api/projects").json()
    snapshot = projects[0]["agent_snapshots"][0]
    assert len(snapshot["evaluations"]) == 1
    assert snapshot["evaluations"][0]["score"] == 8


def test_evaluation_score_clamped(client):
    project = {
        "id": "proj-2",
        "name": "Test2",
        "working_directory": "/tmp",
        "status": "active",
        "agent_snapshots": [
            {"id": "snap-2", "master_agent_id": "w", "config": {}, "project_id": "proj-2", "evaluations": []}
        ],
    }
    client.post("/api/projects", json=project)

    resp = client.post("/api/evaluations", json={
        "project_id": "proj-2", "snapshot_id": "snap-2",
        "evaluator_role": "manager", "score": 15, "is_final": True,
    })
    assert resp.status_code == 201

    projects = client.get("/api/projects").json()
    assert projects[0]["agent_snapshots"][0]["evaluations"][0]["score"] == 10


def test_get_agent_evaluations(client):
    project = {
        "id": "proj-3", "name": "T", "working_directory": "/tmp", "status": "active",
        "agent_snapshots": [
            {"id": "snap-3", "master_agent_id": "a1", "config": {}, "project_id": "proj-3",
             "evaluations": [{"evaluator_role": "ceo", "score": 9, "is_final": True}]}
        ],
    }
    client.post("/api/projects", json=project)

    resp = client.get("/api/agents/a1/evaluations")
    assert resp.status_code == 200
    evals = resp.json()
    assert len(evals) == 1
    assert evals[0]["score"] == 9
```

- [ ] **Step 2: Create evaluation.py**

Create `app/evaluation.py`:

```python
"""Evaluation logic for agent performance scoring."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def create_evaluation(
    evaluator_role: str,
    score: int,
    comment: str | None = None,
    round_number: int | None = None,
    is_final: bool = False,
) -> dict[str, Any]:
    clamped_score = max(1, min(10, score))
    return {
        "id": str(uuid4()),
        "evaluator_role": evaluator_role,
        "score": clamped_score,
        "comment": comment,
        "round_number": round_number,
        "is_final": is_final,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def add_evaluation_to_project(
    project: dict[str, Any],
    snapshot_id: str,
    evaluation: dict[str, Any],
) -> dict[str, Any]:
    updated_snapshots = []
    for snap in project.get("agent_snapshots", []):
        if snap.get("id") == snapshot_id:
            evals = list(snap.get("evaluations", []))
            evals.append(evaluation)
            updated_snapshots.append({**snap, "evaluations": evals})
        else:
            updated_snapshots.append(snap)
    return {**project, "agent_snapshots": updated_snapshots}


def get_agent_evaluations_across_projects(
    projects: list[dict[str, Any]],
    agent_id: str,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for project in projects:
        for snap in project.get("agent_snapshots", []):
            if snap.get("master_agent_id") == agent_id:
                for ev in snap.get("evaluations", []):
                    results.append({
                        **ev,
                        "project_id": project.get("id"),
                        "project_name": project.get("name"),
                    })
    return results
```

- [ ] **Step 3: Add evaluation endpoints to main.py**

Add to `app/main.py`:

```python
from app.evaluation import create_evaluation, add_evaluation_to_project, get_agent_evaluations_across_projects

@app.post("/api/evaluations", status_code=201)
def submit_evaluation(payload: dict, store: FileStore = Depends(get_store)):
    project_id = payload["project_id"]
    projects = store.load_projects()
    project = next((p for p in projects if p["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    evaluation = create_evaluation(
        evaluator_role=payload["evaluator_role"],
        score=payload["score"],
        comment=payload.get("comment"),
        round_number=payload.get("round_number"),
        is_final=payload.get("is_final", False),
    )

    updated = add_evaluation_to_project(project, payload["snapshot_id"], evaluation)
    store.save_project(updated)
    return evaluation


@app.get("/api/agents/{agent_id}/evaluations")
def get_agent_evaluations(agent_id: str, store: FileStore = Depends(get_store)):
    projects = store.load_projects()
    return get_agent_evaluations_across_projects(projects, agent_id)
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m pytest tests/ -v
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add app/evaluation.py tests/test_evaluation.py app/main.py
git commit -m "feat: add evaluation endpoints and scoring logic"
```

---

### Task 6: Real Execution Integration

**Files:**
- Modify: `AgentRefinement/AgentRefinement/Views/Screens/RequirementsScreen.swift`
- Modify: `AgentRefinement/AgentRefinement/AppState.swift`

- [ ] **Step 1: Add execution method to AppState**

Add to `AppState.swift`:

```swift
// MARK: - Execution

func executeRefinement(requirements: String) async {
    guard !isExecuting, let project = selectedProject else { return }
    isExecuting = true
    executionEvents = []

    let agentDTOs = agents.map { agent in
        AgentDTO(
            id: agent.id,
            name: agent.name,
            orgRole: agent.orgRoles.first?.rawValue ?? "worker",
            provider: agent.provider.rawValue,
            mode: agent.mode.rawValue,
            persona: agent.persona,
            skills: agent.skills,
            dependsOn: agent.dependsOn,
            model: agent.model
        )
    }

    let request = RefineRequestDTO(
        workflowMode: "coding",
        orchestrationMode: "sequential",
        sourceText: requirements,
        objective: nil,
        rounds: 1,
        agents: agentDTOs
    )

    do {
        for try await event in apiClient.streamRefine(request: request) {
            executionEvents.append(event)
        }
    } catch {
        // execution error
    }

    isExecuting = false
}

@Published var executionEvents: [StreamEvent] = []
```

- [ ] **Step 2: Update RequirementsScreen to use real execution**

Update `startExecution()` in RequirementsScreen to call `appState.executeRefinement(requirements:)` and update log entries from stream events.

- [ ] **Step 3: Build and verify**

```bash
swift build
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: integrate real execution via APIClient streaming"
```

---

## Phase 3 Completion Checklist

After all 6 tasks:

- [ ] `swift build` succeeds
- [ ] `swift test` passes all tests
- [ ] `python -m pytest tests/ -v` passes all tests
- [ ] ワークフローエディタ: ノードをドラッグ配置、線で接続、PDCAテンプレート一括配置
- [ ] ワークフロー管理: ドロップダウンで切替、新規作成、保存
- [ ] 評価: CEO/Manager/PMOからスコア+コメント送信
- [ ] エージェント履歴: 案件参加履歴+各時点の評価が見える
- [ ] 実行統合: 要件入力→FastAPIストリーミング→ログ表示

**これで全3フェーズ完了。macOSネイティブアプリの主要機能が揃います。**
