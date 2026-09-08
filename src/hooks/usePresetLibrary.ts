import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  deletePreset,
  exportPresets,
  importPresets,
  loadPresets,
  savePreset,
  savePresetsBatch,
} from "../model/presetStorage";
import type { MetadataState } from "../types/metadata";
import type { Preset } from "../types/preset";

export interface PresetLibraryOptions {
  onLoadError?: (error: unknown) => void;
}

export interface PresetLibrary {
  presets: Preset[];
  refresh: () => Promise<Preset[]>;
  save: (name: string, state: MetadataState) => Promise<Preset>;
  saveBatch: (
    items: Array<{ name: string; state: MetadataState }>,
  ) => Promise<Preset[]>;
  remove: (id: string) => Promise<void>;
  importJson: (json: string) => Promise<number>;
  exportJson: () => Promise<string>;
}

export function usePresetLibrary({
  onLoadError,
}: PresetLibraryOptions = {}): PresetLibrary {
  const [presets, setPresets] = useState<Preset[]>([]);
  const isMountedRef = useRef(true);
  const refreshIdRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  const refresh = useCallback(async () => {
    const refreshId = refreshIdRef.current + 1;
    refreshIdRef.current = refreshId;
    const loaded = await loadPresets();

    if (
      isMountedRef.current &&
      refreshIdRef.current === refreshId
    ) {
      setPresets(loaded);
    }
    return loaded;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const initialLoadTimer = setTimeout(() => {
      void refresh().catch((error) => {
        if (isMountedRef.current) {
          onLoadErrorRef.current?.(error);
        }
      });
    }, 0);

    return () => {
      clearTimeout(initialLoadTimer);
      isMountedRef.current = false;
      refreshIdRef.current += 1;
    };
  }, [refresh]);

  const save = async (name: string, state: MetadataState) => {
    const preset = await savePreset(name, state);
    await refresh();
    return preset;
  };

  const saveBatch = async (
    items: Array<{ name: string; state: MetadataState }>,
  ) => {
    const created = await savePresetsBatch(items);
    await refresh();
    return created;
  };

  const remove = async (id: string) => {
    await deletePreset(id);
    await refresh();
  };

  const importJson = async (json: string) => {
    const count = await importPresets(json);
    await refresh();
    return count;
  };

  return {
    presets,
    refresh,
    save,
    saveBatch,
    remove,
    importJson,
    exportJson: exportPresets,
  };
}
