import React, { useRef, useEffect } from "react";
import "../App.css";

export default function RichEditor({ initialHtml, onChange }) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const selectedImageRef = useRef(null);

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

  // Asegura que la selección esté dentro del editor; si no, coloca el cursor al final
  const ensureSelectionInsideEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        return; // selección válida dentro del editor
      }
    }
    // Colocar al final
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false); // al final
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || !savedRangeRef.current) return;
    editor.focus();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  };

  useEffect(() => {
    const onSelectionChange = () => {
      saveSelection();
      // Detectar si la selección está sobre una imagen dentro del editor
      const editor = editorRef.current;
      const sel = window.getSelection();
      if (!editor || !sel) return;
      let node = sel.anchorNode;
      if (!node) return;
      if (!editor.contains(node)) return;
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      const imgEl = el && el.closest ? el.closest("img") : null;
      selectedImageRef.current = imgEl || null;
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const insertImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const editor = editorRef.current;
      if (!editor) return;
      // Foco y selección dentro del editor
      editor.focus();
      ensureSelectionInsideEditor();

      // Insertar imagen con Range API para mayor compatibilidad
      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = file.name || "imagen";
      img.style.maxWidth = "100%";
      img.style.height = "auto";

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.insertNode(img);
        // Mover el cursor después de la imagen
        range.setStartAfter(img);
        range.setEndAfter(img);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editor.appendChild(img);
      }

      // Marcar imagen como seleccionada para permitir cambiar su tamaño
      selectedImageRef.current = img;
      updateHtml();
    };
    reader.readAsDataURL(file);
  };

  // Aplica tamaño de fuente al texto seleccionado o cambia tamaño de imagen si hay una seleccionada
  const applySize = (value) => {
    const size = parseInt(value, 10);
    if (!Number.isFinite(size) || size <= 0) return;

    const editor = editorRef.current;
    if (!editor) return;

    // Si hay una imagen seleccionada, cambiar su tamaño (ancho en px)
    if (selectedImageRef.current && editor.contains(selectedImageRef.current)) {
      const img = selectedImageRef.current;
      img.style.width = `${size}px`;
      img.style.height = "auto";
      updateHtml();
      return;
    }

    // Si no hay imagen, aplicar al texto
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
      // Cambiar tamaño del texto existente en la posición del cursor
      const anchor = sel.anchorNode;
      if (anchor && anchor.nodeType === Node.TEXT_NODE && anchor.parentNode) {
        const span = document.createElement("span");
        span.style.fontSize = `${size}px`;
        anchor.parentNode.insertBefore(span, anchor);
        span.appendChild(anchor);
        // Reposicionar cursor al final del texto envuelto
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        // Aplicar al contenedor más cercano dentro del editor
        let el = anchor && anchor.nodeType === Node.ELEMENT_NODE ? anchor : (anchor ? anchor.parentElement : null);
        while (el && el !== editor && el.parentElement && !el.textContent) {
          el = el.parentElement;
        }
        if (el && el !== editor) {
          el.style.fontSize = `${size}px`;
        } else {
          // Fallback: insertar span como antes
          const span = document.createElement("span");
          span.style.fontSize = `${size}px`;
          span.appendChild(document.createTextNode("\u200B"));
          range.insertNode(span);
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }
    } else {
      // Envolver selección en un span con tamaño, tolerando selecciones parciales
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      const contents = range.extractContents();
      // Evitar anidar spans con mismo font-size innecesariamente
      if (contents.childNodes.length === 1 && contents.firstChild.nodeType === Node.ELEMENT_NODE) {
        const el = contents.firstChild;
        if (el.style && el.style.fontSize) {
          el.style.fontSize = `${size}px`;
          range.insertNode(el);
        } else {
          span.appendChild(contents);
          range.insertNode(span);
        }
      } else {
        span.appendChild(contents);
        range.insertNode(span);
      }
      // Reubicar cursor después
      const newRange = document.createRange();
      newRange.setStartAfter(span);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    updateHtml();
  };

  const loadHtmlFile = (event) => {

    const file = event.target.files[0];
    
    if (!file) return;
    if (!file.name.endsWith(".htm") && !file.name.endsWith(".html")) {
      alert("Por favor selecciona un archivo .htm o .html válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (editorRef.current) {
        const content = e.target.result;
        editorRef.current.innerHTML = content;
        
        if (onChange) {
          onChange(content, { userUpload: true });
        } else {
          updateHtml();
        }
      }
    };
    reader.readAsText(file);

    event.target.value = null;
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

        <select
          className="rich-select"
          defaultValue=""
          onMouseDown={() => saveSelection()}
          onChange={(e) => {
            const value = e.target.value;
            if (value) applySize(value);
          }}
        >
          <option value="" disabled>Tamaño</option>
          <option value="10">10 px</option>
          <option value="12">12 px</option>
          <option value="14">14 px</option>
          <option value="16">16 px</option>
          <option value="18">18 px</option>
          <option value="20">20 px</option>
          <option value="24">24 px</option>
          <option value="28">28 px</option>
          <option value="32">32 px</option>
        </select>

        {/* Cargar imagen */}
        <label className="rich-btn">
          Cargar imagen
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={insertImage} />
        </label>

        {/* Cargar archivo HTML */}
        <label className="rich-btn" style={{ marginLeft: "10px" }}>
          Cargar HTML
          <input type="file" style={{ display: "none" }} accept=".htm,.html" onClick={(e) => (e.target.value = null)} onChange={loadHtmlFile} />
        </label>
      </div>

      <div
        ref={editorRef}
        contentEditable
        spellCheck={false}
        dir="ltr"
        onInput={updateHtml}
        onMouseDown={(e) => {
          // Evitar navegación si hay enlaces dentro del editor
          const link = e.target && e.target.closest ? e.target.closest("a") : null;
          if (link) {
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          // Selección de imagen para permitir cambiar su tamaño
          const imgEl = e.target && e.target.closest ? e.target.closest("img") : null;
          selectedImageRef.current = imgEl || null;
          saveSelection();
        }}
        className="rich-editor-area"
      />
    </div>
  );
}
