from fastapi import FastAPI
import uvicorn

app = FastAPI(title="AI Education Service")

@app.get("/")
async def root():
    return {"message": "AI Service is working!", "status": "healthy"}

@app.get("/health")
async def health():
    return {"status": "AI service running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 