import { MODES } from "../config";

export default function ModeSelect({ mode, onChange, modes }) {
  const modeList = modes || MODES;
  return (
    <label>
      <span className="label-row mode-select-label-row">
        <span className="visually-hidden">Assignment type</span>
      </span>
      <select
        id="mode"
        value={mode}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Assignment type"
      >
        {modeList.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
