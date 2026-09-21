Add-Type -AssemblyName System.Drawing
$f = "green-only.png", "green-ellipse.png", "green-ellipse-final.png", "player-area-final.png", "no-canvas.png", "ellipse-crop.png"
foreach ($name in $f) {
  $path = Join-Path "F:\ROCATECH Projects\VIDEOGAMES\PiliRun\scripts\debug" $name
  $img = [System.Drawing.Image]::FromFile($path)
  Write-Output "$name : $($img.Width)x$($img.Height)"
  $img.Dispose()
}