import React, { useState, useRef, useEffect } from "react";

export default function RichEditor({ initialHtml, onChange }) {
  const editorRef = useRef(null);

  // Cuando cambia initialHtml desde afuera, actualizamos solo si es distinto para no resetear cursor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || "";
    }
  }, [initialHtml]);

  // Actualizamos el html hacia el padre cuando el contenido cambia
  const updateHtml = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Ejecuta comandos de edición (negrita, cursiva, insertar imagen, etc)
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    updateHtml(); // actualizar html al padre para sincronizar estado
  };

  // Insertar imagen desde input file
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
    <div>
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => execCommand("bold")}>Bold</button>
        <button onClick={() => execCommand("italic")}>Italic</button>
        <button onClick={() => execCommand("underline")}>Underline</button>
        <select
          onChange={(e) => execCommand("fontName", e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            Fuente
          </option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Tahoma">Tahoma</option>
        </select>
        <select
          onChange={(e) => execCommand("fontSize", e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            Tamaño
          </option>
          <option value="1">10pt</option>
          <option value="3">14pt</option>
          <option value="5">18pt</option>
          <option value="7">24pt</option>
        </select>

        <input type="file" accept="image/*" onChange={insertImage} />
      </div>

      <div
        ref={editorRef}
        contentEditable
        spellCheck={false}
        dir="ltr"
        onInput={updateHtml}
        style={{
          border: "1px solid gray",
          minHeight: "200px",
          padding: "10px",
          fontFamily: "Arial",
          textAlign: "left",
          outline: "none",
        }}
      />
    </div>
  );
}
