import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "@/components/lumen/shell";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}
