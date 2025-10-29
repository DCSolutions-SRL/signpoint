import React, { useEffect, useState } from "react";
import { AnimatedButton } from "./AnimatedButton";

export function ConfirmModal({ casino, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    setMessage("");
    try {
      await onConfirm(); // Llamada al backend desde App.jsx
      setMessage(`Plantilla cargada exitosamente`);
      setSuccess(true);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Cierre automático tras éxito
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => onCancel?.(), 2500);
      return () => clearTimeout(t);
    }
  }, [success, onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
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
          maxWidth: 480,
          width: "90%",
        }}
      >
        <h2>Confirmar aplicación</h2>
        <p>
          ¿Seguro que quieres aplicar la firma al casino <b>{casino}</b>?
        </p>
        <p style={{ marginTop: 12, color: "red", fontWeight: "bold" }}>
          IMPORTANTE: esto alterará la firma de todos los usuarios del grupo.
        </p>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span>Aplicando firma...</span>
          </div>
        )}
        {message && (
          <p style={{ marginTop: 12, color: success ? "#059669" : "#B91C1C", fontWeight: success ? 600 : 500 }}>
            {message}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            justifyContent: "flex-end",
          }}
        >
         {!loading && <AnimatedButton
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </AnimatedButton>}
          <AnimatedButton onClick={handleConfirm} loading={loading} disabled={loading}>
            Confirmar
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
}
