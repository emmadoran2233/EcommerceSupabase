import React, { useEffect, useMemo, useState } from "react";

const MAX_CHAR = 15;
const palette = ["#111827", "#dc2626", "#ea580c", "#0f766e", "#2563eb", "#9333ea"];

const CustomizationModal = ({
  open,
  onClose,
  onSave,
  initialValue,
  saving = false,
}) => {
  const [lines, setLines] = useState(["", "", ""]);
  const [color, setColor] = useState(palette[0]);

  useEffect(() => {
    if (!open) return;
    setLines(initialValue?.lines || ["", "", ""]);
    setColor(initialValue?.color || palette[0]);
  }, [open, initialValue]);

  const hasContent = useMemo(
    () => lines.some((line) => line.trim().length > 0),
    [lines]
  );

  const tooLongLine = useMemo(
    () => lines.find((line) => line.length > MAX_CHAR),
    [lines]
  );

  const disableSave = !hasContent || !!tooLongLine || saving;

  const handleSave = () => {
    if (disableSave) return;
    const payload = {
      lines: lines.map((line) => line.trim()),
      color,
    };
    onSave(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-black"
          aria-label="Close customization dialog"
        >
          ×
        </button>

        <h2 className="text-xl font-semibold mb-4">Customize your product</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx}>
                <label className="text-xs font-medium text-gray-500">
                  Line {idx + 1} (max {MAX_CHAR} chars)
                </label>
                <input
                  value={line}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((val, lineIdx) =>
                        lineIdx === idx ? e.target.value.slice(0, MAX_CHAR + 5) : val
                      )
                    )
                  }
                  className={`mt-1 w-full border px-3 py-2 rounded ${
                    line.length > MAX_CHAR ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="Type here..."
                />
                <p
                  className={`text-xs mt-1 ${
                    line.length > MAX_CHAR ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {line.length}/{MAX_CHAR}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Preview color</p>
              <div className="flex gap-2 flex-wrap">
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border ${
                      color === c ? "border-black scale-105" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-4 text-center min-h-[130px]">
              <p className="text-xs font-medium text-gray-500 mb-2">Live preview</p>
              <div
                className="space-y-1"
                style={{
                  color,
                }}
              >
                {lines.map((line, idx) => (
                  <p key={idx}>{line || "Your text here"}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {tooLongLine && (
          <p className="text-sm text-red-500 mt-4">
            Each line supports up to {MAX_CHAR} characters. Shorten your text to
            continue.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disableSave}
            className={`px-4 py-2 text-sm rounded-md text-white ${
              disableSave ? "bg-gray-400 cursor-not-allowed" : "bg-black"
            }`}
          >
            {saving ? "Saving..." : "Save Customization"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationModal;
