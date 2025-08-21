import React from "react";
import "../App.css";

export default function Preview({ html }) {
  return (
    <div className="preview-container">
      <div className="preview-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
