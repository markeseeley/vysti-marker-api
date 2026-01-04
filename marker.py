from collections import Counter
from typing import Dict, List, Optional


class MarkEvent:
    """Represents a marking event."""
    def __init__(self):
        self.label_counts: Counter = Counter()


def process_mark_events(metadata: Dict) -> MarkEvent:
    """Process mark events from metadata.
    
    Args:
        metadata: Dictionary containing 'issues' list with {label, explanation, count}
    
    Returns:
        MarkEvent with label_counts populated
    """
    mark_event = MarkEvent()
    
    issues = metadata.get("issues", [])
    
    # Compute label_counter by summing counts from issues
    label_counter = Counter()
    for issue in issues:
        lbl = issue.get("label")
        cnt = int(issue.get("count") or 0)
        if lbl:
            # Use count if > 0, otherwise default to 1 (backward compatibility)
            label_counter[lbl] += (cnt if cnt > 0 else 1)
    
    mark_event.label_counts = label_counter
    
    return mark_event

