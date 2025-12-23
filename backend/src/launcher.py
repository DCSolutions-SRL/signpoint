import sys
import uvicorn

if len(sys.argv) > 1:
    target = sys.argv[1]  # ejemplo: "test:app" o "app:app"
else:
    target = "test:app"   # default

uvicorn.run(target, host="0.0.0.0", port=8000)