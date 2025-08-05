import React from "react";

export default function Editor({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", height: "200px", fontFamily: "Arial", fontSize: "14px" }}
    />
  );
}