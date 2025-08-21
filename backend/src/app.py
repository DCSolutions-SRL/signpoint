from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users, get_user_groups
import re
import os
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Literal
from passlib.context import CryptContext

from jose import jwt, JWTError
from dotenv import load_dotenv

from db import check_connection, connect_with_credentials, connect_default

app = FastAPI()

# Cargar variables de entorno desde .env si existe
load_dotenv()

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


# ====== Roles y administración de usuarios de la app ======
class MeResponse(BaseModel):
    user: str
    role: Literal["admin", "user", "none"] = "none"


class AppUser(BaseModel):
    username: str
    role: Literal["admin", "user"]


class PasswordBody(BaseModel):
    password: str


def ensure_app_users_table():
    """Crea la tabla app_users si no existe (SQL Server)."""
    conn = connect_default()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'app_users')
            BEGIN
                CREATE TABLE app_users (
                    username NVARCHAR(128) NOT NULL PRIMARY KEY,
                    role NVARCHAR(16) NOT NULL CHECK (role IN ('admin','user')),
                    password_hash NVARCHAR(255) NULL,
                    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                    created_by NVARCHAR(128) NULL
                );
            END
            -- Asegurar columna password_hash si la tabla ya existía
            IF COL_LENGTH('app_users','password_hash') IS NULL
            BEGIN
                ALTER TABLE app_users ADD password_hash NVARCHAR(255) NULL;
            END
            """
        )
        conn.commit()
    finally:
        conn.close()


def get_user_role_from_db(username: str) -> Optional[str]:
    """Devuelve 'admin' | 'user' si existe, si no None. 'signpoint' es admin implícito."""
    if not username:
        return None
    if username.lower() == "signpoint":
        return "admin"
    ensure_app_users_table()
    conn = connect_default()
    try:
        cur = conn.cursor()
        cur.execute("SELECT role FROM app_users WHERE username = ?", (username,))
        row = cur.fetchone()
        if row:
            return row[0]
        return None
    finally:
        conn.close()


def require_admin(username: str):
    role = get_user_role_from_db(username)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@app.get("/auth/me", response_model=MeResponse)
def me(user: str = Depends(get_current_user)):
    role = get_user_role_from_db(user) or "none"
    return MeResponse(user=user, role=role)  # type: ignore[arg-type]


@app.get("/app-users", response_model=List[AppUser])
def list_app_users(user: str = Depends(get_current_user)):
    require_admin(user)
    ensure_app_users_table()
    conn = connect_default()
    try:
        cur = conn.cursor()
        cur.execute("SELECT username, role FROM app_users ORDER BY username")
        rows = cur.fetchall() or []
        return [AppUser(username=r[0], role=r[1]) for r in rows]
    finally:
        conn.close()


@app.post("/app-users", response_model=AppUser)
def upsert_app_user(app_user: AppUser, user: str = Depends(get_current_user)):
    require_admin(user)
    # Validar username básico (emails o nombres con @._- permitidos)
    if not re.fullmatch(r"[\w.@\-]{3,128}", app_user.username):
        raise HTTPException(status_code=400, detail="username inválido")
    ensure_app_users_table()
    conn = connect_default()
    try:
        cur = conn.cursor()
        # Upsert simple
        cur.execute(
            """
            IF EXISTS (SELECT 1 FROM app_users WHERE username = ?)
                UPDATE app_users SET role = ?, created_by = ? WHERE username = ?;
            ELSE
                INSERT INTO app_users (username, role, created_by) VALUES (?, ?, ?);
            """,
            (
                app_user.username,  # exists
                app_user.role, user, app_user.username,  # update
                app_user.username, app_user.role, user,  # insert
            ),
        )
        conn.commit()
        return app_user
    finally:
        conn.close()


@app.delete("/app-users/{username}")
def delete_app_user(username: str, user: str = Depends(get_current_user)):
    require_admin(user)
    if username.lower() == "signpoint":
        raise HTTPException(status_code=400, detail="No se puede eliminar 'signpoint'")
    if username.lower() == user.lower():
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    ensure_app_users_table()
    conn = connect_default()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM app_users WHERE username = ?", (username,))
        conn.commit()
        return {"status": "deleted", "username": username}
    finally:
        conn.close()


@app.post("/app-users/{username}/password")
def set_app_user_password(username: str, body: PasswordBody, user: str = Depends(get_current_user)):
    require_admin(user)
    if username.lower() == "signpoint":
        raise HTTPException(status_code=400, detail="No se puede cambiar contraseña de 'signpoint'")
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Contraseña demasiado corta (mínimo 6)")
    ensure_app_users_table()
    pwd_hash = pwd_context.hash(body.password)
    conn = connect_default()
    try:
        cur = conn.cursor()
        # Asegurar fila existente; si no, crear como user por defecto
        cur.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM app_users WHERE username = ?)
                INSERT INTO app_users (username, role, password_hash, created_by)
                VALUES (?, 'user', ?, ?);
            ELSE
                UPDATE app_users SET password_hash = ?, created_by = ? WHERE username = ?;
            """,
            (
                username,  # not exists check
                username, pwd_hash, user,  # insert
                pwd_hash, user, username,  # update
            ),
        )
        conn.commit()
        return {"status": "password_set", "username": username}
    finally:
        conn.close()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
def _verify_app_user_password(username: str, password: str) -> bool:
    """Verifica contraseña contra app_users.password_hash. Devuelve True si coincide."""
    ensure_app_users_table()
    conn = connect_default()
    try:
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM app_users WHERE username = ?", (username,))
        row = cur.fetchone()
        if not row:
            return False
        pwd_hash = row[0]
        if not pwd_hash:
            return False
        try:
            return pwd_context.verify(password, pwd_hash)
        except Exception:
            return False
    finally:
        conn.close()



def get_current_user(authorization: Optional[str] = Header(None)):
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
    # 1) Intentar credenciales de la app (bcrypt)
    if _verify_app_user_password(body.username, body.password):
        token = create_access_token({"sub": body.username})
        return TokenResponse(access_token=token)
    # 2) Fallback: validar intentando conectar a SQL Server
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
    token = get_access_token()
    graph_user = get_user_by_mail(token, mail)
    if not graph_user:
        return {"error": "User not found"}

    # Soportar placeholders en español y en inglés
    replacements = {
        # Español
        "nombre": graph_user.get("displayName", ""),
        "puesto": graph_user.get("jobTitle", ""),
        "departamento": graph_user.get("department", ""),
        "celular": graph_user.get("mobilePhone", ""),
        # Inglés / claves originales
        "displayName": graph_user.get("displayName", ""),
        "jobTitle": graph_user.get("jobTitle", ""),
        "department": graph_user.get("department", ""),
        "mail": graph_user.get("mail", ""),
    }

    html = signature_template
    for key, value in replacements.items():
        html = re.sub(r"{{" + key + "}}", value or "", html)

    return {"mail": mail, "signature": html}


@app.get("/users")
def list_users(user: str = Depends(get_current_user)):
    token = get_access_token()
    users = get_all_users(token)
    return users

@app.get("/user-groups/{mail}")
async def list_groups(mail: str, user: str = Depends(get_current_user)):
    token = get_access_token()
    try:
        groups = get_user_groups(token, mail)
        return {"groups": groups}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ====== Aplicar firma en Exchange Online (PowerShell) ======
# Variables de entorno requeridas para conexión por certificado
APP_ID = os.getenv("APP_ID")
CERT_PASSWORD = os.getenv("CERT_PASSWORD")
# Aceptar tanto ORGANIZATION (correcto) como ORGANIZARTION (legacy/typo)
ORGANIZATION = os.getenv("ORGANIZATION") or os.getenv("ORGANIZARTION")
CERT_ROUTE = os.getenv("CERT_ROUTE")


@app.post("/signature/apply")
def apply_signature(req: ApplyRequest, user: str = Depends(get_current_user)):
    """Aplica la firma HTML actual a una regla de transporte en Exchange Online.

    Requiere que PowerShell Core (pwsh) y el módulo ExchangeOnlineManagement
    estén instalados en el servidor.
    """

    # Validaciones mínimas de configuración
    missing = [
        name for name, value in [
            ("APP_ID", APP_ID),
            ("CERT_PASSWORD", CERT_PASSWORD),
            ("ORGANIZATION", ORGANIZATION),
            ("CERT_ROUTE", CERT_ROUTE),
        ]
        if not value
    ]
    if missing:
        raise HTTPException(status_code=500, detail=f"Faltan variables de entorno: {', '.join(missing)}")

    html = signature_template or ""

    # Escapar comillas simples para PowerShell (strings comillas simples)
    safe_html = (html or "").replace("'", "''")

    rule_name = req.rule_name
    if not rule_name:
        raise HTTPException(status_code=400, detail="rule_name es requerido")

    ps_command = f"""
    Import-Module ExchangeOnlineManagement;

    Connect-ExchangeOnline -AppId '{APP_ID}' `
                        -Organization '{ORGANIZATION}' `
                        -CertificateFile '{CERT_ROUTE}' `
                        -CertificatePassword (ConvertTo-SecureString '{CERT_PASSWORD}' -AsPlainText -Force);

    Set-TransportRule -Identity '{rule_name}' `
                    -ApplyHtmlDisclaimerText '{safe_html}' `
                    -ApplyHtmlDisclaimerFallbackAction Wrap;

    Disable-TransportRule -Identity '{rule_name}' -Confirm:$false;
    Enable-TransportRule -Identity '{rule_name}' -Confirm:$false;

    Disconnect-ExchangeOnline -Confirm:$false;
    """

    try:
        completed = subprocess.run([
            "pwsh",
            "-Command",
            ps_command,
        ], capture_output=True, text=True)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="PowerShell (pwsh) no encontrado en el sistema")

    if completed.returncode != 0:
        err = completed.stderr.strip() or "Error desconocido ejecutando PowerShell"
        raise HTTPException(status_code=500, detail=f"PowerShell error: {err}")

    return {"status": "Firma aplicada"}