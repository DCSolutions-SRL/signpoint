# 📌 SignPoint – Instalación y Ejecución

Este proyecto está dividido en **Backend (FastAPI)** y **Frontend (React)**.

---

## **Requisitos previos**

- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js (&lt; v20) + npm](https://nodejs.org/)
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

### El backend se va a encontrar en http://localhost:8000/docs

## **Ejecutar frontend**

```bash
cd frontend/
npm install
npm run dev
```

### El frontend se va a encontrar en http://localhost:5173



# Certificados y permisos necesario para la comunicacion de backend con Exchange

## Crear App Registration en Azure AD
Abrir Azure Portal → Azure Active Directory → Registros de aplicaciones → Nuevo registro.

Asignar un nombre descriptivo (ej: ExchangeAutomationApp).

Tipo de cuenta: “Cuentas en este directorio organizativo solamente”.

Guardar y copiar Application (client) ID (AppId) y Directory (tenant) ID.

<img width="1903" height="751" alt="image" src="https://github.com/user-attachments/assets/ec8d34c4-d684-4387-b804-86b2fc788d97" />


## Asignar rol en Azure AD
Azure AD → Roles y administradores.

Buscar y seleccionar Exchange Administrator.

Asignar la App Registration como miembro (tipo: Aplicación).

<img width="1914" height="575" alt="image" src="https://github.com/user-attachments/assets/f42fb1e6-18f5-4dbb-9f9f-3fc6008da492" />



## Creamos certificado de validacion en el host del backend

```powershell

PS C:\WINDOWS\system32> New-SelfSignedCertificate -DnsName "ExchangeOnlineAutomationApp" -CertStoreLocation "cert:\CurrentUser\My"


   PSParentPath: Microsoft.PowerShell.Security\Certificate::CurrentUser\My

Thumbprint                                Subject
----------                                -------
A0B255293AD1EE9DF3FAE915D2F66DE594865757  CN=ExchangeOnlineAutomationApp

PS C:\WINDOWS\system32> Get-ChildItem -Path Cert:\CurrentUser\My


   PSParentPath: Microsoft.PowerShell.Security\Certificate::CurrentUser\My

Thumbprint                                Subject
----------                                -------
ABCDEFG123456  CN=ExchangeOnlineAutomationApp


PS C:\WINDOWS\system32> Export-Certificate -Cert "Cert:\CurrentUser\My\ABCDEFG123456" -FilePath "signpointCert.cer"


    Directorio: C:\WINDOWS\system32


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         13/8/2025     11:47            850 signpointCert.cer

```

## Subir certificado público a Azure
En tu App Registration → Certificados y secretos → Cargar certificado.

Seleccionar el .cer (clave pública).

Guardar.

## Asignar permisos de aplicación para Exchange
En App Registration → Permisos de API → Agregar un permiso.

Seleccionar APIs de Microsoft → Exchange → Application permissions.

Elegir al menos:

Copiar
Editar
Exchange.ManageAsApp
Hacer clic en Grant admin co   <img width="1400" height="863" alt="image" src="https://github.com/user-attachments/assets/88b0a5bd-e635-4792-b4a9-412edf053ad4" />
