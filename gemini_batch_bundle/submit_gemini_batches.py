"""
Gemini Batch 제출 (fire-and-forget)

지정한 디렉토리의 모든 JSONL 파일(build_gemini_batch.py 출력)을
순서대로 Gemini Batch API에 제출하고, 배치 메타데이터를 manifest 파일로
저장한 뒤 즉시 종료합니다. 폴링/대기 없음.

사용 예:
    # data/google_apps/batch/ 의 모든 part*.jsonl 제출
    python submit_gemini_batches.py data/google_apps/batch

    # manifest 경로 직접 지정
    python submit_gemini_batches.py data/google_apps/batch \\
        --manifest manifests/google_apps_2026_05_26.json

    # 특정 패턴만
    python submit_gemini_batches.py data/google_apps/batch \\
        --pattern 'batch_input_google_apps_part*.jsonl'

상태 확인은 check_gemini_batches.py 참고.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from google import genai
from google.genai import types


DEFAULT_MODEL = "gemini-3.1-flash-lite"


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_manifest(path: Path, model: str, input_dir: Path,
                  batches: list[dict]) -> None:
    """Manifest를 atomic write로 저장 (중간 실패 대비)."""
    payload = {
        "model":      model,
        "input_dir":  str(input_dir.resolve()),
        "created_at": utc_iso(),
        "batches":    batches,
    }
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False),
                   encoding="utf-8")
    tmp.replace(path)


def main():
    parser = argparse.ArgumentParser(
        description="Gemini Batch JSONL 제출 (fire-and-forget)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("input_dir", type=Path,
                        help="JSONL 파일들이 들어있는 디렉토리")
    parser.add_argument("--manifest", type=Path, default=None,
                        help="배치 정보 저장 경로 "
                             "(기본: <input_dir>/manifest_<timestamp>.json)")
    parser.add_argument("--pattern", default="*.jsonl",
                        help="JSONL 매칭 패턴 (기본: *.jsonl)")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"Gemini 모델 (기본: {DEFAULT_MODEL})")
    parser.add_argument("--display-name-prefix", default="aitw_batch",
                        help="batch display_name prefix (기본: aitw_batch)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        sys.exit("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    if not args.input_dir.is_dir():
        sys.exit(f"ERROR: 디렉토리 없음: {args.input_dir}")

    # 정렬: 파일명 알파벳순 → part001, part002, ... 자동으로 올바른 순서
    jsonl_files = sorted(args.input_dir.glob(args.pattern))
    if not jsonl_files:
        sys.exit(f"ERROR: 매칭되는 파일 없음: {args.input_dir}/{args.pattern}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    manifest_path = args.manifest or (args.input_dir / f"manifest_{timestamp}.json")
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print(f"입력 디렉토리 : {args.input_dir.resolve()}")
    print(f"JSONL 파일    : {len(jsonl_files)}개")
    for p in jsonl_files:
        print(f"  - {p.name}  ({p.stat().st_size / 1e6:.1f} MB)")
    print(f"모델          : {args.model}")
    print(f"Manifest      : {manifest_path}")
    print("=" * 70)
    print()

    client = genai.Client(api_key=api_key)
    submitted: list[dict] = []

    for i, jsonl_path in enumerate(jsonl_files, 1):
        size_mb = jsonl_path.stat().st_size / 1e6
        display_name = f"{args.display_name_prefix}_{jsonl_path.stem}"
        print(f"[{i}/{len(jsonl_files)}] {jsonl_path.name}  ({size_mb:.1f} MB)")

        entry: dict = {
            "part_path":    str(jsonl_path),
            "part_name":    jsonl_path.name,
            "size_bytes":   jsonl_path.stat().st_size,
            "display_name": display_name,
            "submitted_at": utc_iso(),
        }

        try:
            t0 = time.time()
            uploaded = client.files.upload(
                file=str(jsonl_path),
                config=types.UploadFileConfig(
                    mime_type="application/jsonl",
                    display_name=display_name,
                ),
            )
            up_elapsed = time.time() - t0
            entry["file_name"] = uploaded.name

            batch_job = client.batches.create(
                model=args.model,
                src=uploaded.name,
                config=types.CreateBatchJobConfig(display_name=display_name),
            )
            entry["batch_name"]    = batch_job.name
            entry["initial_state"] = batch_job.state.name

            print(f"   ✓ upload {up_elapsed:.1f}s  "
                  f"file={uploaded.name}  "
                  f"batch={batch_job.name}  "
                  f"state={batch_job.state.name}")

        except Exception as e:
            entry["error"] = f"{type(e).__name__}: {e}"
            print(f"   ✗ 실패: {entry['error']}")

        submitted.append(entry)

        # 점진적 저장 — 중간에 죽어도 지금까지 제출된 배치는 보존
        save_manifest(manifest_path, args.model, args.input_dir, submitted)

    # ── 최종 요약 ──
    n_ok  = sum(1 for b in submitted if "batch_name" in b)
    n_err = sum(1 for b in submitted if "error" in b)
    print()
    print("=" * 70)
    print(f"제출 완료: {n_ok}개 성공 / {n_err}개 실패")
    print(f"Manifest : {manifest_path}")
    print(f"\n상태 확인 명령:")
    print(f"  python check_gemini_batches.py {manifest_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
