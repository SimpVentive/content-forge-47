import { describe, expect, it } from "vitest";
import { resolveLessonContent, requireLessonContent, sequenceLessonSlides } from "@/lib/lessonContent";
import { buildSlides as learnerSlides } from "@/components/contentforge/LearnerPreview";
import { buildSlides as sharedSlides } from "@/lib/slideBuilder";
import { acceptScriptRewrite } from "@/lib/textCleaningUtility";

const modules = [{ title: "Camera Selection", topics: ["Recorder Choice"] }];
const lesson = "Choose an NVR for IP cameras. Choose a DVR when retaining existing coaxial wiring.";
const assessment = JSON.stringify({ mcq: [{ module_title: "Camera Selection", question: "Which recorder supports IP cameras?", options: ["NVR", "DVR", "Neither", "Both"], correct_answer: "NVR" }] });

describe("lesson recovery and course integrity", () => {
  it.each([lesson, `# Recorder Choice\n${lesson}`, `##### Recorder Choice\n${lesson}`, `# Camera Selection\n${lesson}`, `## A changed heading\n${lesson}`])("recovers a nonstandard authored script: %s", writer => {
    expect(resolveLessonContent(writer, modules)).toEqual([[lesson]]);
  });
  it("recovers top-level JSON arrays and narration_text without displaying JSON", () => {
    expect(resolveLessonContent(JSON.stringify([{ title: "Recorder Choice", narration_text: lesson }]), modules)).toEqual([[lesson]]);
  });
  it("rejects empty lessons and assessment JSON as teaching", () => {
    expect(() => requireLessonContent("", modules)).toThrow("Lesson content is missing");
    expect(() => requireLessonContent(assessment, modules)).toThrow("Lesson content is missing");
  });
  it("requires every planned topic, not merely one lesson", () => {
    expect(() => requireLessonContent(`## Recorder Choice\n${lesson}`, [{ ...modules[0], topics: ["Recorder Choice", "Outdoor Mounting"] }])).toThrow("Outdoor Mounting");
  });
  it("does not duplicate or misassign another topic when recovering unmatched sections", () => {
    expect(resolveLessonContent(`## Outdoor Mounting\nMount above reach.\n## Renamed Recorder Heading\n${lesson}`, [{ ...modules[0], topics: ["Recorder Choice", "Outdoor Mounting"] }])).toEqual([[lesson, "Mount above reach."]]);
  });
  it("retains extra authored sections rather than deleting them", () => {
    expect(resolveLessonContent(`## Recorder Choice\n${lesson}\n## Extra Advice\nCheck the network capacity.`, modules)[0][0]).toContain("Check the network capacity.");
  });
  it.each([learnerSlides, sharedSlides])("shows recovered teaching before questions in both builders", build => {
    const { slides } = build({ architect: JSON.stringify({ modules: [{ module_title: "Camera Selection", topics: ["Recorder Choice"] }] }), writer: lesson, visual: "{}", assessment });
    expect(slides.find(slide => slide.type === "content")?.content).toBe(lesson);
    expect(slides.findIndex(slide => slide.type === "assessment")).toBeGreaterThan(slides.findIndex(slide => slide.type === "content"));
  });
  it.each([learnerSlides, sharedSlides])("does not show an assessment or completion with absent lessons", build => {
    const { slides } = build({ architect: JSON.stringify({ modules: [{ module_title: "Camera Selection", topics: [] }] }), writer: "", visual: "{}", assessment });
    expect(slides.some(slide => slide.type === "assessment" || slide.type === "summary")).toBe(false);
  });
  it("puts video teaching before assessment instead of after it", () => {
    expect(sequenceLessonSlides([{ type: "title", moduleIndex: 0 }, { type: "assessment", moduleIndex: 0 }, { type: "video", moduleIndex: 0 }, { type: "summary", moduleIndex: 0 }]).map(slide => slide.type)).toEqual(["title", "video", "assessment", "summary"]);
  });
  it("rejects a long rewrite that removes a lesson heading", () => {
    expect(acceptScriptRewrite(`## Recorder Choice\n${lesson}\n## Outdoor Mounting\nMount above reach.`, `## Recorder Choice\n${lesson.repeat(10)}`).accepted).toBe(false);
  });
});