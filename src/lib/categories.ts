import { Category } from "./types";

export interface CategoryInfo {
  id: Category;
  label: string;
  range: [number, number];
  icon: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "content-creation", label: "콘텐츠 제작", range: [1, 15], icon: "🎬", color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  { id: "software-dev", label: "소프트웨어 개발", range: [16, 30], icon: "💻", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "data-ai", label: "데이터 & AI", range: [31, 42], icon: "🧠", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { id: "business-strategy", label: "비즈니스 전략", range: [43, 55], icon: "📊", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { id: "education", label: "교육 & 학습", range: [56, 65], icon: "📚", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "legal-compliance", label: "법률 & 규정", range: [66, 72], icon: "⚖️", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  { id: "lifestyle", label: "라이프스타일", range: [73, 80], icon: "🌿", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  { id: "communication", label: "커뮤니케이션", range: [81, 88], icon: "📝", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  { id: "operations", label: "운영 & 프로세스", range: [89, 95], icon: "⚙️", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { id: "specialized", label: "전문 도메인", range: [96, 100], icon: "🔬", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
];

export function getCategoryByNumber(num: number): CategoryInfo {
  return CATEGORIES.find((c) => num >= c.range[0] && num <= c.range[1]) ?? CATEGORIES[0];
}
