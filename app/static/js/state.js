export const MAX_CUSTOM_AGENTS = 5;
export const PROFILE_STORAGE_KEY = "agent_refinement_profiles_v1";
export const DEFAULT_PRESET_ID = "writing_refine";

export const BUILTIN_PRESETS = [
  {
    id: "writing_refine",
    name: "文章推敲チーム",
    workflow_mode: "writing",
    orchestration_mode: "sequential",
    code_context: {},
    objective: "読み手に通る文章にする",
    global_instruction: "前置きなしで本文だけ出力。曖昧表現を減らす。",
    rounds: 1,
    agents: [
      {
        id: "drafter",
        name: "Drafter",
        mode: "writer",
        provider: "codex_cli",
        persona: "論点を整理し、目的達成に必要な骨子を作る。",
        skills_text: "構成設計\n要約\n明確化",
        depends_on_text: "",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "critic",
        name: "Critic",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "厳しめのレビュー担当。曖昧さ、冗長さ、根拠不足を指摘する。",
        skills_text: "論理性チェック\n曖昧表現の削減\n読み手目線レビュー",
        depends_on_text: "drafter",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "editor",
        name: "Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "全指摘を統合し、最終版として自然で通る文章に仕上げる。",
        skills_text: "統合推敲\nトーン調整\n最終品質確認",
        depends_on_text: "critic",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
  {
    id: "architecture_review",
    name: "設計レビュー組織",
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    code_context: {
      repository: "",
      target_paths: [],
      tech_stack: "既存アーキテクチャに準拠し、運用性とセキュリティを重視する。",
      acceptance_criteria:
        "1) 構成要素が明確 2) 主要リスクと対策が明記 3) 次に実装へ移せる具体度",
      test_command: "",
    },
    objective: "要件を満たす設計案を作り、リスクとトレードオフを可視化する",
    global_instruction:
      "出力は 1)設計概要 2)主要コンポーネント 3)データフロー 4)リスクと対策 の順で簡潔に。",
    rounds: 2,
    agents: [
      {
        id: "architect",
        name: "Architect",
        mode: "writer",
        provider: "codex_cli",
        persona: "要件から全体アーキテクチャ案を組み立てる。",
        skills_text: "アーキテクチャ設計\n分割統治\n技術選定",
        depends_on_text: "",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "scalability",
        name: "Scalability Reviewer",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "負荷・拡張性・運用性の穴を見つける。",
        skills_text: "スケーラビリティ\nSLO/SLI\n可観測性",
        depends_on_text: "architect",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "security",
        name: "Security Reviewer",
        mode: "reviewer",
        provider: "claude_cli",
        persona: "脅威モデル観点で設計の弱点を指摘する。",
        skills_text: "脅威分析\n権限設計\n監査ログ",
        depends_on_text: "architect",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "design_editor",
        name: "Design Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "設計案とレビューを統合し、意思決定しやすい最終版へまとめる。",
        skills_text: "意思決定資料化\nトレードオフ明文化\n要点整理",
        depends_on_text: "scalability,security",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
  {
    id: "coding_delivery",
    name: "実装デリバリーチーム",
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    code_context: {
      repository: "",
      target_paths: [],
      tech_stack: "",
      acceptance_criteria: "",
      test_command: "",
    },
    objective: "実装方針・品質観点・受け入れ条件を揃えて、実装に着手できる状態にする",
    global_instruction:
      "実装対象、変更方針、レビュー観点、テスト観点を明示。曖昧なTODOを残さない。",
    rounds: 2,
    agents: [
      {
        id: "impl_planner",
        name: "Implementation Planner",
        mode: "writer",
        provider: "codex_cli",
        persona: "実装の段取りと変更方針を作成する。",
        skills_text: "タスク分解\n依存関係整理\n実装計画",
        depends_on_text: "",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "code_reviewer",
        name: "Code Reviewer",
        mode: "reviewer",
        provider: "claude_cli",
        persona: "バグやリグレッションを優先して指摘する。",
        skills_text: "不具合検知\nリスク評価\n保守性レビュー",
        depends_on_text: "impl_planner",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "qa_reviewer",
        name: "QA Reviewer",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "テスト不足と受け入れ条件の漏れを指摘する。",
        skills_text: "テスト設計\n境界値\n受け入れ基準",
        depends_on_text: "impl_planner",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "release_editor",
        name: "Release Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "最終的に実装指示として実行可能な文章へ整える。",
        skills_text: "統合編集\n実行可能性確認\nリリース観点",
        depends_on_text: "code_reviewer,qa_reviewer",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
];

export const state = {
  agents: [],
  customIndex: 1,
  savedProfiles: [],
};

export function clone(value) {
  return structuredClone(value);
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseSkills(skillsText) {
  return (skillsText || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseDelimitedList(rawValue) {
  return (rawValue || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
