# Script para obtener información de una regla de transporte en Exchange Online
# Uso: .\get-transport-rule.ps1 -RuleName "NOMBRE_REGLA"

param(
    [Parameter(Mandatory=$true)]
    [string]$RuleName
)


# Variables requeridas (hardcodeadas para pruebas)
$AppId = "f43c3208-4a8f-4f3a-ab66-e67e1fb9b27d"
$Organization = "obsba.org.ar"
$CertRoute = "/home/soporte/signpointCert.pfx"
$CertPassword = "Password01!"

if (-not $AppId -or -not $Organization -or -not $CertRoute -or -not $CertPassword) {
    Write-Error "Faltan datos requeridos: AppId, Organization, CertRoute, CertPassword"
    exit 1
}

Import-Module ExchangeOnlineManagement

Connect-ExchangeOnline -AppId $AppId `
    -Organization $Organization `
    -CertificateFile $CertRoute `
    -CertificatePassword (ConvertTo-SecureString $CertPassword -AsPlainText -Force)

# Obtener la regla de transporte
Get-TransportRule -Identity $RuleName | Format-List *

Disconnect-ExchangeOnline -Confirm:$false
