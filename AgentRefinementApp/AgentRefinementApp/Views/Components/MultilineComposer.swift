import SwiftUI
import AppKit

enum ComposerKeyAction: Equatable {
    case none
    case newline
    case submit
}

enum MultilineComposerKeyResolver {
    static func resolve(
        keyCode: UInt16,
        modifierFlags: NSEvent.ModifierFlags,
        hasMarkedText: Bool
    ) -> ComposerKeyAction {
        // Keep submit/newline behavior deterministic across all composer usages.
        guard keyCode == 36 else { return .none }
        guard !hasMarkedText else { return .none }
        return modifierFlags.contains(.command) ? .submit : .newline
    }
}

struct MultilineComposer: View {
    @Binding var text: String
    let placeholder: String
    let minHeight: CGFloat
    let maxHeight: CGFloat
    let isEnabled: Bool
    let onSubmit: () -> Void

    @State private var measuredHeight: CGFloat

    init(
        text: Binding<String>,
        placeholder: String,
        minHeight: CGFloat,
        maxHeight: CGFloat,
        isEnabled: Bool = true,
        onSubmit: @escaping () -> Void
    ) {
        _text = text
        self.placeholder = placeholder
        self.minHeight = minHeight
        self.maxHeight = maxHeight
        self.isEnabled = isEnabled
        self.onSubmit = onSubmit
        _measuredHeight = State(initialValue: minHeight)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ComposerTextViewRepresentable(
                text: $text,
                measuredHeight: $measuredHeight,
                minHeight: minHeight,
                maxHeight: maxHeight,
                isEnabled: isEnabled,
                onSubmit: onSubmit
            )

            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 7)
                    .allowsHitTesting(false)
            }
        }
        .frame(height: min(max(measuredHeight, minHeight), maxHeight))
        .background(Color(nsColor: .textBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1)
        )
    }
}

private struct ComposerTextViewRepresentable: NSViewRepresentable {
    @Binding var text: String
    @Binding var measuredHeight: CGFloat

    let minHeight: CGFloat
    let maxHeight: CGFloat
    let isEnabled: Bool
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = false
        scrollView.autohidesScrollers = true

        let textView = ComposerTextView(frame: .zero)
        textView.font = .systemFont(ofSize: 14)
        textView.isRichText = false
        textView.importsGraphics = false
        textView.usesFindPanel = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticDataDetectionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = true
        textView.textContainerInset = NSSize(width: 8, height: 7)
        textView.drawsBackground = false
        textView.backgroundColor = .clear
        textView.delegate = context.coordinator
        textView.onSubmit = onSubmit
        textView.isEditable = isEnabled
        textView.isSelectable = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]

        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.lineFragmentPadding = 0
        textView.string = text

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? ComposerTextView else { return }
        context.coordinator.parent = self

        if textView.string != text {
            textView.string = text
        }

        textView.isEditable = isEnabled
        textView.textColor = isEnabled ? .labelColor : .disabledControlTextColor
        textView.onSubmit = onSubmit

        context.coordinator.recalculateHeight(for: textView)
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ComposerTextViewRepresentable

        init(_ parent: ComposerTextViewRepresentable) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            if parent.text != textView.string {
                parent.text = textView.string
            }
            recalculateHeight(for: textView)
        }

        func recalculateHeight(for textView: NSTextView) {
            guard
                let textContainer = textView.textContainer,
                let layoutManager = textView.layoutManager
            else { return }

            layoutManager.ensureLayout(for: textContainer)
            let usedHeight = layoutManager.usedRect(for: textContainer).height
            let rawHeight = usedHeight + textView.textContainerInset.height * 2 + 2
            let clampedHeight = min(max(rawHeight, parent.minHeight), parent.maxHeight)

            if abs(parent.measuredHeight - clampedHeight) > 0.5 {
                DispatchQueue.main.async {
                    self.parent.measuredHeight = clampedHeight
                }
            }

            textView.enclosingScrollView?.hasVerticalScroller = rawHeight > parent.maxHeight
        }
    }
}

private final class ComposerTextView: NSTextView {
    var onSubmit: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        // Intercept Enter here so Enter inserts newline while Cmd+Enter submits.
        let action = MultilineComposerKeyResolver.resolve(
            keyCode: event.keyCode,
            modifierFlags: event.modifierFlags.intersection(.deviceIndependentFlagsMask),
            hasMarkedText: hasMarkedText()
        )

        switch action {
        case .submit:
            onSubmit?()
        case .newline:
            insertNewline(nil)
        case .none:
            super.keyDown(with: event)
        }
    }
}
