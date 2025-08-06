import React, { useState } from "react";
import "./App.css";
import RichEditor from "./components/richEditor";
import Preview from "./components/Preview";
import axios from "axios";

const API_BASE = "http://localhost:8000";

const initialTemplate = `
<div style="font-family:Arial,sans-serif; font-size:15px; color:#222;">
  <p>
    <span style="font-weight:bold; color:#000000; font-size:18px;">{{displayName}}</span><br>
    <span style="color:#222222;">{{jobTitle}}</span><br>
    <span style="color:#222222;">{{department}}</span><br>
    <a href="mailto:{{mail}}" style="color:#000000; text-decoration:none;">{{mail}}</a>
  </p>
</div>
`;

// Ejemplo de datos para reemplazar en la preview en tiempo real
const exampleData = {
  displayName: "Nombre Apellido",
  jobTitle: "Cargo Ejemplo",
  department: "Departamento Ejemplo",
  mail: "email@ejemplo.com"
};

// Función para reemplazar placeholders por valores de ejemplo o usuario real
function renderTemplate(template, data) {
  let html = template;
  for (const key of ["displayName", "mail", "jobTitle", "department"]) {
    html = html.replaceAll(`{{${key}}}`, data[key] || "");
  }
  return html;
}

export default function App() {
  const [template, setTemplate] = useState(initialTemplate);
  const [mail, setMail] = useState("");
  const [preview, setPreview] = useState(renderTemplate(initialTemplate, exampleData));

  // Actualiza la preview en tiempo real con datos de ejemplo
  const handleTemplateChange = (newHtml) => {
    setTemplate(newHtml);
    setPreview(renderTemplate(newHtml, exampleData));
  };

  // Cuando se pide la firma personalizada para un usuario real
  const getSignature = async () => {
    if (!mail) return;
    try {
      const res = await axios.get(`${API_BASE}/signature/user/${encodeURIComponent(mail)}`);
      setPreview(res.data.signature || "<p>Error: Usuario no encontrado</p>");
    } catch (e) {
      setPreview("<p>Error al obtener firma</p>");
    }
  };

  const saveTemplate = async () => {
    await axios.post(`${API_BASE}/signature/template`, { template });
    alert("Plantilla guardada!");
  };

  return (
    <div className="app-container">
      <h1 className="app-title">SignPoint</h1>
      <section className="editor-section">
        <h2 className="section-title">Editar Plantilla</h2>
        <RichEditor initialHtml={template} onChange={handleTemplateChange} />
      </section>
      <section>
        <h2 className="section-title">Vista previa en tiempo real</h2>
        <Preview html={preview} />
      </section>
      <section>
        <h2 className="section-title">Vista previa para usuario real</h2>
        <div className="input-row">
          <input
            type="text"
            className="user-input"
            placeholder="email del usuario"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
          />
          <button className="gen-btn" onClick={getSignature}>
            Generar Firma
          </button>
        </div>
      </section>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
        <button className="save-btn" onClick={saveTemplate}>
          Guardar Plantilla
        </button>
      </div>
    </div>
  );
}
