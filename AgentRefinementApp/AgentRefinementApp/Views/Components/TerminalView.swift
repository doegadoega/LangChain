import SwiftUI
import Foundation

struct TerminalView: View {
    @State private var output = "$ "
    @State private var inputText = ""
    @State private var process: Process?
    @State private var stdinPipe: Pipe?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    Text(output)
                        .font(.system(size: 15, design: .monospaced))
                        .foregroundStyle(.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 6)
                        .padding(.top, 2)
                        .id("bottom")
                }
                .onChange(of: output) { _, _ in
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }

            Divider()

            HStack(spacing: 4) {
                Text("$")
                    .font(.system(size: 15, design: .monospaced))
                    .foregroundStyle(.secondary)
                TextField("", text: $inputText)
                    .font(.system(size: 15, design: .monospaced))
                    .textFieldStyle(.plain)
                    .onSubmit { sendCommand() }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
        }
        .onAppear { startProcess() }
        .onDisappear { terminateProcess() }
    }

    private func startProcess() {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")

        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()
        proc.standardInput = stdin
        proc.standardOutput = stdout
        proc.standardError = stderr
        stdinPipe = stdin

        stdout.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor in output += text }
        }
        stderr.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor in output += text }
        }

        try? proc.run()
        process = proc
    }

    private func sendCommand() {
        let cmd = inputText
        inputText = ""
        output += cmd + "\n"
        guard let data = (cmd + "\n").data(using: .utf8) else { return }
        stdinPipe?.fileHandleForWriting.write(data)
    }

    private func terminateProcess() {
        (process?.standardOutput as? Pipe)?.fileHandleForReading.readabilityHandler = nil
        (process?.standardError as? Pipe)?.fileHandleForReading.readabilityHandler = nil
        process?.terminate()
        process = nil
        stdinPipe = nil
    }
}
