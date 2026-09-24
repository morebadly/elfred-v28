$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot '.env.local'
$secretValue = Read-Host 'API Key（输入不会显示）' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
try {
    $modelKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($modelKey) -or $modelKey -match '[\r\n"\s]') { throw 'Key 不能为空，也不能含空白或双引号。' }
    $existingLines = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath } else { @() }
    $nextLines = @($existingLines | Where-Object { $_ -notmatch '^\s*(ELFRED_MODEL_API_KEY|OPENAI_API_KEY)\s*=' })
    $nextLines += 'ELFRED_MODEL_API_KEY="' + $modelKey + '"'
    [IO.File]::WriteAllLines($configPath, $nextLines, [Text.UTF8Encoding]::new($false))
    Write-Host '已保存到本机 .env.local。重启 npm run start:local 后生效。'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $modelKey = $null
    $secretValue.Dispose()
}
