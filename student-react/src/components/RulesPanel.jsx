const RULES = [
  // Left column — Voice & audience
  { section: "Voice & audience", column: "left" },
  {
    key: "allowI", id: "allow_i", column: "left",
    label: "Allow personal pronouns",
    tip: "Allows for the use of personal pronouns like 'I', 'you', 'we', and 'our'."
  },
  {
    key: "allowAudience", id: "allow_audience", column: "left",
    label: "Allow references to the reader or audience",
    tip: "It is only necessary to refer to the reader or the audience of a text when the reader or audience is known or referred to by the text itself."
  },
  // Left column — Argument and evidence
  { section: "Argument and evidence", column: "left" },
  {
    key: "enforceClosedThesis", id: "enforce_closed_thesis", column: "left",
    label: "Require a closed thesis statement",
    tip: "For literary analysis, a closed thesis will contain specified devices or strategies and a clearly stated argument.",
    hideFor: ["foundation_1"]
  },
  {
    key: "requireBodyEvidence", id: "require_body_evidence", column: "left",
    label: "Require quotations in body paragraphs",
    tip: "For literary analysis, it is generally expected that the body paragraphs will contain quotations.",
    hideFor: ["foundation_1", "foundation_2", "foundation_3", "foundation_4"]
  },
  {
    key: "allowIntroQuotes", id: "allow_intro_quotes", column: "left",
    label: "Allow quotations in the introduction",
    tip: "Unless there is an analytic frame, generally quotations are avoided in the introduction."
  },
  {
    key: "allowLongQuotes", id: "allow_long_quotes", column: "left",
    label: "Allow long quotations",
    tip: "The recommended length for a quotation is five words or less."
  },

  // Right column — Style
  { section: "Style", column: "right" },
  {
    key: "allowContractions", id: "allow_contractions", column: "right",
    label: "Allow contractions",
    tip: "Contractions such as 'isn't' or 'can't' are not generally accepted in academic writing."
  },
  {
    key: "allowWhich", id: "allow_which", column: "right",
    label: 'Allow the word "which"',
    tip: "Stylistically, the term 'which' leads to convoluted expressions."
  },
  {
    key: "disableFactRule", id: "disable_fact_rule", column: "right",
    label: 'Allow "fact" and "prove"',
    tip: "In literary analysis, it is rare to claim that anything is 'proven' or 'factual'."
  },
  {
    key: "disableWeakVerbs", id: "disable_weak_verbs", column: "right",
    label: "Disregard weak verbs",
    tip: 'The verbs "show," "use," "make," "do," "get," and "have" will be flagged as weak verbs due to their overuse.'
  },
  {
    key: "disableHumanRule", id: "disable_human_rule", column: "right",
    label: 'Allow vague references to "people"',
    tip: "Avoid using the words 'human', 'people', 'everyone', or 'individual'."
  },
  {
    key: "disableVagueGeneralRule", id: "disable_vague_general_rule", column: "right",
    label: "Allow vague terms",
    tip: "Avoid overly general words like 'society', 'universe', 'reality', 'life', and 'truth'."
  },
  {
    key: "highlightDevices", id: "highlight_devices", column: "right",
    label: "Highlight devices and strategies",
    tip: "(beta) Literary and rhetorical devices as well as modes of discourse will be highlighted in green."
  },
];

export default function RulesPanel({ rules, onChange, mode }) {
  const leftRules = RULES.filter((r) => r.column === "left");
  const rightRules = RULES.filter((r) => r.column === "right");

  const renderColumn = (items) =>
    items.map((item, i) => {
      if (item.section) {
        return (
          <div key={`section-${i}`} className="rules-title" style={i > 0 ? { marginTop: 14 } : undefined}>
            {item.section}
          </div>
        );
      }

      if (item.hideFor?.includes(mode)) return null;

      return (
        <label key={item.key} className="rule-pill" htmlFor={item.id}>
          <input
            type="checkbox"
            id={item.id}
            checked={!!rules[item.key]}
            onChange={(e) => onChange(item.key, e.target.checked)}
          />
          <span className="rule-pill-label">{item.label}</span>
          <span
            className="rule-pill-info tt"
            data-tip={item.tip}
            tabIndex={0}
            aria-label="Rule explanation"
            onClick={(e) => e.preventDefault()}
          >
            i
          </span>
        </label>
      );
    });

  return (
    <section className="card rules-card">
      <div className="rules-cols">
        <div>{renderColumn(leftRules)}</div>
        <div>{renderColumn(rightRules)}</div>
      </div>
    </section>
  );
}
