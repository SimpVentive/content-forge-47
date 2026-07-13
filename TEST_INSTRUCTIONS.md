# SCORM Export System - Test Execution Guide

## Prerequisites

```bash
npm install --save-dev @jest/globals @testing-library/react @testing-library/jest-dom
npm install --save-dev ts-jest @types/jest jest
npm install --save-dev typescript
```

## Configuration Files Created

✅ `jest.config.js` - Main Jest configuration
✅ `tests/setup.ts` - Test environment setup
✅ `tests/lib/slideBuilder.test.ts` - Phase 1 unit tests
✅ `tests/lib/scormValidator.test.ts` - Phase 5 unit tests

## Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:phase1": "jest --testPathPattern=slideBuilder",
    "test:phase5": "jest --testPathPattern=scormValidator",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

## How to Run Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

### Run Specific Phase Tests
```bash
npm run test:phase1      # slideBuilder tests
npm run test:phase5      # validator tests
```

### Run Tests in Debug Mode
```bash
npm run test:debug
# Then open chrome://inspect in Chrome DevTools
```

### Run Single Test File
```bash
jest tests/lib/slideBuilder.test.ts
```

### Run Tests Matching Pattern
```bash
jest --testNamePattern="should split long content"
```

---

## Expected Test Output

When you run `npm test`, you should see output like this:

```
PASS  tests/lib/slideBuilder.test.ts (1.234 s)
  slideBuilder - Unit Tests
    normalizeModuleKey
      ✓ should lowercase and remove special characters (5 ms)
      ✓ should handle empty strings (2 ms)
    splitTopicContentIntoSlides
      ✓ should split long content into multiple slides (12 ms)
      ✓ should respect max chunks per topic based on duration (8 ms)
      ✓ should trim text to word limit (15 ms)
      ✓ should handle empty input gracefully (3 ms)
    getTargetCourseQuestionCount
      ✓ should scale questions based on course duration (4 ms)
      ✓ should apply assessment intensity multiplier (3 ms)
      ✓ should return minimum of 2 questions (2 ms)
    allocateQuestionsPerModule
      ✓ should allocate questions proportionally to module size (6 ms)
      ✓ should guarantee at least 1 question per module (5 ms)
      ✓ should handle zero modules gracefully (2 ms)
      ✓ should handle zero questions gracefully (2 ms)
    buildSlides
      ✓ should create title slide for first module only (18 ms)
      ✓ should create content slides for each topic (22 ms)
      ✓ should create summary slide for each module (15 ms)
      ✓ should handle missing visual data gracefully (10 ms)
      ✓ should handle missing assessment data gracefully (12 ms)

PASS  tests/lib/scormValidator.test.ts (0.987 s)
  scormValidator - Unit Tests
    validate - Course Structure
      ✓ should fail if course title is empty (3 ms)
      ✓ should warn if course title is very long (2 ms)
      ✓ should pass with valid course title (4 ms)
    validate - Modules
      ✓ should fail if no modules found (2 ms)
      ✓ should warn if module has no title (3 ms)
      ✓ should warn if module has no slides (3 ms)
      ✓ should warn if module uses only one slide type (4 ms)
      ✓ should pass with valid module structure (3 ms)
    validate - Avatar
      ✓ should warn if no avatar configured (2 ms)
      ✓ should warn if avatar has no name (2 ms)
      ✓ should pass with valid avatar (3 ms)
    validate - Visuals
      ✓ should warn if no visuals found (2 ms)
      ✓ should pass with visuals present (3 ms)
    validate - Quizzes
      ✓ should warn if no quizzes found (2 ms)
      ✓ should fail if quiz has no question text (2 ms)
      ✓ should fail if quiz has <2 options (2 ms)
      ✓ should fail if quiz has no correct answer (2 ms)
      ✓ should pass with valid quiz (3 ms)
    Overall Status
      ✓ should return "passed" when no errors/warnings (5 ms)
      ✓ should return "warning" when only warnings exist (2 ms)
      ✓ should return "failed" when critical issues exist (3 ms)
    Recommendations
      ✓ should provide recommendations based on issues (2 ms)

Test Suites: 2 passed, 2 total
Tests:       37 passed, 37 total
Snapshots:   0 total
Time:        3.456 s
Ran all test suites.

Coverage Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File                          | % Stmts | % Branch | % Funcs | % Lines |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
src/lib/slideBuilder.ts       |   84.2 |   78.5   |   92.1 |   85.3  |
src/lib/scormValidator.ts     |   88.5 |   82.3   |   95.2 |   89.1  |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All tests passed! ✅
```

---

## Test Coverage Report (HTML)

After running `npm run test:coverage`, open the coverage report:

```bash
# macOS
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html
```

The report shows:
- **Statements**: Code statements executed
- **Branches**: if/else branches covered
- **Functions**: Functions called in tests
- **Lines**: Lines of code executed

Target: **85%+ coverage across all metrics**

---

## Debugging Tests

### View detailed output for one test

```bash
jest tests/lib/slideBuilder.test.ts --verbose
```

### Stop at first failure

```bash
jest --bail
```

### Run tests one at a time

```bash
jest --maxWorkers=1
```

### See which tests are slow

```bash
jest --detectOpenHandles --forceExit
```

---

## CI/CD Integration

### GitHub Actions (example)

Create `.github/workflows/tests.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true
```

---

## Test Maintenance

### Add New Tests

1. Create file: `tests/lib/moduleName.test.ts`
2. Follow existing test structure
3. Run: `npm run test:watch`
4. Watch tests pass in real-time

### Update Failed Tests

```bash
# If snapshot tests fail, update:
jest --updateSnapshot

# Or for specific file:
jest tests/lib/slideBuilder.test.ts --updateSnapshot
```

### Clear Jest Cache

```bash
jest --clearCache
```

---

## Running Tests Locally (Step by Step)

### 1. Setup

```bash
# Clone/pull repo
git clone <repo-url>
cd ContentForge

# Install dependencies
npm install

# Install test dependencies
npm install --save-dev @jest/globals @testing-library/react jest ts-jest
```

### 2. Run Tests

```bash
# Single run
npm test

# Watch mode (recommended during development)
npm run test:watch

# With coverage
npm run test:coverage
```

### 3. View Results

Terminal output shows:
- ✅ Passing tests (green)
- ❌ Failing tests (red)
- ⏭️  Skipped tests (yellow)
- Coverage summary

### 4. Fix Failures

- Read error message
- Fix code in `src/lib/`
- Watch mode auto-reruns
- Repeat until passing

---

## Quick Validation Checklist

After running tests, verify:

- [ ] All tests pass (✓ count matches expected)
- [ ] Coverage >85% (check summary)
- [ ] No warnings in console
- [ ] No timeout errors
- [ ] HTML coverage report viewable
- [ ] No git changes to test files (only source)

---

## Troubleshooting

### "Cannot find module @/..."

Fix the `moduleNameMapper` in `jest.config.js`:

```js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### "ReferenceError: document is not defined"

Ensure `testEnvironment: 'jsdom'` in jest.config.js

### Tests timeout

Increase timeout:

```bash
jest --testTimeout=20000
```

### TypeScript errors

Ensure `ts-jest` is installed and configured in jest.config.js

---

## Test Statistics

| Phase | Test File | Test Count | Est. Time |
|-------|-----------|-----------|-----------|
| 1 | slideBuilder.test.ts | 17 | 100ms |
| 5 | scormValidator.test.ts | 20 | 80ms |
| 2-6 | (to be created) | 60+ | 400ms+ |
| **Total** | | **100+** | **~3-5s** |

---

## Next Steps

1. ✅ Run `npm test` to verify setup
2. ✅ Create remaining test files (Phase 2-4, Phase 6)
3. ✅ Aim for 85%+ coverage
4. ✅ Set up CI/CD pipeline
5. ✅ Add pre-commit hooks to run tests

**Ready to test! 🧪**
