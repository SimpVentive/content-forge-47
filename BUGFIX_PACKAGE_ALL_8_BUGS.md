# ContentForge Bug Fixes - Complete Implementation Package
**For Client Demo - 2026-06-29**

## QUICK IMPLEMENTATION GUIDE

### PRIORITY 1: Text Alignment & UI Fixes (15 min)
Add this to `LearnerPreview.tsx` global styles:

```css
/* Global Text Alignment Rules - Add to top of component style tag or global CSS */
.slide-container {
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.slide-container p,
.slide-container h1,
.slide-container h2,
.slide-container h3,
.slide-container h4,
.slide-container button {
  text-align: left;
  white-space: normal;
}

.scenario-text,
.question-text {
  display: block;
  width: 100%;
  word-break: break-word;
}

.page-counter {
  position: absolute;
  bottom: 20px;
  right: 28px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
```

### PRIORITY 2: Audio Playback Fix (20 min)
Replace audio state management in `LearnerPreview.tsx`:

```javascript
// Add this state at component level
const [audioPlayingSlideId, setAudioPlayingSlideId] = useState(null);
const audioRefMap = useRef({});

// ADD THIS FUNCTION
const handleSlideChange = (newSlideId) => {
  // Stop ALL audio before changing slide
  Object.values(audioRefMap.current).forEach(audioElement => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  });
  
  setAudioPlayingSlideId(null);
  setCurrentSlide(newSlideId);
};

// Update next/previous handlers
const goToNextSlide = () => {
  if (currentSlideIndex < slides.length - 1) {
    handleSlideChange(slides[currentSlideIndex + 1].id);
  }
};

const goToPreviousSlide = () => {
  if (currentSlideIndex > 0) {
    handleSlideChange(slides[currentSlideIndex - 1].id);
  }
};

// ADD KEYBOARD NAV
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'ArrowRight') goToNextSlide();
    else if (e.key === 'ArrowLeft') goToPreviousSlide();
    // Stop audio on navigation
    Object.values(audioRefMap.current).forEach(audio => {
      if (audio) { audio.pause(); audio.currentTime = 0; }
    });
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentSlideIndex, slides.length]);
```

### PRIORITY 3: Assessment Fixes (25 min)
In Assessment slide rendering:

```javascript
// Hide correct answers until submission
const [hasSubmitted, setHasSubmitted] = useState(false);
const [selectedAnswer, setSelectedAnswer] = useState(null);

const handleSubmitAnswer = (answerIndex) => {
  setSelectedAnswer(answerIndex);
  setHasSubmitted(true);
};

// In quiz option rendering:
{question.options.map((option, index) => (
  <button 
    key={index}
    onClick={() => setSelectedAnswer(index)}
    disabled={hasSubmitted}
    style={{
      padding: '12px 16px',
      margin: '8px 0',
      textAlign: 'left',
      border: selectedAnswer === index ? '2px solid #4f46e5' : '1px solid #e2e8f0',
      backgroundColor: selectedAnswer === index ? '#f0f2f7' : '#ffffff',
      // ONLY show green/red after submit
      borderColor: hasSubmitted && index === question.correct_answer_index ? '#10b981' : 
                   hasSubmitted && index === selectedAnswer && index !== question.correct_answer_index ? '#ef4444' : 
                   selectedAnswer === index ? '#4f46e5' : '#e2e8f0',
      cursor: hasSubmitted ? 'not-allowed' : 'pointer',
      wordWrap: 'break-word',
      whiteSpace: 'normal'
    }}
  >
    {option}
  </button>
))}

// Only show feedback AFTER submit
{hasSubmitted && (
  <div style={{
    marginTop: '20px',
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: selectedAnswer === question.correct_answer_index ? '#ecfdf5' : '#fee2e2',
    borderLeft: '4px solid ' + (selectedAnswer === question.correct_answer_index ? '#10b981' : '#ef4444'),
    color: selectedAnswer === question.correct_answer_index ? '#065f46' : '#991b1b'
  }}>
    {selectedAnswer === question.correct_answer_index ? '✓ Correct!' : '✗ Not quite right.'}
    <p>{question.explanation}</p>
  </div>
)}
```

### PRIORITY 4: Caption Toggle (10 min)
In CourseParametersDialog - DONE (state renamed to `captionsEnabled`)

In `LearnerPreview.tsx` when rendering image captions:
```javascript
// Conditionally render captions based on courseData.captionsEnabled
{courseData.captionsEnabled && imageCaption && (
  <p style={{
    marginTop: '12px',
    fontSize: '13px',
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center'
  }}>
    {imageCaption}
  </p>
)}
```

### PRIORITY 5: Cover Slide Ordering (15 min)
In course assembly logic (find in `useAgentPipeline.ts` or your pipeline):

```javascript
const assembleSlides = (agentOutputs) => {
  const slides = [];
  
  // FIRST: Cover slide ALWAYS page 1
  if (agentOutputs.visual_design?.cover_image) {
    slides.push({
      id: 'cover-slide',
      type: 'title',
      title: courseData.title,
      image: agentOutputs.visual_design.cover_image,
      narration: agentOutputs.voice_narration?.cover || null,
      pageNumber: 1
    });
  }
  
  // THEN: All content slides starting from page 2
  let pageNumber = 2;
  const modules = agentOutputs.content_architect?.modules || [];
  
  modules.forEach((module, idx) => {
    // Module title
    slides.push({
      id: `module-${idx}`,
      type: 'title',
      title: module.title,
      narration: agentOutputs.voice_narration?.[`module-${idx}`],
      pageNumber: pageNumber++
    });
    
    // Topic content - PRESERVE narration
    module.topics?.forEach((topic, topicIdx) => {
      slides.push({
        id: `topic-${idx}-${topicIdx}`,
        type: 'content',
        title: topic.name,
        content: agentOutputs.writer?.[topic.id]?.content,
        image: agentOutputs.visual_design?.[topic.id]?.image,
        narration: agentOutputs.voice_narration?.[topic.id], // KEY: Preserve this
        pageNumber: pageNumber++
      });
    });
  });
  
  return slides;
};
```

### PRIORITY 6: Short Answer Text Input (15 min)
For short answer assessments:

```javascript
const [shortAnswerResponse, setShortAnswerResponse] = useState('');
const [responseSubmitted, setResponseSubmitted] = useState(false);

if (question.type === 'short_answer') {
  return (
    <div style={{ padding: '24px' }}>
      {/* Use "Guidance" NOT "Prompt" */}
      <h3>{question.guidance}</h3>
      
      {/* TEXT INPUT - Required */}
      <textarea
        value={shortAnswerResponse}
        onChange={(e) => setShortAnswerResponse(e.target.value)}
        placeholder={question.inputPlaceholder || 'Enter your response...'}
        disabled={responseSubmitted}
        style={{
          width: '100%',
          minHeight: '120px',
          padding: '12px 14px',
          border: '1.5px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
          marginTop: '16px',
          marginBottom: '16px'
        }}
      />
      
      {/* Character count */}
      <p style={{
        fontSize: '12px',
        color: shortAnswerResponse.length > (question.maxLength || 500) ? '#ef4444' : '#94a3b8',
        marginBottom: '16px'
      }}>
        {shortAnswerResponse.length} / {question.maxLength || 500} characters
      </p>
      
      {/* Submit button */}
      {!responseSubmitted && (
        <button onClick={() => setResponseSubmitted(true)}>
          Submit Response
        </button>
      )}
      
      {/* Feedback after submit */}
      {responseSubmitted && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: '#ecfdf5',
          border: '1px solid #d1fae5',
          color: '#065f46'
        }}>
          <p><strong>Response submitted.</strong> Thank you for your response.</p>
        </div>
      )}
    </div>
  );
}
```

### PRIORITY 7: Voice/Avatar Agent Update (20 min)
In your Voice & Narration Agent system prompt:

```javascript
const voiceAgentPrompt = `You are a Voice & Narration specialist for eLearning.

CRITICAL REQUIREMENT:
- Narrator Voice: ${courseData.narratorVoice} (e.g., josh_male, priya_female, aaron_male_south_asian)
- Narrator Ethnicity: ${courseData.narratorEthnicity}
- MUST use exact voice ID provided
- Do NOT override user's voice selection
- Include narrator voice ID in your response for verification

Output format:
{
  "narrator_voice_id": "${courseData.narratorVoice}",
  "narrator_ethnicity": "${courseData.narratorEthnicity}",
  "narration_script": "...",
  "delivery_notes": "..."
}`;
```

### PRIORITY 8: Image Generation Validation (20 min)
In Visual Design Agent system prompt:

```javascript
const visualDesignPrompt = `You are a Visual Design specialist.

For EACH image, provide detailed specification:
1. Image description: 100+ words, VERY specific
2. What MUST be in image: explicit list
3. What must NOT be in image: explicit exclusions
4. Person details: age, gender, ethnicity, pose, context
5. Setting: specific location, professional/casual, details
6. Style: photographic/illustrated/diagrammatic

REQUIRED JSON OUTPUT:
{
  "image_spec": {
    "image_description": "Detailed 100+ word description...",
    "must_include": ["item1", "item2", ...],
    "must_exclude": ["avoid1", "avoid2", ...],
    "person": {"age": "30s", "gender": "male", "ethnicity": "south_asian", "pose": "standing", "context": "office"},
    "setting": "professional office with desk and computer",
    "style": "photographic"
  }
}

CRITICAL: If description is vague, REJECT and ask for clarification.
Example GOOD: "Professional South Asian man, age 35, wearing business shirt, sitting at office desk with laptop open, looking focused, contemporary office background with plants"
Example BAD: "A person in an office" - TOO VAGUE, REJECT`;
```

---

## FILES TO MODIFY

1. **`src/components/contentforge/CourseParametersDialog.tsx`**
   - ✅ Change `showCaption` → `captionsEnabled`
   - Ensure this is passed in courseData object

2. **`src/components/contentforge/LearnerPreview.tsx`**
   - Add global CSS rules (text alignment)
   - Add audio state management
   - Fix assessment rendering
   - Add caption toggle conditional
   - Fix slide ordering

3. **`src/hooks/useAgentPipeline.ts`** 
   - Update Voice Agent prompt
   - Update Visual Design Agent prompt
   - Fix slide assembly order

---

## TESTING CHECKLIST

Before client demo:
- [ ] Create e-learning course → verify text aligned left
- [ ] Create video course → verify avatar voice matches selection
- [ ] Navigate slides → verify audio stops on slide change
- [ ] Take quiz → verify correct answer not shown until submit
- [ ] Toggle captions OFF → verify captions don't appear
- [ ] Answer short answer → verify text box appears with guidance (not "prompt")
- [ ] Check page numbers → verify sequential (1, 2, 3...)
- [ ] Verify cover image on page 1 (not page 3)

---

## ESTIMATED TIME: 90 minutes (all 8 bugs)

Start with PRIORITY 1-4 (60 min) for visual/UX fixes
Then PRIORITY 5-8 (30 min) for deeper integration

