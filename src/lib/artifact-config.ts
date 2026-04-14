import type { Category } from "./types";

export type ArtifactType = "pdf" | "code-project" | "slides" | "audio" | "image" | "video-script";

export interface ArtifactTypeConfig {
  type: ArtifactType;
  label: string;
  icon: string; // lucide icon name
  description: string;
  requiresApiKey?: boolean;
}

export const ARTIFACT_TYPES: Record<ArtifactType, ArtifactTypeConfig> = {
  pdf: {
    type: "pdf",
    label: "PDF 문서",
    icon: "FileText",
    description: "마크다운을 PDF 보고서로 변환합니다",
  },
  "code-project": {
    type: "code-project",
    label: "코드 프로젝트",
    icon: "Code",
    description: "설계서를 기반으로 실제 코드 프로젝트를 생성합니다",
  },
  slides: {
    type: "slides",
    label: "슬라이드",
    icon: "Presentation",
    description: "마크다운을 프레젠테이션 슬라이드로 변환합니다",
  },
  audio: {
    type: "audio",
    label: "음성 (TTS)",
    icon: "Volume2",
    description: "텍스트를 음성 파일로 변환합니다",
    requiresApiKey: true,
  },
  image: {
    type: "image",
    label: "이미지 생성",
    icon: "ImageIcon",
    description: "프롬프트를 기반으로 이미지를 생성합니다",
    requiresApiKey: true,
  },
  "video-script": {
    type: "video-script",
    label: "영상 스크립트",
    icon: "Film",
    description: "영상 스크립트와 SRT 자막을 생성합니다",
  },
};

// 카테고리별 기본 변환 타입
const CATEGORY_DEFAULTS: Record<Category, ArtifactType> = {
  "content-creation": "pdf",
  "software-dev": "code-project",
  "data-ai": "pdf",
  "business-strategy": "pdf",
  education: "slides",
  "legal-compliance": "pdf",
  lifestyle: "pdf",
  communication: "pdf",
  operations: "pdf",
  specialized: "pdf",
};

// 개별 하네스 오버라이드 (카테고리 기본과 다르거나 추가 타입이 필요한 경우)
// key = 하네스 번호 (zero-padded 2자리)
const HARNESS_OVERRIDES: Record<string, ArtifactType[]> = {
  "01": ["pdf", "video-script"],      // YouTube Production
  "02": ["pdf", "audio"],             // Podcast Studio
  "04": ["pdf", "slides"],            // Presentation Designer
  "05": ["pdf", "video-script"],      // Video Editing
  "07": ["pdf", "image"],             // Photography Director
  "09": ["pdf", "audio"],             // Music Composition
  "10": ["pdf", "image"],             // Social Media Manager
  "11": ["pdf", "slides"],            // Content Strategist
  "56": ["slides", "pdf"],            // Curriculum Designer
  "57": ["slides", "pdf"],            // Exam Prep
  "58": ["slides", "pdf"],            // Learning Path
  "60": ["slides", "pdf"],            // Debate Simulator
  "61": ["slides", "pdf"],            // Language Tutor
  "76": ["pdf", "image"],             // Interior Designer
  "77": ["pdf", "image"],             // Fashion Stylist
  "78": ["pdf", "audio"],             // Meditation Guide
  "86": ["pdf", "slides"],            // Meeting Facilitator
  "87": ["pdf", "slides"],            // Workshop Designer
};

/**
 * 하네스 번호에 대한 사용 가능한 아티팩트 타입 목록 반환
 * 첫 번째 요소가 기본 타입
 */
export function getArtifactTypes(harnessNumber: number, category: Category): ArtifactType[] {
  const key = String(harnessNumber).padStart(2, "0");

  if (HARNESS_OVERRIDES[key]) {
    return HARNESS_OVERRIDES[key];
  }

  const defaultType = CATEGORY_DEFAULTS[category];
  // PDF는 항상 사용 가능 (기본이 아닌 경우에도 보조로)
  if (defaultType === "pdf") {
    return ["pdf"];
  }
  return [defaultType, "pdf"];
}
