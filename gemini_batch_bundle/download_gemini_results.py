"""
Gemini Batch 결과 일괄 다운로드

submit_gemini_batches.py가 만든 manifest를 읽어 SUCCEEDED 상태 배치의 결과
파일을 다운로드합니다. 각 결과는 두 가지 버전으로 저장:

  1. <stem>_result.jsonl         — 원본 (Gemini 응답 순)
  2. <stem>_result_sorted.jsonl  — key 기준 (shard, ep_idx) 정렬

사용 예:
    # 전부 처리
    python download_gemini_results.py manifest_20260526T120000Z.json

    # 출력 디렉토리 지정
    python download_gemini_results.py manifest.json --out-dir results/

    # 이미 받은 것도 재다운로드
    python download_gemini_results.py manifest.json --force

    # 정렬본 안 만들기 (디스크 절약)
    python download_gemini_results.py manifest.json --no-sort

종료 후 상태별 카운트 출력. 아직 완료 안 된 배치는 자동 스킵 (재실행으로 이어받기 가능).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from google import genai


def _line_key(line: str) -> str:
    """JSONL 한 줄에서 정렬용 key 추출. shard{NNNNN}_ep{NNNN} 형식이라 문자열 정렬 = 자연 정렬."""
    try:
        return json.loads(line).get("key", "")
    except json.JSONDecodeError:
        return ""


def write_sorted(raw_path: Path, sorted_path: Path) -> int:
    """raw_path를 key 기준 정렬해서 sorted_path에 저장. 줄 수 반환."""
    with open(raw_path, encoding="utf-8") as f:
        lines = [ln for ln in f if ln.strip()]
    lines.sort(key=_line_key)
    with open(sorted_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return len(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Gemini Batch 결과 다운로드 + 정렬",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("manifest", type=Path,
                        help="submit_gemini_batches.py의 manifest JSON")
    parser.add_argument("--out-dir", type=Path, default=None,
                        help="결과 저장 디렉토리 (기본: manifest 폴더)")
    parser.add_argument("--force", action="store_true",
                        help="이미 받은 파일도 재다운로드")
    parser.add_argument("--no-sort", action="store_true",
                        help="정렬본(_sorted.jsonl) 생성 안 함")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        sys.exit("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    if not args.manifest.exists():
        sys.exit(f"ERROR: manifest 파일 없음: {args.manifest}")

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    batches  = manifest.get("batches", [])
    out_dir  = args.out_dir or args.manifest.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"manifest    : {args.manifest}")
    print(f"model       : {manifest.get('model', '?')}")
    print(f"out_dir     : {out_dir}")
    print(f"batches     : {len(batches)}")
    print(f"sort        : {'no' if args.no_sort else 'yes'}")
    print()

    client = genai.Client(api_key=api_key)
    stats: Counter[str] = Counter()
    downloaded_files: list[Path] = []

    for i, entry in enumerate(batches, 1):
        part_name  = entry.get("part_name", f"<entry_{i}>")
        batch_name = entry.get("batch_name")

        if entry.get("error"):
            print(f"[{i:>3}/{len(batches)}] {part_name} — submit 실패 항목, 건너뜀")
            stats["submit_failed"] += 1
            continue

        if not batch_name:
            print(f"[{i:>3}/{len(batches)}] {part_name} — batch_name 없음, 건너뜀")
            stats["no_batch_name"] += 1
            continue

        stem          = Path(part_name).stem
        result_raw    = out_dir / f"{stem}_result.jsonl"
        result_sorted = out_dir / f"{stem}_result_sorted.jsonl"

        # 이미 있으면 스킵 (force가 아니면)
        if result_raw.exists() and not args.force:
            if not args.no_sort and not result_sorted.exists():
                # 정렬본만 누락된 경우 — 정렬만 새로 생성
                n = write_sorted(result_raw, result_sorted)
                print(f"[{i:>3}/{len(batches)}] {part_name} — 이미 받음, 정렬본만 생성 ({n}건)")
                stats["sorted_only"] += 1
            else:
                size_mb = result_raw.stat().st_size / 1e6
                print(f"[{i:>3}/{len(batches)}] {part_name} — 이미 받음 ({size_mb:.1f} MB)")
                stats["already_have"] += 1
            continue

        # 배치 상태 확인
        try:
            job = client.batches.get(name=batch_name)
        except Exception as e:
            print(f"[{i:>3}/{len(batches)}] {part_name} — 조회 실패: {type(e).__name__}: {e}")
            stats["get_failed"] += 1
            continue

        state = job.state.name
        if state != "JOB_STATE_SUCCEEDED":
            print(f"[{i:>3}/{len(batches)}] {part_name} — {state} (아직 미완료)")
            stats[state] += 1
            continue

        # 결과 파일 다운로드
        dest = getattr(job, "dest", None)
        file_name = getattr(dest, "file_name", None) if dest else None

        try:
            if file_name:
                data = client.files.download(file=file_name)
                result_raw.write_bytes(data)
            else:
                # 인라인 응답 (소규모 배치)
                inlined = getattr(dest, "inlined_responses", None) if dest else None
                if not inlined:
                    print(f"[{i:>3}/{len(batches)}] {part_name} — 결과 형식 미상 (dest={dest})")
                    stats["unknown_dest"] += 1
                    continue
                with open(result_raw, "w", encoding="utf-8") as f:
                    for r in inlined:
                        f.write(json.dumps(r.model_dump(exclude_none=True),
                                           ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"[{i:>3}/{len(batches)}] {part_name} — 다운로드 실패: {type(e).__name__}: {e}")
            stats["download_failed"] += 1
            continue

        size_mb = result_raw.stat().st_size / 1e6

        # 정렬본 생성
        n_lines = 0
        if not args.no_sort:
            n_lines = write_sorted(result_raw, result_sorted)

        msg = f"{size_mb:>6.1f} MB"
        if n_lines:
            msg += f"  {n_lines}건  (+sorted)"
        print(f"[{i:>3}/{len(batches)}] {part_name} — {msg}")
        stats["downloaded"] += 1
        downloaded_files.append(result_raw)

    # ── 요약 ──
    print()
    print("=" * 70)
    print("결과 요약:")
    for k, v in stats.most_common():
        print(f"  {k:25} : {v}")
    print("=" * 70)

    if downloaded_files:
        print(f"\n다운로드된 파일 ({len(downloaded_files)}개):")
        for p in downloaded_files:
            print(f"  {p}")


if __name__ == "__main__":
    main()
