import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    // Fail during deployment instead of publishing a page that cannot initialize Supabase.
    if (!URL.canParse(env.VITE_SUPABASE_URL) || !/^https?:$/.test(new URL(env.VITE_SUPABASE_URL).protocol) || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Build requires a valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
  }
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
