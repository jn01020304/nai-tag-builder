import { useState } from 'react';
import { useQueueRunner } from '../queue/useQueueRunner';
import type { ShowFeedback } from '../types/feedback';
import type { MetadataState } from '../types/metadata';
import type { QueueMode, SeedRule } from '../types/preset';

export interface QueueDraftControlsConfig {
  state: MetadataState;
  queue: string[];
  queueMode: QueueMode;
  onFeedback?: ShowFeedback;
}

export function useQueueDraftControls({ state, queue, queueMode, onFeedback }: QueueDraftControlsConfig) {
  const [queueEnabled, setQueueEnabled] = useState(true);
  const [intervalSec, setIntervalSec] = useState<number | string>(10);
  const [targetCount, setTargetCount] = useState<number | string>(100);
  const [targetMin, setTargetMin] = useState<number | string>(16.7);
  const [seedRule, setSeedRule] = useState<SeedRule>('random');
  const [adjustStep, setAdjustStep] = useState<number | string>(3);
  const [runsPerPreset, setRunsPerPreset] = useState<number | string>(1);

  const {
    isLooping,
    loopCount,
    queueSession,
    startLoop,
    stopLoop,
  } = useQueueRunner({
    state,
    queue,
    queueMode,
    seedRule,
    intervalSec,
    targetCount,
    runsPerPreset,
    onFeedback,
  });

  const handleIntervalChange = (val: string) => {
    const sec = val === '' ? '' : Math.max(0, Number(val));
    setIntervalSec(sec);
    if (typeof sec === 'number' && typeof targetCount === 'number') {
      setTargetMin(Math.round((sec * targetCount / 60) * 10) / 10);
    }
  };

  const handleCountChange = (val: string) => {
    const count = val === '' ? '' : Math.max(0, Number(val));
    setTargetCount(count);
    if (typeof intervalSec === 'number' && typeof count === 'number') {
      setTargetMin(Math.round((intervalSec * count / 60) * 10) / 10);
    }
  };

  const handleMinChange = (val: string) => {
    const min = val === '' ? '' : Math.max(0, Number(val));
    setTargetMin(min);
    if (typeof intervalSec === 'number' && typeof min === 'number' && intervalSec > 0) {
      setTargetCount(Math.round((min * 60) / intervalSec));
    }
  };

  const adjustValue = (type: 'interval' | 'count', dir: 1 | -1) => {
    const step = Number(adjustStep) || 3;
    if (type === 'interval') {
      const val = Math.max(3, Number(intervalSec) + (step * dir));
      handleIntervalChange(String(val));
    } else {
      const val = Math.max(1, Number(targetCount) + (step * dir));
      handleCountChange(String(val));
    }
  };

  return {
    queueEnabled, setQueueEnabled,
    seedRule, setSeedRule,
    runsPerPreset, setRunsPerPreset,
    intervalSec, targetCount, targetMin, adjustStep, setAdjustStep,
    isLooping, loopCount, queueSession,
    startLoop, stopLoop,
    handleIntervalChange, handleCountChange, handleMinChange, adjustValue,
  };
}
