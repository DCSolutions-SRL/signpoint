# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('../../.env', '.'), ('db.py', '.'), ('test.py', '.'), ('app.py', '.'), ('graph_service.py', '.')],
    hiddenimports=['requests', 'fastapi', 'fastapi.middleware.cors', 'fastapi.responses', 'fastapi.requests', 'starlette', 'starlette.responses', 'starlette.requests', 'uvicorn', 'uvicorn.config', 'uvicorn.main', 'uvicorn.logging', 'pydantic', 'pydantic_core', 'passlib', 'passlib.context', 'passlib.handlers.bcrypt', 'anyio', 'h11', 'jose', 'jose.jwt', 'jose.backends', 'pyodbc', 'dotenv', 'typing', 'typing_extensions'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='launcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
