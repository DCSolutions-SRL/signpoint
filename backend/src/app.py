from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users, get_user_groups
import re
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError

from db import check_connection, connect_with_credentials

app = FastAPI()

# CORS: permitir localhost y la IP LAN usada por Vite; configurable por env CORS_ALLOW_ORIGINS (lista separada por comas)
_cors_origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://192.168.79.118:5173",
,
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
    # Valida usuario/contraseña intentando conectar a SQL Server
    result = check_connection(body.username, body.password)
    if not result.get("ok"):
        raise HTTPException(status_code=401, detail="Credenciales inválidas o DB inaccesible")
    token = create_access_token({"sub": body.username})
    return TokenResponse(access_token=token)


@app.get("/health/db")
def health_db():
    return check_connection()

@app.post("/signature/template")
def save_template(body: TemplateBody, user: str = Depends(get_current_user)):
    global signature_template
    signature_template = body.template
    return {"status": "Template updated"}

@app.get("/signature/user/{mail}")
def generate_signature(mail: str, user: str = Depends(get_current_user)):
    token = get_access_token()
    user = get_user_by_mail(token, mail)
    if not user:
        return {"error": "User not found"}

    html = signature_template
    for key in ["displayName", "mail", "jobTitle", "department"]:
        value = user.get(key) or ""
        html = re.sub(r"{{" + key + "}}", value, html)

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