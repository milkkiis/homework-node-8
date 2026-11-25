// Подключаем WebSocket и встроенный модуль чтения из терминала
const WebSocket = require("ws");
const readline = require("node:readline");

// Подключаемся к локальному WebSocket-серверу.
const client = new WebSocket("ws://127.0.0.1:9000");

let input;
let dateTimer;

// После открытия соединения разрешаем ввод сообщений
client.on("open", () => {
    console.log("Подключено к серверу WebSocket");
    console.log("Введите текст или JSON-команду и нажмите Enter.");
    console.log("Для выхода нажмите Ctrl+C.");

    input = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    input.on("line", (line) => {
        // Не отправляем пустые сообщения
        if (!line.trim()) {
            return;
        }

        if (client.readyState === WebSocket.OPEN) {
            client.send(line);
        }
    });


    if (process.argv.includes("--dates")) {
        console.log("Включена отправка даты каждые 3 секунды.");

        dateTimer = setInterval(() => {
            if (client.readyState === WebSocket.OPEN) {
                const currentDate = new Date().toISOString();

                console.log("Отправлено:", currentDate);
                client.send(currentDate);
            }
        }, 3000);
    }
});

// Показываем ответ сервера
client.on("message", (message) => {
    console.log("Ответ от сервера:", message.toString());
});

// Показываем ошибку соединения
client.on("error", (error) => {
    console.error("Ошибка WebSocket:", error.message);
});

// При отключении очищаем таймер и закрываем ввод
client.on("close", () => {
    clearInterval(dateTimer);

    if (input) {
        input.close();
    }

    console.log("Соединение закрыто");
});

process.on("SIGINT", () => {
    clearInterval(dateTimer);

    if (input) {
        input.close();
    }

    client.close();
});