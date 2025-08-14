import os
from typing import Optional

import pyodbc
from dotenv import load_dotenv

load_dotenv()

# Config por entorno (con valores por defecto provistos)
SQL_SERVER = os.getenv("SQLSERVER_SERVER", "tcp:192.168.79.87,1433")
SQL_DATABASE = os.getenv("SQLSERVER_DATABASE", "SIGNPOINT")
SQL_USER = os.getenv("SQLSERVER_USER", "signpoint")
SQL_PASSWORD = os.getenv("SQLSERVER_PASSWORD", "SignP01ntPass!")


def _build_conn_str(server: str, database: str, user: str, password: str, driver_version: str) -> str:
    # Usamos TrustServerCertificate para simplificar en entornos internos
    return (
        f"DRIVER={{ODBC Driver {driver_version} for SQL Server}};"
        f"SERVER={server};DATABASE={database};UID={user};PWD={password};"
        f"Encrypt=no;TrustServerCertificate=yes;Connection Timeout=5;"
    )


def connect_with_credentials(user: str, password: str, server: Optional[str] = None, database: Optional[str] = None):
    """
    Intenta conectar a SQL Server probando ODBC Driver 18 y luego 17.
    Devuelve una conexión abierta si tiene éxito; lanza excepción si falla.
    """
    server = server or SQL_SERVER
    database = database or SQL_DATABASE

    last_err: Optional[Exception] = None
    for drv in ("18", "17"):
        try:
            conn_str = _build_conn_str(server, database, user, password, drv)
            conn = pyodbc.connect(conn_str)
            return conn
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    # Si no se pudo con ningún driver
    raise last_err or RuntimeError("No se pudo establecer la conexión con SQL Server")


def connect_default():
    """Conecta usando las credenciales por defecto del entorno."""
    return connect_with_credentials(SQL_USER, SQL_PASSWORD, SQL_SERVER, SQL_DATABASE)


def check_connection(user: Optional[str] = None, password: Optional[str] = None) -> dict:
    """Retorna un dict con ok: bool y details en caso de error."""
    try:
        if user is None or password is None:
            conn = connect_default()
        else:
            conn = connect_with_credentials(user, password)
        try:
            # Pequeña consulta no destructiva
            cur = conn.cursor()
            cur.execute("SELECT 1")
            _ = cur.fetchone()
        finally:
            conn.close()
        return {"ok": True}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
