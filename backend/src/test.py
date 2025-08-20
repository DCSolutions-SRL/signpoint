from fastapi import FastAPI, HTTPException, Path, Depends
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users, get_user_groups
import re
import subprocess
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from db import check_connection

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


# CORS: permitir localhost y la IP LAN usada por Vite; configurable por env CORS_ALLOW_ORIGINS (lista separada por comas)
_cors_origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://192.168.79.118:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
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


# ====== Auth / Login (JWT simple) ======
SECRET_KEY = os.getenv("SIGNPOINT_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ApplyRequest(BaseModel):
    rule_name: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(authorization: Optional[str] = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Falta token")
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="Token inválido")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Token inválido")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest):
    result = check_connection(body.username, body.password)
    if not result.get("ok"):
        raise HTTPException(status_code=401, detail="Credenciales inválidas o DB inaccesible")
    token = create_access_token({"sub": body.username})
    return TokenResponse(access_token=token)


@app.get("/health/db")
def health_db():
    return check_connection()

@app.post("/signature/template")
def save_template(body: TemplateBody):
    global signature_template
    signature_template = body.template
    return {"status": "Template updated"}

@app.get("/signature/user/{mail}")
def generate_signature(mail: str, user: str = Depends(get_current_user)):
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
def list_users(user: str = Depends(get_current_user)):
    token = get_access_token()
    users = []
    for mail in ALLOWED_EMAILS:
        user = get_user_by_mail(token, mail)
        if user:
            users.append(user)
    return users

@app.get("/user-groups/{mail}")
async def list_groups(mail: str, user: str = Depends(get_current_user)):
    if mail not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="Usuario no permitido")
    token = get_access_token()
    try:
        groups = get_user_groups(token, mail)
        return {"groups": groups}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/signature/apply")
def apply_signature(req: ApplyRequest):
    
    html = signature_template

    # Escapar comillas para PowerShell
    safe_html = html.replace("'", "''")

    RULE_NAME= req.rule_name
    
    ps_command = f"""
    Import-Module ExchangeOnlineManagement;

    Connect-ExchangeOnline -AppId '{APP_ID}' `
                        -Organization '{ORGANIZARTION}' `
                        -CertificateFile '{CERT_ROUTE}' `
                        -CertificatePassword (ConvertTo-SecureString '{CERT_PASSWORD}' -AsPlainText -Force);

    Set-TransportRule -Identity '{RULE_NAME}' `
                    -ApplyHtmlDisclaimerText '{html}' `
                    -ApplyHtmlDisclaimerFallbackAction Wrap
                    
    Disable-TransportRule -Identity '{RULE_NAME}' -Confirm:$false
    Enable-TransportRule -Identity '{RULE_NAME}' -Confirm:$false

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

