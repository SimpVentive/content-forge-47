/**
 * Single rule for how far a learner may move ahead, shared by every navigation
 * control (Next, lesson map, slide dots, sidebar shortcuts) and by course completion.
 * A learner can revisit any screen they have reached, but can only move forward
 * one unseen screen at a time, and never past an unanswered knowledge check.
 */
export interface ProgressionSlide { type: string }

export function getFurthestReachableSlide(
  slides: ProgressionSlide[],
  visited: Set<number>,
  currentSlide: number,
  submittedAssessments: Set<number>,
): number {
  if (slides.length === 0) return 0;
  let reach = 0;
  for (let i = 0; i < slides.length; i++) {
    reach = i;
    const seen = i === currentSlide || visited.has(i);
    if (!seen) break;
    if (slides[i].type === "assessment" && !submittedAssessments.has(i)) break;
    if (i === slides.length - 1) break;
  }
  return reach;
}

export function getCompletionBlockers(
  slides: ProgressionSlide[],
  visited: Set<number>,
  currentSlide: number,
  submittedAssessments: Set<number>,
): { unseen: number[]; unanswered: number[] } {
  const unseen: number[] = [];
  const unanswered: number[] = [];
  slides.forEach((s, i) => {
    if (i !== currentSlide && !visited.has(i)) unseen.push(i);
    if (s.type === "assessment" && !submittedAssessments.has(i)) unanswered.push(i);
  });
  return { unseen, unanswered };
}
