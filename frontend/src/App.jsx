import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

// Componentes existentes
import RichEditor from "./components/richEditor";
import Preview from "./components/Preview";

// Componentes/Hook nuevos
import { AnimatedButton } from "./components/AnimatedButton";
import { Card } from "./components/Card";
import { useRevealOnScroll } from "./hooks/useRevealOnScroll";
import { ConfirmModal } from "./components/ConfirmModal";
import { UserAdmin } from "./components/UserAdmin";

// Importá tu icono PNG (ruta relativa desde App.jsx)
import spImg from "./assets/sp-img.png";

// NOTA: Eliminamos el import de "./App.css" para evitar conflictos con el nuevo tema

const API_BASE = "http://192.168.79.118:8000";


const exampleData = {
  DisplayName: "Nombre Apellido",
  Title: "Cargo Ejemplo",
  Department: "Departamento Ejemplo",
  PhoneNumber: "+54 9 11 XXXX-XXXX",
};

function renderTemplate(template, data) {
  let html = template;
  for (const key of ["DisplayName", "Title", "Department", "PhoneNumber"]) {
    html = html.replaceAll(`%%${key}%%`, data[key] || "");
  }
  return html;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("sp_token") || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [me, setMe] = useState({ user: "", role: "none" });
  const [activeView, setActiveView] = useState("editor"); // editor | users
  const [showAbout, setShowAbout] = useState(false);
  const [template, setTemplate] = useState("");
  const [mail, setMail] = useState("");
  const [preview, setPreview] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCasino, setSelectedCasino] = useState("");
  const [selectedCasinoLabel, setSelectedCasinoLabel] = useState("");
  const [userUploadedHtml, setUserUploadedHtml] = useState(false);
  const [templates, setTemplates] = useState([]); // {name, kind}
  const [selectedTemplateName, setSelectedTemplateName] = useState("");

  // axios default auth header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  // Cargar perfil/rol
  axios.get(`${API_BASE}/auth/me`).then(r => setMe(r.data)).catch(() => setMe({ user: "", role: "none" }));
    } else {
      delete axios.defaults.headers.common["Authorization"];
  setMe({ user: "", role: "none" });
  setActiveView("editor");
    }
  }, [token]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, loginForm);
      const tok = res.data?.access_token;
      if (tok) {
        localStorage.setItem("sp_token", tok);
        setToken(tok);
      }
    } catch (err) {
      alert("Login inválido o DB inaccesible");
    }
  };

  const logout = () => {
    localStorage.removeItem("sp_token");
    setToken("");
  };

  // Animaciones reveal on scroll
  const refEditor = useRef(null);
  const refLivePreview = useRef(null);
  const refUserPreview = useRef(null);

  useRevealOnScroll(refEditor);
  useRevealOnScroll(refLivePreview);
  useRevealOnScroll(refUserPreview);

  // Cuando el usuario edita desde el editor
  const handleTemplateChange = (newHtml, opts = {}) => {
    // opts.userUpload indica si viene de "Cargar HTML" y debe desactivar autoload
    if (opts.userUpload) setUserUploadedHtml(true);
    setTemplate(newHtml);
    setPreview(renderTemplate(newHtml, exampleData));
  };

  // Cargar listado de plantillas desde backend
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/templates`)
      .then(r => setTemplates(r.data || []))
      .catch((e) => {
        console.error("Error obteniendo plantillas:", e?.response?.status, e?.message);
        setTemplates([]);
      });
  }, [token]);

  const loadTemplateByName = async (name) => {
    if (!name) return;
    try {
      const r = await axios.get(`${API_BASE}/templates/${encodeURIComponent(name)}`);
      const html = r.data?.template || "";
      setTemplate(html);
      setPreview(renderTemplate(html, exampleData));
      setUserUploadedHtml(false);
    } catch (e) {
      alert("No se pudo cargar la plantilla seleccionada");
    }
  };

  const resetToTemplates = () => setUserUploadedHtml(false);

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

  const confirmApply = async () => {

      // 1. Guardar plantilla
      const saveRes = await fetch(`${API_BASE}/signature/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!saveRes.ok) throw new Error("Error guardando plantilla");

      // 2. Aplicar en el casino elegido
      const applyRes = await fetch(`${API_BASE}/signature/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_name: selectedCasino }),
      });
      if (!applyRes.ok) throw new Error("Error aplicando firma");

  };


  if (!token) {
    // Pantalla de login con estética del sitio
    return (
      <div>
        <header className="navbar">
          <div className="container navbar__inner">
            <a href="https://www.dcs.ar" target="_blank" rel="noopener noreferrer" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
              <img src={spImg} alt="SignPoint logo" className="brand__logo" />
              <span>SignPoint</span>
            </a>
            <AnimatedButton variant="outline" onClick={() => setShowAbout(v => !v)}>
                About
            </AnimatedButton>
          </div>
        </header>
        <main className="container" style={{ paddingTop: 24 }}>
          <Card title="Ingresar">
            <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
              <input
                className="input"
                placeholder="Usuario (app o SQL Server)"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
              <div style={{ display: "flex", gap: 12 }}>
                <AnimatedButton type="submit">Entrar</AnimatedButton>
              </div>
            </form>
          </Card>
        </main>
        {showAbout && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", maxWidth: 520, width: "90%" }}>
              <h2 style={{ marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src={spImg} alt="SignPoint" className="brand__logo" style={{ width: 20, height: 20 }} />
                  <strong>SignPoint</strong>
                </span>
              </h2>
              <p>Administrador de firmas de correo.</p>
              <p>Desarrollado por <a href="https://www.dcs.ar" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>DCSolutions SRL</a>.</p>
              <p style={{ fontSize: 15, color: '#000000', margin: 0 }}>Versión 1.0.0</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <AnimatedButton variant="outline" onClick={() => setShowAbout(false)}>Cerrar</AnimatedButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Navbar */}
      <header className="navbar">
        <div className="container navbar__inner">
          <div className="brand">
            <a href="https://www.dcs.ar" target="_blank" rel="noopener noreferrer" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
              <img src={spImg} alt="SignPoint logo" className="brand__logo" />
              <span>SignPoint</span>
            </a>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(me.role === "admin") && (
              <AnimatedButton
                variant={activeView === "users" ? "primary" : "outline"}
                onClick={() => setActiveView(activeView === "users" ? "editor" : "users")}
              >
                Alta de usuarios
              </AnimatedButton>
            )}
          <AnimatedButton
            variant="outline"
            onClick={logout}
          >
            Salir
          </AnimatedButton>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        {activeView === "users" ? (
          <UserAdmin apiBase={API_BASE} />
        ) : (
          <>
            <h1 className="animate-fade-in-up">Editor de Firmas</h1>
            <p className="animate-fade-in-up" style={{ color: "var(--color-muted)", marginTop: 6 }}>
              Editá la plantilla y previsualizá en tiempo real.
            </p>

  {/* Editor */}
  <section ref={refEditor} className="reveal" style={{ marginTop: 18 }}>
          <Card title="Editar Plantilla">
            <RichEditor initialHtml={template} onChange={handleTemplateChange} />
            <label htmlFor="casino" style={{ display: "block", margin: "20px 0 0 0" }}>
                Selecciona un grupo para aplicar la firma:
              </label>
            {/* Selector de casino */}
            <div style={{ margin: "10px 0" }} className="select-casino-wrapper">
              
              <select
                id="casino"
                className="select-casino"
                value={selectedCasino}
                onChange={(e) => {
                  setSelectedCasino(e.target.value);
                  const label = e.target.selectedOptions[0].text;
                  setSelectedCasinoLabel(label);
                }}
              >
                <option value="" disabled hidden>Elegir...</option>
                <option value="firma matias">CityCenter</option>
                <option value="firma martin">CityCenter Online</option>
                <option value="firma_casino_hotel">CityCenter Hotel</option>
              </select>
            </div>

            {/* Desplegable de Plantillas */}
            <div style={{ margin: "10px 0" }}>
              <label htmlFor="tpl" style={{ display: "block" }}>Plantillas:</label>
              <select
                id="tpl"
                className="select-casino"
                value={selectedTemplateName}
                onChange={(e) => {
                  const name = e.target.value;
                  setSelectedTemplateName(name);
                  if (name) loadTemplateByName(name);
                }}
              >
                <option value="">Elegir plantilla...</option>
                {templates.length === 0 && (
                  <option value="" disabled>(no hay plantillas)</option>
                )}
                {/* Mostrar solo una vez cada plantilla, priorizando la destacada (kind: 'builtin') */}
                {(() => {
                  const unique = new Map();
                  for (const t of templates) {
                    // Si ya existe, solo reemplazar si la nueva es 'builtin'
                    if (!unique.has(t.name) || t.kind === 'builtin') {
                      unique.set(t.name, t);
                    }
                  }
                  return Array.from(unique.values()).map(t => (
                    <option key={`${t.kind}:${t.name}`} value={t.name}>
                      {t.kind === 'builtin' ? `⭐ ${t.name}` : t.name}
                    </option>
                  ));
                })()}
              </select>
            </div>

            {userUploadedHtml && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-muted)" }}>
                Usando HTML cargado por el usuario. <button style={{ marginLeft: 8 }} className="linklike" onClick={resetToTemplates}>Volver a usar templates</button>
              </div>
            )}


            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <AnimatedButton onClick={downloadHtml}>Descargar HTML</AnimatedButton>
              {me.role === 'admin' && (
              <AnimatedButton variant="outline" onClick={async () => {
                const name = prompt("Nombre para la plantilla:", selectedTemplateName || "");
                if (!name) return;
                try {
                  await axios.post(`${API_BASE}/templates`, { name, template }, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  alert("Plantilla guardada");
                } catch (e) {
                  if (e?.response?.status === 409) {
                    const ok = confirm(`La plantilla '${name}' ya existe. ¿Desea sobrescribirla?`);
                    if (!ok) return;
                    await axios.post(`${API_BASE}/templates`, { name, template, overwrite: true }, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    alert("Plantilla sobrescrita");
                  } else {
                    const msg = e?.response?.data?.detail || e?.message || "Error al guardar plantilla";
                    alert(msg);
                  }
                }
                // refrescar listado
                try {
                  const r = await axios.get(`${API_BASE}/templates`, { headers: { Authorization: `Bearer ${token}` } });
                  setTemplates(r.data || []);
                  setSelectedTemplateName(name);
                } catch {}
              }}>
                Guardar Plantilla
              </AnimatedButton>
              )}


              {me.role === 'admin' && (
              <AnimatedButton variant="outline" onClick={async () => {
                if (!selectedTemplateName) { alert("Seleccione una plantilla para eliminar"); return; }
                const meta = templates.find(t => t.name === selectedTemplateName);
                if (!meta) { alert("Plantilla no encontrada en el listado"); return; }
                if (meta.kind === 'builtin') { alert("No se puede eliminar una plantilla predefinida"); return; }
                const ok = confirm(`¿Eliminar la plantilla '${selectedTemplateName}'? Esta acción no se puede deshacer.`);
                if (!ok) return;
                try {
                  await axios.delete(`${API_BASE}/templates/${encodeURIComponent(selectedTemplateName)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  alert("Plantilla eliminada");
                  setSelectedTemplateName("");
                  const r = await axios.get(`${API_BASE}/templates`, { headers: { Authorization: `Bearer ${token}` } });
                  setTemplates(r.data || []);
                } catch (e) {
                  const msg = e?.response?.data?.detail || e?.message || "Error al eliminar plantilla";
                  alert(msg);
                }
              }}>
                Eliminar Plantilla
              </AnimatedButton>
              )}
              <AnimatedButton onClick={() => {
                if (!selectedCasino) {
                  alert("No se seleccionó ningún casino.");
                  return;
                }
                setShowConfirm(true);
              }}
                >Subir Plantilla
              </AnimatedButton>
            </div>
          </Card>
        </section>

         {showConfirm && (
            <ConfirmModal
              casino={selectedCasinoLabel}
              onCancel={() => setShowConfirm(false)}
              onConfirm={confirmApply}
            />
          )}



        {/* Vista previa en tiempo real */}
        <section ref={refLivePreview} className="reveal" style={{ marginTop: 18 }}>
          <Card title="Vista previa en tiempo real">
            <Preview html={preview} />
          </Card>
        </section>

        {/* Vista previa para usuario real (oculta por no uso) */}
        {false && (
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
        )}
          </>
        )}
      </main>
    </div>
  );
}