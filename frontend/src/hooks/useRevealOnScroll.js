import { useEffect } from "react";

/**
 * Agrega la clase "is-visible" al elemento cuando entra en viewport.
 * Uso:
 *  const ref = useRef(null);
 *  useRevealOnScroll(ref);
 *  <div ref={ref} className="reveal">Contenido</div>
 */
export function useRevealOnScroll(ref, options = { threshold: 0.15, rootMargin: "0px" }) {
  useEffect(() => {
    if (!ref?.current) return;
    const el = ref.current;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          obs.unobserve(el);
        }
      });
    }, options);

    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, options]);
}