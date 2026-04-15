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
