import SwiftUI

enum OrgRole: String, Codable, CaseIterable, Identifiable, Sendable {
    case ceo
    case manager
    case pmo
    case worker
    case qa
    case uiDesigner = "ui_designer"
    case systemDesigner = "system_designer"
    case opsDesigner = "ops_designer"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .ceo: "👑"
        case .manager: "📊"
        case .pmo: "📋"
        case .worker: "⚒️"
        case .qa: "✅"
        case .uiDesigner: "🎨"
        case .systemDesigner: "🏗"
        case .opsDesigner: "🔧"
        }
    }

    var color: Color {
        switch self {
        case .ceo: Color(red: 0.976, green: 0.886, blue: 0.686)
        case .manager: Color(red: 0.537, green: 0.706, blue: 0.98)
        case .pmo: Color(red: 0.796, green: 0.651, blue: 0.969)
        case .worker: Color(red: 0.58, green: 0.886, blue: 0.835)
        case .qa: Color(red: 0.651, green: 0.89, blue: 0.631)
        case .uiDesigner: Color(red: 0.961, green: 0.761, blue: 0.906)
        case .systemDesigner: Color(red: 0.98, green: 0.702, blue: 0.529)
        case .opsDesigner: Color(red: 0.455, green: 0.78, blue: 0.925)
        }
    }

    var displayName: String {
        switch self {
        case .ceo: "CEO"
        case .manager: "Manager"
        case .pmo: "PMO"
        case .worker: "Worker"
        case .qa: "QA"
        case .uiDesigner: "UI Designer"
        case .systemDesigner: "Sys Designer"
        case .opsDesigner: "Ops Designer"
        }
    }

    var shortName: String {
        switch self {
        case .ceo: "CEO"
        case .manager: "Mgr"
        case .pmo: "PMO"
        case .worker: "Worker"
        case .qa: "QA"
        case .uiDesigner: "UI"
        case .systemDesigner: "Sys"
        case .opsDesigner: "Ops"
        }
    }
}
