import { describe, expect, it } from "vitest";
import { learnerDocument, serializeCourseData } from "@/lib/learnerScormPackage";

describe("portable learner SCORM document", () => {
  it("embeds the real learner runtime, project styles and all course settings", () => {
    const html = learnerDocument("CCTV & Training", {
      courseTitle: "CCTV & Training", avatarTrainerId: "soumya", flipStylePreference: "bound",
      insertedVideos: [], courseDuration: "12min", narratorLanguage: "Telugu",
      rawOutputs: { architect: "{}", writer: "Lesson", visual: "{}", assessment: "{}" },
      exportMedia: { audioBySlide: { 1: "data:audio/mpeg;base64,AA==" }, introImages: { 0: "data:image/png;base64,AA==" } },
    }, { js: "window.actualPreview = true;", css: ".preview { display: grid; }" });
    expect(html).toContain("window.actualPreview = true");
    expect(html).toContain(".preview { display: grid; }");
    expect(html).toContain('"avatarTrainerId":"soumya"');
    expect(html).toContain('"flipStylePreference":"bound"');
    expect(html).toContain("data:audio/mpeg;base64,AA==");
    expect(html).toContain("contentforge:progress");
    expect(html).toContain("LMSCommit");
    expect(html).toContain("CCTV &amp; Training");
    expect(html).not.toContain("scorm-learner-preview");
  });

  it("cannot break out of the embedded data script", () => {
    const value = { text: '</script><script>alert("x")</script>' };
    const encoded = serializeCourseData(value);
    expect(encoded).not.toContain("</script>");
    expect(JSON.parse(encoded)).toEqual(value);
  });
});