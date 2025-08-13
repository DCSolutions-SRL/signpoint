import React, { useState } from "react";
import "./App.css";
import RichEditor from "./components/richEditor";
import Preview from "./components/Preview";
import axios from "axios";

const API_BASE = "http://localhost:8000";

const exampleData = {
  nombre: "Nombre Apellido",
  puesto: "Cargo Ejemplo",
  departamento: "Departamento Ejemplo",
  celular: "+54 9 11 XXXX-XXXX"
};

function renderTemplate(template, data) {
  let html = template;
  for (const key of ["nombre", "puesto", "departamento", "celular"]) {
    html = html.replaceAll(`{{${key}}}`, data[key] || "");
  }
  return html;
}

export default function App() {
  const [template, setTemplate] = useState("");
  const [mail, setMail] = useState("");
  const [preview, setPreview] = useState("");


  // ✏️ Cuando el usuario edita desde el editor
  const handleTemplateChange = (newHtml) => {
    setTemplate(newHtml);
    setPreview(renderTemplate(newHtml, exampleData));
  };

  // 📧 Obtener firma real desde backend
  const getSignature = async () => {
    if (!mail) return;
    try {
      const res = await axios.get(`${API_BASE}/signature/user/${encodeURIComponent(mail)}`);
      if (res.status === 200 && res.data?.signature) {
        setPreview(res.data.signature);
      } else {
        setPreview("<p>Error: Usuario no encontrado o sin firma generada</p>");
      }
    } catch (error) {
      console.error("Error al obtener firma:", error);
      const msg = error.response?.status === 404
        ? "<p>Error: Usuario no encontrado</p>"
        : "<p>Error al obtener firma del servidor</p>";
      setPreview(msg);
    }
  };

  

  // 💾 Guardar plantilla en backend
  const saveTemplate = async () => {
    try {
      await axios.post(`${API_BASE}/signature/template`, { template });
      alert("Plantilla guardada!");
    } catch (error) {
      console.error("Error al guardar plantilla:", error);
      alert("Error al guardar plantilla");
    }
  };

  const saveAndApply = async () => {
  try {
    // 1. Guardar plantilla
    const saveRes = await fetch("http://localhost:8000/signature/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template })
    });

    if (!saveRes.ok) {
      throw new Error(`Error guardando plantilla (${saveRes.status})`);
    }

    // 2. Aplicar firma
    const mockEmail = mail || "matias.martin@obsba.org.ar";
    const applyRes = await fetch(`http://localhost:8000/signature/apply/${encodeURIComponent(mockEmail)}`, {
      method: "POST"
    });

    if (!applyRes.ok) {
      throw new Error(`Error aplicando firma (${applyRes.status})`);
    }

    alert(`Firma aplicada correctamente a ${mockEmail}`);
  } catch (err) {
    console.error("Error en saveAndApply:", err);
    alert(`Error: ${err.message}`);
  }
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

      <div className="container-save-btn">
        <button className="save-btn" onClick={saveTemplate}>
          Guardar Plantilla
        </button>
      </div>

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


      <div className="container-save-btn">
        <button className="save-btn" onClick={saveAndApply}>
          Subir Plantilla
        </button>
      </div>
    </div>
  );
}
