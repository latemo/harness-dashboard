export type PdfTheme = "default" | "academic" | "legal" | "business";

export interface PdfThemeConfig {
  id: PdfTheme;
  label: string;
  description: string;
}

export const PDF_THEMES: PdfThemeConfig[] = [
  { id: "default", label: "기본", description: "깔끔한 기본 스타일" },
  { id: "academic", label: "학술", description: "학술 논문 스타일" },
  { id: "legal", label: "법률", description: "법률 문서 스타일" },
  { id: "business", label: "비즈니스", description: "비즈니스 보고서 스타일" },
];

const COMMON_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.7;
    color: #1a1a1a;
    padding: 40px 50px;
  }
  h1 { font-size: 28px; font-weight: 700; margin-top: 32px; margin-bottom: 16px; }
  h2 { font-size: 22px; font-weight: 600; margin-top: 28px; margin-bottom: 12px; }
  h3 { font-size: 18px; font-weight: 600; margin-top: 20px; margin-bottom: 8px; }
  h4 { font-size: 16px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; }
  p { margin-bottom: 12px; font-size: 14px; }
  ul, ol { margin-bottom: 12px; padding-left: 24px; font-size: 14px; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; font-family: 'Fira Code', monospace; }
  pre { background: #f8f8f8; padding: 16px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #0066cc; padding: 12px 16px; margin: 12px 0; background: #f0f6ff; color: #333; }
  a { color: #0066cc; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  img { max-width: 100%; }
`;

const THEMES: Record<PdfTheme, string> = {
  default: `
    ${COMMON_CSS}
    h1 { color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 8px; }
    h2 { color: #333; }
  `,
  academic: `
    ${COMMON_CSS}
    body { font-family: 'Noto Serif KR', Georgia, 'Times New Roman', serif; line-height: 1.8; padding: 50px 60px; }
    h1 { font-size: 24px; text-align: center; border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { font-size: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    p { text-align: justify; text-indent: 1em; font-size: 14px; }
    blockquote { border-left-color: #666; background: #fafafa; font-style: italic; }
    table th { background: #e8e8e8; }
  `,
  legal: `
    ${COMMON_CSS}
    body { font-family: 'Noto Sans KR', Arial, sans-serif; line-height: 1.9; padding: 50px 55px; }
    h1 { font-size: 22px; text-align: center; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
    h2 { font-size: 18px; margin-top: 32px; }
    h3 { font-size: 16px; }
    p { font-size: 13px; text-align: justify; }
    ol { list-style-type: decimal; }
    ol ol { list-style-type: lower-alpha; }
    ol ol ol { list-style-type: lower-roman; }
    blockquote { border-left-color: #8b0000; background: #fff5f5; }
    table th { background: #f0e8e8; }
  `,
  business: `
    ${COMMON_CSS}
    body { font-family: 'Pretendard', -apple-system, sans-serif; padding: 40px 50px; }
    h1 { font-size: 26px; color: #003366; border-bottom: 3px solid #003366; padding-bottom: 8px; }
    h2 { font-size: 20px; color: #003366; margin-top: 28px; }
    h3 { color: #336699; }
    table th { background: #003366; color: white; }
    table tr:nth-child(even) td { background: #f8fafc; }
    blockquote { border-left-color: #003366; background: #f0f4f8; }
    code { background: #e8f0fe; color: #003366; }
  `,
};

export function getThemeCSS(theme: PdfTheme): string {
  return THEMES[theme] || THEMES.default;
}
