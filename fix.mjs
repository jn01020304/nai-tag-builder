import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = "        backgroundColor: theme.base,\n        color: theme.text,\n        borderRadius: '12px',\n        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',\n        fontFamily: 'sans-serif',\n        border: `1px solid ${theme.surface0}`,\n        display: 'flex',";

const replacement = "        backgroundColor: withAlpha(theme.base, 0.85),\n        backdropFilter: 'blur(16px)',\n        WebkitBackdropFilter: 'blur(16px)',\n        color: theme.text,\n        borderRadius: '16px',\n        boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',\n        fontFamily: 'inherit',\n        border: `1px solid ${withAlpha(theme.surface1, 0.5)}`,\n        display: 'flex',";

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log("Fixed App.tsx!");
