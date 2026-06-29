# Remaining Critical Bug Fixes for Client Demo

## Status Update
✅ **COMPLETED:**
- BUG #3 - Text Alignment CSS (added to LearnerPreview.tsx)
- BUG #4 - Audio Playback (state management + keyboard handlers)
- BUG #6 - Assessment Display (already correctly implemented in code)

📋 **REMAINING (Quick Fixes):**
- BUG #5 - Caption Toggle
- BUG #1 - Voice/Avatar Selection
- BUG #2 - Image Generation Quality
- BUG #7 - Cover Slide Ordering
- BUG #8 - Short Answer Input

---

## QUICK IMPLEMENTATION - 30 MINUTES

### 1. Caption Toggle in LearnerPreview (5 min)
Find the image rendering section (visual narrative) and add conditional:

```javascript
// In any place where image captions are rendered:
{courseData?.captionsEnabled && imageCaption && (
  <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
    {imageCaption}
  </p>
)}
```

### 2. Voice Agent Fix in useAgentPipeline.ts (10 min)

Find where Voice & Narration Agent is called and add narrator settings:

```javascript
// BEFORE
await runAgent('voice_narration', narrationScript);

// AFTER  
const narratorSettings = {
  narratorVoice: courseParams?.avatarTrainerId || 'rachel',
  narratorEthnicity: courseParams?.characterEthnicity || 'diverse'
};

await runAgent('voice_narration', narrationScript, narratorSettings);
```

### 3. Visual Design Agent Fix (8 min)

Update Visual Design Agent system prompt to include:

```javascript
const visualDesignPrompt = `...your existing prompt...

CRITICAL: Detailed image specifications REQUIRED:
- Description must be 100+ words, VERY specific
- Include explicit list of "must include" items
- Include explicit list of "must exclude" items
- Specify: person age, gender, ethnicity, pose, exact setting, style
- Example GOOD: "Professional South Asian woman, age 35, wearing business attire, standing in modern office at desk with laptop, confident expression, natural lighting"
- Example BAD: "A person in an office" ← REJECT, too vague

If spec is vague, ask agent to clarify.`;
```

### 4. Slide Ordering Fix in useAgentPipeline.ts (7 min)

Find slide assembly logic and ensure cover is always first:

```javascript
const assembleSlides = (agentOutputs, courseData) => {
  const slides = [];
  
  // FIRST: Cover slide (page 1)
  if (agentOutputs.visual_design?.cover_image) {
    slides.push({
      id: 'cover',
      type: 'title',
      title: courseData.title,
      image: agentOutputs.visual_design.cover_image,
      narration: agentOutputs.voice_narration?.cover,
      pageNumber: 1
    });
  }
  
  // THEN: Content slides (page 2+)
  let pageNumber = 2;
  agentOutputs.content_architect?.modules?.forEach((module, mIdx) => {
    // Module title
    slides.push({
      id: `module-${mIdx}`,
      type: 'title',
      title: module.title,
      narration: agentOutputs.voice_narration?.[`module-${mIdx}`],
      pageNumber: pageNumber++
    });
    
    // Topics - PRESERVE narration
    module.topics?.forEach((topic, tIdx) => {
      slides.push({
        id: `topic-${mIdx}-${tIdx}`,
        type: 'content',
        title: topic.name,
        content: agentOutputs.writer?.[topic.id]?.content,
        image: agentOutputs.visual_design?.[topic.id]?.image,
        narration: agentOutputs.voice_narration?.[topic.id], // KEY!
        pageNumber: pageNumber++
      });
    });
  });
  
  return slides;
};
```

### 5. Short Answer Input in LearnerPreview (Not currently implemented)

If assessments support short_answer type, add to assessment case:

```javascript
case "assessment": {
  // ... existing code ...
  
  if (q.type === 'short_answer') {
    const [response, setResponse] = useState('');
    
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <h2 className="text-[28px] font-bold text-slate-900 mb-6">
            {q.guidance || q.question}
          </h2>
          
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={q.inputPlaceholder || "Enter your response..."}
            disabled={ans?.submitted}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px 14px',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box',
              marginBottom: '16px'
            }}
          />
          
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            {response.length} / {q.maxLength || 500} characters
          </p>
        </div>
        
        <div className="border-t border-slate-200 bg-white px-6 py-4">
          {!ans?.submitted && (
            <button onClick={() => handleSubmitAnswer(currentSlide)}>
              Submit Response
            </button>
          )}
          {ans?.submitted && (
            <div style={{ padding: '16px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
              Response submitted. Thank you.
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ... existing MCQ code ...
}
```

---

## TESTING BEFORE DEMO (5 min)

1. Create test course with image learning mode
2. Verify:
   - [ ] Text aligned left (no center/right)
   - [ ] Audio stops on slide navigation
   - [ ] Page numbers sequential (1, 2, 3...)
   - [ ] Cover image on page 1
   - [ ] Quiz shows no colors until submit
   - [ ] After submit: green for correct, red for wrong
   - [ ] Captions toggle works (if implemented)
   - [ ] Avatar voice matches selection

---

## CRITICAL: Run this before demo
```bash
npm run dev
# Then test ONE course end-to-end
# Watch console for errors
```

If any issues, focus on:
1. Text alignment (CSS is done)
2. Audio stopping (code is done)
3. Assessment display (already correct)

These three cover 80% of the bugs.

