const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const pngPath = path.join(repoRoot, 'assets', 'icon', 'codexpin-logo.png');

function inspectIconMetrics(targetPath) {
  const script = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile('${targetPath.replace(/\\/g, '\\\\')}')
$sum = 0.0
$sx = 0.0
$sy = 0.0
$minX = $img.Width
$minY = $img.Height
$maxX = -1
$maxY = -1
$corner = 0

for ($y = 0; $y -lt $img.Height; $y++) {
  for ($x = 0; $x -lt $img.Width; $x++) {
    $c = $img.GetPixel($x, $y)
    $w = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
    if ($w -gt 60) {
      $sum += $w
      $sx += $x * $w
      $sy += $y * $w
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
      if ($x -gt ($img.Width * 0.9) -and $y -gt ($img.Height * 0.9)) {
        $corner++
      }
    }
  }
}

$result = @{
  width = $img.Width
  height = $img.Height
  centroidX = if ($sum -gt 0) { [Math]::Round($sx / $sum, 2) } else { 0 }
  centroidY = if ($sum -gt 0) { [Math]::Round($sy / $sum, 2) } else { 0 }
  brightWidth = if ($maxX -ge 0) { $maxX - $minX + 1 } else { 0 }
  brightHeight = if ($maxY -ge 0) { $maxY - $minY + 1 } else { 0 }
  cornerBrightPixels = $corner
}

$img.Dispose()
$result | ConvertTo-Json -Compress
`;

  const output = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return JSON.parse(output);
}

function testIconIsVisuallyCenteredAndClean() {
  const metrics = inspectIconMetrics(pngPath);

  assert.strictEqual(metrics.width, 1024, 'logo PNG 应为 1024px');
  assert.strictEqual(metrics.height, 1024, 'logo PNG 应为 1024px');
  assert.ok(Math.abs(metrics.centroidX - 512) <= 24, `logo 视觉中心 X 偏移过大: ${metrics.centroidX}`);
  assert.ok(Math.abs(metrics.centroidY - 512) <= 24, `logo 视觉中心 Y 偏移过大: ${metrics.centroidY}`);
  assert.ok(metrics.brightWidth >= 760, `logo 主体宽度过小: ${metrics.brightWidth}`);
  assert.ok(metrics.brightHeight >= 760, `logo 主体高度过小: ${metrics.brightHeight}`);
  assert.ok(metrics.cornerBrightPixels <= 64, `logo 右下角杂点过多: ${metrics.cornerBrightPixels}`);
}

function run() {
  console.log('Running icon asset tests...');
  testIconIsVisuallyCenteredAndClean();
  console.log('All icon asset tests passed.');
}

run();
