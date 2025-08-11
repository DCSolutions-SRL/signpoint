<# 
EJEMPLOS:
  Usuario local: matias.martin
  Dominio local (NetBIOS): OBSBA
  UPN esperado: matias.martin@obsba.org.ar
  Mail esperado: matias.martin@obsba.org.ar

PUNTOS PERSONALIZABLES (ver variables en la sección "CONFIGURACIÓN"):
  - $ContextFilePath             -> Ruta donde se guardará el JSON con el contexto.
  - $DomainMappings              -> Mapeo NetBIOS -> DNS principal (p.ej. OBSBA -> obsba.org.ar)
  - $AllowedDnsDomainsByNetBIOS  -> Lista de dominios DNS permitidos por NetBIOS (p.ej. obsba.org.ar, obsba.local)
  - $SearchBase, $Server         -> Opcional, para acotar la búsqueda en AD a una OU o a un DC/GC específico.
  - $PreferredMatchOrder         -> Prioridad de criterios de match: SamAccountName, UPNLocalPart, MailLocalPart

SALIDA:
  - Código 0 si se valida y guarda contexto correctamente.
  - Códigos de error distintos de 0 si falla (no se encuentra usuario, múltiples coincidencias ambiguas, etc.).
#>

[CmdletBinding()]
param(
  # Usuario y dominio locales a validar (por defecto toma del entorno del usuario actual)
  [string]$LocalUserName = $env:USERNAME,
  [string]$LocalUserDomainNetBIOS = $env:USERDOMAIN,

  # CONFIGURACIÓN: Ruta del archivo de contexto que se usará en el segundo script
  [string]$ContextFilePath = "$env:ProgramData\SigSync\context.json",

  # CONFIGURACIÓN: Mapeo NetBIOS -> Dominio DNS principal
  # Agregue entradas según su infraestructura (ej: 'CONTOSO'='contoso.com')
  [hashtable]$DomainMappings = @{ 
    'OBSBA' = 'obsba.org.ar'
  },

  # CONFIGURACIÓN: Dominios DNS permitidos por cada NetBIOS (para tolerar variantes como .local)
  [hashtable]$AllowedDnsDomainsByNetBIOS = @{ 
    'OBSBA' = @('obsba.org.ar', 'obsba.local')
  },

  # CONFIGURACIÓN: Orden de preferencia de match
  [string[]]$PreferredMatchOrder = @('SamAccountName','UPNLocalPart','MailLocalPart'),

  # CONFIGURACIÓN (opcional): Scope de búsqueda en AD
  [string]$SearchBase,   # ej: "OU=Usuarios,DC=obsba,DC=org,DC=ar"
  [string]$Server        # ej: "dc01.obsba.org.ar"
)

function Initialize-ActiveDirectoryModule {
  if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
    Write-Error "No se encontró el módulo ActiveDirectory. Instale RSAT AD DS Tools. Abortando."
    exit 10
  }
  Import-Module ActiveDirectory -ErrorAction Stop
}

function Get-ExpectedDnsDomains {
  param(
    [string]$NetBIOS
  )
  $dnsList = @()
  if ($AllowedDnsDomainsByNetBIOS.ContainsKey($NetBIOS)) {
    $dnsList += $AllowedDnsDomainsByNetBIOS[$NetBIOS]
  }
  if ($DomainMappings.ContainsKey($NetBIOS)) {
    if ($dnsList -notcontains $DomainMappings[$NetBIOS]) {
      $dnsList += $DomainMappings[$NetBIOS]
    }
  }
  $dnsList = $dnsList | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique
  if (-not $dnsList) {
    Write-Warning "No hay dominios DNS esperados configurados para NetBIOS '$NetBIOS'. Considere completar AllowedDnsDomainsByNetBIOS/DomainMappings."
  }
  return $dnsList
}

function Get-LocalPart {
  param([string]$Address)
  if ([string]::IsNullOrWhiteSpace($Address)) { return $null }
  return ($Address -split '@', 2)[0]
}

function Get-DomainPart {
  param([string]$Address)
  if ([string]::IsNullOrWhiteSpace($Address)) { return $null }
  return ($Address -split '@', 2)[1]
}

function Find-CandidateAdUsers {
  param(
    [string]$UserName,
    [string]$SearchBase,
    [string]$Server
  )
  $commonParams = @{ ErrorAction='Stop' }
  if ($SearchBase) { $commonParams['SearchBase'] = $SearchBase }
  if ($Server)     { $commonParams['Server'] = $Server }

  # Buscamos por SamAccountName exacto o por UPN/mail que empiecen con "$UserName@"
  $filter = "((SamAccountName -eq '$UserName') -or (UserPrincipalName -like '$UserName@*') -or (mail -like '$UserName@*'))"
  try {
    $users = Get-ADUser -Filter $filter -Properties mail,UserPrincipalName,SamAccountName,DisplayName,DistinguishedName,ObjectGUID @commonParams
    return $users
  }
  catch {
    Write-Error "Error consultando AD: $($_.Exception.Message)"
    exit 11
  }
}
 
function Select-BestMatch {
  param(
    [System.Collections.ArrayList]$Candidates,
    [string[]]$PreferredMatchOrder,
    [string]$LocalUserName,
    [string[]]$ExpectedDnsDomains
  )

  # Filtramos por dominio esperado (UPN o mail)
  $domainFiltered = @()
  foreach ($u in $Candidates) {
    $upnDomain  = Get-DomainPart $u.UserPrincipalName
    $mailDomain = Get-DomainPart $u.mail
    $domainOk = $false
    foreach ($d in $ExpectedDnsDomains) {
      if ($upnDomain -and ($upnDomain.ToLower() -eq $d.ToLower())) { $domainOk = $true; break }
      if ($mailDomain -and ($mailDomain.ToLower() -eq $d.ToLower())) { $domainOk = $true; break }
    }
    if ($ExpectedDnsDomains.Count -eq 0) {
      # Si no hay dominios esperados configurados, aceptamos por dominio
      $domainOk = $true
    }
    if ($domainOk) { $domainFiltered += $u }
  }

  if (-not $domainFiltered -or $domainFiltered.Count -eq 0) {
    Write-Warning "No se encontraron candidatos que coincidan con los dominios esperados: $($ExpectedDnsDomains -join ', ')"
    return $null
  }

  # Priorizamos por el método de match preferido
  foreach ($method in $PreferredMatchOrder) {
    $set = switch ($method) {
      'SamAccountName' {
        $domainFiltered | Where-Object { $_.SamAccountName -eq $LocalUserName }
      }
      'UPNLocalPart' {
        $domainFiltered | Where-Object { (Get-LocalPart $_.UserPrincipalName) -eq $LocalUserName }
      }
      'MailLocalPart' {
        $domainFiltered | Where-Object { (Get-LocalPart $_.mail) -eq $LocalUserName }
      }
      default { @() }
    }
    if ($set.Count -eq 1) { return $set[0] }
    elseif ($set.Count -gt 1) {
      # Varias coincidencias por este método: si todas comparten mismo UPN/mail, elegir la primera, si no, no resolver ambigüedad
      $distinctUpn = $set.UserPrincipalName | Select-Object -Unique
      $distinctMail = $set.mail | Select-Object -Unique
      if ($distinctUpn.Count -eq 1 -or $distinctMail.Count -eq 1) {
        return $set[0]
      }
      Write-Warning "Ambigüedad: múltiples usuarios coinciden por '$method'."
      return $null
    }
  }

  # Si no hubo un único match por los métodos preferidos pero hay al menos uno filtrado por dominio, devolver el primero
  if ($domainFiltered.Count -ge 1) {
    Write-Warning "No hubo un match único por los métodos preferidos; retornando el primer candidato filtrado por dominio."
    return $domainFiltered[0]
  }

  return $null
}

try {
  Write-Host "Validando usuario local vs AD..." -ForegroundColor Cyan
  Write-Host "Usuario local: $LocalUserName" -ForegroundColor Gray
  Write-Host "Dominio local (NetBIOS): $LocalUserDomainNetBIOS" -ForegroundColor Gray

  Initialize-ActiveDirectoryModule

  $expectedDnsDomains = Get-ExpectedDnsDomains -NetBIOS $LocalUserDomainNetBIOS
  if ($expectedDnsDomains -and $expectedDnsDomains.Count -gt 0) {
    Write-Host "Dominios DNS esperados para '$LocalUserDomainNetBIOS': $($expectedDnsDomains -join ', ')" -ForegroundColor Gray
  } else {
    Write-Host "No hay dominios DNS esperados configurados; se omitirá validación de dominio." -ForegroundColor Yellow
  }

  $candidates = [System.Collections.ArrayList](Find-CandidateAdUsers -UserName $LocalUserName -SearchBase $SearchBase -Server $Server)
  if (-not $candidates -or $candidates.Count -eq 0) {
    Write-Error "No se encontró ningún usuario en AD que coincida con '$LocalUserName'."
    exit 20
  }

  if ($candidates.Count -gt 1) {
    Write-Host "Se encontraron $($candidates.Count) candidatos en AD; se aplicarán criterios para elegir el mejor." -ForegroundColor Yellow
  }

  $best = Select-BestMatch -Candidates $candidates -PreferredMatchOrder $PreferredMatchOrder -LocalUserName $LocalUserName -ExpectedDnsDomains $expectedDnsDomains
  if (-not $best) {
    Write-Error "No se pudo determinar un match único y válido en AD."
    exit 21
  }

  $chosenUpn  = $best.UserPrincipalName
  $chosenMail = $best.mail
  $chosenSam  = $best.SamAccountName
  $chosenDn   = $best.DistinguishedName
  $chosenName = $best.DisplayName

  Write-Host "Usuario AD encontrado:" -ForegroundColor Green
  Write-Host "  DisplayName       : $chosenName" -ForegroundColor Green
  Write-Host "  SamAccountName    : $chosenSam" -ForegroundColor Green
  Write-Host "  UserPrincipalName : $chosenUpn" -ForegroundColor Green
  Write-Host "  Mail              : $chosenMail" -ForegroundColor Green
  Write-Host "  DN                : $chosenDn" -ForegroundColor Green

  # Preparar contexto para el segundo script
  $context = [ordered]@{
    Local = @{
      UserName = $LocalUserName
      DomainNetBIOS = $LocalUserDomainNetBIOS
      ExpectedDnsDomains = $expectedDnsDomains
    }
    AD = @{
      SamAccountName    = $chosenSam
      UserPrincipalName = $chosenUpn
      Mail              = $chosenMail
      DisplayName       = $chosenName
      DistinguishedName = $chosenDn
      ObjectGuid        = $best.ObjectGUID.Guid
    }
    TimestampUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    Notes = "Contexto generado por 01-Validate-LocalUser-vs-AD.ps1"
  }

  $contextDir = Split-Path -Parent $ContextFilePath
  if (-not (Test-Path -LiteralPath $contextDir)) {
    New-Item -ItemType Directory -Path $contextDir -Force | Out-Null
  }

  $context | ConvertTo-Json -Depth 5 | Out-File -LiteralPath $ContextFilePath -Encoding UTF8
  Write-Host "Contexto guardado en: $ContextFilePath" -ForegroundColor Cyan

  Write-Host "Validación completa." -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Error "Error inesperado: $($_.Exception.Message)"
  exit 99
}