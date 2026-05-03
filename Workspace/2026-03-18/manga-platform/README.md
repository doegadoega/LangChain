# Manga Platform

1時間ごとに20ページ更新される10本の新規連載と、更新通知、編集体制、漫画制作エージェント群をまとめた配信プラットフォームです。

## 起動

```bash
cd /Users/sfidante-he/workspace/LangChain/Workspace/2026-03-18/manga-platform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

ブラウザで `http://127.0.0.1:8010` を開きます。

## 構成

- `GET /api/platform`: 連載一覧、編集体制、制作エージェント、直近更新を返す
- `GET /api/releases?since=<ISO8601>`: 指定時刻以降の更新イベントを返す
- `POST /api/subscriptions`: 通知購読を登録する

## 運用ルール

- 10連載を6分刻みでずらして配信し、各作品は毎時1回更新
- 1回の更新は常に20ページ
- 更新検知はブラウザ通知と購読登録の両方に対応
- 実在の人物名を含む編集体制は、公開前提で契約と権利処理を通す運用想定
