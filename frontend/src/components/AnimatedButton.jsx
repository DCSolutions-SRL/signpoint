import React from "react";

export function AnimatedButton({ variant = "primary", loading = false, children, ...props }) {
  const cls = ["btn", variant === "primary" ? "btn--primary" : "btn--outline"].join(" ");
  const disabled = loading || props.disabled;
  return (
    <button className={cls} {...props} disabled={disabled}>
      {loading && (
        <span
          aria-hidden="true"
          className="spinner"
          style={{ width: 16, height: 16 }}
        />
      )}
      {children}
      {!loading && (
        <span
          aria-hidden="true"
          style={{ display: "inline-block", transition: "transform .2s var(--ease)" }}
          className="btn__icon"
        >
          →
        </span>
      )}
    </button>
  );
}