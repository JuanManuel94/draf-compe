$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$frontendUrl = 'http://127.0.0.1:5173/'
$apiUrl = 'http://127.0.0.1:3001/api/health'

function Test-LocalUrl([string] $url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

try {
  Set-Location $projectDir
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'No encuentro Node.js. Instala Node.js (incluye npm) y vuelve a abrir este lanzador.'
  }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'No encuentro npm. Reinstala Node.js activando la opción para agregarlo al PATH.'
  }

  if (-not (Test-Path (Join-Path $projectDir 'node_modules'))) {
    Write-Host 'Instalando dependencias del proyecto…'
    & npm install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
  }

  if (-not (Test-LocalUrl $apiUrl)) {
    Write-Host 'Iniciando API…'
    Start-Process -FilePath $env:ComSpec -ArgumentList '/c', 'npm run server' -WorkingDirectory $projectDir -WindowStyle Minimized
  } else {
    Write-Host 'La API ya está funcionando.'
  }

  if (-not (Test-LocalUrl $frontendUrl)) {
    Write-Host 'Iniciando aplicación…'
    Start-Process -FilePath $env:ComSpec -ArgumentList '/c', 'npm run dev' -WorkingDirectory $projectDir -WindowStyle Minimized
  } else {
    Write-Host 'La aplicación ya está funcionando.'
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ((Test-LocalUrl $apiUrl) -and (Test-LocalUrl $frontendUrl)) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw 'No se pudo iniciar la aplicación o la API. Revisa las ventanas minimizadas de Brawl Draft.'
  }

  Write-Host 'Abriendo Brawl Draft Pro en el navegador…'
  Start-Process $frontendUrl
  Write-Host 'Listo. Los servicios seguirán funcionando en segundo plano.'
} catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Pulsa Enter para cerrar'
  exit 1
}
