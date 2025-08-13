import React, { useRef, useState } from "react";
import axios from "axios";

// Componentes existentes
import RichEditor from "./components/richEditor";
import Preview from "./components/Preview";

// Componentes/Hook nuevos
import { AnimatedButton } from "./components/AnimatedButton";
import { Card } from "./components/Card";
import { useRevealOnScroll } from "./hooks/useRevealOnScroll";

// Importá tu icono PNG (ruta relativa desde App.jsx)
import spImg from "./assets/sp-img.png";

// NOTA: Eliminamos el import de "./App.css" para evitar conflictos con el nuevo tema

const API_BASE = "http://localhost:8000";

const exampleData = {
  nombre: "Nombre Apellido",
  puesto: "Cargo Ejemplo",
  departamento: "Departamento Ejemplo",
  celular: "+54 9 11 XXXX-XXXX",
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

  // Animaciones reveal on scroll
  const refEditor = useRef(null);
  const refLivePreview = useRef(null);
  const refUserPreview = useRef(null);

  useRevealOnScroll(refEditor);
  useRevealOnScroll(refLivePreview);
  useRevealOnScroll(refUserPreview);

  // Cuando el usuario edita desde el editor
  const handleTemplateChange = (newHtml) => {
    setTemplate(newHtml);
    setPreview(renderTemplate(newHtml, exampleData));
  };

  // Obtener firma real desde backend
  const getSignature = async () => {
    if (!mail) return;
    try {
      const res = await axios.get(
        `${API_BASE}/signature/user/${encodeURIComponent(mail)}`
      );
      if (res.status === 200 && res.data?.signature) {
        setPreview(res.data.signature);
      } else {
        setPreview("<p>Error: Usuario no encontrado o sin firma generada</p>");
      }
    } catch (error) {
      console.error("Error al obtener firma:", error);
      const msg =
        error.response?.status === 404
          ? "<p>Error: Usuario no encontrado</p>"
          : "<p>Error al obtener firma del servidor</p>";
      setPreview(msg);
    }
  };

  // Guardar plantilla en backend
  const saveTemplate = async () => {
    try {
      await axios.post(`${API_BASE}/signature/template`, { template });
      alert("Plantilla guardada!");
    } catch (error) {
      console.error("Error al guardar plantilla:", error);
      alert("Error al guardar plantilla");
    }
  };

  // Guardar y aplicar
  const saveAndApply = async () => {
    try {
      // 1. Guardar plantilla
      const saveRes = await fetch("http://localhost:8000/signature/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });

      if (!saveRes.ok) {
        throw new Error(`Error guardando plantilla (${saveRes.status})`);
      }

      // 2. Aplicar firma
      const mockEmail = mail || "matias.martin@obsba.org.ar";
      const applyRes = await fetch(
        `http://localhost:8000/signature/apply/${encodeURIComponent(mockEmail)}`,
        { method: "POST" }
      );

      if (!applyRes.ok) {
        throw new Error(`Error aplicando firma (${applyRes.status})`);
      }

      alert(`Firma aplicada correctamente a ${mockEmail}`);
    } catch (err) {
      console.error("Error en saveAndApply:", err);
      alert(`Error: ${err.message}`);
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([preview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "firma_usuario.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Navbar */}
      <header className="navbar">
        <div className="container navbar__inner">
          <div className="brand">
            {/* Reemplaza el punto por tu icono PNG */}
            <img src={spImg} alt="SignPoint logo" className="brand__logo" />
            <span>SignPoint</span>
          </div>
          <AnimatedButton
            variant="outline"
            onClick={() =>
              window.open("https://dcs.ar", "_blank")
            }
          >
            DCS
          </AnimatedButton>
        </div>
      </header>

      {/* Contenido */}
      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <h1 className="animate-fade-in-up">Editor de Firmas</h1>
        <p className="animate-fade-in-up" style={{ color: "var(--color-muted)", marginTop: 6 }}>
          Editá la plantilla y previsualizá en tiempo real.
        </p>

        {/* Editor */}
        <section ref={refEditor} className="reveal" style={{ marginTop: 18 }}>
          <Card title="Editar Plantilla">
            <RichEditor initialHtml={template} onChange={handleTemplateChange} />

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <AnimatedButton onClick={downloadHtml}>Descargar HTML</AnimatedButton>
              <AnimatedButton variant="outline" onClick={saveTemplate}>
                Guardar Plantilla
              </AnimatedButton>
              <AnimatedButton onClick={saveAndApply}>Subir Plantilla</AnimatedButton>
            </div>
          </Card>
        </section>

        {/* Vista previa en tiempo real */}
        <section ref={refLivePreview} className="reveal" style={{ marginTop: 18 }}>
          <Card title="Vista previa en tiempo real">
            <Preview html={preview} />
          </Card>
        </section>

        {/* Vista previa para usuario real */}
        <section ref={refUserPreview} className="reveal" style={{ marginTop: 18 }}>
          <Card title="Vista previa para usuario real">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="email"
                className="input"
                placeholder="email del usuario"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                style={{ minWidth: 260, flex: "1 1 260px" }}
              />
              <AnimatedButton onClick={getSignature}>Generar Firma</AnimatedButton>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}