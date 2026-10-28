/** Read structured function failures without surfacing raw provider responses or keys. */
export async function describeImageFailure(error: unknown, data?: unknown): Promise<string> {
  let body = data;
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    body = await error.context.clone().json().catch(() => null);
  }
  const detail = body && typeof body === "object" && "error" in body ? String(body.error) : "";
  const reasons: string[] = [];
  if (/does not exist|model_not_found/.test(detail)) reasons.push("OpenAI rejected the configured image model");
  if (/insufficient credits/i.test(detail)) reasons.push("the fallback image account has insufficient credits");
  if (/verification|verified/i.test(detail)) reasons.push("the image account requires verification");
  if (/401|invalid_api_key|not set/.test(detail)) reasons.push("an image provider credential is missing or invalid");
  if (/429|insufficient_quota/.test(detail)) reasons.push("the image provider reached its billing or rate limit");
  return reasons.length ? reasons.join("; ") : "The image service could not return an image. Please retry.";
}

export function requireNarrativeImages(narratives: { scenes: { imageDataUrl?: string }[] }[]): void {
  const scenes = narratives.flatMap(n => n.scenes);
  const missing = scenes.filter(scene => !scene.imageDataUrl).length;
  if (!scenes.length || missing) throw new Error(`Image-based course is incomplete: ${missing || 1} scene(s) need images. Course assembly has stopped; generated scenes are retained.`);
}