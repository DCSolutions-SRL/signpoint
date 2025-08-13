import React from "react";

export function Card({ title, children, headerRight = null, ...props }) {
  return (
    <div className="card animate-scale-in" {...props}>
      {title || headerRight ? (
        <div className="card__header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            {title && <div>{title}</div>}
            {headerRight}
          </div>
        </div>
      ) : null}
      <div className="card__body">{children}</div>
    </div>
  );
}