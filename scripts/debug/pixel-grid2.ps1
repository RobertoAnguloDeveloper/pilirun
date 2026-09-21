Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("F:\ROCATECH Projects\VIDEOGAMES\PiliRun\scripts\debug\canvas-raw.png")
$bmp = [System.Drawing.Bitmap]$img
$w = $bmp.Width
$h = $bmp.Height

$countStrict = 0
$countCluster = 0
$bounds = @{ minX = $w; minY = $h; maxX = 0; maxY = 0 }

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.A -lt 100) { continue }
    # Match find-ellipse-precise.cjs filter: r<60 && g>170 && b>70 && b<130
    if ($p.R -lt 60 -and $p.G -gt 170 -and $p.B -gt 70 -and $p.B -lt 130) {
      $countCluster++
      if ($x -lt $bounds.minX) { $bounds.minX = $x }
      if ($y -lt $bounds.minY) { $bounds.minY = $y }
      if ($x -gt $bounds.maxX) { $bounds.maxX = $x }
      if ($y -gt $bounds.maxY) { $bounds.maxY = $y }
    }
  }
}

Write-Output "Cluster (find-ellipse) match count: $countCluster"
Write-Output "Bounds: $($bounds.minX),$($bounds.minY) to $($bounds.maxX),$($bounds.maxY)"

$bmp.Dispose()
$img.Dispose()