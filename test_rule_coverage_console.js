/**
 * VYSTI RULE COVERAGE CHECKER
 *
 * Run this in DevTools Console after marking vysti_test_violations.docx
 *
 * Usage:
 *   1. Upload vysti_test_violations.docx in Student React app
 *   2. Wait for marking to complete
 *   3. Open DevTools Console (F12)
 *   4. Paste this entire script and press Enter
 */

(function checkRuleCoverage() {
  console.clear();
  console.log('%c═══════════════════════════════════════════════════════════', 'color: #4A90E2; font-weight: bold');
  console.log('%c VYSTI RULE COVERAGE ANALYSIS ', 'color: #4A90E2; font-weight: bold; font-size: 16px');
  console.log('%c═══════════════════════════════════════════════════════════', 'color: #4A90E2; font-weight: bold');
  console.log('');

  // Expected violations from vysti_test_violations.docx
  const expectedRules = {
    // Test 1: Forbidden Words
    "Avoid the words 'ethos', 'pathos', and 'logos'": true,
    "Avoid the words 'very' and 'a lot'": true,
    "Avoid the word 'which'": true,
    "Avoid the words 'fact', 'proof', and 'prove'": true,
    "Avoid using the words 'human', 'people', 'everyone', or 'individuals'": true,
    "Avoid using the word 'normal'": true,
    "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'": true,
    "Avoid overly general words like 'society', 'universe', 'reality', and 'world'": true,
    "Do not refer to the text as a text; refer to context instead": true,
    "Do not use 'etc.' at the end of a list": true,

    // Test 2: And overuse
    "Avoid using the word 'and' more than twice in a sentence": true,

    // Test 3: Weak verbs
    "Avoid weak verbs": true,
    "Refer to the Power Verbs list": true,
    "Refer to the Power Verbs List": true,

    // Test 4: Pronouns
    "Clarify pronouns and antecedents": true,

    // Test 5: Reader references
    "Avoid referring to the reader or audience unless necessary": true,

    // Test 6: Evidence
    "Every paragraph needs evidence": true,

    // Test 7: Quote in intro
    "Avoid quotations in the introduction": true,

    // Test 8: Subject-verb agreement
    "Check subject-verb agreement": true,
  };

  // Try to get metadata from the page
  // Method 1: Check if metadata is in window
  let metadata = window.metadata;

  // Method 2: Try to get from React component state (if accessible)
  if (!metadata) {
    console.log('%c⚠️  Metadata not found in window.metadata', 'color: orange');
    console.log('%cTrying to extract from page...', 'color: gray');

    // Give instructions on how to expose metadata
    console.log('');
    console.log('%cTo use this script, first expose the metadata:', 'color: yellow; font-weight: bold');
    console.log('%c1. After marking the document, run this in console:', 'color: white');
    console.log('%c   window.testMetadata = metadata', 'background: #2d2d2d; color: #8be9fd; padding: 4px 8px; font-family: monospace');
    console.log('%c2. Then run this coverage checker script again', 'color: white');
    console.log('');
    console.log('%cAlternatively, paste this in StudentPage.jsx after setMetadata():', 'color: yellow');
    console.log('%c   window.testMetadata = data.metadata;', 'background: #2d2d2d; color: #8be9fd; padding: 4px 8px; font-family: monospace');
    console.log('');

    // Try window.testMetadata as fallback
    metadata = window.testMetadata;
    if (!metadata) {
      console.log('%c❌ No metadata available. Follow instructions above.', 'color: red; font-weight: bold');
      return;
    }
  }

  console.log('%c✓ Metadata found!', 'color: #50fa7b; font-weight: bold');
  console.log('');

  // Extract detected issues
  const issues = metadata?.issues || [];
  const detectedRules = new Set();

  issues.forEach(issue => {
    if (issue.label) {
      detectedRules.add(issue.label);
    }
  });

  console.log(`%c📊 DETECTION RESULTS`, 'color: #f1fa8c; font-weight: bold; font-size: 14px');
  console.log(`   Total issues detected: ${issues.length}`);
  console.log(`   Unique rules triggered: ${detectedRules.size}`);
  console.log(`   Expected rules to find: ${Object.keys(expectedRules).length}`);
  console.log('');

  // Find missing rules
  const missingRules = [];
  const foundRules = [];

  Object.keys(expectedRules).forEach(rule => {
    if (detectedRules.has(rule)) {
      foundRules.push(rule);
    } else {
      missingRules.push(rule);
    }
  });

  // Show found rules
  if (foundRules.length > 0) {
    console.log(`%c✅ DETECTED (${foundRules.length} rules)`, 'color: #50fa7b; font-weight: bold');
    foundRules.forEach(rule => {
      const count = issues.filter(i => i.label === rule).length;
      console.log(`   ✓ ${rule} (${count}×)`);
    });
    console.log('');
  }

  // Show missing rules
  if (missingRules.length > 0) {
    console.log(`%c❌ NOT DETECTED (${missingRules.length} rules)`, 'color: #ff5555; font-weight: bold');
    missingRules.forEach(rule => {
      console.log(`   ✗ ${rule}`);
    });
    console.log('');

    console.log(`%c⚠️  Coverage: ${Math.round(foundRules.length / Object.keys(expectedRules).length * 100)}%`,
                'background: #ff5555; color: white; padding: 4px 8px; font-weight: bold');
  } else {
    console.log(`%c🎉 PERFECT! All expected rules were detected!`, 'color: #50fa7b; font-weight: bold; font-size: 14px');
    console.log(`%c✓ Coverage: 100%`, 'background: #50fa7b; color: black; padding: 4px 8px; font-weight: bold');
  }

  console.log('');

  // Show unexpected detections (rules not in our expected list)
  const unexpectedRules = [];
  detectedRules.forEach(rule => {
    if (!expectedRules[rule]) {
      unexpectedRules.push(rule);
    }
  });

  if (unexpectedRules.length > 0) {
    console.log(`%cℹ️  BONUS DETECTIONS (${unexpectedRules.length} additional rules)`, 'color: #8be9fd; font-weight: bold');
    unexpectedRules.forEach(rule => {
      const count = issues.filter(i => i.label === rule).length;
      console.log(`   + ${rule} (${count}×)`);
    });
    console.log('');
  }

  // Show all issues with counts
  console.log('%c📋 FULL BREAKDOWN BY RULE', 'color: #bd93f9; font-weight: bold');
  const ruleCounts = {};
  issues.forEach(issue => {
    const label = issue.label || 'Unknown';
    ruleCounts[label] = (ruleCounts[label] || 0) + 1;
  });

  Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => {
      console.log(`   ${count.toString().padStart(3)}× ${rule}`);
    });

  console.log('');
  console.log('%c═══════════════════════════════════════════════════════════', 'color: #4A90E2; font-weight: bold');

  // Return data for further inspection
  return {
    expected: Object.keys(expectedRules).length,
    found: foundRules.length,
    missing: missingRules.length,
    coverage: Math.round(foundRules.length / Object.keys(expectedRules).length * 100),
    missingRules,
    foundRules,
    unexpectedRules,
    allIssues: issues
  };
})();
