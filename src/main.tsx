import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/index.css";
import { App } from "./App";
import { initHubEmbed } from "./services/hubEmbed";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
const root = rootEl;

async function bootstrap() {
  initHubEmbed();

  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("mock") === "1"
  ) {
    const { installDevMockApi } = await import("./dev/mockApi");
    installDevMockApi();
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
