import JSZip from "jszip";
import type { LearnerPreviewProps } from "@/components/contentforge/LearnerPreview";
import { AVATAR_TRAINERS, getTrainerMedia, getTrainerVoiceId } from "@/lib/avatarTrainers";
import { learnerExportMedia } from "@/lib/learnerExportData";
import { generateNarrationAudio } from "@/lib/narrationAudioService";
import { generateManifest } from "@/lib/scormManifestGenerator";

export type PortableLearnerProps = Omit<LearnerPreviewProps, "onClose" | "onUpdateVisualTopic" | "onLearnerProgress">;

export function serializeCourseData(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function learnerDocument(title: string, props: PortableLearnerProps, runtime: { js: string; css: string }, passingScore = 70): string {
  const safeTitle = title.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeTitle}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&amp;family=Poppins:wght@500;700&amp;family=Manrope:wght@500;600;700;800&amp;family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap"><style>${runtime.css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>
window.__CONTENTFORGE_COURSE__=${serializeCourseData(props)};
(function(){
var api=null, modern=false, node=window, finished=false;
for(var i=0;i<50;i++){try{if(node.API_1484_11){api=node.API_1484_11;modern=true;break;}if(node.API){api=node.API;break;}if(node.parent===node)break;node=node.parent;}catch(e){break;}}
if(!api){try{api=window.opener&&(window.opener.API_1484_11||window.opener.API);modern=!!(window.opener&&window.opener.API_1484_11);}catch(e){}}
function call(oldName,newName,args){try{return api&&api[modern?newName:oldName].apply(api,args);}catch(e){return null;}}
function set(k,v){call('LMSSetValue','SetValue',[k,String(v)]);}
call('LMSInitialize','Initialize',['']);
var state=call('LMSGetValue','GetValue',[modern?'cmi.completion_status':'cmi.core.lesson_status']);
if(!state||state==='not attempted'||state==='unknown')set(modern?'cmi.completion_status':'cmi.core.lesson_status','incomplete');
window.addEventListener('contentforge:progress',function(e){var p=e.detail;set(modern?'cmi.location':'cmi.core.lesson_location',p.slide);if(p.answered){var score=Math.round(p.score/p.answered*100);set(modern?'cmi.score.raw':'cmi.core.score.raw',score);set(modern?'cmi.score.min':'cmi.core.score.min',0);set(modern?'cmi.score.max':'cmi.core.score.max',100);if(modern)set('cmi.score.scaled',score/100);}if(p.completed){var passed=!p.answered||p.score/p.answered*100>=${passingScore};set(modern?'cmi.completion_status':'cmi.core.lesson_status',modern?'completed':(passed?'passed':'failed'));if(modern)set('cmi.success_status',passed?'passed':'failed');}call('LMSCommit','Commit',['']);});
function finish(){if(finished)return;finished=true;call('LMSCommit','Commit',['']);call('LMSFinish','Terminate',['']);}
window.addEventListener('pagehide',finish);window.addEventListener('contentforge:exit',finish);
})();</script><script>${runtime.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

async function readRuntime(): Promise<{ js: string; css: string }> {
  const [js, css] = await Promise.all(["js", "css"].map(async extension => {
    const response = await fetch(new URL(`learner-runtime.${extension}`, window.location.origin));
    if (!response.ok) throw new Error("The learner export is unavailable. Please reload and try again.");
    const text = await response.text();
    if (text.trimStart().startsWith("<!DOCTYPE")) throw new Error("The learner export files are missing. Please reload and try again.");
    return text;
  }));
  return { js, css };
}

export async function createLearnerScormPackage(props: PortableLearnerProps, passingScore: number, report: (message: string) => void): Promise<{ zip: JSZip; slides: number }> {
  const { buildSlides } = await import("@/components/contentforge/LearnerPreview");
  const cached = learnerExportMedia.get(props.courseTitle);
  const trainerId = props.avatarTrainerId || AVATAR_TRAINERS[0].id;
  const trainerMedia = cached?.trainerMedia || getTrainerMedia(trainerId, import.meta.env as Record<string, string | undefined>);
  const media = { ...cached, trainerMedia: { ...trainerMedia }, audioBySlide: { ...cached?.audioBySlide } };
  const { slides } = buildSlides(props.rawOutputs, props.insertedVideos, props.courseDuration, props.slideLayout?.maxLines, props.assessmentIntensity);
  const zip = new JSZip();
  const mediaCache = new Map<string, Promise<string>>();
  let mediaIndex = 0;
  const embed = (url: string): Promise<string> => {
    if (url.startsWith("data:") || !/^(https?:|blob:|\/)/.test(url)) return Promise.resolve(url);
    const existing = mediaCache.get(url);
    if (existing) return existing;
    const task = (async () => {
      const response = await fetch(new URL(url, window.location.origin));
      if (!response.ok || response.headers.get("content-type")?.includes("text/html")) throw new Error(`A course media file could not be downloaded: ${url.split("?")[0]}`);
      const bytes = await response.arrayBuffer();
      const blob = new Blob([bytes], { type: response.headers.get("content-type") || "application/octet-stream" });
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      zip.file(`assets/media/media_${mediaIndex++}`, blob);
      return dataUrl;
    })();
    mediaCache.set(url, task);
    return task;
  };
  const portableValue = async (value: unknown, key = ""): Promise<unknown> => {
    if (typeof value === "string") {
      if (/(image|audio|poster|video).*url|generated_image_data_url|courseLogoUrl/i.test(key)) return embed(value);
      if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
        try { return JSON.stringify(await portableValue(JSON.parse(value))); } catch (error) { if (error instanceof SyntaxError) return value; throw error; }
      }
      return value;
    }
    if (Array.isArray(value)) return Promise.all(value.map(item => portableValue(item)));
    if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await portableValue(v, k)])));
    return value;
  };

  report("Including the preview's images and presenter...");
  const rawOutputs = await portableValue(props.rawOutputs) as PortableLearnerProps["rawOutputs"];
  for (const key of ["imageUrl", "videoUrl", "posterUrl"] as const) {
    const url = media.trainerMedia[key];
    if (url) media.trainerMedia[key] = await embed(url);
  }
  if (media.introImages) for (const [index, url] of Object.entries(media.introImages)) media.introImages[Number(index)] = await embed(url);
  for (const [index, url] of Object.entries(media.audioBySlide)) media.audioBySlide[Number(index)] = await embed(url);

  if (props.rawOutputs.voice) {
    let sections: Array<Record<string, unknown>> = [];
    try { sections = JSON.parse(props.rawOutputs.voice).sections || []; } catch { /* Narration may be plain text. */ }
    let contentIndex = 0;
    for (let index = 0; index < slides.length; index++) {
      const slide = slides[index];
      if (slide.type !== "content" && slide.type !== "assessment") continue;
      const section = slide.type === "content" ? sections[contentIndex++] : undefined;
      if (media.audioBySlide[index]) continue;
      const recorded = section?.audioDataUrl || section?.audio_url;
      if (typeof recorded === "string") { media.audioBySlide[index] = await embed(recorded); continue; }
      const narration = slide.type === "assessment" ? slide.question?.question : section?.narration_text || slide.content;
      if (typeof narration !== "string" || !narration.trim()) continue;
      report(`Including recorded narration ${index + 1} of ${slides.length}...`);
      const result = await generateNarrationAudio(narration.slice(0, 2500), getTrainerVoiceId(trainerId), props.narratorLanguage || props.textLanguage || "English");
      if (!result.success || !result.audioDataUrl) throw new Error(`Narration could not be included: ${result.error || "The voice service did not return audio."}`);
      media.audioBySlide[index] = result.audioDataUrl;
    }
  }
  learnerExportMedia.set(props.courseTitle, media);
  report("Packaging the same interactive learner preview...");
  const runtime = await readRuntime();
  const html = learnerDocument(props.courseTitle, { ...props, rawOutputs, exportMedia: media, standalone: true }, runtime, passingScore);
  zip.file("module_0.html", html);
  zip.file("index.html", html);
  zip.file("imsmanifest.xml", generateManifest({ courseId: `course_${Date.now()}`, courseTitle: props.courseTitle, passingScore, createdDate: new Date(), modifiedDate: new Date() }, { title: props.courseTitle, items: [{ identifier: "course", title: props.courseTitle, resourceId: "res_course" }] }, [{ id: "res_course", type: "webcontent", href: "module_0.html", scormType: "sco", files: [{ href: "module_0.html" }, { href: "index.html" }, ...Object.keys(zip.files).filter(name => name.startsWith("assets/") && !zip.files[name].dir).map(href => ({ href }))] }]));
  return { zip, slides: slides.length };
}