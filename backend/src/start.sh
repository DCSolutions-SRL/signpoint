#!/bin/bash

echo "¿Qué servidor quieres iniciar? ('prd' o 'tst'):"
read opcion

if [ "$opcion" = "prd" ]; then
    echo "Iniciando PRD..."
    nohup python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000 &
    echo "Servidor PRD iniciado en segundo plano."
elif [ "$opcion" = "tst" ]; then
    echo "Iniciando TST..."
    nohup python -m uvicorn test:app --reload --host 0.0.0.0 --port 8000 &
    echo "Servidor TST iniciado en segundo plano."
else
    echo "Opción no válida. Por favor elige 'prd' o 'tst'."
fi