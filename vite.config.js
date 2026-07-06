import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you deploy this to GitHub Pages as a project site (i.e. the URL is
// https://<user>.github.io/<repo>/ rather than a custom domain or a
// <user>.github.io root repo), uncomment the line below and set it to
// "/<repo-name>/". Forgetting this is the #1 cause of a blank white page
// after deploying a Vite app to GitHub Pages — assets get requested from
// the domain root instead of the repo subpath.
export default defineConfig({
   base: "/<FinanceTracker>/",
  plugins: [react()],
});
