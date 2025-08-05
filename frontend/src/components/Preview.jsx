import React from "react";

export default function Preview({ html }) {
  return (
    <div
      style={{ border: "1px solid #ccc", padding: 20, marginTop: 20, fontFamily: "Arial" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}