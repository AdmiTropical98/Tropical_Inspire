# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

# Configuration
$sourcePath = "$PSScriptRoot\public\logo-algar-frota.png"
$bgColorHex = "#0f172a" 
$sizes = @(192, 512)

# Verify source exists
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found: $sourcePath"
    exit 1
}

# Convert Hex to Color
$colorConverter = [System.Drawing.ColorTranslator]
$bgColor = $colorConverter::FromHtml($bgColorHex)

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($size in $sizes) {
    $targetPath = "$PSScriptRoot\public\pwa-bg-$size`x$size.png"
    
    # Create new bitmap with target size
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    
    # High quality settings
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Fill background
    $brush = New-Object System.Drawing.SolidBrush $bgColor
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Calculate scaled logo dimensions (keep aspect ratio, with 10% padding)
    $padding = $size * 0.1
    $drawWidth = $size - ($padding * 2)
    $drawHeight = $sourceImage.Height * ($drawWidth / $sourceImage.Width)
    
    # If height exceeds available space, scale by height instead
    if ($drawHeight -gt ($size - $padding * 2)) {
        $drawHeight = $size - ($padding * 2)
        $drawWidth = $sourceImage.Width * ($drawHeight / $sourceImage.Height)
    }

    # Center position
    $x = ($size - $drawWidth) / 2
    $y = ($size - $drawHeight) / 2

    # Draw Image
    $graphics.DrawImage($sourceImage, [int]$x, [int]$y, [int]$drawWidth, [int]$drawHeight)
    
    # Save
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    Write-Host "Created $targetPath"
    
    # Cleanup loop resources
    $graphics.Dispose()
    $bmp.Dispose()
    $brush.Dispose()
}

$sourceImage.Dispose()
Write-Host "Done!"
