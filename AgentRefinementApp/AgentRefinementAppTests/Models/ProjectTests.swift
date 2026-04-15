import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("Project Model Tests")
struct ProjectTests {
    @Test("Project default status is active")
    func defaultStatusActive() {
        let project = Project(name: "Test", workingDirectory: "/tmp/test")
        #expect(project.status == .active)
    }

    @Test("Slot tracks assigned agents")
    func slotAssignment() {
        var slot = Slot(orgRole: .worker, minCount: 1, maxCount: 3, required: true)
        #expect(slot.assignedAgentIds.isEmpty)
        slot.assignedAgentIds.append("worker-1")
        #expect(slot.assignedAgentIds.count == 1)
    }

    @Test("OrganizationTemplate has slots")
    func templateHasSlots() {
        let template = OrganizationTemplate(
            name: "Review Team",
            slots: [
                Slot(orgRole: .ceo, minCount: 1, maxCount: 1, required: true),
                Slot(orgRole: .worker, minCount: 2, maxCount: 3, required: true),
                Slot(orgRole: .qa, minCount: 1, maxCount: 3, required: true),
            ]
        )
        #expect(template.slots.count == 3)
        #expect(template.requiredSlots.count == 3)
    }
}
