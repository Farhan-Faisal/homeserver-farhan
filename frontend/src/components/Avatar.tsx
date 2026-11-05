// A coloured circle with someone's initials. The colour comes from the name, so it never changes.
const COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-violet-500"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  const box = size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${box} ${color}`}>
      {initials || "?"}
    </span>
  );
}
