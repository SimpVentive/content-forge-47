/**
 * Generated SVGs sometimes draw text or shapes outside their viewBox, and the browser
 * clips them. This grows the viewBox to cover everything that is actually drawn, plus a
 * margin, so nothing is cut off. It never shrinks the original viewBox.
 */
export function fitSvgToContent(container: HTMLElement | null, padding = 24): void {
  const svg = container?.querySelector("svg");
  if (!svg) return;

  let box: DOMRect;
  try {
    box = svg.getBBox();
  } catch {
    // Not laid out yet, or hidden
    return;
  }
  if (box.width === 0 && box.height === 0) return;

  const vb = svg.viewBox.baseVal;
  const left = Math.min(vb.x, box.x - padding);
  const top = Math.min(vb.y, box.y - padding);
  const right = Math.max(vb.x + vb.width, box.x + box.width + padding);
  const bottom = Math.max(vb.y + vb.height, box.y + box.height + padding);

  svg.setAttribute("viewBox", `${left} ${top} ${right - left} ${bottom - top}`);
}
