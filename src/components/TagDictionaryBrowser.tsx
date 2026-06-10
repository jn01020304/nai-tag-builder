import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useTagDictionary } from '../hooks/useTagDictionary';
import type { TagDictionaryEntry } from '../catalog/tagDictionaryTypes';

const BrowserContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ntb-border, rgba(255, 255, 255, 0.1));
`;

const GroupTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 6px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid ${props => props.$active ? 'var(--ntb-primary, #646cff)' : 'transparent'};
  background: ${props => props.$active ? 'rgba(100, 108, 255, 0.1)' : 'var(--ntb-surface, rgba(255, 255, 255, 0.05))'};
  color: ${props => props.$active ? 'var(--ntb-primary, #646cff)' : 'inherit'};
  font-size: 14px;
  font-weight: ${props => props.$active ? 'bold' : 'normal'};
  cursor: pointer;
  white-space: nowrap;
`;

const CategoryGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const CategoryChip = styled.button<{ $active: boolean }>`
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid ${props => props.$active ? 'var(--ntb-text, #fff)' : 'var(--ntb-border, rgba(255, 255, 255, 0.2))'};
  background: ${props => props.$active ? 'var(--ntb-text, #fff)' : 'var(--ntb-surface, rgba(255, 255, 255, 0.05))'};
  color: ${props => props.$active ? 'var(--ntb-bg, #1a1a1a)' : 'inherit'};
  font-size: 13px;
  cursor: pointer;
`;

const TagGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 10px;
`;

const TagChip = styled.button`
  text-align: left;
  padding: 8px 10px;
  background: var(--ntb-surface, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ntb-border, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  &:hover {
    border-color: var(--ntb-primary, #646cff);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const TagEnglish = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--ntb-text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagKorean = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--ntb-border, rgba(255, 255, 255, 0.2));
  background: var(--ntb-bg, #1a1a1a);
  color: var(--ntb-text, #fff);
  font-size: 14px;
  margin-bottom: 12px;
  
  &:focus {
    outline: none;
    border-color: var(--ntb-primary, #646cff);
  }
`;

const WarningBox = styled.div`
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid rgba(255, 80, 80, 0.3);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #ff8888;
`;

interface TagDictionaryBrowserProps {
  onInsertTag: (tag: string, target: "prompt" | "negative") => void;
}

export const TagDictionaryBrowser: React.FC<TagDictionaryBrowserProps> = ({ onInsertTag }) => {
  const {
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
  } = useTagDictionary();

  const [searchQuery, setSearchQuery] = useState("");

  const activeGroup = useMemo(() => groups.find(g => g.groupId === selectedGroup), [groups, selectedGroup]);

  // Handle Search for autocomplete chunks
  const searchResults = useMemo(() => {
    if (!chunkData || chunkData.mode !== "autocomplete") return [];
    if (searchQuery.length < 2) return []; // Minimum query length 2

    const q = searchQuery.toLowerCase();
    const results: TagDictionaryEntry[] = [];
    
    for (const tag of chunkData.tags) {
      if (
        tag.english_name.toLowerCase().includes(q) ||
        tag.korean_name.includes(q) ||
        tag.keyword.toLowerCase().includes(q)
      ) {
        results.push(tag);
        if (results.length >= 50) break; // Limit to 50 results to prevent UI freeze
      }
    }
    
    return results;
  }, [chunkData, searchQuery]);

  if (isLoadingManifest) {
    return <BrowserContainer>Loading Tag Dictionary Manifest...</BrowserContainer>;
  }

  if (error && !manifest) {
    return (
      <BrowserContainer>
        <div style={{ color: 'red' }}>Failed to load Tag Dictionary: {error}</div>
      </BrowserContainer>
    );
  }

  return (
    <BrowserContainer>
      {/* 1. Group Navigation */}
      <GroupTabs className="dictionary-groups-scroll">
        {groups.map(group => (
          <TabButton
            key={group.groupId}
            $active={selectedGroup === group.groupId}
            onClick={() => selectGroup(group.groupId)}
          >
            {group.groupLabel}
          </TabButton>
        ))}
      </GroupTabs>

      {/* 2. Category Navigation */}
      {activeGroup && (
        <CategoryGrid>
          {activeGroup.categories.map(cat => (
            <CategoryChip
              key={cat.id}
              $active={selectedCategory === cat.id}
              onClick={() => {
                setSearchQuery(""); // Reset search on category change
                selectCategory(cat.id);
              }}
            >
              {cat.label} ({cat.count})
            </CategoryChip>
          ))}
        </CategoryGrid>
      )}

      {/* 3. Chunk Data Rendering */}
      {isLoadingChunk && <div style={{ fontSize: '13px', opacity: 0.7 }}>Loading tags...</div>}
      {error && selectedCategory && <div style={{ color: 'red', fontSize: '13px' }}>Error: {error}</div>}

      {chunkData && !isLoadingChunk && (
        <div>
          {chunkData.mode === "sensitive-select" && (
            <WarningBox>
              NSFW Content Warning: Contains sensitive tags.
            </WarningBox>
          )}

          {chunkData.mode === "autocomplete" ? (
            <div>
              <SearchInput 
                type="text" 
                placeholder="Search tags (min 2 chars)..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery.length < 2 ? (
                <div style={{ fontSize: '12px', opacity: 0.6 }}>Type at least 2 characters to search.</div>
              ) : (
                <TagGrid>
                  {searchResults.map(tag => (
                    <TagChip key={tag.english_name} onClick={() => onInsertTag(tag.english_name, "prompt")}>
                      <TagEnglish>{tag.english_name}</TagEnglish>
                      <TagKorean>{tag.korean_name}</TagKorean>
                    </TagChip>
                  ))}
                  {searchResults.length === 0 && <div style={{ fontSize: '13px', gridColumn: '1 / -1' }}>No matches found.</div>}
                </TagGrid>
              )}
            </div>
          ) : (
            <TagGrid>
              {chunkData.tags.map(tag => (
                <TagChip key={tag.english_name} onClick={() => onInsertTag(tag.english_name, "prompt")}>
                  <TagEnglish>{tag.english_name}</TagEnglish>
                  <TagKorean>{tag.korean_name}</TagKorean>
                </TagChip>
              ))}
            </TagGrid>
          )}
        </div>
      )}
    </BrowserContainer>
  );
};
