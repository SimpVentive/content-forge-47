export type AgentStatus = "idle" | "running" | "complete" | "queued" | "error";

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
}

export interface OutputData {
  outline: string;
  script: string;
  assessment: string;
  package: string;
}

export interface RawAgentOutputs {
  research: string;
  architect: string;
  writer: string;
  visual: string;
  animation: string;
  youtube: string;
  compliance: string;
  assessment: string;
  voice: string;
  assembly: string;
}

export const AGENTS: Omit<AgentInfo, "status">[] = [
  { id: "research", name: "Research Agent", description: "Extracts key themes, knowledge areas, and learning objectives" },
  { id: "architect", name: "Content Architect Agent", description: "Structures modules with Bloom's taxonomy alignment" },
  { id: "writer", name: "Writer Agent", description: "Produces instructional scripts in conversational tone" },
  { id: "visual", name: "Visual Design Agent", description: "Generates slide layouts, diagrams, and infographics" },
  { id: "animation", name: "Animation Agent", description: "Creates motion graphics and interactive elements" },
  { id: "youtube", name: "YouTube Agent", description: "Finds top videos per module topic by views and relevance" },
  { id: "compliance", name: "Compliance Agent", description: "Validates accessibility and regulatory compliance" },
  { id: "assessment", name: "Assessment Agent", description: "Builds quizzes, scenarios, and rubrics" },
  { id: "voice", name: "Voice & Narration Agent", description: "Generates voice scripts and audio narration" },
  { id: "assembly", name: "Final Assembly Agent", description: "Packages SCORM/xAPI-compliant course output" },
];

export const SAMPLE_TITLE = "Workplace Safety for Manufacturing Teams";
export const SAMPLE_NOTES = `Key topics to cover:
- OSHA regulations and compliance requirements
- Personal Protective Equipment (PPE) selection and use
- Hazard identification and risk assessment procedures
- Emergency response protocols
- Machine guarding and lockout/tagout (LOTO) procedures
- Chemical safety and SDS interpretation
- Ergonomics and injury prevention

Target audience: New manufacturing floor employees, supervisors
Duration: 4-hour course with hands-on exercises
Certification: Must meet OSHA 10-hour general industry standards`;
