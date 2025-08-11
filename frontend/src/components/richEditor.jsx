import React, { useRef, useEffect } from "react";
import "../App.css";

export default function RichEditor({ initialHtml, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (
      editorRef.current &&
      initialHtml &&
      editorRef.current.innerHTML.trim() !== initialHtml.trim()
    ) {
      editorRef.current.innerHTML = initialHtml;
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

  const loadHtmlFile = (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith(".htm") && !file.name.endsWith(".html")) {
      alert("Por favor selecciona un archivo .htm o .html válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = e.target.result;
        updateHtml();
      }
    };
    reader.readAsText(file);
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

        <input
          type="number"
          min="1"
          placeholder="Tamaño (pt)"
          className="rich-input font-size-input"
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d+$/.test(value) && parseInt(value) > 0) {
              execCommand("fontSize", value);
            }
          }}
        />

        {/* Cargar imagen */}
        <label className="rich-btn">
          Cargar imagen
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={insertImage} />
        </label>

        {/* Cargar archivo HTML */}
        <label className="rich-btn" style={{ marginLeft: "10px" }}>
          Cargar HTML
          <input type="file" style={{ display: "none" }} accept=".htm,.html" onChange={loadHtmlFile} />
        </label>
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
