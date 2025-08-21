import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card } from "./Card";
import { AnimatedButton } from "./AnimatedButton";

export function UserAdmin({ apiBase }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ username: "", role: "user" });
  const [pwd, setPwd] = useState("");
  const [me, setMe] = useState({ user: "", role: "none" });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/app-users`);
      setItems(res.data || []);
    } catch (e) {
      alert("No se pudieron cargar los usuarios (requiere admin)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cargar perfil actual y luego usuarios
    (async () => {
      try {
        const r = await axios.get(`${apiBase}/auth/me`);
        setMe(r.data || { user: "", role: "none" });
      } catch {
        setMe({ user: "", role: "none" });
      }
      fetchUsers();
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username) return;
    try {
      await axios.post(`${apiBase}/app-users`, form);
      setForm({ username: "", role: "user" });
      fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error creando/actualizando usuario");
    }
  };

  const handleDelete = async (username) => {
    if (!confirm(`Eliminar ${username}?`)) return;
    try {
      await axios.delete(`${apiBase}/app-users/${encodeURIComponent(username)}`);
      fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error eliminando usuario");
    }
  };

  const handleSetPassword = async (username) => {
    const newPwd = prompt(`Nueva contraseña para ${username}:`, pwd || "");
    if (!newPwd) return;
    try {
      await axios.post(`${apiBase}/app-users/${encodeURIComponent(username)}/password`, { password: newPwd });
      setPwd("");
      alert("Contraseña establecida");
    } catch (e) {
      alert(e?.response?.data?.detail || "Error estableciendo contraseña");
    }
  };

  return (
    <div>
      <h1 className="animate-fade-in-up">Alta de usuarios</h1>
      <p className="animate-fade-in-up" style={{ color: "var(--color-muted)", marginTop: 6 }}>
        Crea usuarios y define si son administradores o usuarios.
      </p>

      <section style={{ marginTop: 18 }}>
        <Card title="Nuevo usuario">
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              placeholder="Nombre de usuario (ej: email o login)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label>Rol:</label>
              <select
                className="select-casino"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <AnimatedButton type="submit">Guardar</AnimatedButton>
            </div>
          </form>
        </Card>
      </section>

      <section style={{ marginTop: 18 }}>
        <Card title="Usuarios de la app">
          {loading ? (
            <p>Cargando...</p>
          ) : items.length === 0 ? (
            <p>No hay usuarios creados aún.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items
                .filter((u) => u.username?.toLowerCase() !== me.user?.toLowerCase())
                .map((u) => (
                  <li key={u.username} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <span>{u.username}</span>
                    <span style={{ color: "var(--color-muted)" }}>{u.role}</span>
                    <AnimatedButton variant="outline" onClick={() => handleSetPassword(u.username)}>Set contraseña</AnimatedButton>
                    <AnimatedButton variant="outline" onClick={() => handleDelete(u.username)}>Eliminar</AnimatedButton>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
