# Verificar e instalar ExchangeOnlineManagement si es necesario
if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
    Write-Host "Instalando módulo ExchangeOnlineManagement..."
    Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber
}

# Verificar e importar ActiveDirectory si está disponible
if (Get-Module -ListAvailable -Name ActiveDirectory) {
    Import-Module ActiveDirectory
    Write-Host "Módulo ActiveDirectory importado."
} else {
    Write-Host "Módulo ActiveDirectory no encontrado. Si necesitas validar usuarios de AD, instálalo desde RSAT o el Centro de administración de Windows." 
}
 

# signs.ps1 - Versión simple
param(
    [Parameter(Mandatory=$false)]
    [string]$RuleName = "firma $env:USERNAME"
)

# Datos de conexión (ajusta si es necesario)
$AppId = "f43c3208-4a8f-4f3a-ab66-e67e1fb9b27d"
$Organization = "obsba.org.ar"
$CertRoute = "/home/soporte/signpointCert.pfx"
$CertPassword = "Password01!"

# Conectar a Exchange Online
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -AppId $AppId `
    -Organization $Organization `
    -CertificateFile $CertRoute `
    -CertificatePassword (ConvertTo-SecureString $CertPassword -AsPlainText -Force)

# Obtener la regla de transporte
$Rule = Get-TransportRule -Identity $RuleName

if (-not $Rule) {
    Write-Error "No se encontró la regla de transporte $RuleName"
    Disconnect-ExchangeOnline -Confirm:$false
    exit 1
}

# Extraer la firma HTML
$FirmaHTML = $Rule.ApplyHtmlDisclaimerText

if (-not $FirmaHTML) {
    Write-Error "La regla no contiene firma HTML."
    Disconnect-ExchangeOnline -Confirm:$false
    exit 1
}

# Guardar la firma en la carpeta de firmas de Outlook
$SignaturePath = "$env:APPDATA\Microsoft\Signatures\firma-outlook.htm"
$FirmaHTML | Out-File -Encoding utf8 $SignaturePath

Write-Output "Firma aplicada en: $SignaturePath"

Disconnect-ExchangeOnline -Confirm:$false
