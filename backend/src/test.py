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

APP_ID = os.getenv("APP_ID")
CERT_PASSWORD = os.getenv("CERT_PASSWORD")
ORGANIZARTION = os.getenv("ORGANIZATION")
CERT_ROUTE = os.getenv("CERT_ROUTE")


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


@app.post("/signature/apply")
def apply_signature():
    
    html = signature_template

    # Escapar comillas para PowerShell
    safe_html = html.replace("'", "''")

    RULE_NAME="firma de user martin.matias"
    
    ps_command = f"""
    Import-Module ExchangeOnlineManagement;

    Connect-ExchangeOnline -AppId '{APP_ID}' `
                        -Organization '{ORGANIZARTION}' `
                        -CertificateFile '{CERT_ROUTE}' `
                        -CertificatePassword (ConvertTo-SecureString '{CERT_PASSWORD}' -AsPlainText -Force);

    Set-TransportRule -Identity '{RULE_NAME}' `
                    -ApplyHtmlDisclaimerText '{safe_html}' `
                    -ApplyHtmlDisclaimerFallbackAction Reject
                    
    Disable-TransportRule -Identity '{RULE_NAME} -Confirm:$false'
    Enable-TransportRule -Identity '{RULE_NAME} -Confirm:$false'

    Disconnect-ExchangeOnline -Confirm:$false;
    """

    # Ejecutamos PowerShell
    completed = subprocess.run(
        ["pwsh", "-Command", ps_command],
        capture_output=True,
        text=True,
    )

    print("---- STDOUT ----")
    print(completed.stdout)
    print("---- STDERR ----")
    print(completed.stderr)
    
    if completed.returncode != 0:
        print("Error ejecutando PowerShell:", completed.stderr)
        raise Exception(f"PowerShell error: {completed.stderr}")
    else:
        print("Regla aplicada correctamente:", completed.stdout)

    return {"status": "Firma aplicada"}

