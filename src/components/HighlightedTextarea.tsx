import React, { useRef, useLayoutEffect, useState } from 'react';
import { useTheme } from '../contexts/themeContextCore';
import { withAlpha } from '../styles/theme';
import { parsePromptToTokens } from '../utils/intensityParser';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    selectionAfterRender?: { start: number; end: number; version: number } | null;
}

export default function HighlightedTextarea(props: Props) {
    const {
        value,
        style,
        onChange,
        onScroll,
        onMouseDown,
        onTouchStart,
        onPointerDown,
        onClick,
        selectionAfterRender,
        ...rest
    } = props;
    const theme = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const boxHeight = style?.height ?? style?.minHeight ?? '80px';
    const resizeMode = style?.resize ?? 'vertical';
    const minHeight = typeof style?.minHeight === 'number'
        ? style.minHeight
        : parseFloat(String(style?.minHeight ?? boxHeight)) || 80;
    const [boxHeightPx, setBoxHeightPx] = useState(() => {
        if (typeof style?.height === 'number') return style.height;
        const parsedHeight = parseFloat(String(style?.height ?? boxHeight));
        return Number.isFinite(parsedHeight) ? parsedHeight : minHeight;
    });
    const canResizeVertically = resizeMode === 'vertical' || resizeMode === 'both';

    const tokens = parsePromptToTokens(value);

    // Sync scroll manually in case of fast scrolling
    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (backdropRef.current) {
            backdropRef.current.scrollTop = e.currentTarget.scrollTop;
            backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
        if (onScroll) onScroll(e);
    };

    // Ensure scroll is synced after layout changes (resizes, text changes)
    useLayoutEffect(() => {
        if (textareaRef.current && backdropRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    });

    useLayoutEffect(() => {
        if (!selectionAfterRender || !textareaRef.current) return;

        const start = Math.max(0, Math.min(selectionAfterRender.start, value.length));
        const end = Math.max(start, Math.min(selectionAfterRender.end, value.length));
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
    }, [selectionAfterRender, value]);

    const startManualResize = (clientY: number) => {
        if (!canResizeVertically) return;

        const startY = clientY;
        const startHeight = containerRef.current?.getBoundingClientRect().height ?? boxHeightPx;

        const move = (currentY: number) => {
            setBoxHeightPx(Math.max(minHeight, startHeight + currentY - startY));
        };

        const onMM = (event: MouseEvent) => {
            event.preventDefault();
            move(event.clientY);
        };

        const onTM = (event: TouchEvent) => {
            event.preventDefault();
            move(event.touches[0].clientY);
        };

        const up = () => {
            document.body.style.cursor = "";
            document.removeEventListener('mousemove', onMM);
            document.removeEventListener('mouseup', up);
            document.removeEventListener('touchmove', onTM);
            document.removeEventListener('touchend', up);
        };

        document.body.style.cursor = 'ns-resize';
        document.addEventListener('mousemove', onMM);
        document.addEventListener('mouseup', up);
        document.addEventListener('touchmove', onTM, { passive: false });
        document.addEventListener('touchend', up);
    };

    return (
        <div
            ref={containerRef}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
                position: 'relative',
                width: style?.width || '100%',
                minHeight: boxHeight,
                height: `${boxHeightPx}px`,
                marginBottom: style?.marginBottom,
                maxWidth: '100%',
                resize: resizeMode,
                overflow: 'hidden',
                pointerEvents: 'auto',
                userSelect: 'text',
                WebkitUserSelect: 'text',
                touchAction: 'auto',
            }}
        >
            {/* Backdrop (Highlights) */}
            <div
                ref={backdropRef}
                style={{
                    ...style,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 0,
                    pointerEvents: 'none',
                    color: 'transparent',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    backgroundColor: style?.backgroundColor || 'transparent',
                    fontFamily: style?.fontFamily || 'inherit',
                    fontSize: style?.fontSize || 'inherit',
                    lineHeight: style?.lineHeight || 'inherit',
                    letterSpacing: style?.letterSpacing || 'normal',
                    wordSpacing: style?.wordSpacing || 'normal',
                    zIndex: 0,
                }}
            >
                {tokens.map((token, i) => {
                    let bgColor = 'transparent';
                    if (token.type !== 'none') {
                        const alpha = Math.min(1, token.level / 40);
                        if (token.type === 'high') bgColor = withAlpha(theme.intensityHigh, alpha);
                        else if (token.type === 'low') bgColor = withAlpha(theme.intensityLow, alpha);
                        else if (token.type === 'mid') bgColor = withAlpha(theme.intensityMid, 0.5); // Mid is usually level 20 equivalent
                    }

                    return (
                        <span
                            key={i}
                            style={{
                                backgroundColor: bgColor,
                                borderRadius: bgColor !== 'transparent' ? '2px' : '0',
                                padding: '0',
                            }}
                        >
                            {token.text}
                        </span>
                    );
                })}
                {/* Fix for trailing newline dropping in div */}
                {value.endsWith('\n') ? <br /> : null}
            </div>

            {/* Foreground (Actual Textarea) */}
            <style>{`
                .nai-tag-builder-transparent-textarea {
                    background: transparent !important;
                    background-color: transparent !important;
                    pointer-events: auto !important;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    touch-action: auto !important;
                }
            `}</style>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onScroll={handleScroll}
                className={`nai-tag-builder-transparent-textarea ${props.className || ''}`}
                style={{
                    ...style,
                    position: 'relative',
                    color: style?.color ?? theme.text,
                    caretColor: style?.caretColor ?? style?.color ?? theme.text,
                    margin: 0,
                    fontFamily: style?.fontFamily || 'inherit',
                    fontSize: style?.fontSize || 'inherit',
                    lineHeight: style?.lineHeight || 'inherit',
                    letterSpacing: style?.letterSpacing || 'normal',
                    wordSpacing: style?.wordSpacing || 'normal',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    pointerEvents: 'auto',
                    resize: 'none',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    touchAction: 'auto',
                }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown?.(e);
                }}
                onTouchStart={(e) => {
                    e.stopPropagation();
                    onTouchStart?.(e);
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onPointerDown?.(e);
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    textareaRef.current?.focus();
                    onClick?.(e);
                }}
                {...rest}
            />
            {canResizeVertically && (
                <div
                    aria-hidden="true"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startManualResize(e.clientY);
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startManualResize(e.touches[0].clientY);
                    }}
                    style={{
                        alignItems: 'center',
                        bottom: 0,
                        cursor: 'ns-resize',
                        display: 'flex',
                        height: '14px',
                        justifyContent: 'flex-end',
                        opacity: 0.7,
                        paddingRight: '5px',
                        pointerEvents: 'auto',
                        position: 'absolute',
                        right: 0,
                        width: '42px',
                        zIndex: 2,
                    }}
                >
                    <span
                        style={{
                            borderBottom: `2px solid ${style?.color ?? theme.text}`,
                            display: 'block',
                            opacity: 0.72,
                            width: '24px',
                        }}
                    />
                </div>
            )}
        </div>
    );
}
