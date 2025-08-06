import React, { useRef, useEffect } from "react";
import "../App.css";

export default function RichEditor({ initialHtml, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || "";
    }
  }, [initialHtml]);

  const updateHtml = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    updateHtml();
  };

  const insertImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      execCommand("insertImage", e.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rich-editor-container">
      <div className="rich-toolbar">
        <button className="rich-btn" title="Negrita" onClick={() => execCommand("bold")}>B</button>
        <button className="rich-btn" title="Cursiva" onClick={() => execCommand("italic")}>I</button>
        <button className="rich-btn" title="Subrayado" onClick={() => execCommand("underline")}>U</button>
        <select className="rich-select" onChange={(e) => execCommand("fontName", e.target.value)} defaultValue="">
          <option value="" disabled>Fuente</option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Tahoma">Tahoma</option>
        </select>
        <select className="rich-select" onChange={(e) => execCommand("fontSize", e.target.value)} defaultValue="">
          <option value="" disabled>Tamaño</option>
          <option value="1">10pt</option>
          <option value="3">14pt</option>
          <option value="5">18pt</option>
          <option value="7">24pt</option>
        </select>
        <input type="file" className="rich-input" accept="image/*" onChange={insertImage} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        spellCheck={false}
        dir="ltr"
        onInput={updateHtml}
        className="rich-editor-area"
      />
    </div>
  );
}
