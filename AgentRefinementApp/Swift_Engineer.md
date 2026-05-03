# Swift Engineer Rules

## ファイル分割ルール

### Enum
- enumは階層でなければ1ファイルにまとめる
- 例: `Priority.swift`, `TaskCategory.swift`, `TaskStatus.swift`

### Struct
- structも同様に1ファイルにまとめる
- 例: `Task.swift`, `TaskStatistics.swift`

### UI Components
- UIコンポーネントは`***View`、`***TabView`、`***Button`などの命名規則に従う
- 例: `FilterChipView.swift`, `TaskListView.swift`, `AddTaskView.swift`

## SwiftUI View設計パターン

### iOS18 以降がターゲットです
- 可能な限り、最新のAPIを使用して作成していきます。
- Observation を使用しましょう

### コンポーネント分割原則
- **再利用可能なコンポーネント**は独立したViewとして分離
- **複雑なUI**は複数の小さなViewに分割
- **プレビュー用のView**は`#Preview`で独立してテスト可能にする

### FilterBannerView設計パターン
```swift
// メインのFilterBannerView
struct FilterBannerView: View {
    @StateObject var viewModel: TaskListViewModel
    
    var body: some View {
        VStack {
            FilterBannerContentsView(
                selectedCategory: viewModel.selectedCategory,
                selectedStatus: viewModel.selectedStatus,
                filterRemove: { viewModel.setCategoryFilter(nil) },
                statusRemove: { viewModel.setStatusFilter(nil) },
                clearAction: { viewModel.resetFilters() }
            )
        }
    }
}

// 内部実装用のFilterBannerContentsView
private struct FilterBannerContentsView: View {
    @State var selectedCategory: TaskCategory?
    @State var selectedStatus: TaskStatus?
    
    var filterRemove: (() -> Void)
    var statusRemove: (() -> Void)
    var clearAction: (() -> Void)
    
    var body: some View {
        // 実装詳細
    }
}
```

### View設計のベストプラクティス
- **@StateObject**: ViewModelを保持する場合は`@StateObject`を使用
- **@State**: ローカル状態は`@State`を使用
- **クロージャー渡し**: アクションはクロージャーとして渡す
- **private修飾子**: 内部実装用のViewは`private`にする
- **プレビュー分離**: 複雑なViewは独立したプレビューでテスト

### コードスタイル（クロージャと改行）
- アクションクロージャは1行に詰めず、必ずブロックで記述し、閉じ括弧の後に1行改行を入れる
  - NG: `orderTypeButton(title: "成行", selected: isMarketOrder) { isMarketOrder = true }`
  - OK:
    ```swift
    orderTypeButton(title: "成行", selected: isMarketOrder) {
        isMarketOrder = true
    }

    orderTypeButton(title: "指値", selected: !isMarketOrder) {
        isMarketOrder = false
    }
    ```

### フィルターUI設計
- **FilterChipView**: 個別のフィルター項目を表示
- **条件分岐**: `if let`でオプショナルな状態を表示
- **Spacer()**: レイアウトの調整に使用
- **アクセシビリティ**: ボタンには適切なラベルを設定

## MVVMアーキテクチャルール

### MVVM方式の採用判断
- **複雑な状態管理**が必要な場合はMVVMを採用
- **Repositoryパターン**を使用する場合はMVVMを採用
- **SwiftUI/UIKit両対応**が必要な場合はMVVMを採用
- **テスト容易性**を重視する場合はMVVMを採用
- **単純な画面**の場合は従来のMVC/Vでも可

### UseCase層（オプション）
- **複雑なビジネスロジック**がある場合はUseCaseを採用
- **複数のRepository**を組み合わせる場合はUseCaseを採用
- **ビジネスルールのテスト**を重視する場合はUseCaseを採用
- **単純なCRUD操作**の場合はUseCaseは不要

### Repository層
- データアクセスとビジネスロジックを分離
- `***RepositoryProtocol`を定義してテスト可能にする
- Combineを使用したリアクティブな状態管理を実装

### ViewModel層（Observation 前提）
- iOS 18 以降では Observation を基本にする
  - ViewModel は `@Observable` + `@MainActor`
  - プロパティは通常の `var` を使用（`@Published` は原則使わない）
  - 依存注入や非監視プロパティは `@ObservationIgnored`
- View と ViewModel は別ファイルに分離
  - `Views/.../***View.swift`
  - `Views/.../***ViewModel.swift`
- 計算プロパティ（computed var）はクラス先頭（状態宣言の直下）にまとめる
- 表示用フォーマット・色などの UI ロジックはモデル拡張へ委譲（下記参照）
- UseCase がある場合、Repository ではなく UseCase 経由で呼び出す

### View層
- Observation の ViewModel は `@State` あるいは `@Bindable` で保持（`@StateObject`は不要）
- Repositoryは直接使用せず、ViewModel経由でアクセス
- UseCaseがある場合は、UseCase経由でアクセス
- エラーハンドリングとローディング状態の表示

### 命名規則
- Repository: `***Repository.swift`, `***RepositoryProtocol.swift`
- UseCase: `***UseCase.swift`, `***UseCaseProtocol.swift`
- ViewModel: `***ViewModel.swift`, `***ViewModelProtocol.swift`
- View: `***View.swift`

### 変数・引数命名ルール
- 1～2文字の短い変数名は禁止（`i`, `n`, `q`, `p` など）
  - 数量は `quantity`、価格は `price` のように意味のある英単語を使用
  - ループなどでも `index`, `user`, `price`, `count` などの明確な名称を用いる
  - 注意: `quantity` / `price` はあくまで例示であり固定語ではない。文脈に応じて `limitPrice`, `orderQuantity`, `totalAmount` など意味が最も明確な名称を選定すること。
- 略語は必要最小限（一般的でない略語は使用しない）

### モデル拡張（UIロジックの集約）
- UI 表現（フォーマット文字列、カラー、表示名など）はモデルの `extension` に集約
  - 例: `TickerPriceResponse.Price.formattedCurrentPrice`, `changeColor`
  - 例: `TickerBasicResponse.Info.formattedMarketCap`
- 拡張ファイルは `Extensions/` 配下に `***+UIExtensions.swift` などの命名で配置

### 期間などのパラメータは Enum 化
- API に渡す値は `rawValue`、表示は `displayName` を持つ Enum を定義
  - 例: `HistoryPeriod (rawValue: "1mo", displayName: "1M")`
- UI 用候補は `static var uiDefault` などで定義し、ViewModel から参照

### ナビゲーション
- 画面遷移は `NavigationViewType` を経由
  - 新規画面は `NavigationViewType.destination(...)` に追加
  - フッターのメニューと整合する `MenuType` を使用

### プロジェクト構成/追加ルール
- 新規 Swift ファイルは Xcode プロジェクトに追加し、Target Membership（`MobileSDKPoc`）を有効化
- ファイル分割方針
  - View と ViewModel は別
  - API レスポンスモデルは `Networking/Responses/...` 配下
  - Request/Option はそれぞれ `Networking/Requests/...` / `Networking/RequestOptions/...`
  - 列挙は `Networking/Enumrators` に配置

### Info.plist 運用ルール
- **勝手に変更しない**。`Info.plist` の編集を行う場合は、PR 説明に「Info.plist 変更」を明記し、レビュワー承認を必須とする。
- 代表的な変更項目: `UIAppFonts`（フォント追加）、`CFBundleURLTypes`（URL Scheme）。
- URL Scheme は原則 `$(PRODUCT_BUNDLE_IDENTIFIER)` を基本とする。追加が必要な場合は理由と影響範囲をPRで説明する。
- フォント追加時の指針:
  - フォントファイルは `MobileSDKPoc/MobileSDKPoc/Resources/noto-sans-jp/` に配置する。
  - `UIAppFonts` には相対パス（例: `noto-sans-jp/NotoSansJP-Bold.otf`）で登録し、Target Membership を確認する。

### Combine活用
- `Publishers.CombineLatest`で複数の状態を監視
- `debounce`でパフォーマンス最適化
- `assign(to:on:)`で状態の自動同期
- `AnyCancellable`でメモリリーク防止

### エラーハンドリング
- UseCase層でビジネスルールエラーを定義
- `LocalizedError`プロトコルに準拠したエラー型
- ViewModel層でエラーをキャッチしてUIに反映
- ユーザーフレンドリーなエラーメッセージを提供

---

## アンチパターン集

本プロジェクトで実際に発生した問題や、避けるべき設計パターンをまとめます。

### AP-1: 非Observable経由のPickerバインディング

**NG**
```swift
// DomainManager は @Observable ではないため、Picker の選択が反映されない
Picker("API環境", selection: $viewModel.domainManager.currentDomain) {
    ForEach(viewModel.domainManager.availableDomains, id: \.self) { domain in
        Text(domain.displayName).tag(domain)
    }
}
```

**OK**
```swift
// ViewModel 側に @Observable なプロパティを用意し、didSet で同期する
// ViewModel
var selectedDomain: URLDomain = DomainManager.shared.currentDomain {
    didSet { domainManager.currentDomain = selectedDomain }
}

// View
Picker("API環境", selection: $viewModel.selectedDomain) { ... }
```

**理由**: `@Observable` でないオブジェクトのネストプロパティに `$` でバインドしても、SwiftUI の変更通知が届かず UI が更新されない。

---

### AP-2: 設定フラグの二重管理

**NG**
```swift
// UserDefaults と URLDomain の両方に同じ意味のフラグが存在
// AppKeys.swift
static var isZscalerTunnelEnabled: Bool {
    UserDefaults.standard.object(forKey: "ZSCALER_TUNNEL_ENABLED") as? Bool ?? true
}

// NetworkEnum.swift
var isConnectZscaler: Bool { ... } // 環境ごとに定義
```

**OK**
```swift
// 単一の情報源（Single Source of Truth）に統一
// URLDomain に isConnectZscaler を定義し、TunnelService はそこだけ参照
var isEnabled: Bool { DomainManager.shared.currentDomain.isConnectZscaler }
```

**理由**: 同じ意味のフラグが複数箇所にあると、片方だけ更新されて不整合が生じる。制御の根拠は1箇所に集約する。

---

### AP-3: API ホストのハードコード分散

**NG**
```swift
// 複数ファイルに同じドメイン文字列が散在
// UserAuthRequest.swift
override var host: String { "epi3igznma.execute-api.ap-northeast-1.amazonaws.com" }

// PushRegisterAPI.swift
override var host: String { "epi3igznma.execute-api.ap-northeast-1.amazonaws.com" }
```

**OK**
```swift
// APIPaths.Common または URLDomain に一元定義
enum APIPaths {
    enum Common {
        static let executeApiHost = "epi3igznma.execute-api.ap-northeast-1.amazonaws.com"
    }
}

// 各 Request は共通定義を参照
override var host: String { APIPaths.Common.executeApiHost }
```

**理由**: ドメイン変更時に修正漏れが発生する。環境切替にも対応できない。

---

### AP-4: View に状態ロジックを持たせすぎる

**NG**
```swift
// ChatView.swift 内に大量の @State
@State private var isShowingFilePicker = false
@State private var isShowingUploadSheet = false
@State private var uploadURL: String = ""
@State private var uploadFileId: String = ""
// ... 10個以上の @State
```

**OK**
```swift
// ViewModel に構造体でグループ化して移管
// ChatViewModel.swift
struct UploadState {
    var isShowingFilePicker = false
    var isShowingUploadSheet = false
    var uploadURL: String = ""
    var uploadFileId: String = ""
}
var uploadState = UploadState()
```

**理由**: View が肥大化し、テスト不能になる。関連する状態は ViewModel 内の struct にまとめ、責務を分離する。

---

### AP-5: トンネル停止時の isEnabled ガード

**NG**
```swift
// isEnabled=false のときに stopTunnel() をスキップしてしまう
func stopTunnel() async throws {
    if !isEnabled {
        state = .disconnected
        return  // ← 実際にはトンネルが ON のまま残る
    }
    try await zbridge.stopTunnel()
}
```

**OK**
```swift
// 停止処理は isEnabled に関係なく常に実行可能にする
func stopTunnel() async throws {
    guard zbridge.status() == "ON" else {
        state = .disconnected
        return
    }
    try await zbridge.stopTunnel()
    state = .disconnected
}
```

**理由**: 環境切替で `isEnabled` が `false` になった後も、既存トンネルを確実に落とす必要がある。「開始のガード」と「停止の実行」は対称にしない。

---

### AP-6: Alamofire セッションの不統一

**NG**
```swift
// execute は共有セッション、upload は AF（デフォルトセッション）を使用
func execute<T>(...) { let response = await sharedSession.request(...) }
func upload<T>(...) { let response = await AF.upload(...) }  // ← ログが出ない
```

**OK**
```swift
// 全リクエストを共有セッション経由に統一
func execute<T>(...) { let response = await sharedSession.request(...) }
func upload<T>(...) { let response = await sharedSession.upload(...) }
```

**理由**: `AF`（デフォルトセッション）と `sharedSession` が別インスタンスの場合、EventMonitor（ログ出力・cURL出力）が片方にしか効かない。

---

### AP-7: Info.plist の同期フォルダ内配置

**NG**
```
NotificationService/           ← PBXFileSystemSynchronizedRootGroup
├── Info.plist                 ← 自動でリソースコピー対象になる
├── NotificationService.swift
└── ...

Build Settings:
  INFOPLIST_FILE = NotificationService/Info.plist  ← 二重処理で衝突
```

**OK**
```
NotificationService/           ← 同期グループ（Info.plist を含めない）
├── NotificationService.swift
└── ...

NotificationService-Info.plist  ← ルート直下に配置

Build Settings:
  INFOPLIST_FILE = NotificationService-Info.plist
```

**理由**: Xcode の `PBXFileSystemSynchronizedRootGroup` はフォルダ内のファイルを自動でビルド対象に含める。`INFOPLIST_FILE` と二重になり `Multiple commands produce ... Info.plist` エラーが発生する。

---

### AP-8: UserDefaults.synchronize() の不要な呼び出し

**NG**
```swift
UserDefaults.standard.set(enabled, forKey: key)
UserDefaults.standard.synchronize()  // ← iOS 12 以降は不要
```

**OK**
```swift
UserDefaults.standard.set(enabled, forKey: key)
// synchronize() は呼ばない（システムが自動で永続化する）
```

**理由**: `synchronize()` は iOS 12 以降では Apple が非推奨としている。パフォーマンス劣化の原因にもなるため削除する。

---

### AP-9: do-catch の多重ネスト

**NG**
```swift
func doEverything() async {
    do {
        do {
            try await stepA()
        } catch {
            handleErrorA(error)
        }
        do {
            try await stepB()
        } catch {
            handleErrorB(error)
        }
        do {
            try await stepC()
        } catch {
            handleErrorC(error)
        }
    } catch {
        // 何もしない or 握りつぶし
    }
}
```

**OK**
```swift
func doEverything() async {
    do {
        try await stepA()
        try await stepB()
        try await stepC()
    } catch {
        handleError(error)
    }
}

// 個別のエラーハンドリングが必要ならメソッドに分離する
private func stepA() async throws { ... }
private func stepB() async throws { ... }
private func stepC() async throws { ... }
```

**理由**: `do-catch` は1メソッドに1つだけ。複数の `do-catch` をネストすると可読性が著しく低下し、エラーの握りつぶしや制御フローの見落としを招く。個別のエラー処理が必要な場合はメソッドに分離すること。

---

### AP-10: switch-case での値バインディングスタイル

**NG**
```swift
switch result {
case .success(let value):
    handle(value)
case .failure(let error):
    handle(error)
}
```

**OK**
```swift
switch result {
case let .success(value):
    handle(value)
case let .failure(error):
    handle(error)
}
```

**理由**: `let` を case の先頭に置く `case let .pattern(value)` 形式に統一する。引数が複数ある場合に `let` の重複を防ぎ、可読性が向上する。