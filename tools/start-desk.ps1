# Serves the Tracker Desk at http://localhost:8765/ (needed for "Open from a SharePoint link" sign-in) and opens the browser.
# Close this window to stop it. No admin rights needed.
$port = 8765; $root = Split-Path -Parent $MyInvocation.MyCommand.Path
$page = Get-ChildItem $root -Filter "SGA_Tracker_Desk*.html" | Select-Object -First 1
$l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$port/"); $l.Start()
Start-Process "http://localhost:$port/$($page.Name)"
Write-Host "Tracker Desk running at http://localhost:$port/$($page.Name)  (close this window to stop)"
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css"; ".png"="image/png"; ".svg"="image/svg+xml" }
while ($l.IsListening) {
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/')); if (!$p) { $p = $page.Name }
  $f = Join-Path $root $p
  if ((Test-Path $f -PathType Leaf) -and ((Resolve-Path $f).Path.StartsWith($root))) {
    $b = [IO.File]::ReadAllBytes($f); $ext = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" }); $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
