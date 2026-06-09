"""
Gemini Batch 상태 확인

submit_gemini_batches.py가 생성한 manifest JSON 파일을 읽어
각 배치의 현재 상태를 조회·출력합니다.

사용 예:
    # 기본 (요약 + 배치별 한 줄)
    python check_gemini_batches.py manifest_20260526T120000Z.json

    # 상세 출력 (생성/시작/종료 시각, 결과 파일명 등)
    python check_gemini_batches.py manifest_20260526T120000Z.json --verbose

    # 완료된 배치의 결과 파일명만 추출
    python check_gemini_batches.py manifest_xxx.json --completed-only
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from google import genai


STATE_MARK = {
    "JOB_STATE_PENDING":   "⏳",
    "JOB_STATE_RUNNING":   "🏃",
    "JOB_STATE_SUCCEEDED": "✓",
    "JOB_STATE_FAILED":    "✗",
    "JOB_STATE_CANCELLED": "⊘",
    "JOB_STATE_EXPIRED":   "⏰",
    "SUBMIT_FAILED":       "✗",
    "NO_BATCH_NAME":       "?",
    "QUERY_ERROR":         "!",
}


def fmt_age(t) -> str:
    """ISO 시각/datetime → 'Nm ago' 형태."""
    if t is None:
        return "-"
    try:
        if isinstance(t, str):
            t = datetime.fromisoformat(t.replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        secs = (datetime.now(timezone.utc) - t).total_seconds()
        if secs < 60:    return f"{int(secs)}s"
        if secs < 3600:  return f"{int(secs/60)}m"
        if secs < 86400: return f"{int(secs/3600)}h{int((secs%3600)/60)}m"
        return f"{int(secs/86400)}d"
    except Exception:
        return "?"


def fmt_iso(t) -> str:
    if t is None:
        return "-"
    try:
        if isinstance(t, str):
            return t
        return t.isoformat()
    except Exception:
        return str(t)


def main():
    parser = argparse.ArgumentParser(
        description="Gemini Batch 상태 확인",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("manifest", type=Path,
                        help="submit_gemini_batches.py가 생성한 manifest JSON")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="배치별 상세 정보 출력")
    parser.add_argument("--completed-only", action="store_true",
                        help="SUCCEEDED 배치만 출력 (결과 파일명 포함)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        sys.exit("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    if not args.manifest.exists():
        sys.exit(f"ERROR: manifest 파일 없음: {args.manifest}")

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    batches  = manifest.get("batches", [])

    print(f"Manifest    : {args.manifest}")
    print(f"Model       : {manifest.get('model', '?')}")
    print(f"Input dir   : {manifest.get('input_dir', '?')}")
    print(f"Created     : {manifest.get('created_at', '?')}")
    print(f"Total       : {len(batches)} batches")
    print()

    client = genai.Client(api_key=api_key)
    state_count: Counter[str] = Counter()
    rows: list[dict] = []

    for i, entry in enumerate(batches, 1):
        part = entry.get("part_name", "?")
        row  = {"idx": i, "part": part, "info": ""}

        if "error" in entry:
            row["state"] = "SUBMIT_FAILED"
            row["info"]  = entry["error"]
            rows.append(row)
            state_count["SUBMIT_FAILED"] += 1
            continue

        batch_name = entry.get("batch_name")
        if not batch_name:
            row["state"] = "NO_BATCH_NAME"
            rows.append(row)
            state_count["NO_BATCH_NAME"] += 1
            continue

        try:
            job = client.batches.get(name=batch_name)
            state = job.state.name
            row["state"] = state
            row["job"]   = job
            state_count[state] += 1

            # 추가 정보 — SDK에서 노출되는 필드만 안전하게 수집
            parts = []
            stats = getattr(job, "completion_stats", None)
            if stats:
                ok    = getattr(stats, "successful_count",   None)
                fail  = getattr(stats, "failed_count",       None)
                total = getattr(stats, "total_count",        None) \
                        or getattr(stats, "successful_count", 0)
                if total or ok or fail:
                    parts.append(f"{ok or 0}/{total or 0} ok"
                                 + (f", {fail} fail" if fail else ""))

            create_time = getattr(job, "create_time", None)
            if create_time:
                parts.append(f"age={fmt_age(create_time)}")

            end_time = getattr(job, "end_time", None)
            if end_time:
                parts.append(f"end={fmt_age(end_time)} ago")

            row["info"] = "  ".join(parts)
        except Exception as e:
            row["state"] = "QUERY_ERROR"
            row["info"]  = f"{type(e).__name__}: {e}"
            state_count["QUERY_ERROR"] += 1

        rows.append(row)

    # ── 요약 ──
    print("── 상태 요약 ──────────────────────────────────────────")
    for state, count in sorted(state_count.items(), key=lambda x: -x[1]):
        mark = STATE_MARK.get(state, " ")
        bar  = "█" * min(40, int(40 * count / max(len(rows), 1)))
        print(f"  {mark} {state:25} {count:>4}  {bar}")
    print()

    # ── 배치별 ──
    filtered = rows if not args.completed_only \
               else [r for r in rows if r["state"] == "JOB_STATE_SUCCEEDED"]

    if filtered:
        max_part = max(len(r["part"]) for r in filtered)
        print(f"── 배치별 상태 ({'완료만' if args.completed_only else '전체'}) ──")
        for r in filtered:
            mark = STATE_MARK.get(r["state"], " ")
            print(f"  [{r['idx']:3}] {mark} {r['part']:<{max_part}}  "
                  f"{r['state']:22}  {r['info']}")

            if r["state"] == "JOB_STATE_SUCCEEDED" and "job" in r:
                dest = getattr(r["job"], "dest", None)
                if dest:
                    fn = getattr(dest, "file_name", None)
                    if fn:
                        print(f"        result_file: {fn}")

    # ── verbose 상세 ──
    if args.verbose:
        print("\n── 상세 정보 ──────────────────────────────────────────")
        for r in rows:
            job = r.get("job")
            if not job:
                continue
            print(f"\n  [{r['idx']:3}] {r['part']}")
            print(f"        batch_name : {job.name}")
            print(f"        state      : {job.state.name}")
            print(f"        create_time: {fmt_iso(getattr(job, 'create_time', None))}")
            print(f"        start_time : {fmt_iso(getattr(job, 'start_time', None))}")
            print(f"        end_time   : {fmt_iso(getattr(job, 'end_time', None))}")
            print(f"        model      : {getattr(job, 'model', '-')}")
            dest = getattr(job, "dest", None)
            if dest:
                print(f"        dest.file  : {getattr(dest, 'file_name', '-')}")
            err = getattr(job, "error", None)
            if err:
                print(f"        error      : {err}")


if __name__ == "__main__":
    main()
