import Foundation
import Testing
@testable import AgentRefinement

@Suite("OrgRole Tests")
struct OrgRoleTests {
    @Test("All 8 roles have unique icons")
    func allRolesHaveUniqueIcons() {
        let icons = OrgRole.allCases.map(\.icon)
        #expect(Set(icons).count == OrgRole.allCases.count)
    }

    @Test("All 8 roles have display names")
    func allRolesHaveDisplayNames() {
        for role in OrgRole.allCases {
            #expect(!role.displayName.isEmpty)
        }
    }

    @Test("CEO icon is crown")
    func ceoIcon() {
        #expect(OrgRole.ceo.icon == "👑")
    }

    @Test("OrgRole encodes to JSON string")
    func encodesToJSON() throws {
        let data = try JSONEncoder().encode(OrgRole.ceo)
        let str = String(data: data, encoding: .utf8)
        #expect(str == "\"ceo\"")
    }

    @Test("OrgRole decodes from JSON string")
    func decodesFromJSON() throws {
        let data = Data("\"worker\"".utf8)
        let role = try JSONDecoder().decode(OrgRole.self, from: data)
        #expect(role == .worker)
    }
}
