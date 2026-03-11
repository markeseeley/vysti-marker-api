import { useState } from "react";

/** Suffixes to strip when extracting a family name */
const SUFFIX_RE = /^(jr\.?|sr\.?|senior|junior|ii|iii|iv|v|vi|vii|viii|esq\.?)$/i;

/**
 * Extract the author's family name from a full name string.
 * Strips common suffixes (Jr., III, etc.) and returns the last
 * remaining proper-noun token.
 */
function getLastName(fullName) {
  if (!fullName?.trim()) return null;
  const parts = fullName.trim().split(/\s+/).filter((p) => !SUFFIX_RE.test(p));
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * Thesis outline planner shown at step 2 (Closed Thesis).
 * Devices state is controlled by the parent so it persists
 * when the guide advances to step 3 (Intro Summary).
 */
export default function ThesisPlanner({
  authorName,
  devices = [""],
  onDevicesChange,
}) {
  const [open, setOpen] = useState(false);
  const [argument, setArgument] = useState("");
  const [copied, setCopied] = useState(false);

  const safeDevices = devices && devices.length >= 1 ? devices : [""];

  const updateDevice = (index, value) => {
    const next = [...safeDevices];
    next[index] = value;
    onDevicesChange(next);
  };

  const addDevice = () => {
    if (safeDevices.length < 5) onDevicesChange([...safeDevices, ""]);
  };

  const removeDevice = (index) => {
    if (safeDevices.length <= 1) return;
    const next = safeDevices.filter((_, i) => i !== index);
    onDevicesChange(next);
  };

  const filled = safeDevices.filter((d) => d.trim());
  const lastName = getLastName(authorName);
  const author = lastName || "[Author\u2019s last name]";
  const argText = argument.trim();
  const argPart = argText || "[verb]s [purpose]";

  // Build the device list as plain text
  let deviceStr = "";
  if (filled.length === 1) {
    deviceStr = filled[0];
  } else if (filled.length === 2) {
    deviceStr = `${filled[0]} and ${filled[1]}`;
  } else if (filled.length >= 3) {
    const rest = filled.slice(0, -1);
    deviceStr = `${rest.join(", ")}, and ${filled[filled.length - 1]}`;
  }

  // Plain-text version (for copy)
  const plainText = deviceStr
    ? `Through ${deviceStr}, ${author} ${argPart}.`
    : "";

  // JSX preview (italicizes placeholder parts)
  let preview = null;
  if (deviceStr) {
    preview = (
      <>
        Through {deviceStr}, {author}{" "}
        {argText ? argText : <em>[verb]s [purpose]</em>}.
      </>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select-and-copy not needed for modern browsers
    }
  };

  if (!open) {
    return (
      <button
        className="thesis-planner-toggle"
        onClick={() => setOpen(true)}
      >
        Plan it out?
      </button>
    );
  }

  return (
    <div className="thesis-planner">
      <div className="thesis-planner-header">
        <span className="thesis-planner-label">Outline your thesis</span>
        <button
          className="thesis-planner-close"
          onClick={() => setOpen(false)}
          aria-label="Close planner"
        >
          &times;
        </button>
      </div>

      <div className="thesis-planner-fields">
        {safeDevices.map((val, i) => (
          <div key={i} className="thesis-planner-field thesis-planner-device-row">
            <label className="thesis-planner-field-label">
              Device / Strategy {i + 1}
            </label>
            <div className="thesis-planner-input-row">
              <input
                type="text"
                className="thesis-planner-input"
                name={`thesis-device-${i + 1}`}
                placeholder={
                  i === 0
                    ? "a spatial organization"
                    : i === 1
                      ? "metaphorical analogies"
                      : "an ironic inversion"
                }
                value={val}
                onChange={(e) => updateDevice(i, e.target.value)}
              />
              {safeDevices.length > 1 && (
                <button
                  type="button"
                  className="thesis-planner-remove-device"
                  onClick={() => removeDevice(i)}
                  aria-label={`Remove device ${i + 1}`}
                  title="Remove"
                >&times;</button>
              )}
            </div>
          </div>
        ))}
        {safeDevices.length < 5 && (
          <button
            type="button"
            className="thesis-planner-add-device"
            onClick={addDevice}
          >+ Add device</button>
        )}

        <div className="thesis-planner-field thesis-planner-argument">
          <label className="thesis-planner-field-label">
            Argument
          </label>
          <input
            type="text"
            className="thesis-planner-input"
            name="thesis-argument"
            placeholder="argues to change curricula in hopes of raising reading rates"
            value={argument}
            onChange={(e) => setArgument(e.target.value)}
          />
          <span className="thesis-planner-hint">
            What does the author do, and why?
          </span>
        </div>
      </div>

      {preview && (
        <div className="thesis-planner-preview-wrap">
          <p className="thesis-planner-preview">
            <strong>Preview:</strong> {preview}
          </p>
          <button
            className="thesis-planner-copy"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
