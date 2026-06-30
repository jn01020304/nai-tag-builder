import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useTagDictionary } from '../hooks/useTagDictionary';
import type { TagDictionaryEntry } from '../catalog/tagDictionaryTypes';
import type { PromptState } from '../types/metadata';
import { promptTargetGroup, type PromptInsertTarget } from '../prompt/promptInsertTarget';
import { sortTagsByUsage } from '../utils/tagUsageHelper';
import type { TagAssignment } from '../utils/tagUsageHelper';
import { promptTonePalettes } from '../styles/promptTonePalettes';

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

const TagChip = styled.button<{ $bg: string; $border: string; $color: string; $shadow: string }>`
  text-align: left;
  padding: 8px 10px;
  background: ${props => props.$bg};
  border: 1px solid ${props => props.$border};
  border-radius: 6px;
  box-shadow: ${props => props.$shadow !== 'none' ? `0 0 0 2px ${props.$shadow}` : 'none'};
  color: ${props => props.$color};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  
  &:hover {
    border-color: var(--ntb-primary, #646cff);
    background: ${props => props.$bg === 'var(--ntb-surface, rgba(255, 255, 255, 0.05))' ? 'rgba(255, 255, 255, 0.08)' : props.$bg};
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
  prompt: PromptState;
  activePromptTarget: PromptInsertTarget;
  onToggleDictionaryTag: (tag: string) => void;
}

export const TagDictionaryBrowser: React.FC<TagDictionaryBrowserProps> = ({ 
  prompt,
  activePromptTarget,
  onToggleDictionaryTag 
}) => {
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

  const preservePromptSelection = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Handle Search for autocomplete chunks
  const { sortedSearchResults, searchAssignmentsMap } = useMemo<{
    sortedSearchResults: TagDictionaryEntry[];
    searchAssignmentsMap: Map<string, TagAssignment[]>;
  }>(() => {
    if (!chunkData || chunkData.mode !== "autocomplete") return { sortedSearchResults: [], searchAssignmentsMap: new Map() };
    if (searchQuery.length < 2) return { sortedSearchResults: [], searchAssignmentsMap: new Map() };

    const q = searchQuery.toLowerCase();
    const results: TagDictionaryEntry[] = [];
    
    for (const tag of chunkData.tags) {
      if (
        tag.english_name.toLowerCase().includes(q) ||
        tag.korean_name.includes(q) ||
        tag.keyword.toLowerCase().includes(q)
      ) {
        results.push(tag);
      }
    }
    
    const { sortedTags, assignmentsMap } = sortTagsByUsage(results, prompt);
    return { sortedSearchResults: sortedTags.slice(0, 50), searchAssignmentsMap: assignmentsMap };
  }, [chunkData, searchQuery, prompt]);

  const { sortedCategoryTags, categoryAssignmentsMap } = useMemo<{
    sortedCategoryTags: TagDictionaryEntry[];
    categoryAssignmentsMap: Map<string, TagAssignment[]>;
  }>(() => {
    if (!chunkData || chunkData.mode === "autocomplete") return { sortedCategoryTags: [], categoryAssignmentsMap: new Map() };
    const { sortedTags, assignmentsMap } = sortTagsByUsage(chunkData.tags, prompt);
    return { sortedCategoryTags: sortedTags, categoryAssignmentsMap: assignmentsMap };
  }, [chunkData, prompt]);

  const renderTag = (tag: TagDictionaryEntry, isSearch: boolean) => {
    const assignmentsMap = isSearch ? searchAssignmentsMap : categoryAssignmentsMap;
    const assignments = assignmentsMap.get(tag.english_name) || [];
    const currentTargetGroup = promptTargetGroup(activePromptTarget);

    const activeInCurrentTarget = assignments.some(a => a.group === currentTargetGroup);
    const hasAnyAssignment = assignments.length > 0;
    
    // Styling
    let bg = "var(--ntb-surface, rgba(255, 255, 255, 0.05))";
    let border = "var(--ntb-border, rgba(255, 255, 255, 0.15))";
    let color = "var(--ntb-text, #fff)";
    let shadow = "none";

    if (hasAnyAssignment) {
      const currentAssignmentPalette = promptTonePalettes[currentTargetGroup];
      const firstAssignmentPalette = promptTonePalettes[assignments[0].group];
      const chipPalette = activeInCurrentTarget ? currentAssignmentPalette : firstAssignmentPalette;
      
      bg = chipPalette.background;
      border = chipPalette.border;
      color = chipPalette.color;
      if (activeInCurrentTarget) {
        shadow = chipPalette.shadow;
      }
    }

    return (
      <TagChip 
        key={tag.english_name} 
        data-testid={`dict-tag-${tag.english_name}`}
        onMouseDown={preservePromptSelection}
        onTouchStart={(event) => event.stopPropagation()}
        onPointerDown={preservePromptSelection}
        onClick={() => onToggleDictionaryTag(tag.english_name)}
        $bg={bg}
        $border={border}
        $color={color}
        $shadow={shadow}
      >
        <TagEnglish>{tag.english_name}</TagEnglish>
        <TagKorean>{tag.korean_name}</TagKorean>
        {assignments.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              gap: "2px",
              position: "absolute",
              right: "4px",
              top: "4px",
            }}
          >
            {assignments.map((assignment) => {
              const palette = promptTonePalettes[assignment.group];
              return (
                <span
                  key={assignment.key}
                  style={{
                    backgroundColor: palette.border,
                    borderRadius: "999px",
                    color: "#101224",
                    fontSize: "9px",
                    fontWeight: 800,
                    lineHeight: 1,
                    padding: "2px 4px",
                    textTransform: "lowercase",
                  }}
                >
                  {assignment.label}
                </span>
              );
            })}
          </div>
        )}
      </TagChip>
    );
  };

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
            data-testid={`dict-group-${group.groupId}`}
            $active={selectedGroup === group.groupId}
            onMouseDown={preservePromptSelection}
            onTouchStart={(event) => event.stopPropagation()}
            onPointerDown={preservePromptSelection}
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
              data-testid={`dict-category-${cat.id}`}
              $active={selectedCategory === cat.id}
              onMouseDown={preservePromptSelection}
              onTouchStart={(event) => event.stopPropagation()}
              onPointerDown={preservePromptSelection}
              onClick={() => {
                setSearchQuery("");
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
                  {sortedSearchResults.map(tag => renderTag(tag, true))}
                  {sortedSearchResults.length === 0 && <div style={{ fontSize: '13px', gridColumn: '1 / -1' }}>No matches found.</div>}
                </TagGrid>
              )}
            </div>
          ) : (
            <TagGrid>
              {sortedCategoryTags.map(tag => renderTag(tag, false))}
            </TagGrid>
          )}
        </div>
      )}
    </BrowserContainer>
  );
};
