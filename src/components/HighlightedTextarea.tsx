import React, { useRef, useLayoutEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { withAlpha } from '../styles/theme';
import { parsePromptToTokens } from '../utils/intensityParser';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
}

export default function HighlightedTextarea(props: Props) {
    const { value, style, onChange, onScroll, ...rest } = props;
    const theme = useTheme();
    const backdropRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    return (
        <div style={{ position: 'relative', width: style?.width || '100%', height: style?.height || '100%', marginBottom: style?.marginBottom }}>
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
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    backgroundColor: style?.backgroundColor || 'transparent',
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
                                padding: '0', // Adjust padding if needed to match NAI
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
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onScroll={handleScroll}
                style={{
                    ...style,
                    position: 'relative',
                    background: 'transparent',
                    color: theme.text,
                    margin: 0,
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                }}
                {...rest}
            />
        </div>
    );
}
