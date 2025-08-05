from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph_service import get_access_token, get_user_by_mail, get_all_users
import re

app = FastAPI()

# Permitir peticiones desde React en localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # <-- cambia aquí si usás otro host/puerto
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

@app.post("/signature/template")
def save_template(body: TemplateBody):
    global signature_template
    signature_template = body.template
    return {"status": "Template updated"}

@app.get("/signature/user/{mail}")
def generate_signature(mail: str):
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
def list_users():
    token = get_access_token()
    users = get_all_users(token)
    return users