import React from "react";
import "../App.css";

export default function Preview({ html }) {
  return (
    <div className="preview-container">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
