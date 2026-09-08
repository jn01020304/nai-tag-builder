import { useEffect, useRef, useState } from "react";
import { usePresetLibrary } from "../hooks/usePresetLibrary";
import type { MetadataAction } from "../hooks/useMetadataState";
import {
  createUniquePresetNames,
  movePresetInQueue,
  resolveQueuedPresets,
  togglePresetInQueue,
} from "../model/presetQueue";
import type { ShowFeedback } from "../types/feedback";
import type { MetadataState } from "../types/metadata";
import type { Preset } from "../types/preset";
import { parseNovelAIImageFiles } from "../utils/pngParser";
import CollapsibleSection from "./CollapsibleSection";
import PresetActions from "./PresetActions";
import PresetList from "./PresetList";

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
  queue: string[];
  setQueue: React.Dispatch<React.SetStateAction<string[]>>;
  onImportRequest: (state: MetadataState) => void;
  onFeedback: ShowFeedback;
}

export default function PresetManager({
  state,
  dispatch,
  queue,
  setQueue,
  onImportRequest,
  onFeedback,
}: Props) {
  const [saveName, setSaveName] = useState("");
  const isMountedRef = useRef(true);
  const {
    presets,
    save,
    saveBatch,
    remove,
    importJson,
    exportJson,
  } = usePresetLibrary({
    onLoadError: (error) => {
      console.error("Failed to load presets:", error);
      onFeedback({
        tone: "error",
        message: "저장된 프리셋을 불러오지 못했습니다.",
      });
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSave = async () => {
    const name = saveName.trim() || `Preset ${presets.length + 1}`;
    try {
      await save(name, state);
      if (!isMountedRef.current) return;
      setSaveName("");
      onFeedback({
        tone: "success",
        message: `${name} 프리셋을 저장했습니다.`,
      });
    } catch (error) {
      console.error("Failed to save preset:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "프리셋을 저장하지 못했습니다.",
        });
      }
    }
  };

  const handleExportJson = async () => {
    try {
      const json = await exportJson();
      if (!isMountedRef.current) return;

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nai-tb-presets.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error("Failed to export presets:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "프리셋을 내보내지 못했습니다.",
        });
      }
    }
  };

  const handleImportJson = async (file: File) => {
    try {
      const count = await importJson(await file.text());
      if (!isMountedRef.current) return;
      onFeedback({
        tone: "success",
        message: `${count}개 프리셋을 가져왔습니다.`,
      });
    } catch (error) {
      console.error("Failed to import presets:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "잘못된 프리셋 파일입니다.",
        });
      }
    }
  };

  const handleImportImages = async (files: File[]) => {
    try {
      const result = await parseNovelAIImageFiles(files);
      if (!isMountedRef.current) return;

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
      console.error("Failed to import image metadata:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "이미지 메타데이터를 읽지 못했습니다.",
        });
      }
    }
  };

  const handleQueueImages = async (files: File[]) => {
    try {
      const result = await parseNovelAIImageFiles(files);
      if (!isMountedRef.current) return;
      if (result.patches.length === 0) {
        onFeedback({
          tone: "warning",
          message: "가져온 이미지에서 NovelAI 메타데이터를 찾지 못했습니다.",
        });
        return;
      }

      const names = createUniquePresetNames(
        result.patches.map((patch) => patch.fileName),
        presets.map((preset) => preset.name),
      );
      const createdPresets = await saveBatch(
        result.patches.map((patch, index) => ({
          name: names[index],
          state: patch.state,
        })),
      );
      if (!isMountedRef.current) return;

      setQueue((current) => [
        ...current,
        ...createdPresets.map((preset) => preset.id),
      ]);
      onFeedback({
        tone: "success",
        message: `${createdPresets.length}개 이미지에서 프리셋을 만들고 Queue에 추가했습니다.`,
        detail: result.failedFiles.length > 0
          ? `실패: ${result.failedFiles.join(", ")}`
          : undefined,
      });
    } catch (error) {
      console.error("Failed to add image metadata to queue:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "이미지를 Queue 프리셋으로 추가하지 못했습니다.",
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      if (!isMountedRef.current) return;
      setQueue((current) => current.filter((queueId) => queueId !== id));
    } catch (error) {
      console.error("Failed to delete preset:", error);
      if (isMountedRef.current) {
        onFeedback({
          tone: "error",
          message: "프리셋을 삭제하지 못했습니다.",
        });
      }
    }
  };

  const handleLoad = (preset: Preset) => {
    dispatch({ type: "LOAD_PRESET", state: preset.state });
  };

  const queuedPresets = resolveQueuedPresets(queue, presets);

  return (
    <CollapsibleSection title="Presets" testId="presets-section">
      <PresetActions
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onSave={() => void handleSave()}
        onImportJson={(file) => void handleImportJson(file)}
        onExportJson={() => void handleExportJson()}
        onImportImages={(files) => void handleImportImages(files)}
        onQueueImages={(files) => void handleQueueImages(files)}
      />
      <PresetList
        presets={presets}
        queue={queue}
        queuedPresets={queuedPresets}
        onLoad={handleLoad}
        onToggleQueue={(id) => {
          setQueue((current) => togglePresetInQueue(current, id));
        }}
        onMoveQueue={(id, direction) => {
          setQueue((current) => movePresetInQueue(current, id, direction));
        }}
        onDelete={(id) => void handleDelete(id)}
      />
    </CollapsibleSection>
  );
}
