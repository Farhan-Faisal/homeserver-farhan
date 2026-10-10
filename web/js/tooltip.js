// One floating tooltip shared by every chart.
import { $ } from "./dom.js";

const tip = $("#tip");
export function showTip(x, y, nodes) {
  tip.replaceChildren(...nodes);
  tip.style.display = "block";
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}
export const hideTip = () => { tip.style.display = "none"; };
