import React, { useState } from "react";
import { AnimatedButton } from "./AnimatedButton";

export function ConfirmModal({ casino, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setMessage("");
    try {
      await onConfirm(); // Llamada al backend desde App.jsx
      setMessage(`Firma aplicada correctamente en ${casino}`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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

        {loading && <p>Aplicando firma...</p>}
        {message && <p style={{ marginTop: 12 }}>{message}</p>}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            justifyContent: "flex-end",
          }}
        >
          <AnimatedButton
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </AnimatedButton>
          <AnimatedButton onClick={handleConfirm} disabled={loading}>
            Confirmar
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
}
