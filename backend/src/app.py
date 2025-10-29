from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users, get_user_groups
import re
import os
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Literal
from pathlib import Path
from passlib.context import CryptContext
from jose import jwt, JWTError
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build


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


SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE", "service_account.json")
SCOPES = ["https://www.googleapis.com/auth/admin.directory.user.readonly",
          "https://www.googleapis.com/auth/gmail.settings.basic"
        ]

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=SCOPES
)

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

excluded_users = os.getenv("EXCLUDED_EMAILS", "")
excluded_users_list = [e.strip() for e in excluded_users.split(",") if e.strip()]


@app.get("/signature/user/{email}")
def get_signature(email: str):
    try:
        # Impersonar al usuario
        delegated_creds = credentials.with_subject(email)
        service = build("gmail", "v1", credentials=delegated_creds)
        sig = service.users().settings().sendAs().get(userId=email, sendAsEmail=email).execute()
        return {"signature": sig.get("signature", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class SignatureUpdate(BaseModel):
    email: str
    signature: str

@app.post("/signature/update")
def update_signature(data: SignatureUpdate):
    try:
        delegated_creds = credentials.with_subject(data.email)
        service = build("gmail", "v1", credentials=delegated_creds)
        send_as = service.users().settings().sendAs().get(userId=data.email, sendAsEmail=data.email).execute()
        send_as['signature'] = data.signature
        service.users().settings().sendAs().patch(
            userId=data.email, 
            sendAsEmail=data.email, 
            body={"signature": data.signature,
                  "replyToAddress": data.email,
                  "isDefault": True,
                  "treatAsAlias": True
                 }
        ).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/signature/users/all") 
def getAllUsers():
    try:
         # Delegamos credenciales al admin para leer todos los usuarios
        delegated_creds = credentials.with_subject(ADMIN_EMAIL)
        service = build("admin", "directory_v1", credentials=delegated_creds)
        
        # Traemos todos los usuarios del dominio
        results = service.users().list(domain="dcs.ar", maxResults=500).execute()
        users = results.get("users", [])

        signatures = {}
        
        for u in users:
            email = u["primaryEmail"]
            if email in excluded_users_list:
                continue
            try:
                # Impersonar cada usuario para obtener la firma de Gmail
                delegated = credentials.with_subject(email)
                gmail_service = build("gmail", "v1", credentials=delegated)
                send_as = gmail_service.users().settings().sendAs().get(
                    userId=email, sendAsEmail=email
                ).execute()
                signatures[email] = send_as.get("signature", "")
            except Exception as e:
                signatures[email] = ""
                print(f"Error obteniendo firma de {email}: {e}")

        return signatures

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TemplateBody(BaseModel):
    template: str
    name: Optional[str] = None

class TemplateMeta(BaseModel):
    name: str
    kind: Literal["builtin", "user"]

TEMPLATES_ROOT = Path(__file__).parent / "templates"
USER_TEMPLATES = TEMPLATES_ROOT / "user"
BUILTIN_TEMPLATES = TEMPLATES_ROOT / "builtin"
USER_TEMPLATES.mkdir(parents=True, exist_ok=True)
BUILTIN_TEMPLATES.mkdir(parents=True, exist_ok=True)

def _sanitize_name(name: str) -> str:
    # evitar escapes o rutas
    name = name.strip().replace("/", " ").replace("\\", " ")
    if not name:
        raise HTTPException(status_code=400, detail="Nombre de plantilla vacío")
    return name

def list_templates_meta() -> List[TemplateMeta]:
    items: List[TemplateMeta] = []
    # builtin
    for p in BUILTIN_TEMPLATES.glob("*.htm*"):
        items.append(TemplateMeta(name=p.stem, kind="builtin"))
    # user
    for p in USER_TEMPLATES.glob("*.htm*"):
        items.append(TemplateMeta(name=p.stem, kind="user"))
    # ordenar: builtin primero alfabético, luego user alfabético
    return sorted(items, key=lambda x: (0 if x.kind=="builtin" else 1, x.name.lower()))

def load_template_by_name(name: str) -> Optional[str]:
    safe = _sanitize_name(name)
    for folder in (USER_TEMPLATES, BUILTIN_TEMPLATES):
        for ext in (".htm", ".html"):
            p = folder / f"{safe}{ext}"
            if p.exists():
                return p.read_text(encoding="utf-8")
    return None

def save_user_template(name: str, content: str):
    safe = _sanitize_name(name)
    p = USER_TEMPLATES / f"{safe}.htm"
    p.write_text(content or "", encoding="utf-8")

def delete_user_template(name: str):
    safe = _sanitize_name(name)
    deleted = False
    for ext in (".htm", ".html"):
        p = USER_TEMPLATES / f"{safe}{ext}"
        if p.exists():
            p.unlink()
            deleted = True
    if not deleted:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada para borrar")


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
    if username.lower() in ["signpoint", "admin"]:
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
def me(user: str):
    role = get_user_role_from_db(user) or "none"
    return MeResponse(user=user, role=role)  # type: ignore[arg-type]


@app.get("/app-users", response_model=List[AppUser])
def list_app_users(user: str):
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
def upsert_app_user(app_user: AppUser, user: str):
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
def delete_app_user(username: str, user: str):
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
def set_app_user_password(username: str, body: PasswordBody, user: str):
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
    if body.username == "admin" and body.password == "admin":
        token = create_access_token({"sub": body.username})
        return TokenResponse(access_token=token)
    
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

@app.get("/templates", response_model=List[TemplateMeta])
def api_list_templates(user: str):
    return list_templates_meta()

@app.get("/templates/{name}")
def api_get_template(name: str, user: str):
    html = load_template_by_name(name)
    if html is None:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return {"name": name, "template": html}

class SaveNamedTemplateBody(BaseModel):
    name: str
    template: str
    overwrite: bool = False

@app.post("/templates")
def api_create_or_overwrite_template(body: SaveNamedTemplateBody, user: str):
    require_admin(user)
    existing_html = load_template_by_name(body.name)
    # si existe en builtin y no overwrite -> prohibir
    builtin_exists = any((BUILTIN_TEMPLATES / f"{_sanitize_name(body.name)}{ext}").exists() for ext in (".htm", ".html"))
    user_exists = any((USER_TEMPLATES / f"{_sanitize_name(body.name)}{ext}").exists() for ext in (".htm", ".html"))
    if (builtin_exists or user_exists) and not body.overwrite:
        # indicar que requiere confirmación
        raise HTTPException(status_code=409, detail="La plantilla ya existe. Requiere confirmación para sobrescribir.")
    # Sólo permitimos sobreescribir realmente en carpeta user (no tocamos builtin)
    save_user_template(body.name, body.template)
    return {"status": "saved", "name": body.name}

@app.delete("/templates/{name}")
def api_delete_template(name: str, user: str):
    require_admin(user)
    # No permitir borrar builtin
    if any((BUILTIN_TEMPLATES / f"{_sanitize_name(name)}{ext}").exists() for ext in (".htm", ".html")):
        raise HTTPException(status_code=400, detail="No se puede eliminar una plantilla predefinida")
    delete_user_template(name)
    return {"status": "deleted", "name": name}





@app.get("/users")
def list_users(user: str):
    token = get_access_token()
    users = get_all_users(token)
    return users



# ====== Aplicar firma en Exchange Online (PowerShell) ======
# Variables de entorno requeridas para conexión por certificado
APP_ID = os.getenv("APP_ID")
CERT_PASSWORD = os.getenv("CERT_PASSWORD")
# Aceptar tanto ORGANIZATION (correcto) como ORGANIZARTION (legacy/typo)
ORGANIZATION = os.getenv("ORGANIZATION") or os.getenv("ORGANIZARTION")
CERT_ROUTE = os.getenv("CERT_ROUTE")


