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
                ForEach(evaluations) { eval in
                    HStack(spacing: 8) {
                        Text(roleIcon(eval.evaluatorRole)).font(.system(size: 14))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(eval.evaluatorRole.rawValue.uppercased()).font(.system(size: 9, weight: .bold))
                                Spacer()
                                Text("\(eval.score)/10").font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(scoreColor(eval.score))
                            }
                            if let comment = eval.comment, !comment.isEmpty {
                                Text(comment).font(.system(size: 9)).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            Divider()

            Text("新規評価").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)

            Picker("評価者", selection: $selectedRole) {
                Text("👑 CEO").tag(EvaluatorRole.ceo)
                Text("📊 Manager").tag(EvaluatorRole.manager)
                Text("📋 PMO").tag(EvaluatorRole.pmo)
            }
            .pickerStyle(.segmented).font(.system(size: 10))

            HStack {
                Text("スコア: \(score)/10").font(.system(size: 10))
                Slider(value: Binding(
                    get: { Double(score) },
                    set: { score = Int($0) }
                ), in: 1...10, step: 1)
            }

            TextField("コメント（任意）", text: $comment)
                .textFieldStyle(.roundedBorder).font(.system(size: 10))

            Button {
                onSubmit(selectedRole, score, comment.isEmpty ? nil : comment)
                comment = ""
                score = 7
            } label: {
                Text("評価を送信").font(.system(size: 10, weight: .semibold))
                    .frame(maxWidth: .infinity).padding(.vertical, 5)
                    .background(Color.accentColor).foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
    }

    private func roleIcon(_ role: EvaluatorRole) -> String {
        switch role { case .ceo: "👑"; case .manager: "📊"; case .pmo: "📋" }
    }

    private func scoreColor(_ score: Int) -> Color {
        if score >= 8 { return .green }
        if score >= 5 { return .orange }
        return .red
    }
}
