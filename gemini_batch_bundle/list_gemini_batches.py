"""
Gemini 계정의 모든 배치 작업 조회

사용:
    # 전체 배치 목록 + 상태별 요약
    python list_gemini_batches.py

    # 특정 상태만 필터
    python list_gemini_batches.py --state RUNNING
    python list_gemini_batches.py --state SUCCEEDED FAILED

    # 상세 정보 (시각, 모델 등)
    python list_gemini_batches.py --detailed

    # 업로드된 파일까지 함께
    python list_gemini_batches.py --files
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from google import genai
from google.genai import types


STATE_MARK = {
    "JOB_STATE_PENDING":   "⏳",
    "JOB_STATE_RUNNING":   "🏃",
    "JOB_STATE_SUCCEEDED": "✓",
    "JOB_STATE_FAILED":    "✗",
    "JOB_STATE_CANCELLED": "⊘",
    "JOB_STATE_EXPIRED":   "⏰",
}


def fmt_age(t) -> str:
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


def main():
    parser = argparse.ArgumentParser(
        description="Gemini 계정의 모든 배치 조회",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--state", nargs="+", default=None,
                        help="필터링할 상태 (예: PENDING RUNNING SUCCEEDED). "
                             "JOB_STATE_ 접두사는 자동 추가됨.")
    parser.add_argument("--detailed", action="store_true",
                        help="배치별 상세 정보 출력")
    parser.add_argument("--files", action="store_true",
                        help="업로드된 파일 목록도 함께 출력")
    parser.add_argument("--page-size", type=int, default=100,
                        help="API 페이지 크기 (기본 100)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        sys.exit("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    client = genai.Client(api_key=api_key)

    # 상태 필터 정규화
    filter_states: set[str] | None = None
    if args.state:
        filter_states = set()
        for s in args.state:
            s_up = s.upper()
            if not s_up.startswith("JOB_STATE_"):
                s_up = "JOB_STATE_" + s_up
            filter_states.add(s_up)

    # ── 배치 목록 ──
    print("배치 목록 페치 중...")
    batches = list(client.batches.list(
        config=types.ListBatchJobsConfig(page_size=args.page_size)
    ))
    print(f"총 {len(batches)}개")
    print()

    # ── 상태별 요약 ──
    print("── 상태별 요약 ────────────────────────────────────────")
    state_count = Counter(b.state.name for b in batches)
    for state, n in sorted(state_count.items(), key=lambda x: -x[1]):
        mark = STATE_MARK.get(state, " ")
        bar  = "█" * min(40, int(40 * n / max(len(batches), 1)))
        print(f"  {mark} {state:25} {n:>4}  {bar}")
    print()

    # ── 필터 적용 ──
    shown = batches
    if filter_states:
        shown = [b for b in batches if b.state.name in filter_states]
        print(f"필터: {sorted(filter_states)} → {len(shown)}개")
        print()

    # ── 배치별 ──
    if not shown:
        print("(표시할 배치 없음)")
    else:
        print("── 배치 목록 ──────────────────────────────────────────")
        max_dn = max(len(b.display_name or "") for b in shown)
        max_dn = min(max(max_dn, 10), 50)  # 10~50 사이로 제한
        for b in shown:
            mark = STATE_MARK.get(b.state.name, " ")
            dn   = (b.display_name or "")[:max_dn]
            age  = fmt_age(getattr(b, "create_time", None))
            print(f"  {mark} {b.state.name:22}  age={age:>6}  "
                  f"{dn:<{max_dn}}  {b.name}")

            if args.detailed:
                print(f"        name       : {b.name}")
                print(f"        model      : {getattr(b, 'model', '-')}")
                print(f"        create_time: {getattr(b, 'create_time', '-')}")
                print(f"        start_time : {getattr(b, 'start_time', '-')}")
                print(f"        end_time   : {getattr(b, 'end_time', '-')}")
                dest = getattr(b, "dest", None)
                if dest:
                    fn = getattr(dest, "file_name", None)
                    if fn:
                        print(f"        result_file: {fn}")
                err = getattr(b, "error", None)
                if err:
                    print(f"        error      : {err}")
                print()

    # ── 업로드된 파일 ──
    if args.files:
        print()
        print("── 업로드된 파일 ─────────────────────────────────────")
        files = list(client.files.list())
        print(f"총 {len(files)}개")
        for f in files:
            size_mb = (f.size_bytes or 0) / 1e6
            print(f"  {f.name:30}  {f.state.name:15}  "
                  f"{size_mb:>7.1f} MB  {f.display_name or ''}")


if __name__ == "__main__":
    main()
