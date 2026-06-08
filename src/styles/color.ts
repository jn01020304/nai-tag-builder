export function withAlpha(color: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const percentage = Math.round(clampedAlpha * 10000) / 100;
  const colorMixValue = `color-mix(in srgb, ${color} ${percentage}%, transparent)`;

  if (typeof CSS !== "undefined" && CSS.supports("color", colorMixValue)) {
    return colorMixValue;
  }

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((part) => part + part).join("")
      : hex[1];
    const red = parseInt(raw.slice(0, 2), 16);
    const green = parseInt(raw.slice(2, 4), 16);
    const blue = parseInt(raw.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`;
  }

  const rgb = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${clampedAlpha})`;
  }

  return color;
}

export function colorLuminance(color: string): number | null {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((part) => part + part).join("")
      : hex[1];
    const red = parseInt(raw.slice(0, 2), 16);
    const green = parseInt(raw.slice(2, 4), 16);
    const blue = parseInt(raw.slice(4, 6), 16);
    return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  }

  const match = color.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return null;
  const red = Number(match[0]);
  const green = Number(match[1]);
  const blue = Number(match[2]);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

export function readableTextColor(background: string, dark = "#111222", light = "#ffffff"): string {
  const luminance = colorLuminance(background);
  return luminance != null && luminance > 0.58 ? dark : light;
}
