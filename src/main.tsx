import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

// Force dark theme globally so portals (dialogs, dropdowns, select) keep correct contrast
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
