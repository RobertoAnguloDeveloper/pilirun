Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("F:\ROCATECH Projects\VIDEOGAMES\PiliRun\scripts\debug\canvas-raw.png")
$bmp = [System.Drawing.Bitmap]$img
$w = $bmp.Width
$h = $bmp.Height

$count22c55e = 0
$countGreenish = 0
$bounds = @{ minX = $w; minY = $h; maxX = 0; maxY = 0 }

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.A -lt 100) { continue }
    # Strict #22c55e: r=34, g=197, b=94
    if ($p.R -ge 30 -and $p.R -le 50 -and $p.G -ge 180 -and $p.G -le 210 -and $p.B -ge 80 -and $p.B -le 110) {
      $count22c55e++
      if ($x -lt $bounds.minX) { $bounds.minX = $x }
      if ($y -lt $bounds.minY) { $bounds.minY = $y }
      if ($x -gt $bounds.maxX) { $bounds.maxX = $x }
      if ($y -gt $bounds.maxY) { $bounds.maxY = $y }
    }
    # Greenish filter: r<60, g>170, b>70, b<130
    if ($p.R -lt 60 -and $p.G -gt 170 -and $p.B -gt 70 -and $p.B -lt 130) {
      $countGreenish++
    }
  }
}

Write-Output "Total pixels: $(($w * $h))"
Write-Output "Strict #22c55e count: $count22c55e"
Write-Output "Greenish count: $countGreenish"
Write-Output "Bounds: $($bounds.minX),$($bounds.minY) to $($bounds.maxX),$($bounds.maxY) (size $(($bounds.maxX - $bounds.minX + 1))x$(($bounds.maxY - $bounds.minY + 1)))"

$bmp.Dispose()
$img.Dispose()