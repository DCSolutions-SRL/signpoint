import React from "react";

export function AnimatedButton({ variant = "primary", children, ...props }) {
  const cls = ["btn", variant === "primary" ? "btn--primary" : "btn--outline"].join(" ");
  return (
    <button className={cls} {...props}>
      {children}
      <span aria-hidden="true" style={{ display: "inline-block", transition: "transform .2s var(--ease)" }} className="btn__icon">→</span>
    </button>
  );
}