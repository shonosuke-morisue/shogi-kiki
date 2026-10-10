/** 利きの数 → 色の濃さ。1枚で薄く、5枚以上でいちばん濃い */
export const kikiAlpha = (n: number) => (n <= 0 ? 0 : Math.min(0.24 + 0.13 * (n - 1), 0.76));
