import React, { useState } from "react";
import EngineToggle from "./EngineToggle";

export default function CapturePanel() {
  const [emOptions, setEmOptions] = useState(null);
  const [filePath, setFilePath] = useState("");

  const onRun = async () => {
    // pass emOptions only when EM is selected; main.js decides based on settings
    await window.api.processVideo({
      filePath,
      startTime: 0,
      endTime: null,
      emOptions: emOptions || undefined
    });
  };

  return (
    <div>
      {/* your file picker here… */}
      <EngineToggle onChange={setEmOptions} />
      <button onClick={onRun}>Process</button>
    </div>
  );
}
