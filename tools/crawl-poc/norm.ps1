# Normalise the selected Dungeon Crawl Stone Soup tiles to 32-bit RGBA PNGs
# (the originals mix indexed and interlaced PNGs, which tools/pixcanvas.mjs
# cannot read). Usage: pwsh -File norm.ps1 <path to "crawl-tiles Oct-5-2010">
param([Parameter(Mandatory=$true)][string]$CrawlDir)
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here "norm"
New-Item -ItemType Directory -Force $out | Out-Null
$n = 0
foreach ($line in Get-Content (Join-Path $here "tiles.txt")) {
  if (-not $line.Trim()) { continue }
  $k,$p = $line.Split('=',2)
  $src = Join-Path $CrawlDir $p
  if (-not (Test-Path $src)) { Write-Output "MISSING $k $p"; continue }
  $bmp = [System.Drawing.Bitmap]::FromFile($src)
  $rgba = New-Object System.Drawing.Bitmap $bmp.Width, $bmp.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($rgba)
  $g.DrawImage($bmp, 0, 0, $bmp.Width, $bmp.Height)
  $g.Dispose()
  $rgba.Save((Join-Path $out "$k.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $rgba.Dispose(); $bmp.Dispose()
  $n++
}
Write-Output "converted $n"
