import {test,expect} from "vitest";
import {splitInfographicDescription as f} from "@/components/contentforge/LearnerPreview";
test("svg split",()=>{const r=f("<svg viewBox='0 0 8 4'><!-- x --><text x='1'>CISC</text><text>RISC</text></svg>");expect(r.svg).toContain("<svg");expect(r.text).toBe("CISC · RISC");expect(f("plain").svg).toBe("");});
