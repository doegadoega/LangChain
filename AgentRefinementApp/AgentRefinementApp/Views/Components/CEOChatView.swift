import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let sender: String
    let icon: String
    let content: String
    let isUser: Bool
}

struct CEOChatView: View {
    @Binding var inputText: String
    let messages: [ChatMessage]
    let onSend: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("💬 CEO レポート").font(.system(size: 15, weight: .bold)).foregroundStyle(.orange)
                Spacer()
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(messages) { msg in
                        HStack(alignment: .top, spacing: 4) {
                            Text("\(msg.icon) \(msg.sender):")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(msg.isUser ? .blue : .orange)
                            Text(msg.content).font(.system(size: 16))
                        }
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 4)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    MultilineComposer(
                        text: $inputText,
                        placeholder: "メッセージを入力...",
                        minHeight: 34,
                        maxHeight: 120,
                        onSubmit: send
                    )

                    Button(action: send) {
                        Text("送信").font(.system(size: 16, weight: .semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.accentColor).foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    .buttonStyle(.plain)
                }

                HStack {
                    Spacer()
                    Text("⌘+Enter で送信")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
        }
    }

    private func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onSend(text)
        inputText = ""
    }
}
