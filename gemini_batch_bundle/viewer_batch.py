"""
AitW Batch JSONL Viewer — request/result JSONL만으로 동작 (다중 part 지원)

build_gemini_batch.py가 만든 request JSONL과 download_gemini_results.py가
받아온 result JSONL만 있으면 동작합니다. 여러 part를 한 번에 묶어서 표시 가능.
별도 index.jsonl이나 이미지 파일이 필요 없음 (이미지는 request에 base64로 내장).

기존 viewer.py는 그대로 유지 — 이 스크립트는 별도 파일.

Usage:
    # 1) 단일 part
    python viewer_batch.py \\
        --request data/google_apps/batch/batch_input_google_apps_part001.jsonl \\
        --result  data/google_apps/batch/batch_input_google_apps_part001_result_sorted.jsonl

    # 2) 여러 part 동시에 (request 여러 개, result 자동 매칭)
    python viewer_batch.py --request \\
        data/google_apps/batch/batch_input_google_apps_part001.jsonl \\
        data/google_apps/batch/batch_input_google_apps_part002.jsonl

    # 3) 디렉토리 자동 탐색 (가장 간편)
    python viewer_batch.py --batch-dir data/google_apps/batch

옵션:
    --request   request JSONL 1개 또는 여러 개 (공백 구분)
    --result    result JSONL (생략 시 request에서 _result_sorted.jsonl 자동 추정)
    --batch-dir batch_input_*.jsonl + 매칭 result 자동 탐색
    --port      웹 서버 포트 (기본 5001)
    --host      바인드 호스트 (기본 127.0.0.1)

기능:
- 여러 request 파일을 byte offset으로 인덱싱 (총 합 수십 GB도 인덱스만 메모리)
- result JSONL은 전체 메모리 적재 (보통 수십 MB 수준)
- 모든 part 통합 후 key(shard, ep_idx) 기준 정렬
- 에피소드별로 출처 part 파일 표시
- ←/→ navigation, 숫자 점프
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template_string, send_file


app = Flask(__name__)

# ── 전역 상태 ─────────────────────────────────────────────────────────
# key → (request_file_path, byte_offset, byte_length)
REQUEST_OFFSETS: dict[str, tuple[Path, int, int]] = {}
REQUEST_FILES: list[Path] = []          # 입력 받은 request 파일들
EPISODES: list[dict] = []               # 정렬된 에피소드 메타 (이미지 제외)


# "Instruction: <goal>\n\n..." 형식에서 첫 줄 추출
GOAL_RE = re.compile(r"^Instruction:\s*(.*)$", re.MULTILINE)


def parse_goal_from_prompt(text: str) -> str:
    m = GOAL_RE.search(text or "")
    return m.group(1).strip() if m else ""


def parse_key(key: str) -> tuple[int, int]:
    """shard{NNNNN}_ep{NNNN} → (shard, ep_idx). 파싱 실패 시 (-1, -1)."""
    try:
        s, e = key.split("_")
        return int(s.replace("shard", "")), int(e.replace("ep", ""))
    except Exception:
        return (-1, -1)


def index_request_jsonl(path: Path) -> tuple[dict, dict]:
    """request JSONL 한 개 스캔. (offsets, metas) 반환.

    offsets: key → (path, byte_offset, line_length)
    metas:   key → {"goal_info": str, "part": str}
    """
    offsets: dict[str, tuple[Path, int, int]] = {}
    metas:   dict[str, dict] = {}
    part_name = path.stem

    pos = 0
    with open(path, "rb") as f:
        for raw in f:
            length = len(raw)
            try:
                obj = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                pos += length
                continue

            key = obj.get("key")
            if key:
                offsets[key] = (path, pos, length)
                parts = (obj.get("request", {})
                            .get("contents", [{}])[0]
                            .get("parts", []))
                text = ""
                for p in parts:
                    if "text" in p:
                        text = p["text"]
                        break
                metas[key] = {
                    "goal_info": parse_goal_from_prompt(text),
                    "part":      part_name,
                }
            pos += length

    return offsets, metas


def auto_pair_result(req_path: Path) -> Path | None:
    """request 파일 → 매칭되는 result 파일 자동 추정.

    우선순위: <stem>_result_sorted.jsonl > <stem>_result.jsonl
    """
    stem   = req_path.stem
    parent = req_path.parent
    candidates = [
        parent / f"{stem}_result_sorted.jsonl",
        parent / f"{stem}_result.jsonl",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def find_batch_files(batch_dir: Path) -> list[Path]:
    """디렉토리에서 batch_input_*.jsonl 자동 탐색 (_result*는 제외)."""
    if not batch_dir.is_dir():
        raise SystemExit(f"디렉토리 아님: {batch_dir}")
    files = sorted(
        p for p in batch_dir.glob("batch_input_*.jsonl")
        if "_result" not in p.name
    )
    return files


def load_predictions(path: Path) -> dict:
    """result JSONL → key별 prediction/tokens 맵."""
    preds: dict[str, dict] = {}
    if not path.exists():
        print(f"  ⚠ result 파일 없음: {path}")
        return preds

    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            key = item.get("key", "")
            if not key:
                continue

            if item.get("error"):
                preds[key] = {"error": item["error"]}
                continue

            response = item.get("response", {})
            raw_text = (
                response.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
            )
            try:
                parsed = json.loads(raw_text)
            except json.JSONDecodeError:
                parsed = {"raw": raw_text}

            usage = response.get("usageMetadata", {})
            text_tok = img_tok = 0
            for d in usage.get("promptTokensDetails", []):
                mod = d.get("modality", "")
                cnt = d.get("tokenCount", 0)
                if   mod == "TEXT":  text_tok = cnt
                elif mod == "IMAGE": img_tok  = cnt

            preds[key] = {
                "prediction": parsed,
                "tokens": {
                    "input_text":  text_tok,
                    "input_image": img_tok,
                    "input_total": usage.get("promptTokenCount", 0),
                    "thinking":    usage.get("thoughtsTokenCount", 0),
                    "output":      usage.get("candidatesTokenCount", 0),
                    "total":       usage.get("totalTokenCount", 0),
                },
            }
    return preds


def load_episodes(request_paths: list[Path],
                  result_paths: list[Path | None]) -> None:
    """여러 (request, result) 페어 통합 로드. 전역 EPISODES/REQUEST_OFFSETS 채움."""
    global REQUEST_FILES, REQUEST_OFFSETS, EPISODES

    all_offsets: dict[str, tuple[Path, int, int]] = {}
    all_metas:   dict[str, dict] = {}
    all_preds:   dict[str, dict] = {}

    REQUEST_FILES = list(request_paths)

    for i, (req_path, res_path) in enumerate(zip(request_paths, result_paths), 1):
        print(f"[{i}/{len(request_paths)}] 인덱싱: {req_path.name}")
        offsets, metas = index_request_jsonl(req_path)
        print(f"    request 항목: {len(offsets):>6}건")

        # 중복 키 경고 (다른 part끼리는 충돌 안 나야 정상)
        dup = set(all_offsets) & set(offsets)
        if dup:
            print(f"    ⚠ 중복 key {len(dup)}건 — 나중 파일이 덮어씀")

        all_offsets.update(offsets)
        all_metas.update(metas)

        if res_path and res_path.exists():
            preds = load_predictions(res_path)
            print(f"    result 예측: {len(preds):>6}건  ({res_path.name})")
            all_preds.update(preds)
        else:
            print(f"    result 없음 — 예측 비어있음")

    REQUEST_OFFSETS = all_offsets

    eps: list[dict] = []
    for key, meta in all_metas.items():
        shard, ep_idx = parse_key(key)
        ep = {
            "key":       key,
            "shard":     shard,
            "ep_idx":    ep_idx,
            "goal_info": meta["goal_info"],
            "part":      meta["part"],
        }
        if key in all_preds:
            ep.update(all_preds[key])
        eps.append(ep)

    # shard, ep_idx 순 통합 정렬
    eps.sort(key=lambda e: (e["shard"], e["ep_idx"]))
    EPISODES = eps
    print(f"\n로드 완료: {len(EPISODES)}개 에피소드  "
          f"(예측 매칭 {sum(1 for e in eps if 'prediction' in e or 'error' in e)}건)")


# ── 필터링 ────────────────────────────────────────────────────────────
# (app_q, cat_q) → list of original indices into EPISODES
_FILTER_CACHE: tuple[str, str] | None = None
_FILTER_INDICES: list[int] = []


def _filter_indices(app_q: str, cat_q: str) -> list[int]:
    """case-insensitive substring 매칭. 마지막 결과 캐싱."""
    global _FILTER_CACHE, _FILTER_INDICES

    app_q = (app_q or "").lower().strip()
    cat_q = (cat_q or "").lower().strip()
    key = (app_q, cat_q)

    if _FILTER_CACHE == key:
        return _FILTER_INDICES

    if not app_q and not cat_q:
        result = list(range(len(EPISODES)))
    else:
        result = []
        for i, ep in enumerate(EPISODES):
            pred = ep.get("prediction")
            if not isinstance(pred, dict):
                continue
            app = (pred.get("app_name") or "").lower()
            cat = (pred.get("app_category") or "").lower()
            if app_q and app_q not in app:
                continue
            if cat_q and cat_q not in cat:
                continue
            result.append(i)

    _FILTER_CACHE = key
    _FILTER_INDICES = result
    return result


# ── Routes ────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/api/labels")
def api_labels():
    """모든 고유 app_name / app_category 반환 (datalist 자동완성용)."""
    apps: set[str] = set()
    cats: set[str] = set()
    for ep in EPISODES:
        pred = ep.get("prediction")
        if isinstance(pred, dict):
            app = (pred.get("app_name") or "").strip()
            cat = (pred.get("app_category") or "").strip()
            if app:
                apps.add(app)
            if cat:
                cats.add(cat)
    return jsonify({
        "apps":       sorted(apps),
        "categories": sorted(cats),
    })


@app.route("/api/episodes")
def list_episodes():
    from flask import request
    app_q = request.args.get("app", "")
    cat_q = request.args.get("category", "")
    indices = _filter_indices(app_q, cat_q)
    return jsonify({
        "total":         len(indices),
        "request_files": [str(p) for p in REQUEST_FILES],
        "filter":        {"app": app_q, "category": cat_q},
        "all_total":     len(EPISODES),
    })


@app.route("/api/episode/<int:idx>")
def get_episode(idx):
    """idx는 필터된 리스트 내의 위치. 필터 없으면 원본 인덱스와 동일."""
    from flask import request
    app_q = request.args.get("app", "")
    cat_q = request.args.get("category", "")
    indices = _filter_indices(app_q, cat_q)
    if not (0 <= idx < len(indices)):
        return jsonify({"error": "out of range"}), 404
    orig_idx = indices[idx]
    ep = dict(EPISODES[orig_idx])
    ep["index"]    = idx
    ep["total"]    = len(indices)
    ep["orig_idx"] = orig_idx
    return jsonify(ep)


@app.route("/api/image/<key>")
def get_image(key):
    """key에 해당하는 이미지를 해당 request JSONL에서 on-demand 디코딩."""
    if key not in REQUEST_OFFSETS:
        return "not found", 404
    req_path, offset, length = REQUEST_OFFSETS[key]
    with open(req_path, "rb") as f:
        f.seek(offset)
        raw = f.read(length)
    try:
        obj = json.loads(raw)
        parts = obj["request"]["contents"][0]["parts"]
        inline = None
        mime   = "image/webp"
        for p in parts:
            data = p.get("inline_data") or p.get("inlineData")
            if data:
                inline = data.get("data")
                mime   = data.get("mime_type") or data.get("mimeType") or mime
                break
        if not inline:
            return "no image", 404
        img_bytes = base64.b64decode(inline)
        return send_file(io.BytesIO(img_bytes), mimetype=mime)
    except Exception as e:
        return f"decode error: {e}", 500


@app.route("/api/stats")
def api_stats():
    """전체 에피소드에서 app_name / app_category 집계."""
    from collections import Counter

    app_counter: Counter[str] = Counter()
    cat_counter: Counter[str] = Counter()
    n_with_pred  = 0
    n_with_error = 0
    n_no_pred    = 0

    for ep in EPISODES:
        if "error" in ep:
            n_with_error += 1
            continue
        pred = ep.get("prediction")
        if not pred or not isinstance(pred, dict):
            n_no_pred += 1
            continue
        n_with_pred += 1
        app = (pred.get("app_name") or "").strip()
        cat = (pred.get("app_category") or "").strip()
        if app:
            app_counter[app] += 1
        if cat:
            cat_counter[cat] += 1

    return jsonify({
        "total_episodes":  len(EPISODES),
        "with_prediction": n_with_pred,
        "with_error":      n_with_error,
        "no_prediction":   n_no_pred,
        "unique_apps":       len(app_counter),
        "unique_categories": len(cat_counter),
        "apps":       [{"name": n, "count": c} for n, c in app_counter.most_common()],
        "categories": [{"name": n, "count": c} for n, c in cat_counter.most_common()],
    })


@app.route("/stats")
def stats_page():
    return render_template_string(STATS_HTML)


# ── HTML ──────────────────────────────────────────────────────────────
HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AitW Batch JSONL Viewer</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; background: #f0f2f5; color: #222; }
  .header { background: white; padding: 10px 20px; border-bottom: 1px solid #e0e0e0; }
  .header-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .filter-row { display: flex; gap: 10px; margin-top: 8px; align-items: center;
                font-size: 13px; }
  .filter-row input[type=text] { flex: 0 1 240px; padding: 5px 10px;
                                 border: 1px solid #c0c4cc; border-radius: 4px; font-size: 13px; }
  .filter-row input.active { background: #fffde7; border-color: #f9a825; }
  .filter-row .filter-info { color: #888; font-size: 12px; margin-left: auto; }
  .filter-row button.clear { padding: 4px 10px; font-size: 12px; }
  .header-info { flex: 1; min-width: 0; }
  .header-info .goal { font-size: 16px; font-weight: 500; color: #1565c0;
                       white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-info .meta { font-size: 11px; color: #888; margin-top: 4px; font-family: monospace; }
  .nav { display: flex; gap: 8px; align-items: center; font-size: 14px; }
  button { padding: 6px 14px; border: 1px solid #c0c4cc; background: white;
           border-radius: 4px; cursor: pointer; font-size: 13px; }
  button:hover:not(:disabled) { background: #f5f5f5; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type=number] { width: 80px; padding: 5px; border: 1px solid #c0c4cc;
                       border-radius: 4px; font-size: 13px; }
  .container { display: grid; grid-template-columns: minmax(0, 1fr) 380px;
               gap: 16px; padding: 16px;
               height: calc(100vh - 67px); box-sizing: border-box; }
  .image-panel { background: white; border-radius: 6px; padding: 16px;
                 display: flex; align-items: center; justify-content: center;
                 overflow: hidden; }
  .image-panel img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .info-panel { background: white; border-radius: 6px; padding: 18px; overflow-y: auto; }
  .prediction { background: #e8f5e9; border-left: 4px solid #43a047;
                padding: 12px; border-radius: 4px; margin-bottom: 18px; }
  .prediction.error { background: #ffebee; border-left-color: #e53935; }
  .prediction.empty { background: #f5f5f5; border-left-color: #aaa; }
  .pred-label { font-size: 10px; text-transform: uppercase; color: #555; letter-spacing: 0.5px; }
  .pred-app { font-size: 20px; font-weight: 600; color: #2e7d32; margin: 6px 0 2px; }
  .pred-cat { color: #666; font-size: 14px; }
  .field { margin-bottom: 14px; }
  .field-label { font-size: 10px; text-transform: uppercase; color: #888;
                 margin-bottom: 4px; letter-spacing: 0.5px; }
  .field-value { font-size: 13px; color: #333; word-break: break-all; }
  .mono { font-family: "SF Mono", Monaco, Consolas, monospace; font-size: 11px; }
  h3 { font-size: 12px; text-transform: uppercase; color: #888;
       letter-spacing: 0.5px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
  td:last-child { text-align: right; font-family: "SF Mono", Monaco, monospace; }
  tr.indent td:first-child { padding-left: 20px; color: #777; font-size: 12px; }
  tr.total td { font-weight: 600; border-top: 2px solid #888;
                border-bottom: none; padding-top: 8px; }
  .hint { text-align: center; font-size: 11px; color: #aaa; margin-top: 12px; }
  .src-file { font-size: 11px; color: #888; font-family: monospace; margin-top: 4px;
              word-break: break-all; }
</style>
</head>
<body>

<div class="header">
  <div class="header-row">
    <div class="header-info">
      <div class="goal" id="goal">Loading...</div>
      <div class="meta" id="meta"></div>
    </div>
    <div class="nav">
      <button id="prev-btn" onclick="prev()">← Prev</button>
      <input type="number" id="idx-input" min="0" onchange="goTo(this.value)">
      <span id="counter">/ ?</span>
      <button id="next-btn" onclick="next()">Next →</button>
      <a href="/stats" style="margin-left:12px;padding:6px 14px;border:1px solid #c0c4cc;
         background:white;border-radius:4px;font-size:13px;text-decoration:none;color:#222;">
         📊 Stats</a>
    </div>
  </div>
  <div class="filter-row">
    <label>🔍</label>
    <input type="text" id="app-filter" placeholder="App label 검색 (substring)" list="app-list">
    <input type="text" id="cat-filter" placeholder="Category label 검색 (substring)" list="cat-list">
    <button class="clear" onclick="clearFilters()">Clear</button>
    <span class="filter-info" id="filter-info"></span>
  </div>
</div>
<datalist id="app-list"></datalist>
<datalist id="cat-list"></datalist>

<div class="container">
  <div class="image-panel">
    <img id="img" src="" alt="screenshot">
  </div>
  <div class="info-panel">
    <div class="prediction empty" id="prediction"></div>

    <h3>Episode</h3>
    <div class="field">
      <div class="field-label">Key</div>
      <div class="field-value mono" id="key"></div>
    </div>
    <div class="field">
      <div class="field-label">Shard / Episode</div>
      <div class="field-value" id="shard_ep"></div>
    </div>
    <div class="field">
      <div class="field-label">Source Part</div>
      <div class="field-value mono" id="part"></div>
    </div>

    <h3>Token Usage</h3>
    <table id="tokens"></table>

    <div class="hint">← / → 키로 navigation, 숫자 입력으로 점프</div>
    <div class="src-file" id="src-file"></div>
  </div>
</div>

<script>
let currentIdx = 0;
let totalCount = 0;
let allTotal   = 0;
let filterDebounce = null;

function currentFilterParams() {
  const params = new URLSearchParams();
  const app = document.getElementById('app-filter').value.trim();
  const cat = document.getElementById('cat-filter').value.trim();
  if (app) params.set('app', app);
  if (cat) params.set('category', cat);
  return params;
}

function updateFilterStyling() {
  const appInp = document.getElementById('app-filter');
  const catInp = document.getElementById('cat-filter');
  appInp.classList.toggle('active', appInp.value.trim() !== '');
  catInp.classList.toggle('active', catInp.value.trim() !== '');
}

async function init() {
  try {
    // 자동완성용 라벨 로드
    const labels = await fetch('/api/labels').then(r => r.json());
    document.getElementById('app-list').innerHTML =
      (labels.apps || []).map(a => `<option value="${escapeHtml(a)}">`).join('');
    document.getElementById('cat-list').innerHTML =
      (labels.categories || []).map(c => `<option value="${escapeHtml(c)}">`).join('');

    // 필터 입력 이벤트 (디바운싱)
    document.getElementById('app-filter').addEventListener('input', onFilterInput);
    document.getElementById('cat-filter').addEventListener('input', onFilterInput);

    await applyFilter();
  } catch (err) {
    document.getElementById('goal').textContent = 'Error: ' + err.message;
  }
}

function onFilterInput() {
  updateFilterStyling();
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(applyFilter, 250);
}

async function applyFilter() {
  const params = currentFilterParams();
  const r = await fetch('/api/episodes?' + params).then(r => r.json());
  totalCount = r.total;
  allTotal   = r.all_total;

  document.getElementById('counter').textContent = '/ ' + Math.max(totalCount - 1, 0);
  document.getElementById('idx-input').max = Math.max(totalCount - 1, 0);

  const files = r.request_files || [];
  document.getElementById('src-file').textContent =
    files.length === 1
      ? 'request: ' + files[0]
      : 'request files (' + files.length + '): ' + files.map(f => f.split('/').pop()).join(', ');

  const finfo = document.getElementById('filter-info');
  const hasFilter = (r.filter && (r.filter.app || r.filter.category));
  finfo.textContent = hasFilter
    ? `${totalCount.toLocaleString()} / ${allTotal.toLocaleString()} match`
    : `${totalCount.toLocaleString()} episodes`;

  if (totalCount > 0) {
    currentIdx = 0;
    await load(0);
  } else {
    document.getElementById('goal').textContent = '(no match)';
    document.getElementById('meta').textContent = '';
    document.getElementById('img').removeAttribute('src');
    document.getElementById('prev-btn').disabled = true;
    document.getElementById('next-btn').disabled = true;
  }
}

function clearFilters() {
  document.getElementById('app-filter').value = '';
  document.getElementById('cat-filter').value = '';
  updateFilterStyling();
  applyFilter();
}

async function load(idx) {
  const params = currentFilterParams();
  const url = '/api/episode/' + idx + (params.toString() ? '?' + params : '');
  const e = await fetch(url).then(r => r.json());
  if (e.error && !e.key) { console.error(e); return; }
  currentIdx = e.index;
  document.getElementById('idx-input').value = e.index;
  document.getElementById('prev-btn').disabled = e.index === 0;
  document.getElementById('next-btn').disabled = e.index === totalCount - 1;

  document.getElementById('goal').textContent = e.goal_info || '(no goal)';
  document.getElementById('meta').textContent =
    e.key + ' • shard ' + e.shard + ' • ep ' + e.ep_idx;
  document.getElementById('img').src = '/api/image/' + encodeURIComponent(e.key);

  document.getElementById('key').textContent = e.key;
  document.getElementById('shard_ep').textContent =
    'shard ' + e.shard + ', episode ' + e.ep_idx;
  document.getElementById('part').textContent = e.part || '';

  const predDiv = document.getElementById('prediction');
  if (e.error) {
    predDiv.className = 'prediction error';
    predDiv.innerHTML = '<div class="pred-label">ERROR</div>' +
      '<div style="margin-top:6px;font-size:13px;">' +
      escapeHtml(JSON.stringify(e.error)) + '</div>';
  } else if (e.prediction) {
    predDiv.className = 'prediction';
    const p = e.prediction;
    const appName = p.app_name || '?';
    const appCat  = p.app_category || '?';
    predDiv.innerHTML = '<div class="pred-label">PREDICTED APP (click to filter)</div>' +
      '<div class="pred-app" style="cursor:pointer;text-decoration:underline dotted"' +
      ' title="이 앱으로 필터링" onclick="filterByApp(\'' + escapeJs(appName) + '\')">' +
      escapeHtml(appName) + '</div>' +
      '<div class="pred-cat" style="cursor:pointer;text-decoration:underline dotted"' +
      ' title="이 카테고리로 필터링" onclick="filterByCat(\'' + escapeJs(appCat) + '\')">' +
      escapeHtml(appCat) + '</div>';
  } else {
    predDiv.className = 'prediction empty';
    predDiv.innerHTML = '<div class="pred-label">NO PREDICTION</div>';
  }

  const t = e.tokens || {};
  const fmt = n => (n || 0).toLocaleString();
  document.getElementById('tokens').innerHTML =
    '<tr><td>Input (total)</td><td>' + fmt(t.input_total) + '</td></tr>' +
    '<tr class="indent"><td>text</td><td>' + fmt(t.input_text) + '</td></tr>' +
    '<tr class="indent"><td>image</td><td>' + fmt(t.input_image) + '</td></tr>' +
    '<tr><td>Thinking</td><td>' + fmt(t.thinking) + '</td></tr>' +
    '<tr><td>Output</td><td>' + fmt(t.output) + '</td></tr>' +
    '<tr class="total"><td>Total</td><td>' + fmt(t.total) + '</td></tr>';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeJs(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function filterByApp(name) {
  document.getElementById('app-filter').value = name;
  updateFilterStyling();
  applyFilter();
}

function filterByCat(name) {
  document.getElementById('cat-filter').value = name;
  updateFilterStyling();
  applyFilter();
}

function prev() { if (currentIdx > 0) load(currentIdx - 1); }
function next() { if (currentIdx < totalCount - 1) load(currentIdx + 1); }
function goTo(v) {
  const n = parseInt(v, 10);
  if (!isNaN(n) && n >= 0 && n < totalCount) load(n);
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
});

init();
</script>
</body>
</html>"""


# ── Stats HTML ────────────────────────────────────────────────────────
STATS_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AitW Batch JSONL Viewer — Stats</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; background: #f0f2f5; color: #222; }
  .header { background: white; padding: 12px 20px; border-bottom: 1px solid #e0e0e0;
            display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .header h1 { font-size: 18px; margin: 0; }
  .header a { padding: 6px 14px; border: 1px solid #c0c4cc; background: white;
              border-radius: 4px; text-decoration: none; color: #222; font-size: 13px; }
  .container { padding: 20px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
             gap: 12px; margin-bottom: 24px; }
  .card { background: white; padding: 16px; border-radius: 6px; }
  .card .label { font-size: 11px; text-transform: uppercase; color: #888;
                 letter-spacing: 0.5px; }
  .card .value { font-size: 24px; font-weight: 600; margin-top: 4px; color: #1565c0; }
  .card .value.error  { color: #e53935; }
  .card .value.warn   { color: #ef6c00; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } }
  .panel { background: white; border-radius: 6px; padding: 18px; }
  .panel h2 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase;
              color: #555; letter-spacing: 0.5px; }
  .filter { width: 100%; box-sizing: border-box; padding: 6px 10px;
            border: 1px solid #c0c4cc; border-radius: 4px; margin-bottom: 12px;
            font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f0f0f0; }
  th { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;
       border-bottom: 2px solid #ddd; }
  td.rank   { color: #888; width: 36px; text-align: right; font-family: monospace; }
  td.count  { width: 70px; text-align: right; font-family: monospace; font-weight: 600; }
  td.pct    { width: 60px; text-align: right; font-family: monospace; color: #666; }
  td.bar-cell { width: 30%; }
  .bar { background: #e3f2fd; height: 8px; border-radius: 2px; overflow: hidden; }
  .bar > div { background: #1976d2; height: 100%; }
  .cat .bar > div { background: #7b1fa2; }
  .cat .bar      { background: #f3e5f5; }
</style>
</head>
<body>

<div class="header">
  <h1>📊 App Label Statistics</h1>
  <a href="/">← Back to Viewer</a>
</div>

<div class="container">
  <div class="summary" id="summary"></div>

  <div class="columns">
    <div class="panel">
      <h2>App Names <span id="app-unique"></span></h2>
      <input type="text" class="filter" id="app-filter" placeholder="검색...">
      <table>
        <thead>
          <tr><th>#</th><th>App</th><th>Count</th><th>%</th><th></th></tr>
        </thead>
        <tbody id="app-body"></tbody>
      </table>
    </div>

    <div class="panel cat">
      <h2>App Categories <span id="cat-unique"></span></h2>
      <input type="text" class="filter" id="cat-filter" placeholder="검색...">
      <table>
        <thead>
          <tr><th>#</th><th>Category</th><th>Count</th><th>%</th><th></th></tr>
        </thead>
        <tbody id="cat-body"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
let APP_DATA = [];
let CAT_DATA = [];
let APP_MAX  = 1;
let CAT_MAX  = 1;
let TOTAL    = 0;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderTable(bodyId, data, max, filter) {
  const lc = (filter || '').toLowerCase();
  const filtered = lc
    ? data.filter(d => d.name.toLowerCase().includes(lc))
    : data;
  const html = filtered.map((d, idx) => {
    const origIdx = data.indexOf(d);
    const pct = TOTAL > 0 ? (100 * d.count / TOTAL).toFixed(1) : '0.0';
    const w   = max > 0 ? (100 * d.count / max).toFixed(1) : '0';
    return `<tr>
      <td class="rank">${origIdx + 1}</td>
      <td>${escapeHtml(d.name)}</td>
      <td class="count">${d.count.toLocaleString()}</td>
      <td class="pct">${pct}%</td>
      <td class="bar-cell"><div class="bar"><div style="width:${w}%"></div></div></td>
    </tr>`;
  }).join('');
  document.getElementById(bodyId).innerHTML = html ||
    '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">no match</td></tr>';
}

function renderSummary(s) {
  const cards = [
    { label: 'Total Episodes',   value: s.total_episodes,  cls: '' },
    { label: 'With Prediction',  value: s.with_prediction, cls: '' },
    { label: 'No Prediction',    value: s.no_prediction,   cls: 'warn' },
    { label: 'With Error',       value: s.with_error,      cls: 'error' },
    { label: 'Unique Apps',      value: s.unique_apps,     cls: '' },
    { label: 'Unique Categories',value: s.unique_categories, cls: '' },
  ];
  document.getElementById('summary').innerHTML = cards.map(c =>
    `<div class="card"><div class="label">${c.label}</div>
     <div class="value ${c.cls}">${c.value.toLocaleString()}</div></div>`
  ).join('');
}

async function init() {
  const s = await fetch('/api/stats').then(r => r.json());
  TOTAL = s.with_prediction;
  APP_DATA = s.apps;
  CAT_DATA = s.categories;
  APP_MAX = APP_DATA.length ? APP_DATA[0].count : 1;
  CAT_MAX = CAT_DATA.length ? CAT_DATA[0].count : 1;

  renderSummary(s);
  document.getElementById('app-unique').textContent = '(' + APP_DATA.length + ')';
  document.getElementById('cat-unique').textContent = '(' + CAT_DATA.length + ')';
  renderTable('app-body', APP_DATA, APP_MAX, '');
  renderTable('cat-body', CAT_DATA, CAT_MAX, '');

  document.getElementById('app-filter').addEventListener('input', (e) => {
    renderTable('app-body', APP_DATA, APP_MAX, e.target.value);
  });
  document.getElementById('cat-filter').addEventListener('input', (e) => {
    renderTable('cat-body', CAT_DATA, CAT_MAX, e.target.value);
  });
}

init();
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--request", type=Path, nargs="+", default=None,
                        help="build_gemini_batch.py 출력 (1개 또는 여러 개)")
    parser.add_argument("--result", type=Path, nargs="+", default=None,
                        help="download_gemini_results.py 출력. "
                             "생략 시 request에서 _result_sorted.jsonl 자동 매칭")
    parser.add_argument("--batch-dir", type=Path, default=None,
                        help="디렉토리에서 batch_input_*.jsonl 자동 탐색 "
                             "(--request 대신 사용)")
    parser.add_argument("--port", type=int, default=5001,
                        help="기본 5001 (viewer.py와 충돌 방지)")
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    # ── request 파일 결정 ──
    if args.batch_dir:
        request_paths = find_batch_files(args.batch_dir)
        if not request_paths:
            sys.exit(f"디렉토리에 batch_input_*.jsonl 없음: {args.batch_dir}")
        print(f"--batch-dir에서 발견한 request 파일: {len(request_paths)}개")
    elif args.request:
        request_paths = args.request
    else:
        sys.exit("ERROR: --request 또는 --batch-dir 중 하나는 필요합니다.")

    for p in request_paths:
        if not p.exists():
            sys.exit(f"request 파일 없음: {p}")

    # ── result 파일 결정 (개수 매칭 또는 자동 매칭) ──
    if args.result:
        if len(args.result) != len(request_paths):
            sys.exit(f"ERROR: request {len(request_paths)}개 vs "
                     f"result {len(args.result)}개 — 개수가 같아야 함")
        result_paths: list[Path | None] = list(args.result)
    else:
        result_paths = []
        for req in request_paths:
            paired = auto_pair_result(req)
            if paired is None:
                print(f"⚠ {req.name}: 매칭되는 result 파일 없음 (예측 없이 표시)")
            else:
                print(f"  {req.name} ↔ {paired.name}")
            result_paths.append(paired)

    print()
    load_episodes(
        [p.resolve() for p in request_paths],
        [p.resolve() if p else None for p in result_paths],
    )
    print(f"\n브라우저 열기: http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
