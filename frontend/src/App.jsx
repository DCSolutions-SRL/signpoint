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

import { API_BASE } from "./config";

// NOTA: Eliminamos el import de "./App.css" para evitar conflictos con el nuevo tema

// const API_BASE = "http://192.168.79.118:8000";

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
  const [token, setToken] = useState(
    () => localStorage.getItem("sp_token") || ""
  );
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [me, setMe] = useState({ user: "", role: "none" });
  const [activeView, setActiveView] = useState("editor"); // editor | users
  const [showAbout, setShowAbout] = useState(false);
  const [template, setTemplate] = useState("");
  const [mail, setMail] = useState("");
  const [preview, setPreview] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [userUploadedHtml, setUserUploadedHtml] = useState(false);
  // Nuevo estado para modo
  const [applyMode, setApplyMode] = useState("all"); // "user" | "all"

  // axios default auth header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Cargar perfil/rol
      axios
        .get(`${API_BASE}/auth/me`)
        .then((r) => setMe(r.data))
        .catch(() => setMe({ user: "", role: "none" }));
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
      switch (err.response.status) {
      case 401:
        alert("Usuario o contraseña inválidos");
        break;
      case 403:
        alert("No tiene permisos para acceder");
        break;
      case 500:
        alert("Error interno del servidor (DB inaccesible o fallo interno)");
        break;
      default:
        alert(`Error inesperado: ${err.response.status} ${err.response.statusText}`);
      }
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

  // Función confirmApply adaptada
  const getSignature = async () => {
    if (applyMode === "user" && !mail) return;

    try {
      const url = `${API_BASE}/signature/user/${encodeURIComponent(mail)}`
      const res = await axios.get(url);
      const sig = res.data?.signature || "<p>Error: Firma no disponible o el usuario no la tiene asignada</p>";
      setTemplate(sig); // directamente sobre el editor
      setUserUploadedHtml(false);
    } catch (err) {
      console.error(err);
      alert("Error al obtener la firma");
    }
  };

  // confirmApply para gmail
const confirmApply = async () => {
  try {
    if (applyMode === "all") {
      const { data: usersSignatures } = await axios.get(
        `${API_BASE}/signature/users/all`
      );

      for (const email of Object.keys(usersSignatures)) {
        await axios.post(`${API_BASE}/signature/update`, {
          email,
          signature: template, 
        });
      }
      return; 
    }

    if (applyMode === "user") {
      if (!mail) {
        alert("Debe ingresar un email");
        return;
      }

      const res = await axios.post(`${API_BASE}/signature/update`, {
        email: mail,
        signature: template,
      });

      if (res.status !== 200) {
        throw new Error("Error aplicando firma al usuario");
      }
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "Error aplicando firma");
  }
};

  if (!token) {
    // Pantalla de login con estética del sitio
    return (
      <div>
        <header className="navbar">
          <div className="container navbar__inner">
            <a
              href="https://www.dcs.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="brand"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <img src={spImg} alt="SignPoint logo" className="brand__logo" />
              <span>SignPoint</span>
            </a>
            <AnimatedButton
              variant="outline"
              onClick={() => setShowAbout((v) => !v)}
            >
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
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                required
              />
              <div style={{ display: "flex", gap: 12 }}>
                <AnimatedButton type="submit">Entrar</AnimatedButton>
              </div>
            </form>
          </Card>
        </main>
        {showAbout && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: 24,
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                maxWidth: 520,
                width: "90%",
              }}
            >
              <h2 style={{ marginBottom: 12 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <img
                    src={spImg}
                    alt="SignPoint"
                    className="brand__logo"
                    style={{ width: 20, height: 20 }}
                  />
                  <strong>SignPoint</strong>
                </span>
              </h2>
              <p>Administrador de firmas de correo.</p>
              <p>
                Desarrollado por{" "}
                <a
                  href="https://www.dcs.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-primary)" }}
                >
                  DCSolutions SRL
                </a>
                .
              </p>
              <p style={{ fontSize: 15, color: "#000000", margin: 0 }}>
                Versión 1.0.0
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 16,
                }}
              >
                <AnimatedButton
                  variant="outline"
                  onClick={() => setShowAbout(false)}
                >
                  Cerrar
                </AnimatedButton>
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
            <a
              href="https://www.dcs.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="brand"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <img src={spImg} alt="SignPoint logo" className="brand__logo" />
              <span>SignPoint</span>
            </a>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {me.role === "admin" && (
              <AnimatedButton
                variant={activeView === "users" ? "primary" : "outline"}
                onClick={() =>
                  setActiveView(activeView === "users" ? "editor" : "users")
                }
              >
                Alta de usuarios
              </AnimatedButton>
            )}
            <AnimatedButton variant="outline" onClick={logout}>
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
            <p
              className="animate-fade-in-up"
              style={{ color: "var(--color-muted)", marginTop: 6 }}
            >
              Editá la plantilla y previsualizá en tiempo real.
            </p>

            {/* Editor */}
            <section
              ref={refEditor}
              className="reveal"
              style={{ marginTop: 18 }}
            >
              <Card title="Editar Plantilla">
                {/* Selector de modo */}
                <div
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <label>
                    <input
                      type="radio"
                      name="applyMode"
                      value="all"
                      checked={applyMode === "all"}
                      onChange={() => setApplyMode("all")}
                    />{" "}
                    Todos los usuarios
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="applyMode"
                      value="user"
                      checked={applyMode === "user"}
                      onChange={() => setApplyMode("user")}
                    />{" "}
                    Usuario individual
                  </label>
                  
                </div>

                {/* Input de mail solo si applyMode es 'user' */}
                {applyMode === "user" && (
                  <div
                    style={{
                      marginBottom: 12,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="email"
                      className="input"
                      placeholder="Email del usuario"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                      style={{ flex: "1 1 260px" }}
                    />
                    <AnimatedButton onClick={getSignature} disabled={!mail}>
                      Obtener Firma
                    </AnimatedButton>
                  </div>
                )}

                {/* Editor */}
                <RichEditor
                  initialHtml={template}
                  onChange={handleTemplateChange}
                />

                {/* Selector de casino y botones */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <AnimatedButton onClick={() => { if (mail || applyMode === "all") 
                                                        setShowConfirm(true)
                                                  else alert("No se proporciono un mail")
                                                  }}>
                    Aplicar Firma {applyMode === "all" ? "a todos" : ""}
                  </AnimatedButton>
                  <AnimatedButton onClick={downloadHtml}>
                    Descargar HTML
                  </AnimatedButton>
                  {/* resto de botones de guardado/eliminación de plantilla */}
                </div>
              </Card>
            </section>

            {showConfirm && (
              <ConfirmModal
                mode={applyMode}
                user={mail}
                onCancel={() => setShowConfirm(false)}
                onConfirm={confirmApply}
              />
            )}            

          </>
        )}
      </main>
    </div>
  );
}