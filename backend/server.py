"""
Proxy server — forwards all /api/* requests to Next.js on port 3000.
This allows the Kubernetes ingress to route /api/* → port 8001 → Next.js.
"""
import os
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, Response

app = FastAPI()
NEXTJS_BASE = "http://localhost:3000"

@app.api_route("/api/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS","HEAD"])
async def proxy_to_nextjs(request: Request, path: str):
    url = f"{NEXTJS_BASE}/api/{path}"
    params  = dict(request.query_params)
    headers = dict(request.headers)
    headers.pop("host", None)
    body    = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method  = request.method,
                url     = url,
                params  = params,
                headers = headers,
                content = body,
            )
            return Response(
                content    = resp.content,
                status_code= resp.status_code,
                headers    = dict(resp.headers),
                media_type = resp.headers.get("content-type", "application/json"),
            )
        except httpx.ConnectError:
            return Response(content=b'{"error":"Next.js not ready"}', status_code=503, media_type="application/json")
        except Exception as e:
            return Response(content=f'{{"error":"{str(e)}"}}'.encode(), status_code=500, media_type="application/json")

@app.get("/health")
def health():
    return {"status": "proxy ok", "nextjs": NEXTJS_BASE}
