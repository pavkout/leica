import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { irisPowerOn } from "./components/app/iris";
import { followScales } from "./utils/scaleFollow";
import "./styles.css";

// The first look through the lens: the iris opens on the camera.
irisPowerOn();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Scales bring their set value into view, like a ring under its index.
followScales();
