// Tiny DOM builders: h() for HTML, sv() for SVG. No framework.

const SVGNS = "http://www.w3.org/2000/svg";
export function setAttrs(el, a) {
  for (const [k, v] of Object.entries(a || {})) {
    if (v == null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k === "style") el.style.cssText = v;  // CSSOM: allowed by a strict CSP
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
}
export function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === "") continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
export function h(tag, attrs, ...kids) { const el = document.createElement(tag); setAttrs(el, attrs); return add(el, kids); }
export function sv(tag, attrs, ...kids) { const el = document.createElementNS(SVGNS, tag); setAttrs(el, attrs); return add(el, kids); }
export const $ = (s) => document.querySelector(s);
export const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
