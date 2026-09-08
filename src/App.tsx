import { useRef, useState } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import type { MetadataState } from './types/metadata';
import { runApplyPipeline } from './automation/applyPipeline';
import type { ApplyPipelinePhase } from './automation/applyPipeline';
import { formatApplyErrorDetail } from './automation/applyStatusText';
import { useQueueDraftControls } from './hooks/useQueueDraftControls';
import { useEdgeResize } from './hooks/useEdgeResize';
import { useOverlayPosition } from "./hooks/useOverlayPosition";
import { useImageDropImport } from "./hooks/useImageDropImport";
import type { QueueMode } from './types/preset';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/themeContextCore';
import MainPromptSection from './components/MainPromptSection';
import TagDictionarySection from './components/TagDictionarySection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import AdvancedParams from './components/AdvancedParams';
import PresetManager from './components/PresetManager';
import QueueWorkspace from './components/QueueWorkspace';
import ImportModal from './components/ImportModal';
import StatusBanner from './components/StatusBanner';
import OverlayFooter from './components/OverlayFooter';
import OverlayHeader from './components/OverlayHeader';
import OverlayResizeHandles from "./components/OverlayResizeHandles";
import CollapsedLauncher from "./components/CollapsedLauncher";
import type { StatusFeedback } from './types/feedback';
import { movePromptTag } from './prompt/catalog/promptTagText';
import { usePromptTargets } from './hooks/usePromptTargets';
import { offlineTagSuggestionProvider } from './catalog/providers/tagSuggestionProvider';
import type { PromptAutocompleteApi } from './components/PromptFieldSuggestions';
import { mergeMetadataPatch } from "./model/metadataPatch";

export type AppMode = 'compose' | 'queue';

interface AppProps {
  onRequestClose: () => void;
}

const CONTAINER_ID = 'nai-tag-builder-root';

function AppContent({ onRequestClose }: AppProps) {
  const theme = useTheme();
  const [state, dispatch] = useMetadataState();
  const [isApplying, setIsApplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('compose');
  const { overlayWidth, overlayHeight, startResize } = useEdgeResize(320, CONTAINER_ID);
  const {
    viewportHeight,
    startDrag,
    handleTwoFingerDragStart,
  } = useOverlayPosition({
    rootId: CONTAINER_ID,
    isCollapsed,
    overlayWidth,
    overlayHeight,
  });

  // Preset queue state
  const [queue, setQueue] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>('batched');

  // Import Modal state
  const [pendingImport, setPendingImport] = useState<MetadataState | null>(null);

  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [currentApplyPhase, setCurrentApplyPhase] = useState<ApplyPipelinePhase | null>(null);
  const applyInFlightRef = useRef(false);
  const {
    activePromptTarget,
    setActivePromptTarget,
    recordPromptSelection,
    getSelectionAfterRender,
    handleCatalogToggle,
    handleToggleDictionaryTag,
    acceptAutocomplete,
    addRelatedTag,
  } = usePromptTargets(state, dispatch);
  const [recentTags, setRecentTags] = useState<string[]>([]);

  const pushRecentTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setRecentTags((current) =>
      [trimmed, ...current.filter((existing) => existing.toLowerCase() !== trimmed.toLowerCase())].slice(0, 16),
    );
  };

  const promptAutocomplete: PromptAutocompleteApi = {
    provider: offlineTagSuggestionProvider,
    prompt: state.prompt,
    recentTags,
    acceptAutocomplete: (target, caretIndex, tag) => {
      acceptAutocomplete(target, caretIndex, tag);
      pushRecentTag(tag);
    },
    acceptRecommendation: (target, tag) => {
      addRelatedTag(target, tag);
      pushRecentTag(tag);
    },
  };

  const showFeedback = (nextFeedback: StatusFeedback) => {
    setFeedback(nextFeedback);
    if (nextFeedback.tone === 'error' || nextFeedback.tone === 'warning') {
      setIsCollapsed(false);
    }
  };

  const {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageDropImport({
    onImportRequest: setPendingImport,
    onFeedback: showFeedback,
    onBeforeImport: () => setFeedback(null),
  });

  // Auto-generation logic
  const {
    queueEnabled,
    setQueueEnabled,
    seedRule,
    setSeedRule,
    runsPerPreset,
    setRunsPerPreset,
    intervalSec,
    targetCount,
    targetMin,
    adjustStep,
    setAdjustStep,
    isLooping,
    loopCount,
    queueSession,
    startLoop,
    stopLoop,
    handleIntervalChange,
    handleCountChange,
    handleMinChange,
    adjustValue,
  } = useQueueDraftControls({ state, queue, queueMode, onFeedback: showFeedback });

  const handleClose = () => {
    stopLoop();
    onRequestClose();
  };

  const handleReorderBasePrompt = (fromIndex: number, toIndex: number) => {
    dispatch({
      type: "SET_PROMPT",
      field: "basePrompt",
      value: movePromptTag(state.prompt.basePrompt, fromIndex, toIndex),
    });
  };

  const handleRemoveCharacter = (id: string) => {
    if (activePromptTarget.kind === 'character' && activePromptTarget.id === id) {
      setActivePromptTarget({ kind: 'base' });
    }
    const index = state.prompt.characters.findIndex(c => c.id === id);
    if (index >= 0) {
      const negChar = state.prompt.negativeCharacters[index];
      if (activePromptTarget.kind === 'negativeCharacter' && activePromptTarget.id === (negChar?.id ?? id)) {
        setActivePromptTarget({ kind: 'base' });
      }
    }
    dispatch({ type: 'REMOVE_CHARACTER', id });
  };



  const handleApply = async () => {
    if (applyInFlightRef.current) {
      showFeedback({ tone: 'warning', message: '이미 NovelAI 적용이 진행 중입니다.' });
      return;
    }

    applyInFlightRef.current = true;
    setCurrentApplyPhase('planning');
    setIsApplying(true);
    showFeedback({ tone: 'info', message: 'NovelAI 적용을 시작합니다.' });
    try {
      const result = await runApplyPipeline({
        state,
        autoGenerate: false,
        onPhase: (phase) => {
          setCurrentApplyPhase(phase.phase);
          showFeedback({ tone: 'info', message: phase.message, detail: phase.detail });
        },
      });
      if (result.effect.status === 'failed') {
        console.error('Apply effect failed:', result.effect);
        showFeedback({
          tone: 'error',
          message: result.effect.message,
          detail: formatApplyErrorDetail(result.effect.code, result.effect.detail),
        });
        return;
      }

      showFeedback({
        tone: 'success',
        message: result.effect.message,
      });
      setIsCollapsed(false);
    } catch (error) {
      console.error('Error applying preset:', error);
      showFeedback({ tone: 'error', message: '적용 중 오류가 발생했습니다.' });
    } finally {
      applyInFlightRef.current = false;
      setCurrentApplyPhase(null);
      setIsApplying(false);
    }
  };

  const handleStartQueue = () => {
    if (!queueEnabled) {
      showFeedback({
        tone: "warning",
        message: "Auto-Queue가 꺼져 있습니다.",
        detail: "Queue 모드에서 자동화를 켜고 다시 시작하세요.",
      });
      setAppMode("queue");
      return;
    }
  
    startLoop();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStartCapture={handleTwoFingerDragStart}
      style={{
        width: isCollapsed ? '56px' : `${overlayWidth}px`,
        height: isCollapsed ? '56px' : overlayHeight == null ? undefined : `${overlayHeight}px`,
        minWidth: isCollapsed ? '56px' : '280px',
        maxWidth: isCollapsed ? '56px' : 'calc(100vw - 16px)',
        maxHeight: isCollapsed ? 'none' : overlayHeight == null ? `${Math.floor(viewportHeight * 0.8)}px` : `${Math.max(200, viewportHeight - 16)}px`,
        overflow: 'hidden',
        backgroundColor: theme.base,
        color: theme.text,
        borderRadius: isCollapsed ? '999px' : '16px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.4)',
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: theme.mantle,
          opacity: 0.9,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: `2px dashed ${theme.intensityHigh}`,
          color: theme.text,
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Drop Image Here</h2>
          <p style={{ fontSize: '12px', color: theme.subtext0 }}>Extract NovelAI metadata into Tag Builder</p>
        </div>
      )}

      {/* Right Edge Resize Handle */}
      <OverlayResizeHandles
        hidden={isCollapsed}
        onStartResize={startResize}
      />

      {isCollapsed ? (
        <CollapsedLauncher
          isLooping={isLooping}
          loopCount={loopCount}
          targetCount={targetCount}
          onExpand={() => setIsCollapsed(false)}
          onStartDrag={startDrag}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
          <OverlayHeader
            isCollapsed={isCollapsed}
            onClose={handleClose}
            onToggleCollapsed={() => setIsCollapsed(c => !c)}
            onStartDrag={startDrag}
          />
          <div
            data-testid="mode-tabs"
            style={{
              display: 'flex',
              borderBottom: `1px solid ${theme.surface1}`,
              backgroundColor: theme.mantle,
            }}
          >
            <button
              type="button"
              data-testid="mode-tab-compose"
              aria-pressed={appMode === "compose"}
              onClick={() => setAppMode('compose')}
              style={{
                flex: 1,
                padding: '10px 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: appMode === 'compose' ? `2px solid ${theme.actionAccent}` : '2px solid transparent',
                color: appMode === 'compose' ? theme.actionAccent : theme.subtext0,
                fontWeight: appMode === 'compose' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Compose
            </button>
            <button
              type="button"
              data-testid="mode-tab-queue"
              aria-pressed={appMode === "queue"}
              onClick={() => setAppMode('queue')}
              style={{
                flex: 1,
                padding: '10px 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: appMode === 'queue' ? `2px solid ${theme.actionAccent}` : '2px solid transparent',
                color: appMode === 'queue' ? theme.actionAccent : theme.subtext0,
                fontWeight: appMode === 'queue' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Presets & Queue
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div
        data-testid="overlay-body"
        style={{
          display: isCollapsed ? 'none' : 'block',
          flex: '1 1 auto',
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          padding: '16px 16px 0',
        }}
      >

          {feedback && (
            <StatusBanner
              feedback={feedback}
              onDismiss={() => setFeedback(null)}
            />
          )}

          <PresetManager
            state={state}
            dispatch={dispatch}
            queue={queue}
            setQueue={setQueue}
            onImportRequest={setPendingImport}
            onFeedback={showFeedback}
          />

          {appMode === 'compose' ? (
            <>

              <MainPromptSection
                prompt={state.prompt}
                dispatch={dispatch}
                activePromptTarget={activePromptTarget}
                getSelectionAfterRender={getSelectionAfterRender}
                onPromptSelection={recordPromptSelection}
                autocomplete={promptAutocomplete}
              />
              <CharacterCaptions
                characters={state.prompt.characters}
                negativeCharacters={state.prompt.negativeCharacters}
                activePromptTarget={activePromptTarget}
                dispatch={dispatch}
                getSelectionAfterRender={getSelectionAfterRender}
                onPromptSelection={recordPromptSelection}
                onRemoveCharacter={handleRemoveCharacter}
                autocomplete={promptAutocomplete}
              />
              <TagDictionarySection
                prompt={state.prompt}
                activePromptTarget={activePromptTarget}
                onToggleCatalogEntry={handleCatalogToggle}
                onReorderBasePrompt={handleReorderBasePrompt}
                onToggleDictionaryTag={handleToggleDictionaryTag}
              />
              <GenerationParams state={state} dispatch={dispatch} />
              <AdvancedParams state={state} dispatch={dispatch} />
            </>
          ) : (
            <>
              <QueueWorkspace
                queueEnabled={queueEnabled}
                setQueueEnabled={setQueueEnabled}
                seedRule={seedRule}
                setSeedRule={setSeedRule}
                queueMode={queueMode}
                setQueueMode={setQueueMode}
                runsPerPreset={runsPerPreset}
                setRunsPerPreset={setRunsPerPreset}
                adjustStep={adjustStep}
                setAdjustStep={setAdjustStep}
                intervalSec={intervalSec}
                handleIntervalChange={handleIntervalChange}
                targetCount={targetCount}
                handleCountChange={handleCountChange}
                targetMin={targetMin}
                handleMinChange={handleMinChange}
                adjustValue={adjustValue}
                queueLength={queue.length}
                queueSession={queueSession}
              />
            </>
          )}
      </div>

      {!isCollapsed && (
        <OverlayFooter
          appMode={appMode}
          queueEnabled={queueEnabled}
          feedback={feedback}
          isApplying={isApplying}
          applyPhase={currentApplyPhase}
          isLooping={isLooping}
          loopCount={loopCount}
          targetCount={targetCount}
          onApply={handleApply}
          onStartLoop={handleStartQueue}
          onStopLoop={stopLoop}
        />
      )}

      {pendingImport && (
        <ImportModal
          importedState={pendingImport}
          onConfirm={(partial) => {
            const merged = mergeMetadataPatch(state, partial);
            dispatch({ type: 'LOAD_PRESET', state: merged });
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

export default function App({ onRequestClose }: AppProps) {
  return (
    <ThemeProvider>
      <AppContent onRequestClose={onRequestClose} />
    </ThemeProvider>
  );
}
