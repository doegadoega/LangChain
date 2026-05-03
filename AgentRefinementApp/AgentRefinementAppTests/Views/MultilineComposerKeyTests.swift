import Testing
import AppKit
@testable import AgentRefinementApp

@Suite("MultilineComposer Key Tests")
struct MultilineComposerKeyTests {
    @Test("Cmd+Enter triggers submit key action")
    func cmdEnterAction() {
        let action = MultilineComposerKeyResolver.resolve(
            keyCode: 36,
            modifierFlags: [.command],
            hasMarkedText: false
        )
        #expect(action == .submit)
    }

    @Test("Enter without command inserts newline")
    func enterAction() {
        let action = MultilineComposerKeyResolver.resolve(
            keyCode: 36,
            modifierFlags: [],
            hasMarkedText: false
        )
        #expect(action == .newline)
    }

    @Test("IME marked text prevents submit")
    func imeMarkedTextBlocksSubmit() {
        let action = MultilineComposerKeyResolver.resolve(
            keyCode: 36,
            modifierFlags: [.command],
            hasMarkedText: true
        )
        #expect(action == .none)
    }

    @Test("Non-enter key returns none")
    func otherKeyAction() {
        let action = MultilineComposerKeyResolver.resolve(
            keyCode: 0,
            modifierFlags: [.command],
            hasMarkedText: false
        )
        #expect(action == .none)
    }
}
