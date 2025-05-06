import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // @ts-expect-error - Type 'PluginOption[]' is not assignable to type 'PluginOption'
  plugins: [react()],
});
