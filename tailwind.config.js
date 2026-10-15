/** Design tokens live in src/styles.css as RGB channels; Tailwind maps names onto them. */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: c("canvas"), panel: c("panel"), sunk: c("sunk"), line: c("line"),
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3") },
        pos: { DEFAULT: c("pos"), soft: c("pos-soft") },
        neg: { DEFAULT: c("neg"), soft: c("neg-soft") },
        warn: { DEFAULT: c("warn"), soft: c("warn-soft") },
      },
      fontFamily: {
        display: ['"Manrope"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
    },
  },
};
