#!/usr/bin/env python3

import sys

from docx import Document



QUOTE_MAP = {

    "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',

    "\u2018": '"', "\u2019": '"', "\u201A": '"', "\u201B": '"',

    "\u00AB": '"', "\u00BB": '"', "\u2039": '"', "\u203A": '"',

}

ZERO_WIDTH = {"\u200B": "", "\u200C": "", "\u200D": "", "\uFEFF": ""}

DASH_MAP = { "—": "-", "–": "-" }



def normalize_text(t):

    if not t:

        return t

    out = t.replace("\u00A0", " ")

    for bad, good in QUOTE_MAP.items():

        out = out.replace(bad, good)

    for bad, good in ZERO_WIDTH.items():

        out = out.replace(bad, good)

    for bad, good in DASH_MAP.items():

        out = out.replace(bad, good)

    return out



def preprocess_docx(input_path, output_path):

    doc = Document(input_path)

    for p in doc.paragraphs:

        for run in p.runs:

            run.text = normalize_text(run.text)

    doc.save(output_path)



if __name__ == "__main__":

    if len(sys.argv) != 3:

        print("Usage: python preprocess_quotes.py input.docx output.docx")

        sys.exit(1)

    preprocess_docx(sys.argv[1], sys.argv[2])

    print("Saved cleaned document:", output_path)

