import { useState, useRef, useEffect } from 'react';
import type { MetadataState } from '../types/metadata';
import type { SeedRule, QueueMode } from '../types/preset';
import type { ShowFeedback } from '../types/feedback';
import { getPresetById } from '../model/presetStorage';
import { createRandomSeed, runApplyPipeline } from '../automation/applyPipeline';

export interface AutoGeneratorConfig {
    state: MetadataState;
    queue: string[];
    queueMode: QueueMode;
    onFeedback?: ShowFeedback;
}

export function useAutoGenerator({ state, queue, queueMode, onFeedback }: AutoGeneratorConfig) {
    const [autoGenerate, setAutoGenerate] = useState(false);
    const [intervalSec, setIntervalSec] = useState<number | string>(30);
    const [targetCount, setTargetCount] = useState<number | string>(100);
    const [targetMin, setTargetMin] = useState<number | string>(50);
    const [isLooping, setIsLooping] = useState(false);
    const [loopCount, setLoopCount] = useState(0);
    const [seedRule, setSeedRule] = useState<SeedRule>('none');
    const [adjustStep, setAdjustStep] = useState<number | string>(10);

    const stateRef = useRef(state);
    const queueRef = useRef(queue);
    const queueModeRef = useRef(queueMode);
    const seedRuleRef = useRef(seedRule);
    const feedbackRef = useRef(onFeedback);

    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
    useEffect(() => { seedRuleRef.current = seedRule; }, [seedRule]);
    useEffect(() => { feedbackRef.current = onFeedback; }, [onFeedback]);

    const loopCountRef = useRef(0);
    const loopTimeoutRef = useRef<number | null>(null);
    const queueIndexRef = useRef(0);

    // For live loop reading
    const intervalRef = useRef(Number(intervalSec) || 30);
    const targetCountRef = useRef(Number(targetCount) || 100);

    useEffect(() => { intervalRef.current = Number(intervalSec); }, [intervalSec]);
    useEffect(() => { targetCountRef.current = Number(targetCount); }, [targetCount]);

    const stopLoop = () => {
        if (loopTimeoutRef.current !== null) {
            clearTimeout(loopTimeoutRef.current);
            loopTimeoutRef.current = null;
        }
        setIsLooping(false);
    };

    useEffect(() => () => {
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    }, []);

    const getNextQueueState = async () => {
        const currentQueue = queueRef.current;
        const currentQueueMode = queueModeRef.current;
        if (currentQueue.length === 0) return null;
        let idx: number;
        if (currentQueueMode === 'randomization') {
            idx = Math.floor(Math.random() * currentQueue.length);
        } else {
            idx = queueIndexRef.current % currentQueue.length;
            queueIndexRef.current = idx + 1;
        }
        const preset = await getPresetById(currentQueue[idx]);
        return preset?.state ?? null;
    };

    const startLoop = () => {
        stopLoop();
        setIsLooping(true);
        loopCountRef.current = 0;
        setLoopCount(0);
        queueIndexRef.current = 0;
        let currentLoopSeed = Number(stateRef.current.params.seed);

        const executeLoop = async () => {
            if (loopCountRef.current >= targetCountRef.current) {
                stopLoop();
                return;
            }

            const currentState = stateRef.current;
            const currentQueue = queueRef.current;
            const currentSeedRule = seedRuleRef.current;

            const nextQueueState = currentQueue.length > 0 ? await getNextQueueState() : null;
            const nextState = nextQueueState ?? currentState;
            let nextSeed = currentLoopSeed;

            if (currentQueue.length > 0) {
                if (nextState.params.seed === 0) {
                    nextSeed = createRandomSeed();
                } else {
                    const genBtn = Array.from(document.querySelectorAll('button'))
                        .find(b => b.textContent?.includes('Generate')) as HTMLButtonElement | undefined;
                    if (genBtn && genBtn.disabled) {
                        nextSeed = currentLoopSeed + 1;
                    } else {
                        nextSeed = nextState.params.seed;
                    }
                }
            } else {
                if (currentSeedRule === 'increment') {
                    nextSeed = currentLoopSeed + 1;
                } else if (currentSeedRule === 'decrement') {
                    nextSeed = Math.max(0, currentLoopSeed - 1);
                } else if (currentSeedRule === 'random') {
                    nextSeed = createRandomSeed();
                } else {
                    // 'none' rule
                    if (nextState.params.seed === 0) {
                        nextSeed = createRandomSeed();
                    } else {
                        nextSeed = nextState.params.seed;
                    }
                }
            }

            currentLoopSeed = nextSeed;
            const loopState = {
                ...nextState,
                params: { ...nextState.params, seed: nextSeed },
            };
            try {
                const result = await runApplyPipeline({ state: loopState, autoGenerate: true });
                if (result.effect.status === 'failed') {
                    console.error('Auto generate effect failed:', result.effect);
                    feedbackRef.current?.({ tone: 'error', message: result.effect.message });
                    stopLoop();
                    return;
                }
            } catch (error) {
                console.error('Auto generate pipeline failed:', error);
                feedbackRef.current?.({ tone: 'error', message: '자동 생성 적용 중 오류가 발생했습니다.' });
                stopLoop();
                return;
            }

            loopCountRef.current += 1;
            setLoopCount(loopCountRef.current);
            const nextSec = Math.max(3, intervalRef.current);
            loopTimeoutRef.current = window.setTimeout(executeLoop, nextSec * 1000);
        };

        // Start first loop after a short delay (or immediately)
        loopTimeoutRef.current = window.setTimeout(executeLoop, Math.max(3, intervalRef.current) * 1000);
    };

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
        const step = Number(adjustStep) || 10;
        if (type === 'interval') {
            const val = Math.max(3, Number(intervalSec) + (step * dir));
            handleIntervalChange(String(val));
        } else {
            const val = Math.max(1, Number(targetCount) + (step * dir));
            handleCountChange(String(val));
        }
    };

    return {
        autoGenerate, setAutoGenerate,
        seedRule, setSeedRule,
        intervalSec, targetCount, targetMin, adjustStep, setAdjustStep,
        isLooping, loopCount,
        startLoop, stopLoop,
        handleIntervalChange, handleCountChange, handleMinChange, adjustValue,
    };
}
