 
[CmdletBinding()]
param(
    [string]$Upn,
    [string]$Domain,
    [string]$SignatureName = 'firma-outlook',
    [string]$TransportRuleName,
    [switch]$SetDefault,
    [switch]$Silent,
    [switch]$InstallTask
)

if (-not $IsWindows) { Write-Error 'Requiere Windows (Outlook Desktop)'; exit 1 }

function Info([string]$m) { if (-not $Silent) { Write-Host $m } }

function Ensure-Module([string]$Name) {
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        try { Install-Module -Name $Name -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop }
        catch { throw "No se pudo instalar $Name: $($_.Exception.Message)" }
    }
    Import-Module -Name $Name -ErrorAction Stop | Out-Null
}

try {
    if (-not $Upn) {
        if (-not $Domain) { throw 'Debe especificar -Upn o -Domain.' }
        $Upn = "$($env:USERNAME)@$Domain"
    }
    Info "Usuario objetivo: $Upn"

    Ensure-Module ExchangeOnlineManagement
    Info 'Conectando a Exchange Online...'
    Connect-ExchangeOnline -UserPrincipalName $Upn -ShowBanner:$false -ErrorAction Stop | Out-Null

    $html = $null
    try {
        $cfg = Get-MailboxMessageConfiguration -Identity $Upn -ErrorAction Stop
        $html = $cfg.SignatureHtml
    } catch { }

    if ([string]::IsNullOrWhiteSpace($html) -and $TransportRuleName) {
        try {
            $rule = Get-TransportRule -Identity $TransportRuleName -ErrorAction Stop
            if ($rule -and $rule.ApplyHtmlDisclaimerText) { $html = [string]$rule.ApplyHtmlDisclaimerText }
        } catch { }
    }

    if ([string]::IsNullOrWhiteSpace($html)) {
        $display = $env:USERNAME
        $html = "<div style='font-family:Segoe UI,Arial,sans-serif;font-size:10.5pt;color:#222'><div style='font-size:11.5pt;font-weight:600'>$display</div></div>"
    }

    $sigDir = Join-Path $env:APPDATA 'Microsoft\Signatures'
    if (-not (Test-Path -LiteralPath $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }
    $htmlPath = Join-Path $sigDir ("$SignatureName.htm")
    $txtPath  = Join-Path $sigDir ("$SignatureName.txt")

    $finalHtml = $html
    if ($finalHtml -notmatch '(?is)<meta[^>]+charset') {
        $finalHtml = "<meta http-equiv='Content-Type' content='text/html; charset=utf-8'>`n$finalHtml"
    }
    Set-Content -LiteralPath $htmlPath -Value $finalHtml -Encoding UTF8

    $text = $finalHtml -replace '(?is)<\s*br\s*/?>', "`n"
    $text = $text -replace '(?is)</\s*p\s*>', "`n`n"
    $text = $text -replace '(?is)</\s*div\s*>', "`n"
    $text = $text -replace '(?is)<[^>]+>', ''
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    $text = ($text -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' } | Out-String
    Set-Content -LiteralPath $txtPath -Value $text.Trim() -Encoding UTF8

    if ($SetDefault) {
        foreach ($ver in @('16.0')) {
            $key = "HKCU:Software\Microsoft\Office\$ver\Common\MailSettings"
            if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
            New-ItemProperty -Path $key -Name 'NewSignature' -Value $SignatureName -PropertyType String -Force | Out-Null
            New-ItemProperty -Path $key -Name 'ReplySignature' -Value $SignatureName -PropertyType String -Force | Out-Null
        }
    }

    if ($InstallTask) {
        try {
            $taskName = 'SignPoint Signature Sync (Lite)'
            $scriptPath = $PSCommandPath; if (-not $scriptPath) { $scriptPath = $MyInvocation.MyCommand.Path }
            $prog = (Get-Command powershell.exe).Source
            $args = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $scriptPath + '"'))
            if ($PSBoundParameters.ContainsKey('Upn')) { $args += ('-Upn "' + $Upn + '"') } else { $args += ('-Domain "' + $Domain + '"') }
            if ($SignatureName) { $args += ('-SignatureName "' + $SignatureName + '"') }
            if ($TransportRuleName) { $args += ('-TransportRuleName "' + $TransportRuleName + '"') }
            if ($SetDefault) { $args += '-SetDefault' }
            $args += '-Silent'
            $action = New-ScheduledTaskAction -Execute $prog -Argument ($args -join ' ')
            $trigger = New-ScheduledTaskTrigger -AtLogOn
            $settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Compatibility Win8
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Sincroniza firma de Outlook (Lite)' -Force | Out-Null
            Info "Tarea programada registrada: $taskName"
        } catch { Write-Warning "No se pudo registrar la tarea: $($_.Exception.Message)" }
    }

    Info "Firma lista en:`n- $htmlPath`n- $txtPath"
}
catch {
    Write-Error $_
    exit 1
}
finally {
    try { Disconnect-ExchangeOnline -Confirm:$false -InformationAction SilentlyContinue | Out-Null } catch {}
}
