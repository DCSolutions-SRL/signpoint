#!/bin/bash

# CLI interactivo para gestionar la API (start/restart/stop) en PRD o TST
# Reemplaza los antiguos start.sh y stop.sh

set -o errexit
set -o pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)
cd "$SCRIPT_DIR"

PORT=8000

# Obtiene los PIDs de uvicorn (app:app o test:app) escuchando en el puerto indicado
get_pids() {
    ps aux \
        | grep "[u]vicorn" \
        | grep -E "app:app|test:app" \
        | grep "$PORT" \
        | awk '{print $2}'
}

is_running() {
    local pids
    pids=$(get_pids)
    [[ -n "$pids" ]]
}

current_mode() {
    # Devuelve prd|tst si se puede inferir, vacío en otro caso
    local line
    line=$(ps aux | grep "[u]vicorn" | grep "$PORT" | head -n1 || true)
    if echo "$line" | grep -q "app:app"; then
        echo "prd"
    elif echo "$line" | grep -q "test:app"; then
        echo "tst"
    else
        echo ""
    fi
}

start_server() {
    local mode="$1" # prd|tst
    if is_running; then
        echo "Ya hay un servidor corriendo en el puerto $PORT (modo: $(current_mode || echo desconocido)). Usa 'Reiniciar' o 'Detener' primero."
        return 1
    fi

    if [[ "$mode" == "prd" ]]; then
        echo "Iniciando PRD en puerto $PORT..."
        nohup python -m uvicorn app:app --reload --host 0.0.0.0 --port "$PORT" >/dev/null 2>&1 &
    elif [[ "$mode" == "tst" ]]; then
        echo "Iniciando TST en puerto $PORT..."
        nohup python -m uvicorn test:app --reload --host 0.0.0.0 --port "$PORT" >/dev/null 2>&1 &
    else
        echo "Modo desconocido: $mode (usa 'prd' o 'tst')"
        return 1
    fi
    sleep 0.3
    echo "Servidor $mode iniciado en segundo plano (PID: $!)."
}

stop_server() {
    local pids
    pids=$(get_pids)
    if [[ -z "$pids" ]]; then
        echo "No se encontraron servidores uvicorn corriendo en el puerto $PORT."
        return 0
    fi
    echo "Deteniendo procesos: $pids"
    kill $pids || true
    sleep 0.5
    # Fuerza si sigue vivo
    local still
    still=$(get_pids || true)
    if [[ -n "$still" ]]; then
        echo "Forzando terminación: $still"
        kill -9 $still || true
    fi
    echo "Servidores detenidos."
}

restart_server() {
    local mode="$1" # prd|tst
    echo "Reiniciando servidor ($mode)..."
    stop_server
    start_server "$mode"
}

print_menu() {
    echo ""
    echo "==== SignPoint API ===="
    echo "Puerto: $PORT"
    if is_running; then
        echo "Estado: RUNNING (modo: $(current_mode))"
    else
        echo "Estado: STOPPED"
    fi
    echo "-----------------------"
    echo "1) Iniciar PRD"
    echo "2) Iniciar TST"
    echo "3) Reiniciar PRD"
    echo "4) Reiniciar TST"
    echo "5) Detener"
    echo "6) Salir"
    echo -n "Selecciona una opción [1-6]: "
}

while true; do
    print_menu
    read -r opt
    case "$opt" in
        1)
            start_server "prd"
            ;;
        2)
            start_server "tst"
            ;;
        3)
            restart_server "prd"
            ;;
        4)
            restart_server "tst"
            ;;
        5)
            stop_server
            ;;
        6)
            echo "Saliendo..."
            exit 0
            ;;
        *)
            echo "Opción no válida. Elige un número del 1 al 6."
            ;;
    esac
done