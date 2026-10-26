import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  { ignores: ["public/design_handoff_magazine_refresh/**"] },
];

export default config;
