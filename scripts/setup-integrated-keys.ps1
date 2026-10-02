$ErrorActionPreference = "Stop"

Write-Host "TEUM integrated local key setup" -ForegroundColor Cyan
$kakaoRestKey = Read-Host "Kakao REST API key"
$kakaoJsKey = Read-Host "Kakao JavaScript key"
$tourKey = Read-Host "TourAPI Decoding key"

if ([string]::IsNullOrWhiteSpace($kakaoRestKey)) { throw "Kakao REST API key is empty." }
if ([string]::IsNullOrWhiteSpace($kakaoJsKey)) { throw "Kakao JavaScript key is empty." }
if ([string]::IsNullOrWhiteSpace($tourKey)) { throw "TourAPI Decoding key is empty." }

Set-Content -Path ".env.local" -Value "KAKAO_REST_API_KEY=$kakaoRestKey" -Encoding UTF8

$jsSafe = $kakaoJsKey.Replace("'", "\'")
$tourSafe = $tourKey.Replace("'", "\'")
$config = @"
export const TEUM_KEYS = {
  kakaoRestApiKey: '',
  kakaoJavaScriptKey: '$jsSafe',
  kakaoApiProxyBaseUrl: '',
  hasKakaoRestApiKey: false,
};

export const DATA_GO_KR_API_KEY = '$tourSafe';
"@
Set-Content -Path "js/config/keys.local.js" -Value $config -Encoding UTF8

Write-Host "Created .env.local and js/config/keys.local.js" -ForegroundColor Green
Write-Host "Next: npm run check ; npm run dev" -ForegroundColor Yellow
