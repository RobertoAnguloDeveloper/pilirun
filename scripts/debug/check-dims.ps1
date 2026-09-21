Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("F:\ROCATECH Projects\VIDEOGAMES\PiliRun\scripts\debug\canvas-raw.png")
Write-Output ("size: {0}x{1}" -f $img.Width, $img.Height)
$img.Dispose()