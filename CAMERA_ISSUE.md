# Camera.tsx モバイル表示問題 — 状況説明書

## プロジェクト概要

- **フレームワーク**: React (TypeScript) + Vite
- **対象ファイル**: `frontend/src/components/Camera.tsx`
- **用途**: アイドル特典会の撮影機能デモ。スマホ縦持ちで使用する前提。
- **テスト端末**: Android スマートフォン（機種・ブラウザ不明、Chrome系と推定）

---

## 達成したいこと

1. スマホを縦持ちした状態で、**カメラのプレビュー（モニター）が縦長（9:16）で表示**される
2. シャッターボタンを押すと、**プレビューに映っている範囲と同じ縦長画像が保存**される
3. つまり「モニターで見えているもの ＝ 保存される写真」が一致する

---

## 現在の症状（未解決）

### 症状A: portrait制約を指定するとカメラが映らない

```typescript
// この制約だとスマホでカメラ映像が一切表示されない（真っ黒）
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'environment',
    width: { ideal: 1080 },
    height: { ideal: 1920 },  // ← これが原因？
  },
  audio: false,
});
```

- エラーメッセージは表示されない（catchに落ちていない可能性）
- `ideal` なので `OverconstrainedError` にはならないはず
- ストリームは取得できているが `video.play()` が映像を表示しない？
- **PCブラウザでは正常に動作する**（スマホ実機のみで発生）

### 症状B: 制約を外すとカメラは映るが横長

```typescript
// これだとカメラは映るが、1920x1080（横長16:9）が返ってくる
navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' },
  audio: false,
});
```

- デバッグ表示: `映像: 1920x1080 (横長)`
- スマホを縦に持っていても、ブラウザは横長の映像を返す

---

## 現在のコードの構造

### レイアウト

```
wrapper (flex column, 100dvh, max-width 430px)
├── header (固定高さ)
├── viewfinder (flex: 1, position: relative, overflow: hidden)
│   ├── <video> (position: absolute, inset 0, objectFit: cover)
│   └── overlays (countdown, timer etc.)
├── controlArea (固定高さ 80px)
└── gallery / debug
```

### 撮影ロジック（capturePhoto）

ビューファインダーのDOM要素サイズ（`parentElement.clientWidth/Height`）からアスペクト比を算出し、映像をcanvasにクロップ描画して保存。

```typescript
const targetRatio = displayW / displayH; // ビューファインダーの縦横比
// videoRatio > targetRatio の場合 → 横長映像の左右をクロップ
```

**意図**: `objectFit: cover` でブラウザがクロップしている範囲と同じ範囲をcanvasで切り出す。

### 現在のフォールバック

```typescript
try {
  stream = getUserMedia({ width: { ideal: 1080 }, height: { ideal: 1920 } });
} catch {
  stream = getUserMedia({ facingMode }); // フォールバック
}
```

`ideal` は通常エラーにならないため、フォールバックには到達しない可能性が高い。

---

## これまで試したこと

| 試行 | 結果 |
|------|------|
| `aspectRatio: { ideal: 9/16 }` + `width: { ideal: 1080 }` | カメラは映るが横長(1920x1080)。ブラウザがaspectRatio無視 |
| `width: { ideal: 1080 }, height: { ideal: 1920 }` | **カメラが映らない（真っ黒）** |
| `{ facingMode }` のみ | カメラは映る。横長(1920x1080) |
| video要素に `autoPlay` 属性追加 | 効果不明（上記制約問題と複合） |
| video要素を `position: absolute` + `objectFit: cover` | CSS的には正しいはずだが、未検証 |

---

## 解決してほしいこと

1. **なぜ `height: { ideal: 1920 }` を指定するとスマホでカメラが映らないのか？**
   - エラーにはなっていない（catch節に入っていない）
   - stream自体は取得できている？
   - `video.play()` で映像が出ないだけ？

2. **横長映像しか取得できない場合に、縦長プレビューを正しく表示する方法**
   - `objectFit: cover` で理論上はビューファインダー（縦長コンテナ）に合わせて映像の左右がクロップされ、縦長に見えるはず
   - しかし実機で「横長に表示される」という報告があった（CSS設定前）
   - 現在は `position: absolute` + `objectFit: cover` を設定済みだが実機未確認

3. **プレビューと保存画像の一致を保証する方法**
   - 現在の `capturePhoto` はビューファインダーのDOM寸法からクロップ範囲を計算
   - `objectFit: cover` のクロップ挙動と一致するはず
   - ただし実機で検証できていない

---

## デバッグ用機能（実装済み）

画面下部に緑色のモノスペースフォントで以下を表示:

```
映像: 1920x1080 (横長) | Track: 1920x1080 | FALLBACK使用
```

- 映像の実際の解像度
- 横長/縦長の判定
- フォールバックが使われたかどうか

---

## ファイル

ソースコード全体: `frontend/src/components/Camera.tsx` (640行)
