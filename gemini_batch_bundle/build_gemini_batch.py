"""
AitW 서브셋 전체 → Gemini Batch JSONL 빌더 (외부 서버 실행용)

플로우:
    1. 지정 서브셋의 모든 shard 다운로드 (gsutil -m, 병렬)
    2. STATUS_COMPLETE 스텝의 이미지/지시문 추출 → Gemini Batch JSONL 요청
       - ProcessPoolExecutor로 샤드를 병렬 처리 (CPU 멀티코어)
       - pyvips/OpenCV가 있으면 이미지 디코딩·인코딩 가속 사용
    3. 결과 JSONL이 1.8 GB를 넘으면 자동으로 partN+1 로 롤오버

사용 예:
    # 전체 서브셋 다 처리 (다운로드 + JSONL 생성)
    python build_gemini_batch.py google_apps

    # 일부 샤드만 (디버깅)
    python build_gemini_batch.py single --shards 0 4

    # 다운로드 건너뛰고 이미 받은 샤드만 처리
    python build_gemini_batch.py google_apps --skip-download

    # 워커 수, 해상도, 품질 조절
    python build_gemini_batch.py google_apps --workers 32 --downscale 2 --quality 85
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm


# ── Config — 노트북과 동일 ─────────────────────────────────────────────
SUBSET_SHARD_COUNTS = {
    "general":      321,
    "google_apps":  8688,
    "install":      1052,
    "web_shopping": 1025,
    "single":       252,
}

# AITW_NOTES.md 기준 공식 에피소드 수 (= STATUS_COMPLETE step 개수)
SUBSET_EPISODE_COUNTS = {
    "general":      9_476,
    "google_apps":  625_542,
    "install":      25_760,
    "web_shopping": 28_061,
    "single":       26_303,
}

BUCKET_BASE = "gs://gresearch/android-in-the-wild"

STATUS_COMPLETE = 10
MIN_SHARD_SIZE  = 1024  # 1 KB 미만은 빈/손상된 샤드

GEMINI_MODEL = "gemini-3.1-flash-lite"

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "app_name": {
            "type": "string",
            "description": "Name of the app used (e.g., Chrome, Gmail, Google Maps, Home, Settings)",
        },
        "app_category": {
            "type": "string",
            "description": "Category of the app (e.g., Browser, Email, Shopping, Settings, Social)",
        },
    },
    "required": ["app_name", "app_category"],
}

ANALYSIS_PROMPT = """Instruction: {goal}

This is the final screenshot of an Android task at the moment the task was declared complete.
Identify which app was used to complete this task.
Return ONLY a JSON object — no markdown, no explanation.
"""

# 1.8 GB (10진수 기준) — Gemini Batch API 단일 파일 한도 2 GB 안에 안전 여유
MAX_JSONL_BYTES = int(1.8 * 1_000_000_000)


# ── 다운로드 (gsutil -m) ──────────────────────────────────────────────
def shard_name(subset: str, idx: int, total: int) -> str:
    return f"{subset}-{idx:05d}-of-{total:05d}"


def download_all_shards(subset: str, total: int, out_dir: Path,
                        indices: list[int]) -> None:
    """gsutil -m cp로 누락된 샤드만 병렬 다운로드.

    제약 사항:
      - 인자로 직접 넘기면 ARG_MAX(보통 128KB) 초과 (8688 URL → ~700KB)
      - `gsutil cp -I` (stdin)는 대량 입력 시 처음 몇 개만 처리하고 종료되는
        이슈가 관측됨 (gsutil 자체 버그로 추정)
    → 안전한 크기(500개)로 배치를 나눠 여러 번 호출. 각 배치 내부는 `-m`으로
      병렬 처리. 배치 실패 시 디스크에서 누락된 파일만 추려서 재시도하고,
      최종 실패한 샤드는 인덱스/URL을 로그 파일에 저장.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    def get_missing_pairs(check_indices: list[int]) -> list[tuple[int, str]]:
        """디스크에 없거나 너무 작은 샤드를 (인덱스, URL) 페어로 반환."""
        result = []
        for i in check_indices:
            name  = shard_name(subset, i, total)
            local = out_dir / name
            if not (local.exists() and local.stat().st_size > 100):
                result.append((i, f"{BUCKET_BASE}/{subset}/{name}"))
        return result

    missing_pairs = get_missing_pairs(indices)
    if not missing_pairs:
        print("  → 모두 존재함, 다운로드 건너뜀")
        return

    BATCH = 500           # ARG_MAX 안전 마진
    MAX_RETRIES = 3       # 배치당 시도 횟수
    n_batches = (len(missing_pairs) + BATCH - 1) // BATCH
    print(f"  병렬 다운로드 {len(missing_pairs)}개 파일 "
          f"(gsutil -m cp -n, 배치 크기 {BATCH} × {n_batches}회)...")

    permanently_failed: list[tuple[int, str]] = []

    for bi in range(n_batches):
        chunk = missing_pairs[bi * BATCH : (bi + 1) * BATCH]
        chunk_indices = [p[0] for p in chunk]
        retry_urls    = [p[1] for p in chunk]

        for attempt in range(MAX_RETRIES):
            # -n: 이미 받은 파일은 건너뜀 (재시도 시 효율적)
            cmd_str = ("gsutil -m cp -n "
                       + " ".join(f'"{u}"' for u in retry_urls)
                       + f' "{out_dir}/"')
            try:
                subprocess.run(cmd_str, shell=True, check=True)
            except subprocess.CalledProcessError:
                pass  # 일부 실패해도 디스크 상태로 판단

            # 디스크 검사: 진짜로 누락된 것만 추림
            still_missing = get_missing_pairs(chunk_indices)
            if not still_missing:
                break

            if attempt < MAX_RETRIES - 1:
                wait = 5 * (2 ** attempt)  # 5s, 10s, 20s
                print(f"  ⚠ [batch {bi+1}] {len(still_missing)}/{len(chunk)} 누락 "
                      f"(시도 {attempt+1}/{MAX_RETRIES}). {wait}s 후 누락 분량만 재시도...")
                time.sleep(wait)
                retry_urls = [p[1] for p in still_missing]
            else:
                # 최종 실패 — 어떤 샤드가 안 받아졌는지 출력
                print(f"  ✗ [batch {bi+1}] {MAX_RETRIES}회 시도 후에도 "
                      f"{len(still_missing)}개 실패:")
                for idx, url in still_missing[:10]:
                    print(f"     shard {idx:05d}  ({url})")
                if len(still_missing) > 10:
                    print(f"     ... +{len(still_missing) - 10}개 더")
                permanently_failed.extend(still_missing)

        done = min((bi + 1) * BATCH, len(missing_pairs))
        print(f"  [{bi+1:>3}/{n_batches}] 누적 {done:>5}/{len(missing_pairs)}")

    # ── 최종 실패 보고 ────────────────────────────────────────────────
    if permanently_failed:
        fail_log = out_dir / "_failed_shards.txt"
        with open(fail_log, "w", encoding="utf-8") as f:
            f.write(f"# 다운로드 실패 샤드 ({len(permanently_failed)}개)\n")
            f.write(f"# subset={subset}  total={total}\n")
            for idx, url in permanently_failed:
                f.write(f"{idx}\t{url}\n")

        print(f"\n  ⚠ 다운로드 실패한 샤드: {len(permanently_failed)}개")
        print(f"  실패 인덱스: "
              + ", ".join(str(p[0]) for p in permanently_failed[:30])
              + (f" ... (+{len(permanently_failed)-30}개)"
                 if len(permanently_failed) > 30 else ""))
        print(f"  → 상세 목록: {fail_log}")
        print(f"  → 추출 단계에서 이 샤드들은 missing_or_empty로 자동 스킵됨")
        print(f"  → 나중에 재시도하려면 스크립트 재실행 (이미 받은 파일은 스킵)")


# ── 워커 초기화: GPU 비활성 + TF 로그 억제 ─────────────────────────────
def _worker_init():
    """워커 프로세스 시작 시 1회 호출.

    - CUDA_VISIBLE_DEVICES=-1 : TF가 GPU 잡으려는 시도 차단 (CPU-only).
      여러 워커가 동시에 같은 GPU에 메모리 할당하면 OOM 충돌 발생.
      이 워크로드는 TFRecord 파싱 + WebP 인코딩이라 GPU 필요 없음.
    - TF_CPP_MIN_LOG_LEVEL=3   : INFO/WARNING 로그 억제.
    """
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


# ── 워커: 샤드 1개 → Gemini 배치 요청 dict 리스트 ─────────────────────
def _process_shard(arg: tuple) -> tuple[int, list[dict], str | None]:
    """
    하위 프로세스에서 실행됨. tensorflow/pyvips는 워커에서 lazy import.
    Returns: (shard_idx, requests, error_or_None)
    """
    (subset, shard_idx, total, shard_path_str,
     downscale, quality, thinking_level) = arg

    try:
        # ── lazy import (워커별 1회) ──
        import tensorflow as tf
        import numpy as np

        try:
            import pyvips
            backend = "pyvips"
        except (ImportError, OSError):
            try:
                import cv2
                backend = "opencv"
            except ImportError:
                from PIL import Image as PILImage
                backend = "pillow"

        FEATURE_SPEC = {
            "episode_id":          tf.io.FixedLenFeature([], tf.string),
            "goal_info":           tf.io.FixedLenFeature([], tf.string),
            "image/encoded":       tf.io.FixedLenFeature([], tf.string),
            "image/height":        tf.io.FixedLenFeature([], tf.int64),
            "image/width":         tf.io.FixedLenFeature([], tf.int64),
            "image/channels":      tf.io.FixedLenFeature([], tf.int64, default_value=3),
            "results/action_type": tf.io.FixedLenFeature([], tf.int64),
        }

        def encode_webp_bytes(arr: "np.ndarray") -> bytes:
            if backend == "pyvips":
                vimg = pyvips.Image.new_from_array(arr)
                if downscale > 1:
                    vimg = vimg.subsample(downscale, downscale)
                return vimg.webpsave_buffer(Q=quality)
            elif backend == "opencv":
                bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
                if downscale > 1:
                    h, w = bgr.shape[:2]
                    bgr = cv2.resize(bgr, (w // downscale, h // downscale),
                                     interpolation=cv2.INTER_NEAREST)
                ok, buf = cv2.imencode(".webp", bgr,
                                       [cv2.IMWRITE_WEBP_QUALITY, quality])
                if not ok:
                    raise RuntimeError("cv2.imencode webp failed")
                return bytes(buf)
            else:
                small = arr[::downscale, ::downscale] if downscale > 1 else arr
                buf = io.BytesIO()
                PILImage.fromarray(small).save(buf, format="WEBP", quality=quality)
                return buf.getvalue()

        path = Path(shard_path_str)
        if not path.exists() or path.stat().st_size < MIN_SHARD_SIZE:
            return (shard_idx, [], "missing_or_empty")

        raw    = tf.data.TFRecordDataset([str(path)], compression_type="GZIP")
        parsed = raw.map(lambda x: tf.io.parse_single_example(x, FEATURE_SPEC))

        # ── 스트리밍 처리: STATUS_COMPLETE step만 즉시 처리해서
        #    raw uint8 이미지를 메모리에 누적하지 않음 (OOM 방지)
        ep_id_to_idx: dict[str, int] = {}
        requests_out: list[dict] = []

        try:
            for ex in parsed:
                eid = ex["episode_id"].numpy().decode()
                if eid not in ep_id_to_idx:
                    ep_id_to_idx[eid] = len(ep_id_to_idx)

                if int(ex["results/action_type"].numpy()) != STATUS_COMPLETE:
                    continue

                ep_idx = ep_id_to_idx[eid]
                H = int(ex["image/height"].numpy())
                W = int(ex["image/width"].numpy())
                C = int(ex["image/channels"].numpy())
                arr = (tf.io.decode_raw(ex["image/encoded"], tf.uint8)
                         .numpy().reshape(H, W, C))

                webp_b64 = base64.b64encode(encode_webp_bytes(arr)).decode()
                del arr  # raw 픽셀 즉시 해제

                goal   = ex["goal_info"].numpy().decode(errors="replace")
                prompt = ANALYSIS_PROMPT.format(goal=goal)
                req_id = f"shard{shard_idx:05d}_ep{ep_idx:04d}"

                requests_out.append({
                    "key": req_id,
                    "request": {
                        "contents": [{
                            "parts": [
                                {"text": prompt},
                                {"inline_data": {
                                    "mime_type": "image/webp",
                                    "data": webp_b64,
                                }},
                            ]
                        }],
                        "generationConfig": {
                            "maxOutputTokens":  256,
                            "responseMimeType": "application/json",
                            "responseSchema":   OUTPUT_SCHEMA,
                            "thinkingConfig":   {"thinkingLevel": thinking_level},
                            "mediaResolution":  "MEDIA_RESOLUTION_LOW",
                        },
                    },
                })
        except (tf.errors.DataLossError, tf.errors.InvalidArgumentError) as e:
            return (shard_idx, [], f"corrupted: {type(e).__name__}")

        # 샤드 간 메모리 회수 유도 (TF 텐서/dict refcount 정리)
        import gc
        gc.collect()

        return (shard_idx, requests_out, None)

    except Exception as e:
        return (shard_idx, [], f"worker_error: {type(e).__name__}: {e}")


# ── 1.8 GB 단위로 자동 롤오버하는 JSONL writer ─────────────────────────
class RotatingJSONLWriter:
    def __init__(self, base_dir: Path, prefix: str, max_bytes: int):
        self.base_dir  = base_dir
        self.prefix    = prefix
        self.max_bytes = max_bytes
        self.part_idx  = 0
        self.cur_bytes = 0
        self.cur_file  = None
        self.parts: list[Path] = []
        self._open_next()

    def _open_next(self):
        if self.cur_file:
            self.cur_file.close()
        self.part_idx += 1
        self.cur_bytes = 0
        path = self.base_dir / f"{self.prefix}_part{self.part_idx:03d}.jsonl"
        self.cur_file = open(path, "w", encoding="utf-8")
        self.parts.append(path)

    def write(self, obj: dict) -> None:
        line = json.dumps(obj, ensure_ascii=False) + "\n"
        size = len(line.encode("utf-8"))
        if self.cur_bytes > 0 and self.cur_bytes + size > self.max_bytes:
            self._open_next()
        self.cur_file.write(line)
        self.cur_bytes += size

    def close(self):
        if self.cur_file:
            self.cur_file.close()
            self.cur_file = None


# ── Main ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="AitW 서브셋 → Gemini Batch JSONL 파이프라인",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("subset", choices=list(SUBSET_SHARD_COUNTS.keys()),
                        help="처리할 서브셋")
    parser.add_argument("--shards", nargs=2, type=int, metavar=("START", "END"),
                        help="샤드 범위 (inclusive). 미지정 시 전체")
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 4,
                        help="처리 워커 프로세스 수 (기본: CPU 코어 수)")
    parser.add_argument("--max-tasks-per-worker", type=int, default=100,
                        help="워커가 N개 샤드 처리 후 재시작 (TF 메모리 누수 방지, "
                             "기본 100. 0이면 비활성)")
    parser.add_argument("--data-dir", type=Path, default=Path("data"),
                        help="샤드 다운로드 루트 (기본: data/)")
    parser.add_argument("--output-dir", type=Path, default=None,
                        help="JSONL 출력 디렉토리 (기본: data/<subset>/batch)")
    parser.add_argument("--downscale", type=int, default=1,
                        help="이미지 축소 배수 (1=원본, 2=1/2 ...)")
    parser.add_argument("--quality", type=int, default=90,
                        help="WebP 품질 (1-100, 기본 90)")
    parser.add_argument("--thinking-level", default="MINIMAL",
                        choices=["MINIMAL", "LOW", "MEDIUM", "HIGH"],
                        help="Gemini 3 thinking_level (기본: MINIMAL)")
    parser.add_argument("--max-jsonl-gb", type=float, default=1.8,
                        help="단일 JSONL 최대 크기 (GB, 기본 1.8)")
    parser.add_argument("--skip-download", action="store_true",
                        help="다운로드 건너뛰고 기존 샤드만 처리")
    args = parser.parse_args()

    total = SUBSET_SHARD_COUNTS[args.subset]
    if args.shards:
        start, end = args.shards
        if not (0 <= start <= end < total):
            parser.error(f"--shards 범위 오류 (0~{total-1})")
        shard_indices = list(range(start, end + 1))
    else:
        shard_indices = list(range(total))

    shard_dir  = args.data_dir / args.subset
    output_dir = args.output_dir or (args.data_dir / args.subset / "batch")
    output_dir.mkdir(parents=True, exist_ok=True)

    max_bytes = int(args.max_jsonl_gb * 1_000_000_000)

    expected_eps     = SUBSET_EPISODE_COUNTS[args.subset]
    expected_partial = expected_eps if len(shard_indices) == total \
                       else f"~{int(expected_eps * len(shard_indices) / total):,} (전체 {expected_eps:,} 중 {len(shard_indices)}/{total} shards)"

    print("=" * 70)
    print(f"Subset       : {args.subset}  (total {total} shards)")
    print(f"Shards       : {len(shard_indices)}개  ({shard_indices[0]}~{shard_indices[-1]})")
    print(f"Expected eps : {expected_partial}  (AITW 공식)")
    print(f"Shard dir    : {shard_dir.resolve()}")
    print(f"Output dir   : {output_dir.resolve()}")
    print(f"Workers      : {args.workers}")
    print(f"Image        : downscale={args.downscale}x  quality={args.quality}")
    print(f"Thinking     : {args.thinking_level}")
    print(f"JSONL rollover: {args.max_jsonl_gb} GB")
    print("=" * 70)

    # ── Step 1: 다운로드 ───────────────────────────────────────────────
    if not args.skip_download:
        print(f"\n[1/2] 샤드 다운로드 ({len(shard_indices)}개)...")
        t0 = time.time()
        download_all_shards(args.subset, total, shard_dir, shard_indices)
        print(f"  다운로드 완료 ({time.time() - t0:.1f}s)")
    else:
        print("\n[1/2] 다운로드 건너뜀")

    # ── Step 2: 추출 + JSONL 빌드 ──────────────────────────────────────
    print(f"\n[2/2] 에피소드 추출 + Gemini 배치 JSONL 생성...")
    t0 = time.time()

    writer = RotatingJSONLWriter(
        base_dir=output_dir,
        prefix=f"batch_input_{args.subset}",
        max_bytes=max_bytes,
    )

    worker_args = [
        (
            args.subset, idx, total,
            str(shard_dir / shard_name(args.subset, idx, total)),
            args.downscale, args.quality, args.thinking_level,
        )
        for idx in shard_indices
    ]

    total_eps  = 0
    skipped    = 0
    error_list: list[tuple[int, str]] = []

    pool_kwargs = dict(max_workers=args.workers, initializer=_worker_init)
    if args.max_tasks_per_worker > 0:
        pool_kwargs["max_tasks_per_child"] = args.max_tasks_per_worker

    with ProcessPoolExecutor(**pool_kwargs) as ex:
        futures = {ex.submit(_process_shard, wa): wa[1] for wa in worker_args}
        total_futures = len(futures)
        with tqdm(total=total_futures, desc="shards", unit="shard") as pbar:
            # as_completed는 입력 컬렉션의 스냅샷을 만들므로 dict 변경 안전
            for f in as_completed(list(futures)):
                shard_idx, reqs, err = f.result()

                # 핵심: 완료된 Future를 dict에서 제거해야 ._result(리스트)가 GC됨.
                # 안 그러면 8천 샤드의 결과가 메인 메모리에 그대로 쌓임.
                del futures[f]

                if err and err not in ("missing_or_empty",):
                    error_list.append((shard_idx, err))
                    if len(error_list) <= 5:
                        tqdm.write(f"  [error] shard {shard_idx:05d}: {err}")
                elif err == "missing_or_empty":
                    skipped += 1

                for r in reqs:
                    writer.write(r)
                total_eps += len(reqs)

                # 디스크에 쓴 뒤 명시적 해제 (다음 iter 전에 메모리 회수)
                del reqs, f

                pbar.update(1)
                pbar.set_postfix(eps=total_eps, parts=writer.part_idx,
                                 errs=len(error_list))

    writer.close()

    # ── 결과 요약 ──────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"완료  ({time.time() - t0:.1f}s)")
    print(f"  처리한 샤드  : {len(shard_indices)}")
    print(f"  빈/누락 샤드 : {skipped}")
    print(f"  오류 샤드    : {len(error_list)}")
    if len(shard_indices) == total:
        diff = total_eps - expected_eps
        match = "✓ 일치" if diff == 0 else f"✗ 차이 {diff:+,}"
        print(f"  추출 에피소드: {total_eps:,}  (AITW 공식 {expected_eps:,}) {match}")
    else:
        print(f"  추출 에피소드: {total_eps:,}  (전체 처리 시 AITW 공식 {expected_eps:,})")
    print(f"  생성 JSONL   : {writer.part_idx}개")
    for p in writer.parts:
        sz = p.stat().st_size / 1e9
        print(f"    {p.name}  ({sz:.2f} GB)")
    if error_list:
        print(f"\n오류 샤드 (최대 10개):")
        for s, e in error_list[:10]:
            print(f"  shard {s:05d}: {e}")
    print("=" * 70)


if __name__ == "__main__":
    main()
