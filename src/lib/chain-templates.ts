import { ChainTemplate } from "./types";

export const CHAIN_TEMPLATES: ChainTemplate[] = [
  {
    id: "business-launch",
    name: "비즈니스 런칭 체인",
    description: "스타트업 기획부터 재무 모델링, 투자자 리포트까지 완전한 비즈니스 파이프라인",
    category: "business-strategy",
    steps: [
      { harnessId: "43-startup-launcher", harnessTitle: "Startup Launcher", harnessNumber: 43, outputsToForward: [] },
      { harnessId: "53-financial-modeler", harnessTitle: "Financial Modeler", harnessNumber: 53, outputsToForward: [] },
      { harnessId: "51-investor-report", harnessTitle: "Investor Report", harnessNumber: 51, outputsToForward: [] },
    ],
  },
  {
    id: "dev-pipeline",
    name: "개발 파이프라인 체인",
    description: "풀스택 웹앱 설계부터 코드 리뷰, 테스트 자동화까지",
    category: "software-dev",
    steps: [
      { harnessId: "16-fullstack-webapp", harnessTitle: "Fullstack Webapp", harnessNumber: 16, outputsToForward: [] },
      { harnessId: "21-code-reviewer", harnessTitle: "Code Reviewer", harnessNumber: 21, outputsToForward: [] },
      { harnessId: "24-test-automation", harnessTitle: "Test Automation", harnessNumber: 24, outputsToForward: [] },
    ],
  },
  {
    id: "content-pipeline",
    name: "콘텐츠 파이프라인 체인",
    description: "브랜드 아이덴티티부터 소셜미디어 전략, 뉴스레터까지",
    category: "content-creation",
    steps: [
      { harnessId: "06-brand-identity", harnessTitle: "Brand Identity", harnessNumber: 6, outputsToForward: [] },
      { harnessId: "10-social-media-manager", harnessTitle: "Social Media Manager", harnessNumber: 10, outputsToForward: [] },
      { harnessId: "03-newsletter-engine", harnessTitle: "Newsletter Engine", harnessNumber: 3, outputsToForward: [] },
    ],
  },
  {
    id: "legal-check",
    name: "법무 체크 체인",
    description: "계약서 분석부터 컴플라이언스 체크, 개인정보 보호까지",
    category: "legal-compliance",
    steps: [
      { harnessId: "66-contract-analyzer", harnessTitle: "Contract Analyzer", harnessNumber: 66, outputsToForward: [] },
      { harnessId: "67-compliance-checker", harnessTitle: "Compliance Checker", harnessNumber: 67, outputsToForward: [] },
      { harnessId: "69-privacy-engineer", harnessTitle: "Privacy Engineer", harnessNumber: 69, outputsToForward: [] },
    ],
  },
  {
    id: "education-course",
    name: "교육 과정 체인",
    description: "교육 과정 설계부터 시험 준비, 토론 시뮬레이션까지",
    category: "education",
    steps: [
      { harnessId: "08-course-builder", harnessTitle: "Course Builder", harnessNumber: 8, outputsToForward: [] },
      { harnessId: "57-exam-prep", harnessTitle: "Exam Prep", harnessNumber: 57, outputsToForward: [] },
      { harnessId: "60-debate-simulator", harnessTitle: "Debate Simulator", harnessNumber: 60, outputsToForward: [] },
    ],
  },
];
