import XCTest

final class AgentRefinementAppUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testProjectCreationToExecutionFlow() throws {
        let app = XCUIApplication()
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("agent-refinement-ui-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDir, withIntermediateDirectories: true)

        app.launchEnvironment["AGENT_REFINEMENT_DATA_DIR"] = testDir.path
        app.launchEnvironment["AGENT_REFINEMENT_AUTOMATED_TEST"] = "1"
        app.launchEnvironment["AGENT_REFINEMENT_E2E_PROJECT_NAME"] = "うんこ"
        app.launchEnvironment["AGENT_REFINEMENT_E2E_WORKDIR"] = testDir.appendingPathComponent("うんこ").path
        app.launchEnvironment["AGENT_REFINEMENT_E2E_REQUIREMENTS"] = "最高の晩餐について"
        app.launch()

        let addButton = app.buttons["project.add"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 8))
        addButton.click()

        let nextButton = app.buttons["new_project.next"]
        XCTAssertTrue(nextButton.waitForExistence(timeout: 5))
        nextButton.click()

        XCTAssertTrue(nextButton.waitForExistence(timeout: 5))
        nextButton.click()

        let submitButton = app.buttons["new_project.submit"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 5))
        submitButton.click()

        let completionMessage = app.staticTexts["全エージェントの実行が完了しました。"]
        XCTAssertTrue(completionMessage.waitForExistence(timeout: 20))
    }
}
