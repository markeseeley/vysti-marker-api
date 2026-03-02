"""
Server-side scoring engine — computes Power, Variety, Cohesion, Precision metrics.

This is the authoritative scoring implementation. The frontend reads pre-computed
scores from API responses rather than computing them client-side.
"""

import re
import math
import json
import os

# ────────────────────────────────────────────────────────────────────
# Label category arrays (mirrors the former client-side categorization)
# ────────────────────────────────────────────────────────────────────

CONCISION_LABELS = [
    "Avoid referring to the reader or audience unless necessary",
    "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
    "Use the author's name instead of 'the author'",
    "No 'I', 'we', 'us', 'our' or 'you' in academic writing",
    "No contractions in academic writing",
    "Avoid the word 'which'",
    "Avoid using the word 'and' more than twice in a sentence",
]

CLARITY_LABELS = [
    "Avoid the vague term 'society'",
    "Avoid the vague term 'universe'",
    "Avoid the vague term 'reality'",
    "Avoid the vague term 'life'",
    "Avoid the vague term 'truth'",
    "Clarify pronouns and antecedents",
    "Do not refer to the text as a text; refer to context instead",
    "Avoid absolute language like 'always' or 'never'",
    "Article error",
    "Avoid the word 'ethos'",
    "Avoid the word 'pathos'",
    "Avoid the word 'logos'",
    "Avoid the word 'very'",
    "Avoid the phrase 'a lot'",
    "Avoid the vague term 'human'",
    "Avoid the vague term 'people'",
    "Avoid the vague term 'everyone'",
    "Avoid the vague term 'individual'",
    "Avoid the word 'fact'",
    "Avoid the word 'proof'",
    "Avoid the word 'prove'",
    "Noun repetition",
]

UNNECESSARY_LABELS = [
    "Avoid referring to the reader or audience unless necessary",
    "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
    "No 'I', 'we', 'us', 'our' or 'you' in academic writing",
    "No contractions in academic writing",
]

WORDY_LABELS = [
    "Use the author's name instead of 'the author'",
    "Avoid the word 'which'",
    "Avoid using the word 'and' more than twice in a sentence",
    "Avoid the word 'very'",
    "Avoid the phrase 'a lot'",
]

IMPRECISE_LABELS = [
    "Avoid the vague term 'society'",
    "Avoid the vague term 'universe'",
    "Avoid the vague term 'reality'",
    "Avoid the vague term 'life'",
    "Avoid the vague term 'truth'",
    "Clarify pronouns and antecedents",
    "Do not refer to the text as a text; refer to context instead",
    "Avoid absolute language like 'always' or 'never'",
    "Avoid the word 'ethos'",
    "Avoid the word 'pathos'",
    "Avoid the word 'logos'",
    "Avoid the vague term 'human'",
    "Avoid the vague term 'people'",
    "Avoid the vague term 'everyone'",
    "Avoid the vague term 'individual'",
    "Avoid the word 'fact'",
    "Avoid the word 'proof'",
    "Avoid the word 'prove'",
]

DEVELOPMENT_LABELS = [
    "Floating quotation",
    "Follow the process for inserting evidence",
    "Explain the significance of evidence",
    "Shorten, modify, and integrate quotations",
    "Only cite a quotation once",
    "No quotations in thesis statements",
    "No quotations in topic sentences",
    "No quotations in the final sentence of a body paragraph",
    "Avoid quotations in the introduction",
    "Avoid quotations in the conclusion",
    "Undeveloped paragraph",
    "Every paragraph needs evidence",
]

COHESION_CRITICAL_LABELS = [
    "Off-topic",
    "Follow the organization of the thesis",
    "Use a closed thesis statement",
    "The topics in the thesis statement should be specific devices or strategies",
]

COHESION_MODERATE_LABELS = [
    "Put this topic in the thesis statement",
    "Incomplete conclusion",
]

COHESION_MINOR_LABELS = [
    "Avoid beginning a sentence with a quotation",
    "Use a boundary statement when transitioning between paragraphs",
]

CONVENTIONS_LABELS = [
    "Qualify language",
    "Essay title format",
    "Capitalize the words in the title",
    "The title of major works should be italicized",
    "The title of minor works should be inside double quotation marks",
    "Write out the numbers one through ten",
    "Check subject-verb agreement",
    "Spelling error",
    "Commonly confused word",
    "Comma after introductory word",
    "Possessive apostrophe",
    "Write in the present tense",
    "Uncountable noun",
    "A one-sentence summary is always insufficient",
    "Do not use 'etc.' at the end of a list",
    "Is this the author's full name?",
    "Is this the correct title?",
    "Add parenthetical citation",
]

OVERALL_CRITICAL_LABELS = list(COHESION_CRITICAL_LABELS)

OVERALL_MODERATE_LABELS = [
    *COHESION_MODERATE_LABELS,
    "Floating quotation",
    "Follow the process for inserting evidence",
    "Explain the significance of evidence",
]

# ────────────────────────────────────────────────────────────────────
# Weak verbs
# ────────────────────────────────────────────────────────────────────

WEAK_VERBS = {
    "show", "shows", "showed", "shown", "showing",
    "use", "uses", "used", "using",
    "demonstrate", "demonstrates", "demonstrated", "demonstrating",
    "emphasize", "emphasizes", "emphasized", "emphasizing",
    "represent", "represents", "represented", "representing",
    "state", "states", "stated", "stating",
    "symbolize", "symbolizes", "symbolized", "symbolizing",
}

WEAK_VERB_FORM_TO_BASE = {
    "show": "show", "shows": "show", "showed": "show", "shown": "show", "showing": "show",
    "use": "use", "uses": "use", "used": "use", "using": "use",
    "demonstrate": "demonstrate", "demonstrates": "demonstrate",
    "demonstrated": "demonstrate", "demonstrating": "demonstrate",
    "emphasize": "emphasize", "emphasizes": "emphasize",
    "emphasized": "emphasize", "emphasizing": "emphasize",
    "represent": "represent", "represents": "represent",
    "represented": "represent", "representing": "represent",
    "state": "state", "states": "state", "stated": "state", "stating": "state",
    "symbolize": "symbolize", "symbolizes": "symbolize",
    "symbolized": "symbolize", "symbolizing": "symbolize",
}

WEAK_STARTERS = {
    "this", "that", "these", "those", "it", "they", "he", "she", "we", "i", "you", "there",
}

SENTENCE_STARTER_SKIPS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "so", "because", "since", "as",
    "while", "when", "after", "before", "though", "although", "however", "therefore", "thus",
    "moreover", "furthermore", "additionally", "also", "likewise", "similarly", "from", "into",
    "onto", "with", "within", "without", "of", "to", "in", "on", "at", "by", "for", "about",
    "over", "under", "between", "through", "during", "is", "are", "was", "were", "be", "been",
    "being", "am", "have", "has", "had", "do", "does", "did", "doing", "that", "this", "these",
    "those", "it", "its", "their", "they", "them", "he", "she", "his", "her", "we", "our", "us",
    "you", "your", "i", "me", "my", "mine", "yours", "ours", "theirs", "not", "no", "yes",
    "can", "could", "would", "should", "may", "might", "must", "will", "just", "very", "really",
    "more", "most", "less", "least", "such", "than", "too", "each", "every", "some", "any",
    "all", "both", "either", "neither", "nor", "own", "same", "other", "another", "there",
    "here", "then", "now", "who", "whom", "which", "what", "where", "why", "how", "up", "down",
    "out", "off", "again", "further", "once",
}

STOP_WORDS = SENTENCE_STARTER_SKIPS | {
    "essay", "text", "story", "novel", "poem", "poetry", "author", "writer", "reader",
    "audience", "character", "quote", "quotation", "example", "evidence", "paragraph",
    "sentence", "chapter",
}

TRANSITION_STARTS = {
    "however", "therefore", "thus", "moreover", "furthermore", "additionally", "also",
    "likewise", "similarly", "instead", "meanwhile", "consequently", "finally", "overall",
    "nevertheless",
}

# ────────────────────────────────────────────────────────────────────
# Helper functions (ported from JS)
# ────────────────────────────────────────────────────────────────────

_WORD_RE = re.compile(r"[a-z']+")
_HEADER_WORD_RE = re.compile(
    r"\b(teacher|class|block|period|assignment|name|date)\b", re.IGNORECASE
)
_MONTH_RE = re.compile(
    r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
    re.IGNORECASE,
)
_SENTENCE_END_RE = re.compile(r'[.!?]["\'\u201D\u2019)]*\s*$')
_ABBREV_END_RE = re.compile(r"(?:\b[A-Z]\.|(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs)\.)$")
_SHORT_QUOTE_RE = re.compile(r'"[^"]{2,140}"')
_TITLE_SMALL_WORDS = {
    "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet",
    "of", "in", "on", "at", "by", "to", "up", "from", "into", "onto", "over", "under",
    "with", "within", "without", "about", "between", "before", "after", "as", "than", "via",
}


def _clamp(val, lo, hi):
    return min(max(val, lo), hi)


def _normalize_typography(text: str) -> str:
    t = str(text or "")
    t = t.replace("\u201C", '"').replace("\u201D", '"')
    t = t.replace("\u2018", "'").replace("\u2019", "'")
    t = t.replace("\u2014", "-").replace("\u2013", "-")
    return t


def _normalize_typography_preserve_paragraphs(text: str) -> str:
    t = _normalize_typography(text)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    return t


def _strip_quoted_text(text: str) -> str:
    return re.sub(r'"[^"]+"', " ", str(text or ""))


def _tokenize_words(text: str) -> list[str]:
    return [m for m in _WORD_RE.findall(str(text or "").lower()) if m]


def _split_paragraphs_simple(text: str) -> list[str]:
    t = _normalize_typography_preserve_paragraphs(text)
    return [p.strip() for p in re.split(r"\n\s*\n+", t) if p.strip()]


def _has_sentence_ending(paragraph: str) -> bool:
    return bool(_SENTENCE_END_RE.search(str(paragraph or "").strip()))


def _get_word_count(paragraph: str) -> int:
    return len(_tokenize_words(paragraph))


def _is_header_like_paragraph(paragraph: str) -> bool:
    wc = _get_word_count(paragraph)
    if wc > 12:
        return False
    if _has_sentence_ending(paragraph):
        return False
    text = str(paragraph or "")
    if wc <= 3:
        return True
    return bool(re.search(r"\d", text) or _MONTH_RE.search(text) or _HEADER_WORD_RE.search(text))


def _looks_like_title(text: str) -> bool:
    trimmed = str(text or "").strip()
    if _has_sentence_ending(trimmed):
        return False
    words = trimmed.split()
    if not words or len(words) > 40:
        return False
    if len(words) <= 5:
        return True
    if re.match(r'^"[^"]+"\s*:?\s+.+"[^"]+"', trimmed):
        return True
    caps = 0
    sig = 0
    for i, w in enumerate(words):
        clean = re.sub(r"^[^a-zA-Z]+", "", w)
        if not clean:
            continue
        if i > 0 and clean.lower() in _TITLE_SMALL_WORDS:
            continue
        sig += 1
        if clean[0].isupper():
            caps += 1
    return sig >= 2 and (caps / sig) >= 0.5


def _strip_leading_header_paragraphs(paragraphs: list[str]):
    idx = 0
    removed = 0
    while idx < len(paragraphs) and removed < 6:
        if not _is_header_like_paragraph(paragraphs[idx]):
            break
        idx += 1
        removed += 1

    stripped = paragraphs[idx:]
    kept_indices = list(range(idx, len(paragraphs)))

    if len(stripped) >= 2:
        first, second = stripped[0], stripped[1]
        if _looks_like_title(first) and _get_word_count(second) >= 20:
            stripped = stripped[1:]
            kept_indices = kept_indices[1:]

    return stripped, kept_indices, removed


def _split_sentences_simple(text: str) -> list[str]:
    raw = [s.strip() for s in re.split(r"(?<=[.!?])\s+", _normalize_typography(text)) if s.strip()]
    merged = []
    for frag in raw:
        if merged and _ABBREV_END_RE.search(merged[-1]):
            merged[-1] += " " + frag
        else:
            merged.append(frag)
    return merged


def _get_sentence_starter_word(sentence: str) -> str:
    tokens = _tokenize_words(sentence)
    if not tokens:
        return ""
    idx = 0
    while idx < len(tokens) and tokens[idx] in SENTENCE_STARTER_SKIPS:
        idx += 1
    return tokens[idx] if idx < len(tokens) else tokens[0]


def _count_short_quotes_in_paragraph(paragraph: str) -> int:
    return len(_SHORT_QUOTE_RE.findall(str(paragraph or "")))


def _count_sentences_with_quotes(sentences: list[str]) -> int:
    return sum(1 for s in sentences if _count_short_quotes_in_paragraph(s) > 0)


def _get_essay_paragraphs_for_variety(text: str):
    raw = _split_paragraphs_simple(text)
    stripped, kept_indices, removed = _strip_leading_header_paragraphs(raw)
    filtered = []
    filtered_indices = []
    for i, para in enumerate(stripped):
        if _get_word_count(para) < 5:
            continue
        filtered.append(para)
        filtered_indices.append(kept_indices[i])
    return raw, stripped, kept_indices, filtered, filtered_indices


def _get_body_paragraph_indices(paragraphs: list) -> list[int]:
    n = len(paragraphs)
    if n >= 4:
        return list(range(1, n - 1))
    if n == 3:
        return [1]
    return list(range(n))


def _sum_label_counts(labels: list[str], counts: dict) -> int:
    return sum(int(counts.get(l, 0) or 0) for l in labels)


def _sum_label_counts_deduped(labels: list[str], counts: dict, cap: int = 2) -> int:
    """Sum label counts but cap each individual label type at *cap* hits.

    This prevents a single repeated issue (e.g. 'people' flagged 5×)
    from compounding into an outsized penalty.
    """
    return sum(min(int(counts.get(l, 0) or 0), cap) for l in labels)


def _capped_penalty(count: int, per_issue: float, cap: float) -> float:
    total = 0.0
    for i in range(count):
        total += per_issue * (0.85 ** i)
    return min(total, cap)


def _power_verb_target_for_word_count(wc: int) -> int:
    n = int(wc or 0)
    if n < 200:
        return 0
    if n <= 500:
        return 5
    if n <= 800:
        return 10
    return 10 + 5 * math.ceil((n - 800) / 300)


def _is_the_use_of(words: list[str], idx: int) -> bool:
    if words[idx] not in ("use", "uses"):
        return False
    return (idx > 0 and words[idx - 1] == "the" and
            idx + 1 < len(words) and words[idx + 1] == "of")


# Compound-noun phrases where "use" is a noun, not a weak verb.
# Covers both "use value" and "land use" patterns.
_USE_NOUN_AFTER = {"value", "values", "case", "cases", "rights"}
_USE_NOUN_BEFORE = {"land", "drug", "substance", "water", "energy", "resource", "exchange"}


def _is_use_noun_compound(words: list[str], idx: int) -> bool:
    """Return True when 'use'/'uses' is part of a noun compound like
    'use value', 'land use', 'substance use', etc."""
    w = words[idx]
    if w not in ("use", "uses"):
        return False
    # "use value", "use case", etc.
    if idx + 1 < len(words) and words[idx + 1] in _USE_NOUN_AFTER:
        return True
    # "land use", "drug use", etc.
    if idx > 0 and words[idx - 1] in _USE_NOUN_BEFORE:
        return True
    return False


def _is_state_noun(words: list[str], idx: int) -> bool:
    w = words[idx]
    if w not in ("state", "states"):
        return False
    if idx + 1 < len(words) and words[idx + 1] == "of":
        return True
    if idx > 0 and words[idx - 1] == "united":
        return True
    return False


# ── Lightweight suffix stemmer ──

_IRREGULARS = {"children": "child", "women": "woman", "men": "man", "people": "person", "mice": "mouse"}


def _stem_token(word: str) -> str:
    if len(word) <= 3:
        return word
    if word in _IRREGULARS:
        return _IRREGULARS[word]
    w = word
    # inflectional suffixes
    if w.endswith("ies") and len(w) > 4:
        w = w[:-3] + "y"
    elif w.endswith("ves") and not w.endswith("ives") and 4 < len(w) <= 7:
        w = w[:-3] + "f"
    elif (w.endswith("ches") or w.endswith("shes") or w.endswith("xes")) and len(w) > 5:
        w = w[:-2]
    elif w.endswith("ses") and not w.endswith("ises") and len(w) > 5:
        w = w[:-2]
    elif w.endswith("s") and not w.endswith("ss") and len(w) > 4:
        w = w[:-1]

    if w.endswith("ing") and len(w) > 5:
        w = w[:-3]
        if len(w) > 2 and w[-1] == w[-2]:
            w = w[:-1]
    if w.endswith("ed") and len(w) > 4:
        w = w[:-2]
        if len(w) > 2 and w[-1] == w[-2]:
            w = w[:-1]

    # derivational suffixes
    if w.endswith("ly") and len(w) > 5:
        w = w[:-2]
    if w.endswith("ment") and len(w) > 7:
        w = w[:-4]
    if w.endswith("ness") and len(w) > 7:
        w = w[:-4]
    if w.endswith("al") and len(w) > 5:
        w = w[:-2]
    if w.endswith("ful") and len(w) > 6:
        w = w[:-3]
    if w.endswith("ous") and len(w) > 6:
        w = w[:-3]
    if w.endswith("ive") and len(w) > 6:
        w = w[:-3]
    if w.endswith("ize") and len(w) > 6:
        w = w[:-3]
    return w


def _normalize_token(token: str) -> str:
    t = str(token or "").lower()
    t = re.sub(r"'s$", "", t).replace("'", "")
    return _stem_token(t)


def _content_tokens(sentence: str) -> list[str]:
    tokens = [_normalize_token(w) for w in _tokenize_words(sentence)]
    return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]


# ────────────────────────────────────────────────────────────────────
# Thesis devices
# ────────────────────────────────────────────────────────────────────

def parse_thesis_devices_lexicon(text: str) -> dict[str, str]:
    entries = {}
    for line in str(text or "").split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",", 1)
        term = parts[0].strip().lower()
        canonical = parts[1].strip().lower() if len(parts) > 1 and parts[1].strip() else term
        if term:
            entries[term] = canonical
    return entries


def _get_canonical_devices_in_paragraph(paragraph: str, lexicon: dict) -> set[str]:
    if not lexicon:
        return set()
    text = str(paragraph or "").lower()
    devices = set()
    for term, canonical in lexicon.items():
        if not term:
            continue
        is_single = bool(re.match(r"^[a-z0-9]+$", term, re.IGNORECASE))
        escaped = re.escape(term)
        if is_single:
            pattern = rf"\b{escaped}\b"
        else:
            pattern = rf"(?:^|\W){escaped}(?:$|\W)"
        if re.search(pattern, text, re.IGNORECASE):
            devices.add(canonical)
    return devices


# ────────────────────────────────────────────────────────────────────
# Cohesion computation
# ────────────────────────────────────────────────────────────────────

def _compute_cohesion_paragraph_aware(paragraphs, original_indices):
    details = {
        "sentenceBoundaryHits": 0,
        "sentenceBoundaryDenom": 0,
        "paragraphBoundaryHits": 0,
        "paragraphBoundaryDenom": 0,
        "transitionsWithinCount": 0,
        "transitionsWithinUnique": 0,
        "paragraphStartTransitionsCount": 0,
        "issues": {
            "weakTransitions": [],
            "paragraphBoundaryMisses": [],
            "sentenceBoundaryMisses": [],
        },
    }

    seen_transitions = set()
    sentence_tokens_list = []
    sentence_texts = []
    sentence_paragraph_index = []
    first_para_orig_idx = original_indices[0] if original_indices else 0

    for para_idx, para in enumerate(paragraphs):
        orig_idx = original_indices[para_idx] if para_idx < len(original_indices) else para_idx
        sentences = _split_sentences_simple(para)
        for sentence in sentences:
            tokens = _content_tokens(sentence)
            sentence_tokens_list.append(tokens)
            sentence_texts.append(sentence)
            sentence_paragraph_index.append(orig_idx)
            if tokens:
                starter = tokens[0]
                if starter in TRANSITION_STARTS:
                    details["transitionsWithinCount"] += 1
                    if starter not in seen_transitions:
                        seen_transitions.add(starter)
                        details["transitionsWithinUnique"] += 1
                    elif para_idx > 0:
                        details["issues"]["weakTransitions"].append({
                            "reason": "Repeated transition",
                            "token": starter,
                            "sentence": sentence,
                            "paragraph_index": orig_idx,
                        })

    # Sentence boundary hits
    for i in range(len(sentence_tokens_list) - 1):
        if sentence_paragraph_index[i] != sentence_paragraph_index[i + 1]:
            continue
        if sentence_paragraph_index[i] == first_para_orig_idx:
            continue
        details["sentenceBoundaryDenom"] += 1
        left = set(sentence_tokens_list[i])
        right = sentence_tokens_list[i + 1]
        if any(t in left for t in right):
            details["sentenceBoundaryHits"] += 1
        else:
            details["issues"]["sentenceBoundaryMisses"].append({
                "sentence": sentence_texts[i + 1],
                "paragraph_index": sentence_paragraph_index[i + 1],
            })

    # Paragraph boundary hits
    for i in range(len(paragraphs) - 1):
        if i == 0:
            continue
        last_sent = (_split_sentences_simple(paragraphs[i]) or [""])[-1]
        first_sent = (_split_sentences_simple(paragraphs[i + 1]) or [""])[0]
        left = set(_content_tokens(last_sent))
        right = _content_tokens(first_sent)
        details["paragraphBoundaryDenom"] += 1
        if any(t in left for t in right):
            details["paragraphBoundaryHits"] += 1
        else:
            orig_i = original_indices[i + 1] if i + 1 < len(original_indices) else i + 1
            details["issues"]["paragraphBoundaryMisses"].append({
                "sentence": first_sent,
                "paragraph_index": orig_i,
            })

    sent_rate = (details["sentenceBoundaryHits"] / details["sentenceBoundaryDenom"]
                 if details["sentenceBoundaryDenom"] else 0)
    para_rate = (details["paragraphBoundaryHits"] / details["paragraphBoundaryDenom"]
                 if details["paragraphBoundaryDenom"] else 0)
    transition_bonus = min(details["transitionsWithinUnique"] * 3, 15)
    raw = 100 * (0.75 * sent_rate + 0.25 * para_rate) + transition_bonus
    sent_floor = round(sent_rate * 55)
    score = _clamp(round(max(raw, sent_floor)), 0, 100)

    return score, details


# ────────────────────────────────────────────────────────────────────
# Score ceiling
# ────────────────────────────────────────────────────────────────────

def get_score_ceiling(label_counts: dict) -> int:
    if not label_counts:
        return 100
    has_critical = any((int(label_counts.get(l, 0) or 0)) > 0 for l in OVERALL_CRITICAL_LABELS)
    if has_critical:
        return 69
    has_moderate = any((int(label_counts.get(l, 0) or 0)) > 0 for l in OVERALL_MODERATE_LABELS)
    if has_moderate:
        return 79
    return 100


# ────────────────────────────────────────────────────────────────────
# Power verbs loader
# ────────────────────────────────────────────────────────────────────

_POWER_VERB_FORMS_CACHE: set[str] | None = None


def _to_base_form(verb: str) -> str:
    """Reverse 3rd-person singular to base form (mirrors frontend toBaseForm)."""
    v = verb.lower().strip()
    if not v:
        return v
    if v.endswith("ies") and len(v) > 4:
        return v[:-3] + "y"
    if v.endswith("sses"):
        return v[:-2]
    if v.endswith("shes"):
        return v[:-2]
    if v.endswith("ches"):
        return v[:-2]
    if v.endswith("xes"):
        return v[:-2]
    if v.endswith("zzes"):
        return v[:-2]
    if v.endswith("s") and len(v) > 2:
        return v[:-1]
    return v


# Words with stressed final syllable that double the consonant
_STRESSED_FINAL = {
    "admit", "commit", "embed", "upset", "abet", "befit", "begin", "compel",
    "confer", "defer", "deter", "excel", "expel", "forget", "incur", "infer",
    "occur", "omit", "patrol", "permit", "prefer", "propel", "rebel", "recur",
    "refer", "regret", "remit", "repel", "submit", "transfer", "transmit",
}
_VOWELS = set("aeiou")


def _should_double(base: str) -> bool:
    if len(base) < 3:
        return False
    last, penult, ante = base[-1], base[-2], base[-3]
    if last not in "bcdfghjklmnpqrstvwxyz" or penult not in _VOWELS or ante in _VOWELS:
        return False
    if last in ("w", "x", "y"):
        return False
    if len(base) <= 4:
        return True
    return base in _STRESSED_FINAL


def _conjugate_verb_forms(base: str) -> list[str]:
    """Generate common conjugations from a base verb (mirrors frontend conjugateVerb)."""
    forms = [base]
    # -s (3rd person singular)
    if base.endswith("y") and len(base) > 2 and base[-2] not in _VOWELS:
        forms.append(base[:-1] + "ies")
    elif base.endswith(("s", "sh", "ch", "x", "z")):
        forms.append(base + "es")
    else:
        forms.append(base + "s")
    # -ing (present participle)
    if base.endswith("ie"):
        forms.append(base[:-2] + "ying")
    elif base.endswith("ee"):
        forms.append(base + "ing")
    elif base.endswith("e") and len(base) > 2:
        forms.append(base[:-1] + "ing")
    elif _should_double(base):
        forms.append(base + base[-1] + "ing")
    else:
        forms.append(base + "ing")
    # -ed (past tense)
    if base.endswith("e"):
        forms.append(base + "d")
    elif base.endswith("y") and len(base) > 2 and base[-2] not in _VOWELS:
        forms.append(base[:-1] + "ied")
    elif _should_double(base):
        forms.append(base + base[-1] + "ed")
    else:
        forms.append(base + "ed")
    return forms


def _load_power_verb_forms() -> set[str]:
    global _POWER_VERB_FORMS_CACHE
    if _POWER_VERB_FORMS_CACHE is not None:
        return _POWER_VERB_FORMS_CACHE
    forms = set()
    try:
        path = os.path.join(os.path.dirname(__file__), "power_verbs_2025.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict):
                    verb = entry.get("verb")
                    if verb:
                        v = str(verb).lower()
                        forms.add(v)
                        base = _to_base_form(v)
                        for f_form in _conjugate_verb_forms(base):
                            forms.add(f_form)
                    for form in entry.get("forms", []):
                        forms.add(str(form).lower())
        elif isinstance(data, dict):
            for _verb, info in data.items():
                v = str(_verb).lower()
                forms.add(v)
                base = _to_base_form(v)
                for f_form in _conjugate_verb_forms(base):
                    forms.add(f_form)
                if isinstance(info, dict):
                    for form in info.get("forms", []):
                        forms.add(str(form).lower())
                elif isinstance(info, list):
                    for form in info:
                        forms.add(str(form).lower())
    except Exception:
        pass
    _POWER_VERB_FORMS_CACHE = forms
    return forms


# Thesis devices loader
_THESIS_DEVICES_CACHE: dict[str, str] | None = None


def _load_thesis_devices_lexicon() -> dict[str, str]:
    global _THESIS_DEVICES_CACHE
    if _THESIS_DEVICES_CACHE is not None:
        return _THESIS_DEVICES_CACHE
    try:
        path = os.path.join(os.path.dirname(__file__), "thesis_devices.txt")
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        _THESIS_DEVICES_CACHE = parse_thesis_devices_lexicon(text)
    except Exception:
        _THESIS_DEVICES_CACHE = {}
    return _THESIS_DEVICES_CACHE


# ────────────────────────────────────────────────────────────────────
# Main scoring function
# ────────────────────────────────────────────────────────────────────

def compute_scores(
    text: str,
    mode: str = "",
    *,
    label_counts: dict | None = None,
    mark_event_id: str | None = None,
    sentence_types: dict | None = None,
    repeated_nouns: list | None = None,
) -> dict:
    """Compute Power, Variety, Cohesion, Precision scores from essay text and metadata.

    Returns a dict matching the shape the frontend expects:
    {
        "power":     { "score": int, "details": {...} },
        "variety":   { "score": int, "details": {...} },
        "cohesion":  { "score": int, "details": {...} },
        "precision": { "score": int|None, "details": {...} },
        "meta":      { "paragraphs": int, "sentences": int, "mode": str },
        "ceiling":   int,
    }
    """
    power_verb_forms = _load_power_verb_forms()
    thesis_devices_lex = _load_thesis_devices_lexicon()
    counts = label_counts if isinstance(label_counts, dict) else {}
    has_precision_counts = bool(counts)
    _sent_types = sentence_types if isinstance(sentence_types, dict) else {}

    clean_for_cohesion = _normalize_typography_preserve_paragraphs(text or "")
    clean_for_counts = _strip_quoted_text(_normalize_typography(text or ""))
    clean_lower = re.sub(r"\s+", " ", clean_for_counts.lower()).strip()
    words = _tokenize_words(clean_lower)
    total_words = len(words)

    # ── Weak verbs ──
    weak_by_base = {"show": 0, "use": 0, "demonstrate": 0, "emphasize": 0,
                    "represent": 0, "state": 0, "symbolize": 0}
    weak_count = 0
    for i, w in enumerate(words):
        if w not in WEAK_VERBS:
            continue
        if _is_the_use_of(words, i):
            continue
        if _is_use_noun_compound(words, i):
            continue
        if _is_state_noun(words, i):
            continue
        weak_count += 1
        base = WEAK_VERB_FORM_TO_BASE.get(w)
        if base and base in weak_by_base:
            weak_by_base[base] += 1

    # ── Power verbs ──
    power_target = _power_verb_target_for_word_count(total_words)
    power_count = 0
    if power_verb_forms and power_target > 0:
        uniq = set()
        for w in words:
            if w in WEAK_VERBS:
                continue
            if w in power_verb_forms:
                uniq.add(w)
        power_count = len(uniq)

    max_credited = max(math.ceil(total_words / 80), power_target) if total_words > 0 else 0
    credited_power = min(power_count, max_credited) if power_target > 0 else power_count
    weak_rate_per_100 = (weak_count / total_words) * 100 if total_words else 0

    # ── Paragraph analysis ──
    raw_paragraphs, stripped_paragraphs, kept_indices, filtered_paragraphs, filtered_indices = \
        _get_essay_paragraphs_for_variety(clean_for_cohesion)

    # ── Repeated nouns ──
    repeated_nouns_list = repeated_nouns or []
    active_repeated_nouns = []
    if repeated_nouns_list and words:
        thesis_words = set()
        if len(filtered_paragraphs) >= 2:
            intro = filtered_paragraphs[0]
            intro_sents = _split_sentences_simple(intro)
            if len(intro_sents) >= 2:
                thesis = intro_sents[-1].lower()
                thesis_words = set(_tokenize_words(thesis))

        word_freq: dict[str, int] = {}
        for w in words:
            word_freq[w] = word_freq.get(w, 0) + 1

        for noun in repeated_nouns_list:
            lemma = str(noun.get("lemma", "")).lower()
            forms = {lemma} | {f.lower() for f in noun.get("forms", [])}
            if any(f in thesis_words for f in forms):
                continue
            total = sum(word_freq.get(f, 0) for f in forms)
            if total >= 3:
                active_repeated_nouns.append({**noun, "activeCount": total})

    repetition_count = len(active_repeated_nouns)

    # ── Power score ──
    weak_score = _clamp(round(100 - weak_rate_per_100 * 8), 0, 100)
    power_verb_score = (
        100 if power_target == 0
        else _clamp(round((credited_power / power_target) * 100), 0, 100)
    )
    repetition_penalty = _capped_penalty(max(0, repetition_count - 2), 4, 15)
    power_score = _clamp(round(weak_score * 0.6 + power_verb_score * 0.4 - repetition_penalty), 0, 100)

    # ── Sentence analysis ──
    paragraphs = filtered_paragraphs
    paragraph_sentences = [_split_sentences_simple(p) for p in paragraphs]
    all_sentences = [s for sents in paragraph_sentences for s in sents]
    total_sentence_count = len(all_sentences)

    body_indices = _get_body_paragraph_indices(paragraphs)
    body_preview_indices = [filtered_indices[i] for i in body_indices
                           if i < len(filtered_indices) and isinstance(filtered_indices[i], int)]
    body_paragraphs = [paragraphs[i] for i in body_indices if i < len(paragraphs)]
    body_count = len(body_paragraphs)
    intro_preview_index = filtered_indices[0] if filtered_indices else 0

    technique_failures = []
    evidence_dev_failures = []
    weak_start_sentences = []
    technique_ok = 0
    evidence_dev_ok = 0
    weak_start_count = 0
    techniques_available = bool(thesis_devices_lex)

    for idx_in_body, para in enumerate(body_paragraphs):
        para_index = body_indices[idx_in_body]
        sents = paragraph_sentences[para_index] if para_index < len(paragraph_sentences) else []
        sent_count = len(sents)
        sents_with_evidence = _count_sentences_with_quotes(sents)
        has_evidence = sents_with_evidence >= 2
        is_developed = sent_count >= 4
        if has_evidence and is_developed:
            evidence_dev_ok += 1
        else:
            evidence_dev_failures.append(para_index)

        if techniques_available:
            canonical = _get_canonical_devices_in_paragraph(para, thesis_devices_lex)
            if len(canonical) >= 3:
                technique_ok += 1
            else:
                technique_failures.append(para_index)

    if not techniques_available:
        technique_ok = body_count

    failing_tech_preview = [filtered_indices[i] for i in technique_failures
                            if i < len(filtered_indices) and isinstance(filtered_indices[i], int)]
    failing_ev_preview = [filtered_indices[i] for i in evidence_dev_failures
                          if i < len(filtered_indices) and isinstance(filtered_indices[i], int)]

    # ── Structure analysis ──
    structure_failures = []
    structure_ok = 0
    for para_index in body_indices:
        orig_para_index = filtered_indices[para_index] if para_index < len(filtered_indices) else para_index
        sents = paragraph_sentences[para_index] if para_index < len(paragraph_sentences) else []
        weak_in_para = 0
        for sentence in sents:
            starter = _get_sentence_starter_word(sentence)
            if starter and starter in WEAK_STARTERS:
                weak_in_para += 1
                weak_start_count += 1
                weak_start_sentences.append({"sentence": sentence, "paragraph_index": orig_para_index})

        para_types = (_sent_types.get(str(orig_para_index)) or
                      _sent_types.get(orig_para_index) or [])
        para_types_str = [
            (entry if isinstance(entry, str) else (entry.get("type", "simple") if isinstance(entry, dict) else "simple"))
            for entry in para_types
        ]
        all_simple = len(para_types_str) >= 3 and all(t == "simple" for t in para_types_str)

        if weak_in_para > 1 or all_simple:
            structure_failures.append(orig_para_index)
        else:
            structure_ok += 1

    # ── Variety score ──
    tech_ratio = technique_ok / body_count if body_count else 1
    evidence_dev_ratio = evidence_dev_ok / body_count if body_count else 1
    structure_ratio = structure_ok / body_count if body_count else 1
    variety_base = round(100 * (0.40 * tech_ratio + 0.45 * evidence_dev_ratio + 0.15 * structure_ratio))
    dev_count = _sum_label_counts(DEVELOPMENT_LABELS, counts) if has_precision_counts else 0
    dev_count_dd = _sum_label_counts_deduped(DEVELOPMENT_LABELS, counts, cap=2) if has_precision_counts else 0
    dev_penalty = _capped_penalty(dev_count, 5, 20)
    variety_score = _clamp(round(variety_base - dev_penalty), 0, 100)

    # ── Cohesion score ──
    cohesion_raw, cohesion_details = _compute_cohesion_paragraph_aware(paragraphs, filtered_indices)
    crit_coh = _sum_label_counts(COHESION_CRITICAL_LABELS, counts) if has_precision_counts else 0
    mod_coh = _sum_label_counts(COHESION_MODERATE_LABELS, counts) if has_precision_counts else 0
    minor_coh = _sum_label_counts(COHESION_MINOR_LABELS, counts) if has_precision_counts else 0
    crit_coh_pen = _capped_penalty(crit_coh, 8, 25)
    mod_coh_pen = _capped_penalty(mod_coh, 4, 12)
    minor_coh_pen = _capped_penalty(minor_coh, 2, 6)
    cohesion_score = _clamp(round(cohesion_raw - crit_coh_pen - mod_coh_pen - minor_coh_pen), 0, 100)

    # ── Precision score ──
    precision_score = None
    precision_details = {
        "concisionCount": 0, "clarityCount": 0, "unnecessaryCount": 0,
        "wordyCount": 0, "impreciseCount": 0, "conventionsCount": 0,
        "hasCounts": False,
    }
    if has_precision_counts:
        # Raw totals (for display / detail reporting)
        concision = _sum_label_counts(CONCISION_LABELS, counts)
        clarity = _sum_label_counts(CLARITY_LABELS, counts)
        unnecessary = _sum_label_counts(UNNECESSARY_LABELS, counts)
        wordy = _sum_label_counts(WORDY_LABELS, counts)
        imprecise = _sum_label_counts(IMPRECISE_LABELS, counts)
        conventions = _sum_label_counts(CONVENTIONS_LABELS, counts)

        # ── Fix 1: De-duplicate — cap each label type at 2 hits ──
        # Prevents a single repeated word (e.g. 'people' × 5) from
        # compounding into an outsized penalty.
        concision_dd = _sum_label_counts_deduped(CONCISION_LABELS, counts, cap=2)
        clarity_dd = _sum_label_counts_deduped(CLARITY_LABELS, counts, cap=2)
        conventions_dd = _sum_label_counts_deduped(CONVENTIONS_LABELS, counts, cap=2)

        # ── Fix 2: Lower per-issue weights ──
        # Old: concision 4/25, clarity 4/25, conventions 3/15  (total cap 65)
        # New: concision 2.5/15, clarity 2/18, conventions 2/10 (total cap 43)
        penalty = (_capped_penalty(concision_dd, 2.5, 15)
                   + _capped_penalty(clarity_dd, 2, 18)
                   + _capped_penalty(conventions_dd, 2, 10))

        # ── Fix 3: Blend in positive signals ──
        # Power verb usage rewards strong language choices (up to +5 pts)
        pv_bonus = 0.0
        if power_target > 0:
            pv_ratio = min(credited_power / power_target, 1.0)
            pv_bonus = round(pv_ratio * 5, 1)

        # Sentence variety rewards structural sophistication (up to +5 pts)
        variety_bonus = round(min(variety_base / 100, 1.0) * 5, 1)

        precision_score = _clamp(round(100 - penalty + pv_bonus + variety_bonus), 0, 100)
        # Don't let bonuses push score to 100 while deduped issues remain —
        # dots use deduped counts, so score and dots must agree.
        if precision_score == 100 and (concision_dd + clarity_dd + conventions_dd) > 0:
            precision_score = 99
        precision_details = {
            "concisionCount": concision_dd, "clarityCount": clarity_dd,
            "unnecessaryCount": unnecessary, "wordyCount": wordy,
            "impreciseCount": imprecise, "conventionsCount": conventions_dd,
            "penalty": round(penalty, 1),
            "powerVerbBonus": pv_bonus,
            "varietyBonus": variety_bonus,
            "hasCounts": True,
        }

    ceiling = get_score_ceiling(counts)

    return {
        "power": {
            "score": power_score,
            "sub": "",
            "details": {
                "weakCount": weak_count,
                "weakByBase": weak_by_base,
                "powerCount": power_count,
                "powerTarget": power_target,
                "repetitionCount": repetition_count,
                "repeatedNouns": active_repeated_nouns,
            },
        },
        "variety": {
            "score": variety_score,
            "sub": "",
            "details": {
                "totalOriginalParagraphs": len(raw_paragraphs),
                "bodyParagraphCount": body_count,
                "bodyParagraphIndices": body_indices,
                "bodyParagraphAnalyzedIndices": body_indices,
                "bodyParagraphPreviewIndices": body_preview_indices,
                "introPreviewIndex": intro_preview_index,
                "techniqueOkCount": technique_ok,
                "techniqueFailures": technique_failures,
                "failingTechniquesParagraphPreviewIndices": failing_tech_preview,
                "evidenceDevOkCount": evidence_dev_ok,
                "evidenceDevFailures": evidence_dev_failures,
                "failingEvidenceDevParagraphPreviewIndices": failing_ev_preview,
                "structureOkCount": structure_ok,
                "structureFailures": structure_failures,
                "weakStartCount": weak_start_count,
                "weakStartSentences": weak_start_sentences,
                "sentenceTypes": _sent_types,
                "totalSentenceCount": total_sentence_count,
                "techniquesUnavailable": not techniques_available,
                "developmentCount": dev_count_dd,
                "developmentPenalty": dev_penalty,
            },
        },
        "cohesion": {
            "score": cohesion_score,
            "sub": "",
            "details": {
                **cohesion_details,
                "paragraphLabelCount": crit_coh + mod_coh,
                "transitionLabelCount": minor_coh,
                "paragraphLabelPenalty": crit_coh_pen + mod_coh_pen,
                "transitionLabelPenalty": minor_coh_pen,
                "criticalCohesionCount": crit_coh,
                "moderateCohesionCount": mod_coh,
                "minorCohesionCount": minor_coh,
                "criticalCohesionPenalty": crit_coh_pen,
                "moderateCohesionPenalty": mod_coh_pen,
                "minorCohesionPenalty": minor_coh_pen,
            },
        },
        "precision": {
            "score": precision_score,
            "sub": "",
            "details": precision_details,
        },
        "meta": {
            "paragraphs": len(raw_paragraphs),
            "sentences": total_sentence_count,
            "mode": mode or "",
        },
        "ceiling": ceiling,
    }
