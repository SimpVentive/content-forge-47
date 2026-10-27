interface IntroImageSlide {
  moduleIndex: number;
  visualImageDataUrl?: string;
  visualSvg?: string;
}

function findImage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["visualImageDataUrl", "generated_image_data_url", "imageDataUrl", "image_url", "imageUrl", "dataUrl"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  for (const key of ["visualSvg", "generated_scene_svg", "sceneSvg", "svg"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.includes("<svg")) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(candidate)}`;
    }
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      const image = findImage(child);
      if (image) return image;
    }
  }
  return undefined;
}

export function resolveIntroImage(slides: IntroImageSlide[], moduleIndex: number): string | undefined {
  return findImage(slides.filter(slide => slide.moduleIndex === moduleIndex)) || findImage(slides);
}

// Shared by the authoring preview and packaging; offline learners never call this.
export async function generateIntroImage(moduleTitle: string, courseTitle: string): Promise<string> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { functionErrorMessage } = await import("@/lib/edgeFunctions");
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Image generation timed out. Please retry.")), 120000);
  });
  const { data, error } = await Promise.race([
    supabase.functions.invoke("generate-slide-image", {
      body: {
        prompt: `A photorealistic, professional workplace training scene representing "${moduleTitle}" in the context of ${courseTitle}. Modern, diverse, well-lit, editorial style.`,
        moduleTitle, topicTitle: moduleTitle, altText: moduleTitle,
      },
    }),
    timeout,
  ]);
  if (error || data?.error) throw new Error(data?.error || (error ? await functionErrorMessage(error) : "The introduction image could not be generated."));
  const image = findImage(data);
  if (!image) throw new Error("The image service did not return an introduction image.");
  return image;
}