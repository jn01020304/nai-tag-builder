// Catppuccin Mocha palette
export const theme = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  blue: '#89b4fa',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  overlay0: '#6c7086',
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
