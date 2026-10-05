Add-Type -AssemblyName System.Drawing
$taskBitmap = [System.Drawing.Bitmap]::new(256,256)
$taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
$taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#29483e'))
$taskFont = [System.Drawing.Font]::new('Georgia',168,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$taskGraphics.DrawString('a.', $taskFont, [System.Drawing.Brushes]::White, 27, 18)
$taskBitmap.Save((Join-Path $PSScriptRoot 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
# PNG-backed 256px ICO avoids GDI handle ownership and preserves sharp edges.
$taskPng = [System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'icon.png'))
$taskStream = [System.IO.File]::Open((Join-Path $PSScriptRoot 'icon.ico'), [System.IO.FileMode]::Create)
$taskWriter = [System.IO.BinaryWriter]::new($taskStream)
$taskWriter.Write([uint16]0); $taskWriter.Write([uint16]1); $taskWriter.Write([uint16]1)
$taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0)
$taskWriter.Write([uint16]1); $taskWriter.Write([uint16]32); $taskWriter.Write([uint32]$taskPng.Length); $taskWriter.Write([uint32]22)
$taskWriter.Write($taskPng); $taskWriter.Dispose()
$taskFont.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
