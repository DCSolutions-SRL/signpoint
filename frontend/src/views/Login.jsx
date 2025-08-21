import React, { useState } from "react";
import axios from "axios";
import spImg from "../assets/sp-img.png"; // ajusta el path según tu proyecto
import { Card } from "../components/Card";
import { AnimatedButton } from "../components/AnimatedButton";

const API_BASE = "http://localhost:8000";



export function Login({ loginForm, setLoginForm, handleLogin }) {
  const [showAbout, setShowAbout] = useState(false);
  return (
    <div>
      <header className="navbar">
        <div className="container navbar__inner">
          <a href="https://www.dcs.ar" target="_blank" rel="noopener noreferrer" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
            <img src={spImg} alt="SignPoint logo" className="brand__logo" />
            <span>SignPoint</span>
          </a>
          <AnimatedButton variant="outline" onClick={() => setShowAbout(v => !v)}>About</AnimatedButton>
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
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <AnimatedButton variant="outline" onClick={() => setShowAbout(false)}>Cerrar</AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
