import { useState, useRef, useEffect } from 'react';
import type { MetadataState } from '../types/metadata';
import type { SeedRule, QueueMode } from '../types/preset';
import { getPresetById } from '../model/presetStorage';
import { buildCommentJson } from '../model/buildCommentJson';
import { generatePngWithMetadata } from '../encoding/pngEncoder';
import { dispatchPasteEvent } from '../encoding/pasteDispatch';

export interface AutoGeneratorConfig {
    state: MetadataState;
    queue: string[];
    queueMode: QueueMode;
}

export function useAutoGenerator({ state, queue, queueMode }: AutoGeneratorConfig) {
    const [autoGenerate, setAutoGenerate] = useState(false);
    const [intervalSec, setIntervalSec] = useState<number | string>(30);
    const [targetCount, setTargetCount] = useState<number | string>(100);
    const [targetMin, setTargetMin] = useState<number | string>(50);
    const [isLooping, setIsLooping] = useState(false);
    const [seedRule, setSeedRule] = useState<SeedRule>('none');
    const [adjustStep, setAdjustStep] = useState<number | string>(10);

    const stateRef = useRef(state);
    const queueRef = useRef(queue);
    const queueModeRef = useRef(queueMode);
    const seedRuleRef = useRef(seedRule);

    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
    useEffect(() => { seedRuleRef.current = seedRule; }, [seedRule]);

    const loopCountRef = useRef(0);
    const loopTimeoutRef = useRef<number | null>(null);
    const queueIndexRef = useRef(0);

    // For live loop reading
    const intervalRef = useRef(Number(intervalSec) || 30);
    const targetCountRef = useRef(Number(targetCount) || 100);

    useEffect(() => { intervalRef.current = Number(intervalSec); }, [intervalSec]);
    useEffect(() => { targetCountRef.current = Number(targetCount); }, [targetCount]);

    const stopLoop = () => {
        if (loopTimeoutRef.current) {
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
                    nextSeed = Math.floor(Math.random() * 4294967295);
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
                    nextSeed = Math.floor(Math.random() * 4294967295);
                } else {
                    // 'none' rule
                    if (nextState.params.seed === 0) {
                        nextSeed = Math.floor(Math.random() * 4294967295);
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
            const loopComment = buildCommentJson(loopState);
            const loopBlob = await generatePngWithMetadata(loopComment, nextState.source);
            dispatchPasteEvent(loopBlob, true);

            loopCountRef.current += 1;
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
        isLooping, loopCount: loopCountRef.current,
        startLoop, stopLoop,
        handleIntervalChange, handleCountChange, handleMinChange, adjustValue,
    };
}
