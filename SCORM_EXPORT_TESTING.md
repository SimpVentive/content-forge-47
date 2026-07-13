# SCORM Export System - Testing Strategy & Suite

## Testing Overview

Comprehensive testing across 6 phases ensures the SCORM export system works reliably across all LMS platforms and edge cases.

**Test Coverage Target:** 85%+
**Total Test Cases:** 100+
**Execution Time:** ~5-10 minutes

---

## Phase 1: Architecture Tests

### Unit Tests: slideBuilder.ts

```typescript
// tests/lib/slideBuilder.test.ts

describe('slideBuilder', () => {
  describe('normalizeModuleKey', () => {
    it('should lowercase and remove special chars', () => {
      expect(normalizeModuleKey('Module 1 - Intro!')).toBe('module 1 intro');
    });
  });

  describe('buildSlides', () => {
    it('should create title slide for first module only', () => {
      // Setup: 2 modules
      // Assert: slides[0].type === 'title'
      // Assert: slides.filter(s => s.type === 'title').length === 1
    });

    it('should allocate questions proportionally to modules', () => {
      // Setup: 3 modules (5, 10, 5 topics respectively)
      // Setup: 10 total questions
      // Assert: questions distributed roughly 2.5, 5, 2.5
    });

    it('should fuzzy match topics to visuals', () => {
      // Setup: Topic "Product Management", Visual "prod mgmt"
      // Assert: Visual matches topic
    });

    it('should handle missing visual data gracefully', () => {
      // Setup: No visual agent output
      // Assert: Slides created without errors
      // Assert: visualImageDataUrl is undefined
    });
  });

  describe('splitTopicContentIntoSlides', () => {
    it('should split long content into multiple slides', () => {
      const longText = 'sentence. ' * 200;
      const chunks = splitTopicContentIntoSlides(longText, 15);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should respect max chunks per topic duration', () => {
      const text = 'content. ' * 100;
      // 3-minute course → max 2 chunks per topic
      const chunks = splitTopicContentIntoSlides(text, 3);
      expect(chunks.length).toBeLessThanOrEqual(2);
    });

    it('should trim text to word limit', () => {
      const text = 'word ' * 200;
      const chunks = splitTopicContentIntoSlides(text, 15);
      chunks.forEach(chunk => {
        expect(chunk.text.split(/\s+/).length).toBeLessThanOrEqual(200);
      });
    });
  });
});
```

### Integration Tests: scormRenderEngine.ts

```typescript
// tests/lib/scormRenderEngine.test.ts

describe('scormRenderEngine', () => {
  describe('renderScormModuleHtml', () => {
    it('should render module to valid HTML', async () => {
      const html = await renderScormModuleHtml({
        courseTitle: 'Test Course',
        module: { title: 'Module 1', topics: ['Topic 1'] },
        moduleIndex: 0,
        totalModules: 1,
        slides: [],
        quizzes: [],
      });
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('Test Course');
    });

    it('should include SCORM API wrapper', async () => {
      const html = await renderScormModuleHtml({...});
      expect(html).toContain('LMSInitialize');
      expect(html).toContain('SCORM_API');
    });

    it('should escape HTML special characters in titles', async () => {
      const html = await renderScormModuleHtml({
        courseTitle: 'Course <script>alert("xss")</script>',
        ...
      });
      
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('extractScormAssets', () => {
    it('should parse visual data structure', () => {
      const visualOutput = JSON.stringify({
        modules: [{
          module_title: 'Module 1',
          topic_visuals: [{
            topic_title: 'Topic 1',
            generated_image_data_url: 'data:image/png;base64,...',
          }],
        }],
      });

      const result = extractScormAssets(visualOutput);
      expect(result.visuals.size).toBe(1);
    });

    it('should handle multiple JSON structure formats', () => {
      // Test: modules in different keys
      // - visualData.modules
      // - visualData.course_visual_plan.modules
      // - visualData.module_visuals
    });
  });
});
```

---

## Phase 2: Rendering Tests

### Component Tests: Slide Components

```typescript
// tests/components/scorm/slides.test.tsx

describe('ScormLearnerPreview', () => {
  describe('DashboardSlide', () => {
    it('should render avatar with trainer name', () => {
      const { getByText } = render(
        <DashboardSlide
          moduleTitle="Module 1"
          topicTitle="Topic 1"
          content="Content"
          avatarImageUrl="avatar.jpg"
          trainerName="Sarah Johnson"
        />
      );
      
      expect(getByText('Sarah Johnson')).toBeInTheDocument();
    });

    it('should display visual image', () => {
      const { getByRole } = render(
        <DashboardSlide
          {...props}
          visualImageDataUrl="data:image/png;base64,..."
        />
      );
      
      const img = getByRole('img', { name: /visual/i });
      expect(img.src).toContain('data:image/png');
    });

    it('should display gradient header', () => {
      const { container } = render(<DashboardSlide {...props} />);
      const header = container.querySelector('.bg-gradient-to-r');
      expect(header).toBeInTheDocument();
    });
  });

  describe('MediaQuizSlide', () => {
    it('should render question and options', () => {
      const question = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correct_answer: '4',
      };

      const { getByText, getByRole } = render(
        <MediaQuizSlide
          moduleTitle="Module 1"
          questionNumber={1}
          totalQuestions={5}
          question={question}
        />
      );

      expect(getByText('What is 2+2?')).toBeInTheDocument();
      expect(getByText('4')).toBeInTheDocument();
    });

    it('should highlight correct answer', () => {
      const { container } = render(<MediaQuizSlide {...props} />);
      const correctOption = container.querySelector('.border-green-500');
      expect(correctOption).toBeInTheDocument();
    });

    it('should show progress bar', () => {
      const { container } = render(
        <MediaQuizSlide
          questionNumber={2}
          totalQuestions={5}
          {...props}
        />
      );
      
      const progressFill = container.querySelector('.bg-purple-600');
      // Should be 40% width (2/5)
      expect(progressFill).toHaveStyle('width: 40%');
    });
  });
});
```

### Server Rendering Tests

```typescript
// tests/lib/scormRenderEngine.serverRender.test.tsx

describe('React to Static HTML Rendering', () => {
  it('should render without React runtime errors', async () => {
    const html = await renderScormModuleHtml({...});
    
    // Should not contain React error boundaries or hydration mismatches
    expect(html).not.toContain('Warning: ReactDOM.render');
    expect(html).not.toContain('hydrationMismatch');
  });

  it('should produce identical output for same input', async () => {
    const input = {
      courseTitle: 'Test Course',
      module: { title: 'Module 1', topics: [] },
      moduleIndex: 0,
      totalModules: 1,
      slides: [],
      quizzes: [],
    };

    const html1 = await renderScormModuleHtml(input);
    const html2 = await renderScormModuleHtml(input);

    expect(html1).toBe(html2);
  });

  it('should include Tailwind CSS classes', async () => {
    const html = await renderScormModuleHtml({...});
    
    expect(html).toContain('class="');
    expect(html).toMatch(/class="[^"]*bg-/); // Tailwind classes
  });
});
```

---

## Phase 3: Asset Tests

### Visual Extraction Tests

```typescript
// tests/lib/scormVisualExtractor.test.ts

describe('scormVisualExtractor', () => {
  describe('extractVisualsFromRawOutput', () => {
    it('should parse standard visual output format', () => {
      const output = JSON.stringify({
        modules: [{
          module_title: 'Module 1',
          topic_visuals: [{
            topic_title: 'Topic 1',
            generated_image_data_url: 'data:image/png;base64,...',
          }],
        }],
      });

      const result = extractVisualsFromRawOutput(output);
      expect(result.modules.length).toBe(1);
      expect(result.allVisuals.size).toBe(1);
    });

    it('should handle alternative JSON structures', () => {
      // Test variations in output structure
      // - course_visual_plan.modules
      // - module_visuals array
      // - nested structures
    });

    it('should validate image URLs', () => {
      const output = JSON.stringify({
        modules: [{
          topic_visuals: [{
            topic_title: 'Topic',
            generated_image_data_url: 'https://example.com/image.png',
          }],
        }],
      });

      const result = extractVisualsFromRawOutput(output);
      const visual = result.allVisuals.get('topic');
      expect(visual.imageDataUrl).toBe('https://example.com/image.png');
    });

    it('should validate SVG content', () => {
      const output = JSON.stringify({
        modules: [{
          topic_visuals: [{
            generated_scene_svg: '<svg viewBox="0 0 100 100">...</svg>',
          }],
        }],
      });

      const result = extractVisualsFromRawOutput(output);
      expect(result.modules[0].visuals[0].imageSvg).toContain('<svg');
    });
  });

  describe('findVisualByTopic', () => {
    it('should find exact match', () => {
      const visuals = { allVisuals: new Map([['product management', {...}]]) };
      const result = findVisualByTopic(visuals, 'product management');
      expect(result).toBeDefined();
    });

    it('should find fuzzy match', () => {
      const visuals = { allVisuals: new Map([['product mgmt', {...}]]) };
      const result = findVisualByTopic(visuals, 'product management');
      expect(result).toBeDefined();
    });

    it('should return first visual as fallback', () => {
      const visual1 = {...};
      const visuals = {
        modules: [{ visuals: [visual1] }],
        allVisuals: new Map(),
      };
      
      const result = findVisualByTopic(visuals, 'nonexistent');
      expect(result).toBe(visual1);
    });
  });
});
```

### Asset Bundling Tests

```typescript
// tests/lib/scormAssetInliner.test.ts

describe('scormAssetInliner', () => {
  describe('bundleAssets', () => {
    it('should embed small images as data-uri', async () => {
      const bundle = {
        avatarImage: {
          url: 'small.jpg',
          mimeType: 'image/jpeg',
          strategy: 'data-uri',
        },
        visuals: new Map(),
      };

      const result = await bundleAssets(bundle);
      expect(result.avatar).toMatch(/^data:image\/jpeg/);
    });

    it('should store large assets in ZIP', async () => {
      const zip = new JSZip();
      const bundle = {
        narrationAudio: {
          url: 'narration.mp3',
          mimeType: 'audio/mpeg',
          strategy: 'file-reference',
        },
        visuals: new Map(),
      };

      await bundleAssets(bundle, zip);
      expect(zip.file('assets/audio/narration.mp3')).toBeDefined();
    });
  });

  describe('rewriteAssetsInHtml', () => {
    it('should replace avatar src attribute', () => {
      const html = '<img src="avatar.jpg" alt="trainer"/>';
      const assetMap = { avatar: 'data:image/jpeg;base64,...', visuals: new Map() };

      const result = rewriteAssetsInHtml(html, assetMap);
      expect(result).toContain('data:image/jpeg');
      expect(result).not.toContain('avatar.jpg');
    });

    it('should replace audio source URLs', () => {
      const html = '<source src="narration.mp3" type="audio/mpeg">';
      const assetMap = { narration: 'assets/audio/narration.mp3', visuals: new Map() };

      const result = rewriteAssetsInHtml(html, assetMap);
      expect(result).toContain('assets/audio/narration.mp3');
    });
  });
});
```

---

## Phase 4: Interactive Tests

### Audio Player Tests

```typescript
// tests/lib/scormAudioPlayer.test.ts

describe('scormAudioPlayer', () => {
  describe('parseSentences', () => {
    it('should split text by sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = parseSentences(text);
      
      expect(sentences.length).toBe(3);
      expect(sentences[0].text).toContain('First');
      expect(sentences[1].text).toContain('Second');
    });

    it('should handle abbreviations', () => {
      const text = 'Dr. Smith works here.';
      const sentences = parseSentences(text);
      // Should not split on Dr.
      expect(sentences.length).toBeLessThanOrEqual(2);
    });
  });

  describe('generateAudioCues', () => {
    it('should distribute sentences across duration', () => {
      const sentences = ['Sentence one.', 'Sentence two.', 'Sentence three.'];
      const text = sentences.join(' ');
      const cues = generateAudioCues(text, 3000);

      expect(cues.length).toBe(3);
      expect(cues[0].startMs).toBe(0);
      expect(cues[2].endMs).toBeLessThanOrEqual(3000);
    });
  });

  describe('initializeAudioPlayer', () => {
    it('should highlight active sentence during playback', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div id="scorm-audio-player">
          <audio><source src="test.mp3"></audio>
          <div class="scorm-narration-text">
            <span class="scorm-sentence" id="sentence-0">First.</span>
            <span class="scorm-sentence" id="sentence-1">Second.</span>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      const player = initializeAudioPlayer();
      // Simulate playback at 500ms (sentence 0 active)
      highlightSentence(0);

      const sentence0 = document.getElementById('sentence-0');
      expect(sentence0?.classList.contains('active')).toBe(true);

      document.body.removeChild(container);
    });
  });
});
```

### Quiz Engine Tests

```typescript
// tests/lib/scormQuizEngine.test.ts

describe('scormQuizEngine', () => {
  describe('recordAnswer', () => {
    it('should mark correct answer', () => {
      const state = createQuizState([{
        id: 'q1',
        question: 'What is 2+2?',
        options: ['3', '4', '5'],
        correctAnswer: '4',
      }]);

      const answer = recordAnswer(state, 'q1', '4');
      expect(answer.isCorrect).toBe(true);
      expect(state.progress.correctCount).toBe(1);
    });

    it('should mark incorrect answer', () => {
      const state = createQuizState([{...}]);
      const answer = recordAnswer(state, 'q1', '3');
      expect(answer.isCorrect).toBe(false);
    });

    it('should track multiple attempts', () => {
      const state = createQuizState([{...}]);
      recordAnswer(state, 'q1', '3'); // Incorrect
      recordAnswer(state, 'q1', '4'); // Correct

      const answer = state.answers.get('q1');
      expect(answer?.attemptNumber).toBe(2);
      expect(answer?.isCorrect).toBe(true);
    });
  });

  describe('updateProgress', () => {
    it('should calculate score percentage', () => {
      const state = createQuizState([
        { id: 'q1', question: 'Q1', options: ['A'], correctAnswer: 'A' },
        { id: 'q2', question: 'Q2', options: ['B'], correctAnswer: 'B' },
      ]);

      recordAnswer(state, 'q1', 'A'); // Correct
      recordAnswer(state, 'q2', 'B'); // Correct

      expect(state.progress.score).toBe(100);
    });

    it('should determine pass status', () => {
      const summary = generateQuizSummary(state);
      expect(summary.passThreshold).toBe(70);
      expect(summary.passed).toBe(state.progress.score >= 70);
    });
  });
});
```

### SCORM API Tests

```typescript
// tests/lib/scormApiClient.test.ts

describe('ScormApiClient', () => {
  beforeEach(() => {
    // Mock SCORM API
    window.API = {
      LMSInitialize: jest.fn(() => 'true'),
      LMSSetValue: jest.fn(() => 'true'),
      LMSGetValue: jest.fn(() => ''),
      LMSCommit: jest.fn(() => 'true'),
      LMSFinish: jest.fn(() => 'true'),
    };
  });

  describe('initialize', () => {
    it('should call LMSInitialize', async () => {
      const client = new ScormApiClient();
      await client.initialize();
      
      expect(window.API.LMSInitialize).toHaveBeenCalledWith('');
    });

    it('should set initialized flag', async () => {
      const client = new ScormApiClient();
      await client.initialize();
      
      expect(client.isReady()).toBe(true);
    });
  });

  describe('setStatus', () => {
    it('should set lesson status to passed', async () => {
      const client = new ScormApiClient();
      await client.initialize();
      client.setStatus('passed');

      expect(window.API.LMSSetValue).toHaveBeenCalledWith(
        'cmi.core.lesson_status',
        'passed'
      );
    });
  });

  describe('setScore', () => {
    it('should normalize score to 0-100', async () => {
      const client = new ScormApiClient();
      await client.initialize();
      
      client.setScore(150); // > 100
      expect(window.API.LMSSetValue).toHaveBeenCalledWith(
        'cmi.core.score.raw',
        '100'
      );

      client.setScore(-10); // < 0
      expect(window.API.LMSSetValue).toHaveBeenCalledWith(
        'cmi.core.score.raw',
        '0'
      );
    });
  });
});
```

---

## Phase 5: Validation Tests

### Validator Tests

```typescript
// tests/lib/scormValidator.test.ts

describe('scormValidator', () => {
  describe('validate', () => {
    it('should pass when all requirements met', () => {
      const data = {
        courseTitle: 'Valid Course',
        modules: [{ title: 'Module 1', slides: [{type: 'content'}] }],
        avatar: { trainerName: 'Trainer', imageUrl: 'avatar.jpg' },
        visuals: { allVisuals: new Map([['topic1', {imageDataUrl: 'img.jpg'}]]) },
        quizzes: [{question: 'Q?', options: ['A','B'], correct_answer: 'A'}],
      };

      const report = validate(data);
      expect(report.overallStatus).toBe('passed');
    });

    it('should fail on critical issues', () => {
      const data = {
        courseTitle: '', // Empty title
        modules: [],
      };

      const report = validate(data);
      expect(report.overallStatus).toBe('failed');
      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should warn on missing avatar', () => {
      const data = { courseTitle: 'Course', modules: [{...}] };
      const report = validate(data);
      
      const warnings = report.summary.warnings.filter(w => w.message.includes('avatar'));
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
```

### Manifest Generator Tests

```typescript
// tests/lib/scormManifestGenerator.test.ts

describe('scormManifestGenerator', () => {
  describe('generate', () => {
    it('should create valid XML', () => {
      const generator = new ScormManifestGenerator(
        { courseId: 'course1', courseTitle: 'Test' },
        { title: 'Org', items: [] }
      );

      const xml = generator.generate();
      expect(xml).toContain('<?xml version');
      expect(xml).toContain('<manifest');
      expect(xml).toContain('</manifest>');
    });

    it('should include organization', () => {
      const generator = new ScormManifestGenerator(
        {...},
        { title: 'Module Org', items: [] }
      );

      const xml = generator.generate();
      expect(xml).toContain('<organization');
      expect(xml).toContain('Module Org');
    });

    it('should escape XML special characters', () => {
      const generator = new ScormManifestGenerator(
        { courseId: 'id', courseTitle: 'Course <script>' },
        {...}
      );

      const xml = generator.generate();
      expect(xml).toContain('&lt;script&gt;');
      expect(xml).not.toContain('<script>');
    });
  });
});
```

### Package Validator Tests

```typescript
// tests/lib/scormPackageValidator.test.ts

describe('scormPackageValidator', () => {
  describe('validatePackage', () => {
    it('should pass valid SCORM package', async () => {
      const zip = new JSZip();
      zip.file('imsmanifest.xml', createValidManifest());
      zip.file('module_0.html', '<html></html>');

      const report = await validatePackage(zip, 5000000);
      expect(report.isValid).toBe(true);
    });

    it('should fail if manifest missing', async () => {
      const zip = new JSZip();
      // No imsmanifest.xml

      const report = await validatePackage(zip, 1000000);
      expect(report.isValid).toBe(false);
      expect(report.summary.critical).toBeGreaterThan(0);
    });

    it('should check resource references', async () => {
      const zip = new JSZip();
      zip.file('imsmanifest.xml', `
        <?xml version="1.0"?>
        <manifest>
          <resources>
            <resource href="missing.html"/>
          </resources>
        </manifest>
      `);

      const report = await validatePackage(zip, 1000000);
      expect(report.summary.critical).toBeGreaterThan(0);
    });
  });
});
```

---

## Phase 6: Integration Tests

### End-to-End Export Tests

```typescript
// tests/lib/scormExportOrchestrator.test.ts

describe('scormExportOrchestrator', () => {
  describe('export', () => {
    it('should complete full export cycle', async () => {
      const rawOutputs = createMockRawOutputs();
      const options = {
        courseTitle: 'Test Course',
        courseDescription: 'Test Description',
        trainerId: 'trainer_1',
      };

      const orchestrator = new ScormExportOrchestrator(jest.fn());
      const result = await orchestrator.export(rawOutputs, options);

      expect(result.success).toBe(true);
      expect(result.fileBlob).toBeDefined();
      expect(result.fileName).toContain('SCORM');
      expect(result.preValidation).toBeDefined();
      expect(result.postValidation).toBeDefined();
    });

    it('should block export on validation failure', async () => {
      const rawOutputs = { architect: '', writer: '', assessment: '' };
      const options = { courseTitle: '' }; // No title

      const result = await orchestrator.export(rawOutputs, options);

      expect(result.success).toBe(false);
      expect(result.fileBlob).toBeUndefined();
    });

    it('should report progress', async () => {
      const progressUpdates: ExportProgress[] = [];
      const orchestrator = new ScormExportOrchestrator((p) => progressUpdates.push(p));

      await orchestrator.export(rawOutputs, options);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('validation');
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('complete');
    });
  });
});
```

---

## Manual Testing Checklist

### UI/UX Testing

- [ ] Export button visible and clickable
- [ ] Pre-export validation modal appears
- [ ] Modal shows quality score
- [ ] Critical issues block export
- [ ] Warnings allow export
- [ ] Progress bar updates during export
- [ ] Post-export validation modal appears
- [ ] File downloads with correct name
- [ ] No console errors during export

### LMS Compatibility Testing

- [ ] Package imports to Blackboard
- [ ] Package imports to Canvas
- [ ] Package imports to Moodle
- [ ] Learner can navigate slides
- [ ] Audio plays correctly
- [ ] Quiz submissions record scores
- [ ] Quiz scores sync to gradebook
- [ ] Progress tracking works
- [ ] Course completion marks SCORM as complete

### Content Quality Testing

- [ ] All modules render correctly
- [ ] Avatar images display
- [ ] Generated visuals appear
- [ ] SVG infographics render
- [ ] Quiz questions show all options
- [ ] Correct answers highlighted
- [ ] Narration audio plays
- [ ] Sentence highlighting syncs
- [ ] Time tracking accurate

### Edge Cases Testing

- [ ] Very long course titles (>200 chars)
- [ ] Special characters in module names
- [ ] Missing visual data
- [ ] No avatar selected
- [ ] No quizzes in course
- [ ] Single module course
- [ ] Single slide module
- [ ] Very large package (>200MB)
- [ ] Offline playback works
- [ ] Internationalization (future)

---

## Performance Testing

```typescript
// Benchmark tests
describe('Performance', () => {
  it('should complete export in <30 seconds', async () => {
    const start = Date.now();
    await orchestrator.export(rawOutputs, options);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(30000);
  });

  it('should render 100 slides without memory issues', async () => {
    const largeOutputs = createMockWithSlides(100);
    const result = await orchestrator.export(largeOutputs, options);
    
    expect(result.success).toBe(true);
    // Memory usage should not exceed browser limits
  });

  it('package size should scale linearly', () => {
    // Small course: 5 slides → ~2MB
    // Medium course: 50 slides → ~10MB
    // Large course: 200 slides → ~30MB
  });
});
```

---

## Continuous Integration Setup

### GitHub Actions Workflow

```yaml
name: SCORM Export Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - run: npm install
      - run: npm run test:unit      # Phase 1-2 unit tests
      - run: npm run test:integration # Phase 3-4 integration
      - run: npm run test:validation  # Phase 5 validation
      - run: npm run test:e2e       # Phase 6 end-to-end
      
      - uses: codecov/codecov-action@v2
        with:
          flags: scorm-export
          fail_ci_if_error: true
          verbose: true
```

---

## Test Execution Command

```bash
# Run all tests
npm test -- --coverage

# Run specific phase tests
npm test -- --testPathPattern=phase1
npm test -- --testPathPattern=phase2
npm test -- --testPathPattern=phase3
npm test -- --testPathPattern=phase4
npm test -- --testPathPattern=phase5
npm test -- --testPathPattern=phase6

# Run with verbose output
npm test -- --verbose

# Run with detailed coverage report
npm test -- --coverage --coverageReporters=html
```

---

## Success Criteria

✅ **All tests passing:** 100+ test cases
✅ **Code coverage:** >85%
✅ **Performance:** Export completes in <30 seconds
✅ **LMS compatibility:** Works on all major platforms
✅ **No console errors:** Clean browser console
✅ **Offline functionality:** Works without internet
✅ **Accessibility:** WCAG 2.1 AA compliance
