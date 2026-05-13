# =============================================================================
# generate-icons.ps1
# -----------------------------------------------------------------------------
# Gera os PNGs da extensão (16x16, 48x48, 128x128) usando System.Drawing.
# Design: balão de chat branco sobre fundo arredondado com gradiente.
#
# Para re-gerar após mudar cores/tamanhos, basta rodar:
#   powershell -ExecutionPolicy Bypass -File tools\generate-icons.ps1
# =============================================================================

Add-Type -AssemblyName System.Drawing

# --- Configuração (mexa aqui pra customizar) --------------------------------
$ColorStart = "#6366f1"   # Índigo (canto superior esquerdo)
$ColorEnd   = "#8b5cf6"   # Roxo (canto inferior direito)
$OutDir     = Join-Path $PSScriptRoot "..\icons"
# ----------------------------------------------------------------------------

function New-RoundedRectPath {
    param(
        [single]$X, [single]$Y, [single]$W, [single]$H, [single]$Radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $Radius * 2
    $path.AddArc($X,           $Y,           $d, $d, 180, 90) | Out-Null
    $path.AddArc($X + $W - $d, $Y,           $d, $d, 270, 90) | Out-Null
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d,   0, 90) | Out-Null
    $path.AddArc($X,           $Y + $H - $d, $d, $d,  90, 90) | Out-Null
    $path.CloseFigure()
    return $path
}

function New-IconPng {
    param([int]$Size, [string]$OutPath)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # --- Fundo arredondado com gradiente -----------------------------------
    $bgRadius = [single]($Size * 0.22)
    $bgPath   = New-RoundedRectPath -X 0 -Y 0 -W $Size -H $Size -Radius $bgRadius

    $c1 = [System.Drawing.ColorTranslator]::FromHtml($ColorStart)
    $c2 = [System.Drawing.ColorTranslator]::FromHtml($ColorEnd)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF([single]$Size, [single]$Size)),
        $c1, $c2
    )
    $g.FillPath($gradBrush, $bgPath)

    # --- Balão de chat (branco) -------------------------------------------
    $bubbleW = [single]($Size * 0.64)
    $bubbleH = [single]($Size * 0.48)
    $bubbleX = [single](($Size - $bubbleW) / 2)
    $bubbleY = [single](($Size - $bubbleH) / 2 - $Size * 0.05)
    $bubbleR = [single]([Math]::Min($bubbleH, $bubbleW) * 0.28)

    $bubblePath = New-RoundedRectPath -X $bubbleX -Y $bubbleY -W $bubbleW -H $bubbleH -Radius $bubbleR

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPath($whiteBrush, $bubblePath)

    # Cauda do balão (ponta inferior esquerda) — apenas em tamanhos >= 32
    if ($Size -ge 32) {
        $tailSize = [single]($Size * 0.14)
        $tailX    = [single]($bubbleX + $bubbleW * 0.22)
        $tailY    = [single]($bubbleY + $bubbleH - 1)
        $tailX2   = [single]($tailX + $tailSize)
        $tailY2   = [single]($tailY + $tailSize)
        $p1 = [System.Drawing.PointF]::new($tailX,  $tailY)
        $p2 = [System.Drawing.PointF]::new($tailX2, $tailY)
        $p3 = [System.Drawing.PointF]::new($tailX,  $tailY2)
        $points = [System.Drawing.PointF[]]@($p1, $p2, $p3)
        $tailPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $tailPath.AddPolygon($points)
        $g.FillPath($whiteBrush, $tailPath)
        $tailPath.Dispose()
    }

    # Três pontinhos (indicador de "digitando") — apenas em tamanhos >= 48
    if ($Size -ge 48) {
        $dotR     = [single]($bubbleH * 0.10)
        $dotY     = [single]($bubbleY + $bubbleH * 0.50 - $dotR)
        $spacing  = [single]($bubbleW * 0.22)
        $centerX  = [single]($bubbleX + $bubbleW / 2)
        $dotBrush = New-Object System.Drawing.SolidBrush($c1)
        foreach ($i in -1, 0, 1) {
            $dx = $centerX + ($i * $spacing) - $dotR
            $g.FillEllipse($dotBrush, $dx, $dotY, $dotR * 2, $dotR * 2)
        }
        $dotBrush.Dispose()
    }

    # --- Salva e libera recursos -------------------------------------------
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $gradBrush.Dispose()
    $whiteBrush.Dispose()
    $bgPath.Dispose()
    $bubblePath.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

# --- Garante a pasta de saída e gera os 3 tamanhos --------------------------
$resolvedOut = (Resolve-Path -LiteralPath $OutDir -ErrorAction SilentlyContinue)
if (-not $resolvedOut) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $resolvedOut = (Resolve-Path -LiteralPath $OutDir)
}

foreach ($size in 16, 48, 128) {
    $out = Join-Path $resolvedOut "icon$size.png"
    New-IconPng -Size $size -OutPath $out
    Write-Host "Gerado: $out"
}

# --- Store assets (logo 300x300 para Edge Add-ons / Chrome Web Store) -------
$storeDir = Join-Path $PSScriptRoot "..\store-assets"
if (-not (Test-Path -LiteralPath $storeDir)) {
    New-Item -ItemType Directory -Path $storeDir -Force | Out-Null
}
$storeDir = (Resolve-Path -LiteralPath $storeDir)
$storeLogo = Join-Path $storeDir "logo-300.png"
New-IconPng -Size 300 -OutPath $storeLogo
Write-Host "Gerado: $storeLogo"
