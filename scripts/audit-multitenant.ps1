$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$findings = @()

$requireUserMatches = Select-String -Path "src/**/*.ts", "src/**/*.tsx" -Pattern "requireUser\(" -ErrorAction SilentlyContinue
foreach ($m in $requireUserMatches) {
  $full = [System.IO.Path]::GetFullPath($m.Path)
  if ($full.ToLower().EndsWith("\src\lib\auth.ts")) {
    continue
  }

  $findings += [PSCustomObject]@{
    Rule   = 'REQUIREUSER_USAGE'
    File   = $m.Path
    Line   = $m.LineNumber
    Match  = $m.Matches.Value
  }
}

$findings | Format-Table -AutoSize

if ($findings.Count -gt 0) {
  exit 1
}
