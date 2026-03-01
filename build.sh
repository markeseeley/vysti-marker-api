#!/bin/bash
# Build script for Render deployment
# This script validates Python files before installation

set -e  # Exit on any error

echo "🔍 Validating Python files..."

# Method 1: Use custom validation script (checks for HTML and syntax)
if [ -f validate_python.py ]; then
    python3 validate_python.py
    if [ $? -ne 0 ]; then
        echo "❌ Python validation failed. Build aborted."
        exit 1
    fi
else
    # Fallback: Use Python's built-in compileall
    echo "Using python -m compileall for validation..."
    python3 -m compileall -q .
    if [ $? -ne 0 ]; then
        echo "❌ Python compilation failed. Build aborted."
        exit 1
    fi
fi

echo "✓ Python validation passed"
echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "✓ Build completed successfully"
