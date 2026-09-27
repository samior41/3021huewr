$ErrorActionPreference = "Stop"
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path) -replace '\\', '/'
$tmp = Join-Path $env:TEMP "enty-apply-theme.js"

Copy-Item (Join-Path $root "apply_theme.js") $tmp -Force
$env:ENTY_ROOT = $root
node $tmp
