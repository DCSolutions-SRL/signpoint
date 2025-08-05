import React, { useState } from "react";
import axios from "axios";
import Editor from "./components/Editor";
import RichEditor from "./components/richEditor";
import Preview from "./components/Preview";
import miImagen from "./assets/ccr.jpg";


const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [template, setTemplate] = useState(`
    <p>Saludos,<br>
    <strong>{{displayName}}</strong><br>
    {{jobTitle}}<br>
    {{department}}</p>
    <img src="${miImagen}" alt="Firma" style="width: 150px; height: auto;" />
    <p><a href='mailto:{{mail}}'>{{mail}}</a></p>
  `);
  const [mail, setMail] = useState("");
  const [preview, setPreview] = useState("");

  const saveTemplate = async () => {
    await axios.post(`${API_BASE}/signature/template`, { template });
    alert("Plantilla guardada!");
  };

  const getSignature = async () => {
    try {
      const res = await axios.get(`${API_BASE}/signature/user/${encodeURIComponent(mail)}`);
      setPreview(res.data.signature || "<p>Error: Usuario no encontrado</p>");
    } catch (e) {
      setPreview("<p>Error al obtener firma</p>");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Gestión de Firmas</h1>
      <h2>Editar Plantilla</h2>
      <RichEditor initialHtml={template} onChange={setTemplate} />
      <button onClick={saveTemplate} style={{ marginTop: 10 }}>
        Guardar Plantilla
      </button>

      <h2>Vista previa por usuario</h2>
      <input
        type="text"
        placeholder="email del usuario"
        value={mail}
        onChange={(e) => setMail(e.target.value)}
        style={{ width: 300, marginRight: 10 }}
      />
      <button onClick={getSignature}>Generar Firma</button>

      <Preview html={preview} />
    </div>
  );
}

export default App;
