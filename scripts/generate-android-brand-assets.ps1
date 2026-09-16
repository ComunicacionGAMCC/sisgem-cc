param(
  [string]$SourcePath = "public/marca-cuatro-canadas.png",
  [string]$AssetDirectory = "assets"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$sourceFile = (Resolve-Path -LiteralPath $SourcePath).Path
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $AssetDirectory))
$workspaceRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)

if (-not $assetRoot.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "El directorio de recursos debe permanecer dentro del proyecto."
}

[System.IO.Directory]::CreateDirectory($assetRoot) | Out-Null
$source = [System.Drawing.Image]::FromFile($sourceFile)

try {
  # La marca pictográfica ocupa el bloque izquierdo del logotipo institucional.
  $crop = New-Object System.Drawing.Rectangle 70, 115, 590, 590
  $symbol = New-Object System.Drawing.Bitmap 760, 760
  $symbol.SetResolution(96, 96)
  $symbolGraphics = [System.Drawing.Graphics]::FromImage($symbol)
  try {
    $symbolGraphics.Clear([System.Drawing.Color]::Transparent)
    $symbolGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $symbolGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $symbolGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $symbolGraphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, 760, 760), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  }
  finally {
    $symbolGraphics.Dispose()
  }

  $foreground = New-Object System.Drawing.Bitmap 1024, 1024
  $foreground.SetResolution(96, 96)
  $foregroundGraphics = [System.Drawing.Graphics]::FromImage($foreground)
  try {
    $foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
    $foregroundGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $foregroundGraphics.DrawImage($symbol, 132, 132, 760, 760)
  }
  finally {
    $foregroundGraphics.Dispose()
  }

  $background = New-Object System.Drawing.Bitmap 1024, 1024
  $background.SetResolution(96, 96)
  $backgroundGraphics = [System.Drawing.Graphics]::FromImage($background)
  try {
    $backgroundGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#123B28"))
  }
  finally {
    $backgroundGraphics.Dispose()
  }

  $legacy = New-Object System.Drawing.Bitmap 1024, 1024
  $legacy.SetResolution(96, 96)
  $legacyGraphics = [System.Drawing.Graphics]::FromImage($legacy)
  try {
    $legacyGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#123B28"))
    $legacyGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $legacyGraphics.DrawImage($symbol, 132, 132, 760, 760)
  }
  finally {
    $legacyGraphics.Dispose()
  }

  $foreground.Save((Join-Path $assetRoot "icon-foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $background.Save((Join-Path $assetRoot "icon-background.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $legacy.Save((Join-Path $assetRoot "icon-only.png"), [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  if ($legacy) { $legacy.Dispose() }
  if ($background) { $background.Dispose() }
  if ($foreground) { $foreground.Dispose() }
  if ($symbol) { $symbol.Dispose() }
  $source.Dispose()
}
