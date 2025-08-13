from fastapi import FastAPI, HTTPException, Path
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users, get_user_groups
import re
import subprocess
import os
from dotenv import load_dotenv

load_dotenv()

TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")


app = FastAPI()

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


# Permitir peticiones desde React en localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Usuarios de testing 
ALLOWED_EMAILS = [
    "matias.martin@obsba.org.ar",
    "martin.matias@obsba.org.ar"
]

# Plantilla por defecto
signature_template = """
<div style="font-family:Arial;font-size:12px;">
  <p>Saludos,<br>
  <strong>{{displayName}}</strong><br>
  {{jobTitle}}<br>
  {{department}}<br>
  <a href="mailto:{{mail}}">{{mail}}</a>
  </p>
</div>
"""

class TemplateBody(BaseModel):
    template: str

@app.post("/signature/template")
def save_template(body: TemplateBody):
    global signature_template
    signature_template = body.template
    return {"status": "Template updated"}

@app.get("/signature/user/{mail}")
def generate_signature(mail: str):
    if mail not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="Usuario no permitido")
    token = get_access_token()
    user = get_user_by_mail(token, mail)
    if not user:
        return {"error": "User not found"}

    # Mapea campos de Graph a tus claves
    replacements = {
        "nombre": user.get("displayName", ""),
        "puesto": user.get("jobTitle", ""),
        "departamento": user.get("department", ""),
        "celular": user.get("mobilePhone", "")
    }

    html = signature_template
    for key, value in replacements.items():
        html = re.sub(r"{{" + key + "}}", value or "", html)

    return {"mail": mail, "signature": html}

@app.get("/users")
def list_users():
    token = get_access_token()
    users = []
    for mail in ALLOWED_EMAILS:
        user = get_user_by_mail(token, mail)
        if user:
            users.append(user)
    return users

@app.get("/user-groups/{mail}")
async def list_groups(mail: str):
    if mail not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="Usuario no permitido")
    token = get_access_token()
    try:
        groups = get_user_groups(token, mail)
        return {"groups": groups}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/signature/apply/{mail}")
def apply_signature(mail: str = Path(...)):
    if mail not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="Usuario no permitido")

    token = get_access_token()
    user = get_user_by_mail(token, mail)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Generar HTML con reemplazos
    replacements = {
        "nombre": user.get("displayName", ""),
        "puesto": user.get("jobTitle", ""),
        "departamento": user.get("department", ""),
        "celular": user.get("mobilePhone", "")
    }
    html = signature_template
    for key, value in replacements.items():
        html = re.sub(r"{{" + key + "}}", value or "", html)

    # Escapar comillas para PowerShell
    safe_html = html.replace("'", "''")

    user = f"matias.martin"
    client_id = CLIENT_ID
    tenant_id = TENANT_ID
    client_secret = CLIENT_SECRET

    ps_command = f"""
    Import-Module ExchangeOnlineManagement;
    Connect-ExchangeOnline -AppId '{client_id}' -Organization '{tenant_id}' -AppSecret '{client_secret}' -ShowProgress $false -ErrorAction Stop;
    Set-TransportRule -Identity 'matias.martin' -ApplyDisclaimerText '{safe_html}' -ApplyDisclaimerFallbackAction Reject;
    Disconnect-ExchangeOnline -Confirm:$false;
    """

    # Ejecutamos PowerShell
    completed = subprocess.run(
        ["powershell", "-Command", ps_command],
        capture_output=True,
        text=True,
        shell=True
    )

    if completed.returncode != 0:
        print("Error ejecutando PowerShell:", completed.stderr)
        raise Exception(f"PowerShell error: {completed.stderr}")
    else:
        print("Regla aplicada correctamente:", completed.stdout)

    return {"status": "Firma aplicada", "mail": mail}

