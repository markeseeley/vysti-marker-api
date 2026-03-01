/**
 * Build FormData for the teacher /mark endpoint.
 *
 * Handles the rule inversion logic: teacher UI uses "allow" booleans,
 * but the API expects "enforce/forbid" booleans — often the opposite.
 */

export function buildTeacherFormData({
  file,
  mode,
  rules,
  works,
  studentName,
  assignmentName,
  classId,
}) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);

  if (studentName) fd.append("student_name", studentName);
  if (assignmentName) fd.append("assignment_name", assignmentName.trim());
  if (classId) fd.append("class_id", classId);

  // Works (up to 3)
  if (works?.length > 0) {
    const w1 = works[0];
    if (w1.author) fd.append("author", w1.author);
    if (w1.title) {
      fd.append("title", w1.title);
      fd.append("text_is_minor_work", w1.isMinor ? "true" : "false");
    }
  }
  if (works?.length > 1) {
    const w2 = works[1];
    if (w2.author) fd.append("author2", w2.author);
    if (w2.title) {
      fd.append("title2", w2.title);
      fd.append("text_is_minor_work_2", w2.isMinor ? "true" : "false");
    }
  }
  if (works?.length > 2) {
    const w3 = works[2];
    if (w3.author) fd.append("author3", w3.author);
    if (w3.title) {
      fd.append("title3", w3.title);
      fd.append("text_is_minor_work_3", w3.isMinor ? "true" : "false");
    }
  }

  // Rule inversion: teacher "allow" → API "forbid/enforce"
  const r = rules || {};
  fd.append("forbid_personal_pronouns", r.allowI ? "false" : "true");
  fd.append("forbid_audience_reference", r.allowAudience ? "false" : "true");
  fd.append("enforce_closed_thesis", r.enforceClosedThesis ? "true" : "false");
  fd.append("require_body_evidence", r.requireBodyEvidence ? "true" : "false");
  fd.append("allow_intro_summary_quotes", r.allowIntroQuotes ? "true" : "false");
  fd.append("enforce_intro_quote_rule", r.allowIntroQuotes ? "false" : "true");
  fd.append("enforce_long_quote_rule", r.allowLongQuotes ? "false" : "true");
  fd.append("enforce_contractions_rule", r.allowContractions ? "false" : "true");
  fd.append("enforce_which_rule", r.allowWhich ? "false" : "true");
  fd.append("enforce_weak_verbs_rule", r.disableWeakVerbs ? "false" : "true");
  fd.append("enforce_fact_proof_rule", r.disableFactRule ? "false" : "true");
  fd.append("enforce_human_people_rule", r.disableHumanRule ? "false" : "true");
  fd.append("enforce_vague_terms_rule", r.disableVagueGeneralRule ? "false" : "true");
  fd.append("highlight_thesis_devices", r.highlightDevices ? "true" : "false");

  return fd;
}
