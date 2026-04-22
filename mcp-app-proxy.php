<?php
/**
 * MCP App Proxy for MCPeek
 *
 * Fetches MCP app HTML via the resources/read protocol and serves it directly.
 * This allows the app to be loaded in an iframe with full script capabilities.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Get parameters
$serverUrl = $_GET['server'] ?? '';
$resourceUri = $_GET['resource'] ?? '';
$toolName = $_GET['tool'] ?? '';

// Collect all other parameters as tool arguments with type coercion
$toolArgs = [];
foreach ($_GET as $key => $value) {
    if (!in_array($key, ['server', 'resource', 'tool'])) {
        // Coerce types: numeric strings to numbers, boolean strings to bools
        if (is_numeric($value)) {
            $toolArgs[$key] = strpos($value, '.') !== false ? (float)$value : (int)$value;
        } elseif ($value === 'true') {
            $toolArgs[$key] = true;
        } elseif ($value === 'false') {
            $toolArgs[$key] = false;
        } elseif ($value === 'null') {
            $toolArgs[$key] = null;
        } else {
            $toolArgs[$key] = $value;
        }
    }
}

if (!$serverUrl) {
    http_response_code(400);
    echo 'Missing server parameter';
    exit;
}

if (!$resourceUri) {
    http_response_code(400);
    echo 'Missing resource parameter';
    exit;
}

/**
 * Send request to MCP server
 */
function sendMCPRequest(string $url, array $request, bool $expectResponse = true): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($request),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json, text/event-stream, */*'
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode >= 400 || !$response) {
        error_log("MCP request failed: HTTP $httpCode, Error: $error");
        return null;
    }

    if (!$expectResponse) {
        return ['success' => true];
    }

    // Try JSON first
    $decoded = json_decode($response, true);
    if ($decoded !== null) {
        return $decoded;
    }

    // Try SSE format
    $lines = explode("\n", $response);
    foreach ($lines as $line) {
        $line = trim($line);
        if (str_starts_with($line, 'data:')) {
            $data = trim(substr($line, 5));
            if (!empty($data)) {
                $parsed = json_decode($data, true);
                if ($parsed !== null) {
                    return $parsed;
                }
            }
        }
    }

    return null;
}

// Initialize MCP session
$initRequest = [
    'jsonrpc' => '2.0',
    'id' => 1,
    'method' => 'initialize',
    'params' => [
        'protocolVersion' => '2025-11-25',
        'clientInfo' => [
            'name' => 'MCPeek-App-Proxy',
            'version' => '1.0.0'
        ],
        'capabilities' => new stdClass()
    ]
];

$initResponse = sendMCPRequest($serverUrl, $initRequest);
if (!$initResponse || isset($initResponse['error'])) {
    http_response_code(502);
    echo 'Failed to initialize MCP session: ' . ($initResponse['error']['message'] ?? 'Connection failed');
    exit;
}

// Send initialized notification
sendMCPRequest($serverUrl, [
    'jsonrpc' => '2.0',
    'method' => 'notifications/initialized',
    'params' => new stdClass()
], false);

// Fetch the UI resource
$resourceRequest = [
    'jsonrpc' => '2.0',
    'id' => 2,
    'method' => 'resources/read',
    'params' => [
        'uri' => $resourceUri
    ]
];

$resourceResponse = sendMCPRequest($serverUrl, $resourceRequest);

if (!$resourceResponse || isset($resourceResponse['error'])) {
    http_response_code(502);
    echo 'Failed to fetch MCP resource: ' . ($resourceResponse['error']['message'] ?? 'Unknown error');
    exit;
}

// Extract HTML content
$htmlContent = $resourceResponse['result']['contents'][0]['text'] ?? null;

if (!$htmlContent) {
    http_response_code(502);
    echo 'No HTML content in MCP resource';
    exit;
}

// Build legacy init data for non-SDK apps
// MCP Apps SDK init is handled by parent window via postMessage
$legacyInitData = array_merge(
    $toolArgs,
    [
        'toolName' => $toolName,
        'arguments' => $toolArgs,
        'serverUrl' => $serverUrl,
        'resourceUri' => $resourceUri
    ]
);
$legacyInitJson = json_encode($legacyInitData, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);

$initScript = <<<SCRIPT
<script>
    // MCP App initialization data - available for direct access
    // The MCP Apps SDK will receive the init message from the parent window via postMessage
    (function() {
        // Store for direct access by non-SDK apps
        window.MCP_INIT_DATA = {$legacyInitJson};
        window.MCP_SERVER_URL = '{$serverUrl}';

        // Dispatch custom event for non-SDK apps that don't use postMessage
        function dispatchInit() {
            window.dispatchEvent(new CustomEvent('mcp-init', { detail: window.MCP_INIT_DATA }));
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', dispatchInit);
        } else {
            setTimeout(dispatchInit, 50);
        }
    })();
</script>
SCRIPT;

// Inject before </head> or at the start
if (strpos($htmlContent, '</head>') !== false) {
    $htmlContent = str_replace('</head>', $initScript . '</head>', $htmlContent);
} else {
    $htmlContent = $initScript . $htmlContent;
}

// Rewrite relative URLs to point to the MCP server's base URL
// This handles scripts, stylesheets, and other assets loaded from /path
$parsedUrl = parse_url($serverUrl);
$baseUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
if (isset($parsedUrl['port'])) {
    $baseUrl .= ':' . $parsedUrl['port'];
}

// Rewrite src="/..." and href="/..." to use absolute URLs
$htmlContent = preg_replace(
    '/(src|href)=(["\'])\/(?!\/)/i',
    '$1=$2' . $baseUrl . '/',
    $htmlContent
);

// Serve the HTML
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $htmlContent;
