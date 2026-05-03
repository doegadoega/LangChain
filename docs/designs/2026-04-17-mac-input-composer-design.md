# AgentRefinementApp — 入力体験改善（Cmd+Enter送信）設計

## 1. 背景と目的

現行の macOS アプリでは、主要入力導線（要件入力・CEOチャット・Terminal入力）が1行入力中心で、長文入力や改行を伴う作業に不向きである。
本設計では「テキスト入力のしやすさ」を最優先に、次の統一操作を導入する。

- Enter: 改行
- Cmd+Enter: 送信/実行

対象は以下3箇所。

1. 要件・実行画面の要件入力
2. CEOチャットのメッセージ入力
3. Terminalのコマンド入力

## 2. 目標と非目標

### 2.1 目標

- 長文入力と複数行編集を快適にする
- 3画面のキー挙動を統一し、学習コストを下げる
- 日本語IME利用時に誤送信しない
- 既存の送信/実行ロジック（`startExecution` / `send` / `sendCommand`）を維持する

### 2.2 非目標

- 入力履歴、補完、コマンドパレット等の大型機能追加
- チャットログ/実行ログのデータ構造変更
- サーバーAPIやオーケストレーション挙動の変更

## 3. 採用方針

採用案は「共通コンポーネント案（推奨案2）」とする。

- `NSTextView` ラッパーの共通コンポーネント `MultilineComposer` を新規追加
- 3画面で同一コンポーネントを再利用
- キー入力・IME配慮・高さ自動調整・プレースホルダ表示を1箇所に集約

## 4. 変更範囲

### 4.1 新規追加

- `AgentRefinementApp/AgentRefinementApp/Views/Components/MultilineComposer.swift`

### 4.2 既存改修

- `AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift`
- `AgentRefinementApp/AgentRefinementApp/Views/Components/CEOChatView.swift`
- `AgentRefinementApp/AgentRefinementApp/Views/Components/TerminalView.swift`

## 5. コンポーネント設計

### 5.1 `MultilineComposer` の責務

- `Binding<String>` で親の入力状態を直接編集
- `placeholder` 表示
- `minHeight` / `maxHeight` で高さレンジを指定し、内容量に応じて自動拡張
- `Cmd+Enter` を捕捉して `onSubmit()` を呼ぶ
- `Enter` は改行として扱う
- IME変換中（marked textあり）は `Cmd+Enter` を無視

### 5.2 `MultilineComposer` の公開IF（想定）

- `text: Binding<String>`
- `placeholder: String`
- `minHeight: CGFloat`
- `maxHeight: CGFloat`
- `isEnabled: Bool`
- `onSubmit: () -> Void`

## 6. 画面別仕様

### 6.1 要件・実行（RequirementsScreen）

- `TextField` を `MultilineComposer` に置換
- `Cmd+Enter` で `startExecution()` 実行
- 下部ヒント表示: `Cmd+Enter で実行`
- 実行ボタンは維持し、既存の disabled 条件を継続

### 6.2 CEOチャット（CEOChatView）

- 入力欄を `MultilineComposer` に置換
- `Cmd+Enter` で `send()` 実行
- 送信後は入力クリア
- 連続入力しやすいようフォーカスを保持

### 6.3 Terminal（TerminalView）

- 1行 `TextField` を `MultilineComposer` に置換
- `Cmd+Enter` で `sendCommand()` 実行
- 複数行コマンドを編集してからまとめて投入可能

## 7. データフロー

1. ユーザー入力は `MultilineComposer` 内で `Binding<String>` に反映
2. `Cmd+Enter` 時のみ `onSubmit` を親へ通知
3. 親画面側で既存の送信/実行メソッドを呼び出し
4. 既存の状態更新（ログ、チャット、プロセス送信）を再利用

このため、入力UI以外の処理フローは変更しない。

## 8. エラーハンドリングと安全性

- 空白のみ入力は送信不可（既存ガード維持）
- `isEnabled == false` 時は編集不可・送信不可
- IME変換中の送信抑止で誤送信を回避
- 既存ボタン操作（クリック送信）を残し、ショートカット不慣れな操作も担保

## 9. テスト戦略

### 9.1 最低確認

- `swift test`（`AgentRefinementApp`）で回帰確認

### 9.2 手動確認

- 要件入力:
  - Enterで改行される
  - Cmd+Enterで実行される
  - 空入力時は実行不可
- CEOチャット:
  - Enterで改行される
  - Cmd+Enterで送信される
  - 送信後に入力が空になる
- Terminal:
  - Enterで改行される
  - Cmd+Enterで入力内容が送信される
- 日本語入力:
  - 変換中 Cmd+Enter で送信されない

## 10. リスクと対策

- リスク: `NSTextView` ブリッジでフォーカスや高さ更新が不安定化する可能性
- 対策: `MultilineComposer` 内で高さ計測を一元化し、適用タイミングを MainActor に寄せる

- リスク: 既存 `TextField` 固有の見た目との差異
- 対策: 余白・背景・ボーダーを画面ごとに最小調整できるようスタイル引数を持たせる

## 11. 受け入れ基準

- 3対象画面すべてで `Enter=改行` / `Cmd+Enter=送信(実行)` が成立
- 要件入力とCEOチャットが複数行入力可能
- 既存の実行・送信ロジックに機能退行がない
- ビルド/テストが通る
