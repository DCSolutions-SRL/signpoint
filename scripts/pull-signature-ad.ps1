<# 
PUNTOS PERSONALIZABLES:
  - $ContextFilePath          -> Dónde leer el contexto.
  - $SignatureName            -> Nombre de la firma local (sin extensión).
  - $SetAsDefault             -> Si desea establecerla como firma por defecto en Outlook.
  - $OutlookOfficeVersions    -> Versiones de Office para aplicar NewSignature/ReplySignature (HKCU).
  - $PreferredSource          -> 'ExchangeOnline' (estable) o 'GraphBeta' (experimental).
  - Autenticación Graph       -> $GraphAuthMode ('DeviceCode' o 'AppOnlyCertificate'), $TenantId, $ClientId, $CertificateThumbprint
  - Autenticación Exchange    -> $ExoAuthMode ('Delegated' o 'AppOnlyCertificate'), $EXO_Tenant, $EXO_AppId, $EXO_CertificateThumbprint
#>

[CmdletBinding()]
param(
  # CONFIGURACIÓN: Ruta del contexto generado por el primer script
  [string]$ContextFilePath = "$env:ProgramData\SigSync\context.json",

  # CONFIGURACIÓN: Nombre del archivo de firma local (sin extensión). 
  # Puede personalizarse por cliente. Ej: "Firma_OBSBA"
  [string]$SignatureName = "Firma_Corporativa",

  # CONFIGURACIÓN: Establecer firma por defecto en Outlook (nuevos y respuestas)
  [bool]$SetAsDefault = $true,

  # CONFIGURACIÓN: Versiones Office a configurar (si SetAsDefault = $true)
  [string[]]$OutlookOfficeVersions = @('16.0','15.0'),

  # CONFIGURACIÓN: Fuente preferida para obtener la firma
  [ValidateSet('ExchangeOnline','GraphBeta')]
  [string]$PreferredSource = 'ExchangeOnline',

  # CONFIGURACIÓN: Autenticación Microsoft Graph
  [ValidateSet('DeviceCode','AppOnlyCertificate')]
  [string]$GraphAuthMode = 'DeviceCode',
  [string]$TenantId = "",               # Ej: "00000000-0000-0000-0000-000000000000" o "contoso.com"
  [string]$ClientId = "",               # App (Entra ID)
  [string]$CertificateThumbprint = "",  # Cert. instalado en Personal\Certificates (LocalMachine o CurrentUser)
  [string[]]$GraphScopes = @('MailboxSettings.Read'),

  # CONFIGURACIÓN: Autenticación Exchange Online
  [ValidateSet('Delegated','AppOnlyCertificate')]
  [string]$ExoAuthMode = 'Delegated',
  [string]$EXO_Tenant = "",                 # Ej: "obsba.org.ar"
  [string]$EXO_AppId = "",                  # Para App-Only
  [string]$EXO_CertificateThumbprint = ""   # Para App-Only
)

function Read-Context {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No se encontró el archivo de contexto en '$Path'. Ejecute primero 01-Validate-LocalUser-vs-AD.ps1."
  }
  $json = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
  return $json | ConvertFrom-Json -ErrorAction Stop
}

function Test-Module {
  param(
    [string]$Name,
    [string]$InstallHint
  )
  if (-not (Get-Module -ListAvailable -Name $Name)) {
    Write-Error "No se encontró el módulo '$Name'. $InstallHint"
    throw "Falta módulo $Name"
  }
}

function Connect-GraphIfNeeded {
  param(
    [ValidateSet('DeviceCode','AppOnlyCertificate')]
    [string]$Mode,
    [string]$TenantId,
    [string]$ClientId,
    [string]$CertificateThumbprint,
    [string[]]$Scopes
  )
  Test-Module -Name "Microsoft.Graph" -InstallHint "Instale con: Install-Module Microsoft.Graph -Scope AllUsers"
  try {
    if ($Mode -eq 'DeviceCode') {
      if (-not $ClientId) { Write-Host "Nota: Con DeviceCode, puede omitir ClientId para usar app pública por defecto del módulo." -ForegroundColor Yellow }
      $params = @{ }
      if ($TenantId) { $params['TenantId'] = $TenantId }
      if ($Scopes)   { $params['Scopes']   = $Scopes }
      Connect-MgGraph @params -NoWelcome -ErrorAction Stop | Out-Null
    } else {
      if (-not ($TenantId -and $ClientId -and $CertificateThumbprint)) {
        throw "Para AppOnlyCertificate en Graph, establezca TenantId, ClientId y CertificateThumbprint."
      }
      Connect-MgGraph -TenantId $TenantId -ClientId $ClientId -CertificateThumbprint $CertificateThumbprint -NoWelcome -ErrorAction Stop | Out-Null
    }
    Write-Host "Conectado a Microsoft Graph." -ForegroundColor Green
  }
  catch {
    throw "Error conectando a Graph: $($_.Exception.Message)"
  }
}

function Get-SignatureFromGraphBeta {
  param([string]$UserId)
  # NOTA IMPORTANTE:
  # - El acceso a la firma vía Microsoft Graph puede requerir el endpoint /beta y no está garantizado en todos los tenants.
  # - Este bloque intenta leer mailboxSettings y buscar campos que contengan 'signature'.
  $uri = "https://graph.microsoft.com/beta/users/$([uri]::EscapeDataString($UserId))/mailboxSettings"
  try {
    $resp = Invoke-MgGraphRequest -Method GET -Uri $uri -ErrorAction Stop
  }
  catch {
    Write-Warning "Graph beta mailboxSettings no disponible o permisos insuficientes: $($_.Exception.Message)"
    return $null
  }

  # Heurística: algunos tenants exponen 'signature' como string; otros podrían no exponerlo.
  $sigHtml = $null
  $sigText = $null

  if ($resp.PSObject.Properties.Name -contains 'signature') {
    $sig = $resp.signature
    if ($sig -and $sig -is [string]) {
      $sigHtml = [string]$sig
    }
  }

  # Si no hay 'signature', intente descubrir propiedades relacionadas
  if (-not $sigHtml) {
    foreach ($p in $resp.PSObject.Properties) {
      if ($p.Name -match 'signature') {
        if ($p.Value -is [string] -and [string]::IsNullOrWhiteSpace($sigHtml)) { $sigHtml = [string]$p.Value }
        elseif ($p.Value -is [pscustomobject]) {
          # algunos previews podrían exponer estructuras; intente campos Html/Text si existen
          if ($p.Value.PSObject.Properties.Name -contains 'html') { $sigHtml = $p.Value.html }
          if ($p.Value.PSObject.Properties.Name -contains 'text') { $sigText = $p.Value.text }
        }
      }
    }
  }

  if (-not $sigHtml -and -not $sigText) {
    Write-Warning "Graph no devolvió firma. Es posible que su tenant no exponga mailboxSettings.signature en /beta."
    return $null
  }

  # Si sólo hay HTML, generaremos texto a partir de él más adelante
  [pscustomobject]@{
    SignatureHtml = $sigHtml
    SignatureText = $sigText
    Source        = 'GraphBeta'
  }
}

function Connect-ExchangeOnlineIfNeeded {
  param(
    [ValidateSet('Delegated','AppOnlyCertificate')]
    [string]$Mode,
    [string]$Tenant,
    [string]$AppId,
    [string]$CertThumb
  )
  Test-Module -Name "ExchangeOnlineManagement" -InstallHint "Instale con: Install-Module ExchangeOnlineManagement -Scope AllUsers"
  try {
    if ($Mode -eq 'Delegated') {
      if ($Tenant) {
        Connect-ExchangeOnline -ShowBanner:$false -ErrorAction Stop -Organization $Tenant | Out-Null
      } else {
        Connect-ExchangeOnline -ShowBanner:$false -ErrorAction Stop | Out-Null
      }
    } else {
      if (-not ($Tenant -and $AppId -and $CertThumb)) {
        throw "Para AppOnlyCertificate en EXO, establezca EXO_Tenant, EXO_AppId y EXO_CertificateThumbprint."
      }
      Connect-ExchangeOnline -AppId $AppId -Organization $Tenant -CertificateThumbprint $CertThumb -ShowBanner:$false -ErrorAction Stop | Out-Null
    }
    Write-Host "Conectado a Exchange Online." -ForegroundColor Green
  }
  catch {
    throw "Error conectando a Exchange Online: $($_.Exception.Message)"
  }
}

function Get-SignatureFromExchangeOnline {
  param([string]$UserId)
  try {
    $cfg = Get-MailboxMessageConfiguration -Identity $UserId -ErrorAction Stop
    # Campos disponibles típicamente: SignatureHtml, SignatureText
    if ([string]::IsNullOrWhiteSpace($cfg.SignatureHtml) -and [string]::IsNullOrWhiteSpace($cfg.SignatureText)) {
      Write-Warning "El buzón no tiene firma configurada en OWA/EXO."
      return $null
    }
    [pscustomobject]@{
      SignatureHtml = $cfg.SignatureHtml
      SignatureText = $cfg.SignatureText
      Source        = 'ExchangeOnline'
    }
  }
  catch {
    throw "Error obteniendo la firma desde EXO: $($_.Exception.Message)"
  }
}

function Convert-HtmlToText {
  param([string]$Html)
  if ([string]::IsNullOrWhiteSpace($Html)) { return "" }
  $text = $Html -replace '<\s*br\s*/?>', "`r`n"
  $text = $text -replace '<\s*/p\s*>', "`r`n"
  $text = $text -replace '<[^>]+>', ''         # remover etiquetas
  $text = [System.Web.HttpUtility]::HtmlDecode($text)
  # Normalizar saltos
  $text = $text -replace "(`r`n){3,}", "`r`n`r`n"
  return $text.Trim()
}

function ConvertTo-RtfEscapedText {
  param([string]$Text)
  if ($null -eq $Text) { return "" }
  $t = $Text -replace '\\', '\\\'    # backslash
  $t = $t -replace '{', '\{'         # llave abierta
  $t = $t -replace '}', '\}'         # llave cerrada
  # Reemplazar saltos de línea por \par
  $t = $t -replace "(`r`n|\n|\r)", '\par '
  return $t
}

function Convert-TextToRtf {
  param([string]$Text)
  $escaped = ConvertTo-RtfEscapedText -Text $Text
  $rtf = "{\rtf1\ansi\deff0{\fonttbl{\f0 Arial;}}\fs20 $escaped}"
  return $rtf
}

function Write-SignatureFiles {
  param(
    [string]$SignatureName,
    [string]$HtmlContent,
    [string]$TextContent
  )

  $sigRoot = Join-Path $env:APPDATA "Microsoft\Signatures"
  if (-not (Test-Path -LiteralPath $sigRoot)) {
    New-Item -ItemType Directory -Path $sigRoot -Force | Out-Null
  }

  $htmPath = Join-Path $sigRoot ($SignatureName + ".htm")
  $rtfPath = Join-Path $sigRoot ($SignatureName + ".rtf")
  $txtPath = Join-Path $sigRoot ($SignatureName + ".txt")

  # HTML
  if (-not [string]::IsNullOrWhiteSpace($HtmlContent)) {
    # Outlook espera un HTML con <html> y <body> en la firma; si no vienen, añadimos contenedor básico
    $htmlToWrite = $HtmlContent
    if ($HtmlContent -notmatch '<\s*html' -or $HtmlContent -notmatch '<\s*body') {
      $htmlToWrite = @"
<html>
  <head>
    <meta http-equiv='Content-Type' content='text/html; charset=utf-8'>
  </head>
  <body>
    $HtmlContent
  </body>
</html>
"@
    }
    $htmlToWrite | Out-File -LiteralPath $htmPath -Encoding UTF8
    Write-Host "Escribido: $htmPath" -ForegroundColor Green
  } else {
    Write-Warning "No hay contenido HTML de firma para escribir."
    if ([string]::IsNullOrWhiteSpace($TextContent)) {
      # Evitar dejar archivos vacíos
      $TextContent = " "
    }
  }

  # Texto
  $textToWrite = $TextContent
  if ([string]::IsNullOrWhiteSpace($textToWrite) -and -not [string]::IsNullOrWhiteSpace($HtmlContent)) {
    $textToWrite = Convert-HtmlToText -Html $HtmlContent
  }
  $textToWrite | Out-File -LiteralPath $txtPath -Encoding UTF8
  Write-Host "Escribido: $txtPath" -ForegroundColor Green

  # RTF (generado a partir del texto)
  $rtf = Convert-TextToRtf -Text $textToWrite
  $rtf | Out-File -LiteralPath $rtfPath -Encoding ASCII
  Write-Host "Escribido: $rtfPath" -ForegroundColor Green

  return @{
    HtmPath = $htmPath
    TxtPath = $txtPath
    RtfPath = $rtfPath
  }
}

function Set-DefaultSignatureIfRequested {
  param([string]$SignatureName)
  if (-not $SetAsDefault) { return }

  foreach ($ver in $OutlookOfficeVersions) {
    $key = "HKCU:\Software\Microsoft\Office\$ver\Common\MailSettings"
    try {
      if (-not (Test-Path $key)) {
        New-Item -Path $key -Force | Out-Null
      }
      New-ItemProperty -Path $key -Name "NewSignature"   -Value $SignatureName -PropertyType String -Force | Out-Null
      New-ItemProperty -Path $key -Name "ReplySignature" -Value $SignatureName -PropertyType String -Force | Out-Null
      Write-Host "Firma por defecto establecida para Office $ver (Nuevos/Respuestas): '$SignatureName'." -ForegroundColor Cyan
    }
    catch {
      Write-Warning "No se pudo establecer firma por defecto para Office ${ver}: $($_.Exception.Message)"
    }
  }
}

try {
  Write-Host "Sincronización de firma de Outlook local desde la nube" -ForegroundColor Cyan

  $ctx = Read-Context -Path $ContextFilePath
  $userUPN  = $ctx.AD.UserPrincipalName
  $userMail = $ctx.AD.Mail
  $userSam  = $ctx.AD.SamAccountName

  if (-not $userUPN -and -not $userMail -and -not $userSam) {
    throw "El contexto no contiene identificadores suficientes del usuario (UPN/Mail/Sam)."
  }

  # Elegimos el mejor identificador para la nube (UPN preferido)
  $cloudId = $userUPN
  if (-not $cloudId) { $cloudId = $userMail }
  if (-not $cloudId) { $cloudId = $userSam }

  Write-Host "Usuario objetivo: $cloudId" -ForegroundColor Gray
  Write-Host "Origen preferido: $PreferredSource" -ForegroundColor Gray

  $sig = $null

  if ($PreferredSource -eq 'GraphBeta') {
    try {
      Connect-GraphIfNeeded -Mode $GraphAuthMode -TenantId $TenantId -ClientId $ClientId -CertificateThumbprint $CertificateThumbprint -Scopes $GraphScopes
      $sig = Get-SignatureFromGraphBeta -UserId $cloudId
    }
    catch {
      Write-Warning $_
    }
  }

  if (-not $sig -and $PreferredSource -ne 'ExchangeOnline') {
    Write-Host "Fallo o no disponible vía GraphBeta; intentando Exchange Online..." -ForegroundColor Yellow
  }

  if (-not $sig) {
    Connect-ExchangeOnlineIfNeeded -Mode $ExoAuthMode -Tenant $EXO_Tenant -AppId $EXO_AppId -CertThumb $EXO_CertificateThumbprint
    $sig = Get-SignatureFromExchangeOnline -UserId $cloudId
  }

  if (-not $sig) {
    throw "No se obtuvo firma desde la nube para el usuario '$cloudId'."
  }

  $html = $sig.SignatureHtml
  $txt  = $sig.SignatureText

  if ([string]::IsNullOrWhiteSpace($html) -and [string]::IsNullOrWhiteSpace($txt)) {
    throw "La firma del usuario está vacía."
  }

  # Advertencia sobre Outlook en ejecución
  $outlookProc = Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue
  if ($outlookProc) {
    Write-Host "Outlook está en ejecución. Se recomienda cerrarlo para aplicar la firma sin bloqueos." -ForegroundColor Yellow
  }

  $written = Write-SignatureFiles -SignatureName $SignatureName -HtmlContent $html -TextContent $txt
  Set-DefaultSignatureIfRequested -SignatureName $SignatureName

  # Verificación básica
  $ok = Test-Path -LiteralPath $written.HtmPath -PathType Leaf -and `
        Test-Path -LiteralPath $written.TxtPath -PathType Leaf -and `
        Test-Path -LiteralPath $written.RtfPath -PathType Leaf

  if ($ok) {
    Write-Host "Firma aplicada correctamente en: $($written.HtmPath | Split-Path -Parent)" -ForegroundColor Green
    Write-Host "Origen de firma: $($sig.Source)" -ForegroundColor Green
    exit 0
  } else {
    throw "No se pudieron verificar los archivos de firma."
  }
}
catch {
  Write-Error "Error: $($_.Exception.Message)"
  exit 99
}
finally {
  # Cierre de sesiones remotas (mejor práctica)
  if (Get-Module -Name ExchangeOnlineManagement -ListAvailable) {
    try { Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
  }
  if (Get-Module -Name Microsoft.Graph -ListAvailable) {
    try { Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null } catch {}
  }
}