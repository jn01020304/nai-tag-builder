import { useState } from "react";
import type { DragEvent } from "react";
import { parseNovelAIImageFiles } from "../utils/pngParser";
import type { ShowFeedback } from "../types/feedback";
import type { MetadataState } from "../types/metadata";

export interface ImageDropImportConfig {
  onImportRequest: (state: MetadataState) => void;
  onFeedback: ShowFeedback;
  onBeforeImport?: () => void;
}

export function useImageDropImport({
  onImportRequest,
  onFeedback,
  onBeforeImport,
}: ImageDropImportConfig) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    if (event.currentTarget === event.target) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    onBeforeImport?.();

    const files = Array.from(event.dataTransfer.files)
      .filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      onFeedback({
        tone: "warning",
        message: "이미지 파일만 가져올 수 있습니다.",
      });
      return;
    }

    try {
      const result = await parseNovelAIImageFiles(files);
      if (!result.mergedState) {
        onFeedback({
          tone: "warning",
          message: "가져온 이미지에서 NovelAI 메타데이터를 찾지 못했습니다.",
        });
        return;
      }

      onImportRequest(result.mergedState);
      onFeedback({
        tone: "success",
        message: `${result.patches.length}개 이미지에서 NovelAI 메타데이터를 찾았습니다.`,
        detail: result.failedFiles.length > 0
          ? `실패: ${result.failedFiles.join(", ")}`
          : undefined,
      });
    } catch (error) {
      console.error("Error parsing image metadata:", error);
      onFeedback({
        tone: "error",
        message: "이미지 메타데이터를 읽지 못했습니다.",
      });
    }
  };

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
