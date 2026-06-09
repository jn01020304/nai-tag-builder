import { useState, useEffect, useCallback, useRef } from 'react';
import { tagDictionaryLoader } from '../catalog/tagDictionaryLoader';
import type { TagDictionaryManifest, TagDictionaryChunkData, TagDictionaryCategoryMeta } from '../catalog/tagDictionaryTypes';

export function useTagDictionary() {
  const [manifest, setManifest] = useState<TagDictionaryManifest | null>(null);
  const [groups, setGroups] = useState<{ groupId: string; groupLabel: string; categories: TagDictionaryCategoryMeta[] }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chunkData, setChunkData] = useState<TagDictionaryChunkData | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequestId = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    async function init() {
      setIsLoadingManifest(true);
      setError(null);
      try {
        const m = await tagDictionaryLoader.loadManifest();
        if (isMounted) {
          setManifest(m);
          const g = tagDictionaryLoader.getGroups();
          setGroups(g);
          if (g.length > 0) {
            setSelectedGroup(g[0].groupId);
          }
        }
      } catch (e) {
        if (isMounted) {
          setError((e as Error).message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingManifest(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectGroup = useCallback((groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedCategory(null);
    setChunkData(null);
  }, []);

  const selectCategory = useCallback(async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setChunkData(null);
    setError(null);
    setIsLoadingChunk(true);
    
    const reqId = ++fetchRequestId.current;

    try {
      const data = await tagDictionaryLoader.loadChunk(categoryId);
      if (reqId === fetchRequestId.current) {
        setChunkData(data);
      }
    } catch (e) {
      if (reqId === fetchRequestId.current) {
        setError((e as Error).message);
      }
    } finally {
      if (reqId === fetchRequestId.current) {
        setIsLoadingChunk(false);
      }
    }
  }, []);

  return {
    manifest,
    groups,
    selectedGroup,
    selectedCategory,
    chunkData,
    isLoadingManifest,
    isLoadingChunk,
    error,
    selectGroup,
    selectCategory,
  };
}
