import os
from datetime import datetime
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import (
    session_router,
    account_router,
    transaction_router,
    graph_router,
    detection_router,
    investigation_router,
)

app = FastAPI(
    title="TraceLedger API",
    description="Mini Banking Fraud Detection Simulator Using Graphs (DFS)",
    version="1.0.0",
)

# Comma separated list so deployment can point at the Vercel domain.
origins = os.getenv(
    "TRACELEDGER_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def relative_redirects(request: Request, call_next):
    """Keep redirects relative so they survive a reverse proxy.

    FastAPI answers /api/accounts with 307 to /api/accounts/, and builds the
    Location from the incoming Host header. Behind the Next.js rewrite that
    host is the backend's internal address, so the browser would be sent to
    127.0.0.1:8000. A relative Location resolves against the public origin.
    """
    response = await call_next(request)
    location = response.headers.get("location")
    if location:
        parts = urlsplit(location)
        if parts.scheme and parts.netloc:
            response.headers["location"] = parts.path + (
                f"?{parts.query}" if parts.query else ""
            )
    return response


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health() -> dict:
    return {
        "status": "healthy",
        "service": "TraceLedger API",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


app.include_router(session_router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(account_router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(transaction_router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(graph_router, prefix="/api/graph", tags=["Graph"])
app.include_router(detection_router, prefix="/api/detection", tags=["Detection"])
app.include_router(investigation_router, prefix="/api/investigations", tags=["Investigations"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
