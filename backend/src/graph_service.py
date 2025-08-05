import os
import requests
from dotenv import load_dotenv

load_dotenv()

TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

TOKEN_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
GRAPH_API = "https://graph.microsoft.com/v1.0"

def get_access_token():
    data = {
        "client_id": CLIENT_ID,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    response = requests.post(TOKEN_URL, data=data)
    response.raise_for_status()
    return response.json().get("access_token")

def get_users(token, limit=10):
    headers = {"Authorization": f"Bearer {token}"}
    params = {"$select": "id,displayName,mail,jobTitle,department", "$top": limit}
    response = requests.get(f"{GRAPH_API}/users", headers=headers, params=params)
    response.raise_for_status()
    return response.json().get("value", [])

def get_user_groups(token, user_email):
    headers = {"Authorization": f"Bearer {token}"}
    # Usamos userPrincipalName que suele ser el email
    response = requests.get(f"{GRAPH_API}/users/{user_email}/memberOf", headers=headers)
    response.raise_for_status()
    groups = [
        g.get("displayName") 
        for g in response.json().get("value", []) 
        if g.get("@odata.type") == "#microsoft.graph.group"
    ]
    return groups

def get_user_by_mail(token, mail):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{GRAPH_API}/users/{mail}", headers=headers)
    if response.status_code == 200:
        return response.json()
    return None

def get_all_users(token):
    url = f"{GRAPH_API}/users"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    users = []
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        users = data.get("value", [])
    else:
        print(f"Error fetching users: {response.status_code} {response.text}")
    return users