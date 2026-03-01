#!/usr/bin/env python3
"""
Analyze rule coverage - which rules are detected frequently vs. rarely.
Helps identify rules that might need better detection logic or more testing.
"""

import pandas as pd
from glob import glob
import json

def analyze_rule_coverage():
    """
    Analyze which rules are triggered in actual documents.

    Usage:
      1. Mark several student documents
      2. Check which rules were detected
      3. Identify rules that are NEVER triggered (might be broken)
    """

    # Load all rules
    df = pd.read_excel('Vysti Rules for Writing.xlsx', header=None)
    all_rules = set(df[0].tolist())

    print("=" * 70)
    print("VYSTI RULE COVERAGE ANALYSIS")
    print("=" * 70)
    print(f"\nTotal rules defined: {len(all_rules)}")
    print()

    # Categorize rules for better understanding
    categories = {
        'Forbidden words': [],
        'Structural': [],
        'Evidence/Quotations': [],
        'Grammar/Style': [],
        'Formatting': [],
        'Other': []
    }

    for rule in all_rules:
        rule_lower = str(rule).lower()
        if 'avoid' in rule_lower or 'forbidden' in rule_lower or 'do not use' in rule_lower:
            categories['Forbidden words'].append(rule)
        elif 'evidence' in rule_lower or 'quot' in rule_lower:
            categories['Evidence/Quotations'].append(rule)
        elif 'paragraph' in rule_lower or 'thesis' in rule_lower or 'sentence' in rule_lower:
            categories['Structural'].append(rule)
        elif 'title' in rule_lower or 'capitalize' in rule_lower or 'format' in rule_lower:
            categories['Formatting'].append(rule)
        elif 'agreement' in rule_lower or 'pronoun' in rule_lower or 'antecedent' in rule_lower:
            categories['Grammar/Style'].append(rule)
        else:
            categories['Other'].append(rule)

    print("Rules by category:")
    for cat, rules in categories.items():
        print(f"\n  {cat}: {len(rules)} rules")
        if len(rules) <= 5:  # Show all if 5 or fewer
            for rule in rules[:3]:
                print(f"    • {rule}")
        else:  # Show first 3 as examples
            for rule in rules[:3]:
                print(f"    • {rule}")
            print(f"    ... and {len(rules) - 3} more")

    print("\n" + "=" * 70)
    print("TESTING STRATEGY RECOMMENDATIONS")
    print("=" * 70)

    print("""
1. HIGH PRIORITY: Test forbidden words (easy to detect)
   → Use vysti_test_violations.docx (already created)

2. MEDIUM PRIORITY: Test structural rules
   → Create documents with missing thesis, no evidence, weak structure

3. LOW PRIORITY: Grammar rules (harder to detect, less common)
   → These often need NLP analysis and may have false positives

4. CONTINUOUS: Upload real student essays
   → Best way to find rules that never trigger
   → Build a corpus of test documents over time

NEXT STEPS:
  a) Upload vysti_test_violations.docx to your marker
  b) Check which violations are detected
  c) For any missing detections, investigate those specific rules
  d) Build targeted tests for rules that seem broken
""")

    print("=" * 70)

if __name__ == "__main__":
    analyze_rule_coverage()
