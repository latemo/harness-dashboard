/**
 * 빌드 타임 데이터 생성 스크립트
 * harness-100 레포의 .md 파일을 파싱하여 JSON으로 변환
 *
 * 실행: npx tsx scripts/generate-data.ts
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const REPO_PATH = path.join(__dirname, "..", "temp", "harness-100", "ko");
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const DETAIL_DIR = path.join(DATA_DIR, "harnesses");

interface CategoryInfo {
  id: string;
  label: string;
  range: [number, number];
}

const CATEGORIES: CategoryInfo[] = [
  { id: "content-creation", label: "콘텐츠 제작", range: [1, 15] },
  { id: "software-dev", label: "소프트웨어 개발", range: [16, 30] },
  { id: "data-ai", label: "데이터 & AI", range: [31, 42] },
  { id: "business-strategy", label: "비즈니스 전략", range: [43, 55] },
  { id: "education", label: "교육 & 학습", range: [56, 65] },
  { id: "legal-compliance", label: "법률 & 규정", range: [66, 72] },
  { id: "lifestyle", label: "라이프스타일", range: [73, 80] },
  { id: "communication", label: "커뮤니케이션", range: [81, 88] },
  { id: "operations", label: "운영 & 프로세스", range: [89, 95] },
  { id: "specialized", label: "전문 도메인", range: [96, 100] },
];

function getCategory(num: number): CategoryInfo {
  return CATEGORIES.find((c) => num >= c.range[0] && num <= c.range[1])!;
}

function readMdFile(filePath: string): { frontmatter: Record<string, string>; content: string } {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    return { frontmatter: data as Record<string, string>, content: content.trim() };
  } catch {
    return { frontmatter: {}, content: "" };
  }
}

function extractTitle(folderName: string): string {
  // "01-youtube-production" → "YouTube Production"
  const name = folderName.replace(/^\d+-/, "");
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractDescription(claudeMd: string): string {
  // CLAUDE.md의 첫 번째 문단(# 제목 다음)을 설명으로 사용
  const lines = claudeMd.split("\n");
  let desc = "";
  let pastTitle = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      pastTitle = true;
      continue;
    }
    if (pastTitle && line.trim()) {
      desc = line.trim();
      break;
    }
  }
  return desc || "하네스 설명 없음";
}

function extractOutputs(claudeMd: string): string[] {
  const outputs: string[] = [];
  const lines = claudeMd.split("\n");
  for (const line of lines) {
    const match = line.match(/^- `([^`]+)`/);
    if (match && (match[1].includes("_workspace") || match[1].endsWith(".md") || match[1].endsWith(".srt") || match[1].endsWith(".json"))) {
      outputs.push(match[1]);
    }
  }
  return outputs;
}

function determineSkillType(skillId: string, harnessName: string): "orchestrator" | "specialized" {
  // 하네스 이름과 동일하거나 유사하면 오케스트레이터
  const harnessSlug = harnessName.replace(/^\d+-/, "");
  if (skillId === harnessSlug || skillId.includes(harnessSlug) || harnessSlug.includes(skillId)) {
    return "orchestrator";
  }
  return "specialized";
}

function main() {
  // 출력 디렉토리 생성
  fs.mkdirSync(DETAIL_DIR, { recursive: true });

  const folders = fs.readdirSync(REPO_PATH).filter((f) => {
    const fullPath = path.join(REPO_PATH, f);
    return fs.statSync(fullPath).isDirectory() && /^\d{1,3}-/.test(f);
  });

  folders.sort((a, b) => {
    const numA = parseInt(a.split("-")[0]);
    const numB = parseInt(b.split("-")[0]);
    return numA - numB;
  });

  const summaries: any[] = [];

  for (const folder of folders) {
    const num = parseInt(folder.split("-")[0]);
    const category = getCategory(num);
    const claudePath = path.join(REPO_PATH, folder, ".claude", "CLAUDE.md");
    const agentsDir = path.join(REPO_PATH, folder, ".claude", "agents");
    const skillsDir = path.join(REPO_PATH, folder, ".claude", "skills");

    // CLAUDE.md 파싱
    const claudeMd = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, "utf-8") : "";
    const description = extractDescription(claudeMd);
    const outputs = extractOutputs(claudeMd);

    // 에이전트 파싱
    const agents: any[] = [];
    if (fs.existsSync(agentsDir)) {
      const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
      for (const af of agentFiles) {
        const { frontmatter, content } = readMdFile(path.join(agentsDir, af));
        agents.push({
          id: af.replace(".md", ""),
          name: frontmatter.name || af.replace(".md", ""),
          description: frontmatter.description || "",
          content,
        });
      }
    }

    // 스킬 파싱
    const skills: any[] = [];
    if (fs.existsSync(skillsDir)) {
      const skillDirs = fs.readdirSync(skillsDir).filter((f) => {
        return fs.statSync(path.join(skillsDir, f)).isDirectory();
      });
      for (const sd of skillDirs) {
        const skillPath = path.join(skillsDir, sd, "skill.md");
        if (fs.existsSync(skillPath)) {
          const { frontmatter, content } = readMdFile(skillPath);
          skills.push({
            id: sd,
            name: frontmatter.name || sd,
            description: frontmatter.description || "",
            type: determineSkillType(sd, folder),
            content,
          });
        }
      }
    }

    // 상세 JSON 저장
    const detail = {
      id: folder,
      number: num,
      name: folder.replace(/^\d+-/, ""),
      title: extractTitle(folder),
      description,
      category: category.id,
      categoryLabel: category.label,
      agentCount: agents.length,
      skillCount: skills.length,
      claudeMd,
      agents,
      skills,
      outputs,
    };

    fs.writeFileSync(path.join(DETAIL_DIR, `${folder}.json`), JSON.stringify(detail, null, 2), "utf-8");

    // 요약 데이터 (카탈로그용)
    summaries.push({
      id: folder,
      number: num,
      name: folder.replace(/^\d+-/, ""),
      title: extractTitle(folder),
      description,
      category: category.id,
      categoryLabel: category.label,
      agentCount: agents.length,
      skillCount: skills.length,
      agentNames: agents.map((a: any) => a.id),
      skillNames: skills.map((s: any) => s.id),
    });
  }

  // 카탈로그 JSON 저장
  fs.writeFileSync(path.join(DATA_DIR, "harnesses.json"), JSON.stringify(summaries, null, 2), "utf-8");

  console.log(`✅ 생성 완료: ${summaries.length}개 하네스`);
  console.log(`   에이전트 총: ${summaries.reduce((s: number, h: any) => s + h.agentCount, 0)}개`);
  console.log(`   스킬 총: ${summaries.reduce((s: number, h: any) => s + h.skillCount, 0)}개`);
}

main();
