<h1 align="center">
  <br>
  <a href="http://www.dcs.ar"><img src="https://i.imgur.com/GgjNXNl.png" alt="DCSolutions" width="200"></a>
  <br>
  SignPoint – Gestor de Firmas Automáticas
  <br>
</h1>

<h4 align="center">Sistema para edición, gestión y aplicación automatizada de firmas HTML en Exchange Online vía Microsoft Graph.</h4>

<p align="center">
  <a href="#caracteristicas">Características</a> •
  <a href="#estructura">Estructura</a> •
  <a href="#instalacion">Instalación</a> •
  <a href="#uso">Uso</a> •
  <a href="#creditos">Créditos</a>
</p>

---

## <a name="caracteristicas"></a>Características

* **Edición visual de plantillas HTML** con variables dinámicas (nombre, puesto, mail, etc.)
* **Vista previa en tiempo real** y descarga de la firma generada
* **Aplicación automática de firmas** a usuarios de Exchange Online
* **Integración con Microsoft Graph** para obtener datos de usuario y grupos
* **Gestión de plantillas**: guardar, editar y aplicar desde el frontend
* **Scripts de automatización** para backend y despliegue
* **Soporte multiplataforma** (Linux/Mac/Windows)

---

## <a name="estructura"></a>Estructura del Proyecto

```
signpoint/
├── backend/
│   └── src/
│       ├── app.py                # API principal (FastAPI)
│       ├── test.py               # API de testing/restricciones
│       ├── graph_service.py      # Integración con Microsoft Graph
│       ├── requirements.txt      # Dependencias Python
│       ├── start.sh, stop.sh     # Scripts de arranque/parada
├── frontend/
│   ├── src/
│   │   ├── App.jsx, main.jsx     # App React principal
│   │   ├── components/           # Componentes UI (Editor, Preview, etc)
│   │   └── styles/               # Estilos CSS
│   ├── public/                   # Recursos estáticos
│   ├── package.json              # Dependencias y scripts npm
│   └── vite.config.js            # Configuración Vite
├── scripts/                      # Scripts PowerShell para AD/Exchange
└── README.md                     # Documentación principal
```

---

## <a name="instalacion"></a>Instalación

### Requisitos previos

- Python 3.9+
- Node.js (recomendado v18, no v20+)
- npm
- Git
- Cuenta y permisos en Azure AD (para integración Exchange)

### Clonar el repositorio

```bash
git clone https://github.com/DCSolutions-SRL/signpoint.git
cd signpoint
```

### Backend

```bash
cd backend/src
python -m venv venv
source venv/bin/activate  # En Linux/Mac
# .\venv\Scripts\activate  # En Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd ../../frontend
npm install
```

---

## <a name="uso"></a>Uso

### Iniciar backend

```bash
# Modo producción
python -m uvicorn app:app --reload --port 8000
# Modo testing/restringido
python -m uvicorn test:app --reload --port 8000

# Tambien podemos iniciar el servicio con el script interactivo.
./start.sh     # Seleccionamos tst o prd segundo corresponda.

# Lo detenemos con:
./stop.sh
```

Acceso a la API: [http://localhost:8000/docs](http://localhost:8000/docs)

### Iniciar frontend

```bash
cd frontend
npm run dev
```

Acceso web: [http://localhost:5173](http://localhost:5173)

---

## <a name="creditos"></a>Créditos

* [DCSolutions SRL](https://www.dcs.ar)

---

<p align="center">
  © 2025 DCSolutions - Desarrollado para gestión y automatización de firmas en Exchange Online.
</p>
