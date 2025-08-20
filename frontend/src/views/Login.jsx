import React from "react";
import axios from "axios";
import spImg from "../assets/sp-img.png"; // ajusta el path según tu proyecto
import { Card } from "../components/Card";
import { AnimatedButton } from "../components/AnimatedButton";

const API_BASE = "http://localhost:8000";



export function Login({ loginForm, setLoginForm, handleLogin }) {
  return (
    <div>
      <header className="navbar">
        <div className="container navbar__inner">
          <div className="brand">
            <img src={spImg} alt="SignPoint logo" className="brand__logo" />
            <span>SignPoint</span>
          </div>
        </div>
      </header>
      <main className="container" style={{ paddingTop: 24 }}>
        <Card title="Ingresar">
          <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              placeholder="Usuario SQL Server"
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
              <AnimatedButton
                type="button"
                variant="outline"
                onClick={async () => {
                  const r = await axios
                    .get(`${API_BASE}/health/db`)
                    .catch(() => null);
                  alert(
                    r?.data?.ok
                      ? "DB OK"
                      : `DB ERROR: ${r?.data?.error || "sin detalle"}`
                  );
                }}
              >
                Probar DB
              </AnimatedButton>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
