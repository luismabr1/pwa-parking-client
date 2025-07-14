"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "20px",
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#f9fafb",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              textAlign: "center",
              maxWidth: "400px",
              width: "100%",
            }}
          >
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "#dc2626",
              }}
            >
              Error Global
            </h1>

            <p
              style={{
                color: "#6b7280",
                marginBottom: "24px",
              }}
            >
              Ha ocurrido un error crítico en la aplicación.
            </p>

            {error.message.includes("chunk") && (
              <div
                style={{
                  backgroundColor: "#dbeafe",
                  padding: "12px",
                  borderRadius: "6px",
                  marginBottom: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    color: "#1e40af",
                  }}
                >
                  🔄 Error de chunk detectado. Recargando página...
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                Reintentar
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  color: "#374151",
                  padding: "12px 24px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                Inicio
              </button>
            </div>
          </div>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Auto-reload en caso de errores de chunk
            if (window.location.search.includes('chunk-error')) {
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
            }
          `,
          }}
        />
      </body>
    </html>
  )
}
