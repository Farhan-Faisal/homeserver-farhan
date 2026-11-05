// Runs Tailwind over the CSS: turns @import "tailwindcss", @theme and the classes
// used in components into real CSS.
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
