Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path $PSScriptRoot '..\client\public\roblox-icons'
$outputDirectory = [System.IO.Path]::GetFullPath($outputDirectory)

function New-IconCanvas {
    $bitmap = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 15)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return @{ Bitmap = $bitmap; Graphics = $graphics; Pen = $pen }
}

function Save-IconCanvas($canvas, $name) {
    $path = Join-Path $outputDirectory $name
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Pen.Dispose()
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
}

$heart = New-IconCanvas
$heartPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$heartPath.StartFigure()
$heartPath.AddBezier(128, 222, 109, 207, 43, 164, 29, 111)
$heartPath.AddBezier(29, 111, 17, 66, 43, 34, 79, 34)
$heartPath.AddBezier(79, 34, 101, 34, 118, 47, 128, 64)
$heartPath.AddBezier(128, 64, 138, 47, 155, 34, 177, 34)
$heartPath.AddBezier(177, 34, 213, 34, 239, 66, 227, 111)
$heartPath.AddBezier(227, 111, 213, 164, 147, 207, 128, 222)
$heartPath.CloseFigure()
$heart.Graphics.DrawPath($heart.Pen, $heartPath)
$heartPath.Dispose()
Save-IconCanvas $heart 'heart-outline.png'

$filledHeart = New-IconCanvas
$filledHeartPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$filledHeartPath.StartFigure()
$filledHeartPath.AddBezier(128, 222, 109, 207, 43, 164, 29, 111)
$filledHeartPath.AddBezier(29, 111, 17, 66, 43, 34, 79, 34)
$filledHeartPath.AddBezier(79, 34, 101, 34, 118, 47, 128, 64)
$filledHeartPath.AddBezier(128, 64, 138, 47, 155, 34, 177, 34)
$filledHeartPath.AddBezier(177, 34, 213, 34, 239, 66, 227, 111)
$filledHeartPath.AddBezier(227, 111, 213, 164, 147, 207, 128, 222)
$filledHeartPath.CloseFigure()
$filledHeart.Graphics.FillPath([System.Drawing.Brushes]::White, $filledHeartPath)
$filledHeartPath.Dispose()
Save-IconCanvas $filledHeart 'heart-filled.png'

$comment = New-IconCanvas
$commentPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$commentPath.StartFigure()
$commentPath.AddBezier(128, 31, 72, 31, 29, 70, 29, 121)
$commentPath.AddBezier(29, 121, 29, 171, 72, 210, 128, 210)
$commentPath.AddBezier(128, 210, 144, 210, 159, 207, 173, 201)
$commentPath.AddLine(173, 201, 219, 218)
$commentPath.AddLine(219, 218, 205, 179)
$commentPath.AddBezier(205, 179, 219, 163, 227, 143, 227, 121)
$commentPath.AddBezier(227, 121, 227, 70, 184, 31, 128, 31)
$commentPath.CloseFigure()
$comment.Graphics.DrawPath($comment.Pen, $commentPath)
$commentPath.Dispose()
Save-IconCanvas $comment 'comment-outline.png'

$share = New-IconCanvas
$sharePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$sharePath.StartFigure()
$sharePath.AddLine(29, 47, 230, 27)
$sharePath.AddLine(230, 27, 153, 229)
$sharePath.AddLine(153, 229, 111, 144)
$sharePath.AddLine(111, 144, 29, 103)
$sharePath.CloseFigure()
$share.Graphics.DrawPath($share.Pen, $sharePath)
$share.Graphics.DrawLine($share.Pen, 111, 144, 230, 27)
$sharePath.Dispose()
Save-IconCanvas $share 'share-outline.png'
