export const metadata = { title: "ai-studio Public API v1" };

/**
 * Swagger UI 페이지 — OpenAPI 3.0 스펙을 시각화.
 * CDN 기반으로 단순화 (별도 패키지 의존성 없음).
 */
export default function Page() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ai-studio API v1</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger',
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;

  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100vh", border: 0 }}
      title="ai-studio API v1 docs"
    />
  );
}
