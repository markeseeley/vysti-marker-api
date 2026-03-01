#!/usr/bin/env python3
"""
Build-time validation script to check Python files for syntax errors.
This should be run during the build process to catch errors before deployment.
"""
import sys
import ast
import os
from pathlib import Path

def validate_python_file(filepath: Path) -> tuple[bool, str | None]:
    """Validate a Python file for syntax errors. Returns (is_valid, error_message)."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            content = ''.join(lines)
        
        # Check if file starts with HTML (common mistake where HTML gets copied into Python file)
        first_lines = ''.join(lines[:10]).strip()
        html_start_tags = ['<!DOCTYPE', '<html', '<HTML']
        for tag in html_start_tags:
            if first_lines.startswith(tag):
                return False, f"Python file {filepath} appears to start with HTML (found '{tag}')"
        
        # Check for HTML tags in the first 20 lines (where imports/actual code should be)
        # This catches cases where HTML was accidentally inserted at the top
        top_content = ''.join(lines[:20])
        html_tags = ['<!DOCTYPE', '<html', '<head', '<title', '<body']
        for tag in html_tags:
            # Only flag if it appears as actual HTML (not in a string literal or comment)
            # Simple heuristic: check if it's at the start of a line or after whitespace
            import re
            pattern = rf'^\s*{re.escape(tag)}'
            if re.search(pattern, top_content, re.MULTILINE | re.IGNORECASE):
                return False, f"Found HTML tag '{tag}' in Python file {filepath} (likely accidental HTML insertion)"
        
        # Parse with AST to check syntax
        ast.parse(content, filename=str(filepath))
        return True, None
    except SyntaxError as e:
        return False, f"Syntax error in {filepath}: {e}"
    except Exception as e:
        return False, f"Error reading {filepath}: {e}"

def main():
    """Validate all Python files in the current directory."""
    current_dir = Path('.')
    python_files = list(current_dir.glob('*.py'))
    
    if not python_files:
        print("No Python files found to validate.")
        return 0
    
    errors = []
    for py_file in python_files:
        is_valid, error_msg = validate_python_file(py_file)
        if not is_valid:
            errors.append(error_msg)
            print(f"❌ {error_msg}", file=sys.stderr)
        else:
            print(f"✓ {py_file} is valid")
    
    if errors:
        print(f"\n❌ Validation failed: {len(errors)} error(s) found", file=sys.stderr)
        return 1
    
    print(f"\n✓ All {len(python_files)} Python file(s) validated successfully")
    return 0

if __name__ == '__main__':
    sys.exit(main())
