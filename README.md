# 📌 SignPoint – Instalación y Ejecución

Este proyecto está dividido en **Backend (FastAPI)** y **Frontend (React)**.

---

## **Requisitos previos**
- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js (< v20) + npm](https://nodejs.org/)
- Git instalado
- Cuenta en Azure AD (para la API de Microsoft Graph)

---

## **Clonar el repositorio**
```bash
git clone https://github.com/DCSolutions-SRL/signpoint.git
cd signpoint
```

## **Instalar dependencias**
```bash
cd backend/src

python -m venv venv

.\venv\Scripts\activate   # En Windows
source venv/bin/activate  # En Linux/Mac

pip install -r requirements.txt
```

## **Ejecutar backend**
```bash
cd backend/src

prd: python -m uvicorn app:app --reload --port 8000
tst: python -m uvicorn test:app --reload --port 8000
```
### El backend se va a encontrar en http://127.0.0.1:8000/docs

## **Ejecutar frontend**
```bash
cd frontend/
npm install
npm run dev
```

### El backend se va a encontrar en http://localhost:5173
