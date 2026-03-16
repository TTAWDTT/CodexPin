param(
  [string]$SourcePath = (Join-Path $PSScriptRoot '..\assets\icon\codexpin-logo-source.png'),
  [string]$PngOutputPath = (Join-Path $PSScriptRoot '..\assets\icon\codexpin-logo.png'),
  [string]$IcoOutputPath = (Join-Path $PSScriptRoot '..\assets\icon\codexpin.ico'),
  [int]$CanvasSize = 1024
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function Get-MaxChannel {
  param([System.Drawing.Color]$Color)

  return [Math]::Max($Color.R, [Math]::Max($Color.G, $Color.B))
}

function New-TransparentBitmap {
  param([int]$Width, [int]$Height)

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.Dispose()
  return $bitmap
}

function Get-FocusCenter {
  param([System.Drawing.Bitmap]$Bitmap)

  $sum = 0.0
  $sumX = 0.0
  $sumY = 0.0

  for ($y = 0; $y -lt $Bitmap.Height; $y += 2) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += 2) {
      $color = $Bitmap.GetPixel($x, $y)
      $weight = Get-MaxChannel $color
      if ($weight -gt 60) {
        $sum += $weight
        $sumX += $x * $weight
        $sumY += $y * $weight
      }
    }
  }

  if ($sum -le 0) {
    return @{
      X = [int]($Bitmap.Width / 2)
      Y = [int]($Bitmap.Height / 2)
    }
  }

  return @{
    X = [int][Math]::Round($sumX / $sum)
    Y = [int][Math]::Round($sumY / $sum)
  }
}

function Get-VisibleBounds {
  param([System.Drawing.Bitmap]$Bitmap)

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      $color = $Bitmap.GetPixel($x, $y)
      if ($color.A -gt 8) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    throw 'No visible pixels were detected in the generated icon.'
  }

  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function Get-WeightedCentroid {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [System.Drawing.Rectangle]$Bounds
  )

  $sum = 0.0
  $sumX = 0.0
  $sumY = 0.0

  for ($y = $Bounds.Y; $y -lt ($Bounds.Y + $Bounds.Height); $y++) {
    for ($x = $Bounds.X; $x -lt ($Bounds.X + $Bounds.Width); $x++) {
      $color = $Bitmap.GetPixel($x, $y)
      if ($color.A -le 8) {
        continue
      }

      $weight = Get-MaxChannel $color
      if ($weight -le 16) {
        continue
      }

      $sum += $weight
      $sumX += $x * $weight
      $sumY += $y * $weight
    }
  }

  if ($sum -le 0) {
    return @{
      X = $Bounds.X + ($Bounds.Width / 2.0)
      Y = $Bounds.Y + ($Bounds.Height / 2.0)
    }
  }

  return @{
    X = $sumX / $sum
    Y = $sumY / $sum
  }
}

if (-not (Test-Path $SourcePath)) {
  throw "Source icon does not exist: $SourcePath"
}

$sourceBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourcePath))
$focus = Get-FocusCenter -Bitmap $sourceBitmap

$cropSide = [int][Math]::Round([Math]::Min($sourceBitmap.Width, $sourceBitmap.Height) * 0.72)
$halfCrop = [int]($cropSide / 2)
$cropLeft = [Math]::Max(0, [Math]::Min($focus.X - $halfCrop, $sourceBitmap.Width - $cropSide))
$cropTop = [Math]::Max(0, [Math]::Min($focus.Y - $halfCrop, $sourceBitmap.Height - $cropSide))
$cropRect = New-Object System.Drawing.Rectangle($cropLeft, $cropTop, $cropSide, $cropSide)

$workingBitmap = New-TransparentBitmap -Width $cropRect.Width -Height $cropRect.Height

$centerX = $cropRect.Width / 2.0
$centerY = $cropRect.Height / 2.0
$radiusX = $cropRect.Width * 0.39
$radiusY = $cropRect.Height * 0.35
$fadeStart = 24
$fadeEnd = 72

for ($y = 0; $y -lt $cropRect.Height; $y++) {
  for ($x = 0; $x -lt $cropRect.Width; $x++) {
    $sourceColor = $sourceBitmap.GetPixel($cropRect.X + $x, $cropRect.Y + $y)
    $brightness = Get-MaxChannel $sourceColor
    if ($brightness -le $fadeStart) {
      continue
    }

    $normalizedX = ($x - $centerX) / $radiusX
    $normalizedY = ($y - $centerY) / $radiusY
    $distance = [Math]::Sqrt(($normalizedX * $normalizedX) + ($normalizedY * $normalizedY))

    if ($distance -gt 1.02) {
      continue
    }

    $alpha = 255
    if ($brightness -lt $fadeEnd) {
      $alpha = [int][Math]::Round((($brightness - $fadeStart) / ($fadeEnd - $fadeStart)) * 255)
    }
    if ($distance -gt 0.94) {
      $alpha = [int][Math]::Round($alpha * (1.02 - $distance) / 0.08)
    }

    if ($alpha -le 0) {
      continue
    }

    $finalColor = [System.Drawing.Color]::FromArgb(
      [Math]::Min(255, [Math]::Max(0, $alpha)),
      $sourceColor.R,
      $sourceColor.G,
      $sourceColor.B
    )
    $workingBitmap.SetPixel($x, $y, $finalColor)
  }
}

$visibleBounds = Get-VisibleBounds -Bitmap $workingBitmap
$outputBitmap = New-TransparentBitmap -Width $CanvasSize -Height $CanvasSize
$graphics = [System.Drawing.Graphics]::FromImage($outputBitmap)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$targetMargin = [int][Math]::Round($CanvasSize * 0.03)
$targetSize = $CanvasSize - ($targetMargin * 2)
$scale = [Math]::Min($targetSize / $visibleBounds.Width, $targetSize / $visibleBounds.Height)
$drawWidth = [int][Math]::Round($visibleBounds.Width * $scale)
$drawHeight = [int][Math]::Round($visibleBounds.Height * $scale)
$weightedCentroid = Get-WeightedCentroid -Bitmap $workingBitmap -Bounds $visibleBounds
$centroidOffsetX = ($weightedCentroid.X - $visibleBounds.X) * $scale
$centroidOffsetY = ($weightedCentroid.Y - $visibleBounds.Y) * $scale
$drawX = [int][Math]::Round(($CanvasSize / 2.0) - $centroidOffsetX)
$drawY = [int][Math]::Round(($CanvasSize / 2.0) - $centroidOffsetY)

$graphics.DrawImage(
  $workingBitmap,
  (New-Object System.Drawing.Rectangle($drawX, $drawY, $drawWidth, $drawHeight)),
  $visibleBounds,
  [System.Drawing.GraphicsUnit]::Pixel
)
$graphics.Dispose()

$pngDirectory = Split-Path $PngOutputPath -Parent
$icoDirectory = Split-Path $IcoOutputPath -Parent

if (-not (Test-Path $pngDirectory)) {
  New-Item -ItemType Directory -Path $pngDirectory | Out-Null
}

if (-not (Test-Path $icoDirectory)) {
  New-Item -ItemType Directory -Path $icoDirectory | Out-Null
}

$outputBitmap.Save((Resolve-Path $pngDirectory | Join-Path -ChildPath (Split-Path $PngOutputPath -Leaf)), [System.Drawing.Imaging.ImageFormat]::Png)

$appBuilderPath = Join-Path $PSScriptRoot '..\node_modules\app-builder-bin\win\x64\app-builder.exe'
if (-not (Test-Path $appBuilderPath)) {
  throw "app-builder executable does not exist: $appBuilderPath"
}

$iconOutputDirectory = Join-Path $icoDirectory '.generated'
if (Test-Path $iconOutputDirectory) {
  Remove-Item -Recurse -Force $iconOutputDirectory
}
New-Item -ItemType Directory -Path $iconOutputDirectory | Out-Null

& $appBuilderPath icon --input $PngOutputPath --format ico --out $iconOutputDirectory
if ($LASTEXITCODE -ne 0) {
  throw "app-builder icon generation failed with exit code $LASTEXITCODE"
}

$generatedIcoPath = Join-Path $iconOutputDirectory 'icon.ico'
if (-not (Test-Path $generatedIcoPath)) {
  throw "Generated icon file does not exist: $generatedIcoPath"
}

Copy-Item $generatedIcoPath $IcoOutputPath -Force
Remove-Item -Recurse -Force $iconOutputDirectory

$sourceBitmap.Dispose()
$workingBitmap.Dispose()
$outputBitmap.Dispose()

Write-Output "Generated icon assets:`n- PNG: $PngOutputPath`n- ICO: $IcoOutputPath"
