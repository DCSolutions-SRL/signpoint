import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { init as initApm } from '@elastic/apm-rum';

// Estilos nuevos
import "./styles/theme.css";
import "./styles/animations.css";
import "./styles/components.css";

// Inicializar APM RUM
const apm = initApm({
  serviceName: 'signpoint',
  serverUrl: 'http://192.168.79.150:8200',
  secretToken: 'GAH0LXwWM222X6XdtIc/8bmAjB4rctDbcScSKERicas=',
  serviceVersion: '1.0',
  environment: 'production'
});

ReactDOM.render(
  <App />,
  document.getElementById("root")
);