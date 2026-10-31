# Packs the player photos into js/photos.local.js, so they also show when index.html
# is opened by double-clicking. (Opened straight from disk, the browser won't let the
# game read photo files; a script file with the photos inside it works everywhere.)
#
# Reads the photo folder named by `photos:` in js/party.local.js (or js/party.js),
# crops each photo to the face (the same frame the game uses) and saves them as
# 512 px JPEGs. Run make-photos.bat again after adding or changing photos.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$party = Join-Path $root 'js\party.local.js'
if (-not (Test-Path -LiteralPath $party)) { $party = Join-Path $root 'js\party.js' }
$folder = 'photos/'
$m = [regex]::Match([IO.File]::ReadAllText($party, [Text.Encoding]::UTF8), "photos:\s*'([^']*)'")
if ($m.Success -and $m.Groups[1].Value) { $folder = $m.Groups[1].Value }
$dir = Join-Path $root $folder
if (-not (Test-Path -LiteralPath $dir)) { throw "Photo folder not found: $dir" }

$size = 512
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$quality = New-Object Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality, [long]85)

$entries = @()
Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Extension -match '^\.(png|jpe?g)$' } | Sort-Object Name | ForEach-Object {
  $img = [Drawing.Image]::FromFile($_.FullName)
  try {
    # Phone photos: turn them the right way up first.
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip('Rotate180FlipNone') }
        6 { $img.RotateFlip('Rotate90FlipNone') }
        8 { $img.RotateFlip('Rotate270FlipNone') }
      }
    }
    # Head and shoulders: a centred square of 3/4 of the short side, near the top.
    $s = [Math]::Min($img.Width, $img.Height) * 0.75
    $from = New-Object Drawing.RectangleF ((($img.Width - $s) / 2), ($img.Height * 0.02), $s, $s)
    $bmp = New-Object Drawing.Bitmap $size, $size
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
    $g.Clear([Drawing.Color]::Black)
    $g.DrawImage($img, (New-Object Drawing.RectangleF 0, 0, $size, $size), $from, [Drawing.GraphicsUnit]::Pixel)
    $ms = New-Object IO.MemoryStream
    $bmp.Save($ms, $jpeg, $quality)
    $key = $_.BaseName.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormC).Replace('\', '\\').Replace('"', '\"')
    $entries += ('  "{0}": "data:image/jpeg;base64,{1}"' -f $key, [Convert]::ToBase64String($ms.ToArray()))
    Write-Host ("  " + $_.Name)
    $g.Dispose(); $bmp.Dispose(); $ms.Dispose()
  } finally { $img.Dispose() }
}

$out = "/* Player photos packed by make-photos.bat from '$folder'. Run it again after`n   changing photos. Not in git: it contains everyone's faces. */`n" +
       "window.HH = window.HH || {};`nHH.PHOTOS = {`n" + ($entries -join ",`n") + "`n};`n"
$file = Join-Path $root 'js\photos.local.js'
[IO.File]::WriteAllText($file, $out, (New-Object Text.UTF8Encoding $false))
Write-Host ("Packed {0} photos into js\photos.local.js" -f $entries.Count)
