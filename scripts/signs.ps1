# Intentar importar el módulo ActiveDirectory (si se requiere en el futuro)
try {
	Import-Module ActiveDirectory -ErrorAction Stop
	Write-Host "Módulo ActiveDirectory importado correctamente."
} catch {
	Write-Host "Advertencia: No se pudo importar el módulo ActiveDirectory. Si no se requiere, puede ignorar este mensaje."
}
# Script: signs.ps1
# Objetivo: Sincronizar la firma de Outlook Web (Exchange Online) con Outlook Desktop
# Autor: DCSolutions SRL

# 1. Configuración inicial
$ErrorActionPreference = "Stop"

# 2. Forzar prueba: buscar y aplicar la firma del usuario matias.martin
# ---
# PARA PRODUCCIÓN:
# $usuarioWindows = $env:USERNAME
# $nombrePC = $env:COMPUTERNAME
# Write-Host "Usuario de Windows detectado: $usuarioWindows"
# Write-Host "Nombre de la PC: $nombrePC"
# ---
$usuarioWindows = "matias.martin"
$nombrePC = "matias-martin-pc"

Write-Host "[PRUEBA] Usuario de Windows forzado: $usuarioWindows"
Write-Host "[PRUEBA] Nombre de la PC forzado: $nombrePC"

# 3. Buscar usuario en EntraID (Azure AD) por usuario de la PC y por nombre de la PC
# Requiere módulo Microsoft.Graph instalado y permisos adecuados
try {
	Import-Module Microsoft.Graph.Users -ErrorAction Stop
	Write-Host "Módulo Microsoft.Graph.Users importado correctamente."
} catch {
	Write-Host "Instalando módulo Microsoft.Graph..."
	Install-Module Microsoft.Graph -Scope CurrentUser -Force -AllowClobber -Confirm:$false
	Import-Module Microsoft.Graph.Users
	Write-Host "Módulo Microsoft.Graph.Users instalado e importado."
}

# Autenticación interactiva (puede cambiarse por autenticación silenciosa si se requiere)
Write-Host "Iniciando autenticación con Microsoft Graph..."
Connect-MgGraph -Scopes "User.Read,MailboxSettings.Read"
Write-Host "Autenticación con Microsoft Graph completada."

# Buscar usuario en EntraID por usuario de la PC

Write-Host "Buscando usuario en EntraID por usuario de la PC ($usuarioWindows)..."
$usuarioAD = Get-MgUser -UserId $usuarioWindows -ErrorAction SilentlyContinue

# Si no existe, buscar por nombre de la PC
if (-not $usuarioAD) {
	Write-Host "No se encontró usuario EntraID con el nombre de usuario de la PC ($usuarioWindows). Buscando por nombre de la PC ($nombrePC)..."
	$usuarioAD = Get-MgUser -UserId $nombrePC -ErrorAction SilentlyContinue
}

if (-not $usuarioAD) {
	Write-Host "No se encontró usuario en EntraID que coincida con el usuario o el nombre de la PC. Abortando."
	exit 1
}

Write-Host "Usuario encontrado en EntraID: $($usuarioAD.UserPrincipalName)"


Write-Host "Obteniendo la firma de Outlook Web usando Microsoft Graph..."
$mailboxSettings = Get-MgUserMailboxSetting -UserId $usuarioWindows
$firmaHtml = $mailboxSettings.SignatureHtml
if (-not $firmaHtml) {
	Write-Host "No se encontró firma en Outlook Web para el usuario."
	exit 1
}
Write-Host "Firma obtenida correctamente."

# 6. Guardar la firma como archivo .htm en el escritorio
$rutaFirma = [System.IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "firma-outlook.htm")
$firmaHtml | Out-File -FilePath $rutaFirma -Encoding utf8

Write-Host "Firma exportada a: $rutaFirma"

# 7. Copiar la firma a la carpeta de firmas de Outlook Desktop
# Ruta típica de firmas en Outlook Desktop
$rutaFirmasOutlook = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Signatures")
if (-not (Test-Path $rutaFirmasOutlook)) {
	New-Item -ItemType Directory -Path $rutaFirmasOutlook | Out-Null
}

# Copiar el archivo .htm
Copy-Item -Path $rutaFirma -Destination (Join-Path $rutaFirmasOutlook "firma-outlook.htm") -Force

Write-Host "Firma aplicada en Outlook Desktop."

# 8. Mensaje final
Write-Host "Proceso completado correctamente."
