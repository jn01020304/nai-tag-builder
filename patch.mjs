import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const { from, to } of replacements) {
        content = content.replace(from, to);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. App.tsx
replaceInFile('src/App.tsx', [
    {
        from: "import { useTheme } from './contexts/themeContextCore';",
        to: "import { useTheme } from './contexts/themeContextCore';\nimport { withAlpha } from './styles/theme';"
    },
    {
        from: "        backgroundColor: theme.base,\n        color: theme.text,\n        borderRadius: '12px',\n        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',\n        fontFamily: 'sans-serif',\n        border: `1px solid ${theme.surface0}`,",
        to: "        backgroundColor: withAlpha(theme.base, 0.85),\n        backdropFilter: 'blur(16px)',\n        WebkitBackdropFilter: 'blur(16px)',\n        color: theme.text,\n        borderRadius: '16px',\n        boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',\n        fontFamily: 'inherit',\n        border: `1px solid ${withAlpha(theme.surface1, 0.5)}`,"
    }
]);

// 2. index.css
const cssToAdd = `
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nai-tb-apply-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.1);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4) !important;
}
`;
fs.appendFileSync('src/index.css', cssToAdd);

// 3. PresetManager.tsx
replaceInFile('src/components/PresetManager.tsx', [
    {
        from: "    const chipStyle: React.CSSProperties = {\n        display: 'inline-flex',\n        alignItems: 'center',\n        gap: '4px',\n        padding: '2px 8px',\n        borderRadius: '12px',\n        fontSize: '11px',\n        border: `1px solid var(--nai-tb-surface1)`,\n        background: 'var(--nai-tb-surface0)',\n        color: 'var(--nai-tb-text)',\n    };",
        to: "    const chipStyle: React.CSSProperties = {\n        display: 'inline-flex',\n        alignItems: 'center',\n        gap: '6px',\n        padding: '4px 10px',\n        borderRadius: '16px',\n        fontSize: '12px',\n        border: `1px solid rgba(255, 255, 255, 0.1)`,\n        background: 'rgba(255, 255, 255, 0.05)',\n        color: 'var(--nai-tb-text)',\n        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',\n        transition: 'all 0.2s ease',\n    };"
    }
]);

// 4. OverlayHeader.tsx
replaceInFile('src/components/OverlayHeader.tsx', [
    {
        from: "      style={{\n        alignItems: \"center\",\n        backgroundColor: 'var(--nai-tb-crust)',\n        borderBottom: isCollapsed ? \"none\" : `1px solid var(--nai-tb-surface0)`,\n        borderRadius: isCollapsed ? \"12px\" : \"12px 12px 0 0\",\n        cursor: \"grab\",\n        display: \"flex\",\n        flex: \"0 0 auto\",\n        fontSize: \"14px\",\n        fontWeight: \"bold\",\n        justifyContent: \"space-between\",\n        padding: \"10px 16px\",",
        to: "      style={{\n        alignItems: \"center\",\n        background: isCollapsed ? \"rgba(255, 255, 255, 0.05)\" : \"transparent\",\n        borderBottom: isCollapsed ? \"none\" : `1px solid rgba(255, 255, 255, 0.1)`,\n        borderRadius: isCollapsed ? \"16px\" : \"16px 16px 0 0\",\n        cursor: \"grab\",\n        display: \"flex\",\n        flex: \"0 0 auto\",\n        fontSize: \"14px\",\n        fontWeight: \"bold\",\n        justifyContent: \"space-between\",\n        padding: \"12px 16px\","
    }
]);

// 5. HighlightedTextarea.tsx
replaceInFile('src/components/HighlightedTextarea.tsx', [
    {
        from: "            <style>{`\n                .nai-tag-builder-transparent-textarea {\n                    background: transparent !important;\n                    background-color: transparent !important;\n                    pointer-events: auto !important;\n                    user-select: text !important;\n                    -webkit-user-select: text !important;\n                    touch-action: auto !important;\n                }\n            `}</style>",
        to: "            <style>{`\n                .nai-tag-builder-transparent-textarea {\n                    background: transparent !important;\n                    background-color: transparent !important;\n                    pointer-events: auto !important;\n                    user-select: text !important;\n                    -webkit-user-select: text !important;\n                    touch-action: auto !important;\n                    transition: all 0.2s ease;\n                }\n                .nai-tag-builder-transparent-textarea:focus {\n                    outline: 2px solid rgba(255,255,255,0.3) !important;\n                    outline-offset: 2px;\n                    border-radius: 4px;\n                }\n            `}</style>"
    }
]);

// 6. OverlayFooter.tsx
replaceInFile('src/components/OverlayFooter.tsx', [
    {
        from: "      style={{\n        backgroundColor: 'var(--nai-tb-base)',\n        borderTop: `1px solid var(--nai-tb-surface0)`,\n",
        to: "      style={{\n        background: 'transparent',\n        borderTop: `1px solid rgba(255, 255, 255, 0.1)`,\n"
    }
]);

// 7. ApplyButton.tsx
replaceInFile('src/components/ApplyButton.tsx', [
    {
        from: "    <button\n      data-testid=\"apply-button\"\n      onClick={onApply}\n      disabled={isApplying}\n      style={{\n        width: '100%',\n        padding: '12px',\n        backgroundColor: isApplying ? 'var(--nai-tb-surface1)' : 'var(--nai-tb-green)',\n        color: isApplying ? 'var(--nai-tb-subtext0)' : '#ffffff', // Usually white text over intensity button\n        border: 'none',\n        borderRadius: '6px',\n        fontWeight: 'bold',\n        cursor: isApplying ? 'not-allowed' : 'pointer',\n        fontSize: '14px',\n      }}\n    >",
        to: "    <button\n      className=\"nai-tb-apply-btn\"\n      data-testid=\"apply-button\"\n      onClick={onApply}\n      disabled={isApplying}\n      style={{\n        width: '100%',\n        padding: '12px',\n        backgroundColor: isApplying ? 'var(--nai-tb-surface1)' : 'var(--nai-tb-green)',\n        color: isApplying ? 'var(--nai-tb-subtext0)' : '#ffffff', // Usually white text over intensity button\n        border: 'none',\n        borderRadius: '12px',\n        fontWeight: 'bold',\n        cursor: isApplying ? 'not-allowed' : 'pointer',\n        fontSize: '14px',\n        transition: 'all 0.2s ease-in-out',\n        boxShadow: isApplying ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',\n      }}\n    >"
    }
]);

console.log("Comprehensive patch applied!");
