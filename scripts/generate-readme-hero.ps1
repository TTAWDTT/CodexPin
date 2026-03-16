param(
  [string]$LogoPath = (Join-Path $PSScriptRoot '..\assets\icon\codexpin-logo.png'),
  [string]$FontPath = (Join-Path $PSScriptRoot '..\assets\fonts\LXGWWenKai-Regular.ttf'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\assets\readme\codexpin-hero.png')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $LogoPath)) {
  throw "Logo does not exist: $LogoPath"
}

$outputDirectory = Split-Path $OutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$width = 1600
$height = 560
$canvas = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)

$backgroundRect = [System.Drawing.Rectangle]::new(18, 18, $width - 36, $height - 36)
$backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $backgroundRect,
  [System.Drawing.Color]::FromArgb(255, 10, 16, 28),
  [System.Drawing.Color]::FromArgb(255, 23, 33, 52),
  12
)

$cornerRadius = 46
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$diameter = $cornerRadius * 2
$path.AddArc($backgroundRect.X, $backgroundRect.Y, $diameter, $diameter, 180, 90)
$path.AddArc($backgroundRect.Right - $diameter, $backgroundRect.Y, $diameter, $diameter, 270, 90)
$path.AddArc($backgroundRect.Right - $diameter, $backgroundRect.Bottom - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc($backgroundRect.X, $backgroundRect.Bottom - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()
$graphics.FillPath($backgroundBrush, $path)

$glowBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  ([System.Drawing.Rectangle]::new(0, 0, $width, $height)),
  [System.Drawing.Color]::FromArgb(120, 255, 214, 102),
  [System.Drawing.Color]::FromArgb(10, 255, 214, 102),
  0
)
$graphics.FillEllipse($glowBrush, 920, 40, 540, 260)
$graphics.FillEllipse($glowBrush, 1100, 280, 360, 180)

$logo = [System.Drawing.Bitmap]::FromFile((Resolve-Path $LogoPath))
$logoRect = [System.Drawing.Rectangle]::new(86, 88, 360, 360)
$graphics.DrawImage($logo, $logoRect)

$fontCollection = $null
$fontFamily = $null
if (Test-Path $FontPath) {
  $fontCollection = [System.Drawing.Text.PrivateFontCollection]::new()
  $fontCollection.AddFontFile((Resolve-Path $FontPath))
  $fontFamily = $fontCollection.Families[0]
} else {
  $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
}

$titleFont = [System.Drawing.Font]::new($fontFamily, 84, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = [System.Drawing.Font]::new($fontFamily, 31, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$eyebrowFont = [System.Drawing.Font]::new($fontFamily, 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 214, 102))
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 247, 250, 252))
$subtitleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 203, 213, 225))
$chipBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 30, 41, 59))
$chipTextBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
$chipPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 71, 85, 105), 2)

$graphics.DrawString("Codex Workflow Widget", $eyebrowFont, $goldBrush, 480, 118)
$graphics.DrawString("CodexPin", $titleFont, $titleBrush, 480, 156)
$graphics.DrawString("Always on top, auto-wired, local-first status tracking for Codex.", $subtitleFont, $subtitleBrush, 486, 270)

$chips = @(
  "Electron",
  "Windows",
  "Codex Hook",
  "Always On Top"
)

$chipFont = [System.Drawing.Font]::new($fontFamily, 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$chipX = 486
$chipY = 360

foreach ($chip in $chips) {
  $size = $graphics.MeasureString($chip, $chipFont)
  $chipWidth = [int][Math]::Ceiling($size.Width) + 34
  $chipHeight = 46
  $chipRect = [System.Drawing.Rectangle]::new($chipX, $chipY, $chipWidth, $chipHeight)
  $chipPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $chipRadius = 23
  $chipDiameter = $chipRadius * 2
  $chipPath.AddArc($chipRect.X, $chipRect.Y, $chipDiameter, $chipDiameter, 180, 90)
  $chipPath.AddArc($chipRect.Right - $chipDiameter, $chipRect.Y, $chipDiameter, $chipDiameter, 270, 90)
  $chipPath.AddArc($chipRect.Right - $chipDiameter, $chipRect.Bottom - $chipDiameter, $chipDiameter, $chipDiameter, 0, 90)
  $chipPath.AddArc($chipRect.X, $chipRect.Bottom - $chipDiameter, $chipDiameter, $chipDiameter, 90, 90)
  $chipPath.CloseFigure()
  $graphics.FillPath($chipBrush, $chipPath)
  $graphics.DrawPath($chipPen, $chipPath)
  $graphics.DrawString($chip, $chipFont, $chipTextBrush, $chipX + 17, $chipY + 9)
  $chipX += $chipWidth + 14
}

$canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$logo.Dispose()
$graphics.Dispose()
$canvas.Dispose()
$backgroundBrush.Dispose()
$glowBrush.Dispose()
$path.Dispose()
if ($null -ne $fontCollection) {
  $fontCollection.Dispose()
}
$titleFont.Dispose()
$subtitleFont.Dispose()
$eyebrowFont.Dispose()
$chipFont.Dispose()
$goldBrush.Dispose()
$titleBrush.Dispose()
$subtitleBrush.Dispose()
$chipBrush.Dispose()
$chipTextBrush.Dispose()
$chipPen.Dispose()

Write-Output "Generated README hero: $OutputPath"
