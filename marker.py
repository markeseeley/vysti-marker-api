import re
from collections import Counter
from typing import Dict, List, Optional
from docx import Document
from docx.shared import Pt


def load_rules(rules_path: str) -> Dict:
    """Load rules from a file. Placeholder implementation."""
    # This would load rules from a file/configuration
    return {}


def analyze_text(text: str, rules: Dict) -> List[Dict]:
    """Analyze text and return marks. Placeholder implementation."""
    # This would analyze text and return marks with 'note' field
    return []


def enforce_font(run, font_name: str = "Calibri", font_size: int = 11):
    """Enforce font on a run."""
    run.font.name = font_name
    run.font.size = Pt(font_size)


def add_summary_table(doc: Document, labels: List[str], rules: Dict, issue_counts: Optional[Counter] = None):
    """Add summary table with issues and explanations.
    
    Args:
        doc: Word document
        labels: List of issue labels to include
        rules: Dictionary of rules (label -> explanation)
        issue_counts: Optional Counter of issue occurrences
    """
    # Add a heading
    doc.add_heading("Summary", level=1)
    
    # Create table
    table = doc.add_table(rows=1, cols=2)
    table.style = "Light Grid Accent 1"
    
    # Header row
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = "Issue"
    hdr_cells[1].text = "Explanation"
    
    # Add rows for each label
    for lbl in labels:
        row_cells = table.add_row().cells
        
        # Issue cell: keep label text, append count if > 0
        cnt = (issue_counts or {}).get(lbl, 0)
        issue_cell = row_cells[0]
        
        # Clear default paragraph
        issue_cell.paragraphs[0].clear()
        p = issue_cell.paragraphs[0]
        
        # Add label text (preserves anchors/bookmarks)
        run = p.add_run(lbl)
        enforce_font(run)
        
        # Append count if > 0
        if cnt > 0:
            count_run = p.add_run(f" ({cnt})")
            enforce_font(count_run)
        
        # Explanation cell
        explanation = rules.get(lbl, "")
        row_cells[1].text = explanation


def extract_summary_metadata(doc: Document) -> Dict:
    """Extract summary metadata from the document.
    
    Returns:
        Dictionary with 'issues' list containing {label, explanation, count}
    """
    issues = []
    
    # Find the Summary table
    for table in doc.tables:
        # Check if this is the summary table (has "Issue" and "Explanation" headers)
        if len(table.rows) > 0:
            header_row = table.rows[0]
            if len(header_row.cells) >= 2:
                header_text = header_row.cells[0].text.strip().lower()
                if "issue" in header_text:
                    # Process data rows (skip header)
                    for row in table.rows[1:]:
                        if len(row.cells) >= 2:
                            # Parse Issue cell: label and optional count
                            raw = row.cells[0].text.strip()
                            
                            # Use regex to separate label and count
                            # Pattern matches: "Label" or "Label (N)"
                            # Note: Using corrected pattern - user's pattern had typo (.?) which only matches 0-1 chars
                            m = re.match(r"^(.+?)(?:\s+\((\d+)\))?$", raw)
                            if m:
                                label = (m.group(1) or "").strip()
                                count_str = m.group(2) if (m and m.group(2)) else None
                                count = int(count_str) if count_str else 0
                            else:
                                # Fallback: no count found
                                label = raw
                                count = 0
                            
                            explanation = row.cells[1].text.strip()
                            
                            if label:
                                issues.append({
                                    "label": label,
                                    "explanation": explanation,
                                    "count": count
                                })
                    break
    
    return {"issues": issues}


def run_marker(doc_path: str, rules_path: str, output_path: str):
    """Run the marker on a document.
    
    Args:
        doc_path: Path to input document
        rules_path: Path to rules file
        output_path: Path to output marked document
    """
    # Load rules
    rules = load_rules(rules_path)
    
    # Initialize issue counter
    issue_counts = Counter()
    
    # Load document
    doc = Document(doc_path)
    
    # Track labels used
    labels_used = set()
    
    # Process paragraphs
    for para in doc.paragraphs:
        text = para.text
        if not text.strip():
            continue
        
        # Analyze text to get marks
        marks = analyze_text(text, rules)
        
        # Increment counts for each mark
        for m in marks:
            note = m.get("note")
            if note and note in rules:
                issue_counts[note] += 1
                labels_used.add(note)
        
        # Apply marks to paragraph (existing marking logic would go here)
        # ...
    
    # Convert labels_used to sorted list
    labels_used = sorted(labels_used)
    
    # Add summary table at the end
    add_summary_table(doc, labels_used, rules, issue_counts=issue_counts)
    
    # Save document
    doc.save(output_path)

