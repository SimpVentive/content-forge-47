// Direct test of credit estimation logic
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the creditEstimator.ts file
const estimatorPath = path.join(__dirname, 'src/lib/creditEstimator.ts');
const estimatorCode = fs.readFileSync(estimatorPath, 'utf-8');

console.log('=== Testing Credit Estimation ===\n');

// Check if all required functions are exported
const functions = [
  'estimateCredits',
  'estimateImageCredits',
  'estimateStaticELearningCredits',
  'estimateVideoCredits',
  'getCreditAmountColor',
  'getCreditBreakdownText'
];

console.log('Checking function exports:\n');
functions.forEach(fn => {
  const regex = new RegExp(`export\\s+function\\s+${fn}`, 'm');
  if (regex.test(estimatorCode)) {
    console.log(`✓ ${fn} is exported`);
  } else {
    console.log(`✗ ${fn} is NOT exported`);
  }
});

// Check the interface export
console.log('\nChecking interface exports:\n');
if (/export\s+interface\s+CreditEstimate/m.test(estimatorCode)) {
  console.log('✓ CreditEstimate interface is exported');
} else {
  console.log('✗ CreditEstimate interface is NOT exported');
}

// Check CreditConfirmationModal imports
console.log('\n=== Checking CreditConfirmationModal Imports ===\n');
const modalPath = path.join(__dirname, 'src/components/CreditConfirmationModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf-8');

const requiredImports = [
  'Dialog',
  'Button',
  'AlertCircle',
  'Zap',
  'CreditEstimate',
  'getCreditAmountColor',
  'getCreditBreakdownText'
];

requiredImports.forEach(imp => {
  if (modalCode.includes(imp)) {
    console.log(`✓ ${imp} is used/imported`);
  } else {
    console.log(`✗ ${imp} is NOT used/imported`);
  }
});

// Check Index.tsx for credit-related functionality
console.log('\n=== Checking Index.tsx Credit Flow ===\n');
const indexPath = path.join(__dirname, 'src/pages/Index.tsx');
const indexCode = fs.readFileSync(indexPath, 'utf-8');

const checks = [
  { name: 'estimateCredits import', regex: /import.*estimateCredits.*from/ },
  { name: 'CreditConfirmationModal import', regex: /import.*CreditConfirmationModal.*from/ },
  { name: 'handleParamsConfirm function', regex: /const handleParamsConfirm/ },
  { name: 'handleCreditConfirmation function', regex: /const handleCreditConfirmation/ },
  { name: 'spendCredits function call', regex: /await spendCredits/ },
  { name: 'CreditConfirmationModal component', regex: /<CreditConfirmationModal/ },
];

checks.forEach(check => {
  if (check.regex.test(indexCode)) {
    console.log(`✓ ${check.name} found`);
  } else {
    console.log(`✗ ${check.name} NOT found`);
  }
});

console.log('\n=== Test Complete ===');
