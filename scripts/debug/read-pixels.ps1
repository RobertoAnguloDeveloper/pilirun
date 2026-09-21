Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("F:\ROCATECH Projects\VIDEOGAMES\PiliRun\scripts\debug\canvas-raw.png")
$bmp = [System.Drawing.Bitmap]$img
# Read pixel at (127, 604)
$pixel = $bmp.GetPixel(127, 604)
Write-Output "(127, 604): R=$($pixel.R), G=$($pixel.G), B=$($pixel.B), A=$($pixel.A)"

# Sample a 10x10 grid around it
Write-Output "Grid:"
for ($y = 590; $y -lt 650; $y += 5) {
  $row = ""
  for ($x = 90; $x -lt 180; $x += 5) {
    $p = $bmp.GetPixel($x, $y)
    $row += "($($p.R),$($p.G),$($p.B)) "
  }
  Write-Output "y=$y : $row"
}

$bmp.Dispose()
$img.Dispose()