// NovelAI UI Palette
export const theme = {
  base: '#13152c',       // NovelAI Deep Navy (Main Background)
  mantle: '#1c1f3c',     // NovelAI slightly lighter navy (Input backgrounds)
  crust: '#0b0c1a',      // Very dark
  surface0: '#22253f',   // NovelAI Dark Slate Blue (Secondary panels)
  surface1: '#2f345a',   // Hover states, borders
  surface2: '#3c4273',   // Active states
  text: '#ffffff',       // Pure white for primary text
  subtext0: '#a0a0b0',   // Grayed out text
  subtext1: '#d0d0e0',   // Lighter gray text
  blue: '#3b82f6',       // Generic blue for highlights if needed
  red: '#ef4444',        // Error states
  green: '#10b981',      // Success states
  yellow: '#f5f3c2',     // NovelAI Pale Yellow (Primary Action / Accent)
  overlay0: '#4a5078',   // De-emphasized borders/dividers

  // Custom Tag Colors
  tagPositiveBg: 'rgba(102, 59, 39, 0.8)', // Orange-Brown
  tagNegativeBg: 'rgba(29, 66, 115, 0.8)', // Deep Blue
} as const;

export const inputStyle: React.CSSProperties = {
  backgroundColor: theme.mantle,
  color: theme.text,
  border: `1px solid ${theme.surface1}`,
  borderRadius: '4px',
  padding: '6px 8px',
  fontSize: '13px',
  boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: theme.subtext0,
  marginBottom: '4px',
  display: 'block',
};

export const smallBtnStyle: React.CSSProperties = {
  background: 'none',
  border: `1px solid ${theme.surface1}`,
  color: theme.text,
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
};
