#!/bin/bash

echo "Frenando servidores uvicorn (app:app y test:app)..."

# Encuentra los procesos de uvicorn que usan app:app o test:app en el puerto 8000 y los mata
PIDS=$(ps aux | grep "uvicorn" | grep -E "app:app|test:app" | grep "8000" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
    echo "No se encontraron servidores uvicorn corriendo en el puerto 8000."
else
    echo "Matando procesos: $PIDS"
    kill $PIDS
    echo "Servidores detenidos."
fi
