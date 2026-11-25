const WebSocket = require("ws");
const redisClient = require("./redis");

const PORT = 9000;

const TODOS_KEY = "homework8:todos";

function sendJSON(socket, data) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

// Проверяем обязательные строковые поля
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

// Обрабатываем сообщение от клиента
async function handleMessage(socket, message) {
    const text = message.toString();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        // JSON-команда должна быть корректной
        if (text.trimStart().startsWith("{")) {
            sendJSON(socket, { error: "Некорректный JSON" });
            return;
        }

        // Обычный текст, включая дату, возвращаем в перевёрнутом виде
        const reversedText = Array.from(text).reverse().join("");

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(reversedText);
        }

        return;
    }

    if (
        data === null ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        typeof data.command !== "string"
    ) {
        sendJSON(socket, {
            error: "Ожидается JSON-объект с полем command",
        });
        return;
    }

    // Для создания, изменения и удаления нужен ID задачи
    const needsId = ["create", "update", "delete"].includes(data.command);

    if (needsId && !isNonEmptyString(data.id)) {
        sendJSON(socket, {
            error: "ID должен быть непустой строкой",
        });
        return;
    }

    // Для создания и изменения нужен заголовок
    const needsTitle = ["create", "update"].includes(data.command);

    if (needsTitle && !isNonEmptyString(data.title)) {
        sendJSON(socket, {
            error: "Заголовок должен быть непустой строкой",
        });
        return;
    }

    switch (data.command) {
        case "create": {
            // Создаём задачу только в том случае, если ID ещё не занят
            const created = await redisClient.hSetNX(
                TODOS_KEY,
                data.id,
                data.title
            );

            if (!created) {
                sendJSON(socket, {
                    error: "Задача с таким ID уже существует",
                });
                return;
            }

            sendJSON(socket, { message: "TODO создано" });
            break;
        }

        case "read": {
            // Возвращаем все задачи из Redis
            const todos = await redisClient.hGetAll(TODOS_KEY);

            sendJSON(socket, todos);
            break;
        }

        case "update": {
            // Проверяем наличие задачи перед изменением
            const exists = await redisClient.hExists(TODOS_KEY, data.id);

            if (!exists) {
                sendJSON(socket, { error: "TODO не найдено" });
                return;
            }

            await redisClient.hSet(TODOS_KEY, data.id, data.title);

            sendJSON(socket, { message: "TODO обновлено" });
            break;
        }

        case "delete": {
            // hDel возвращает количество удалённых полей
            const deleted = await redisClient.hDel(TODOS_KEY, data.id);

            if (deleted === 0) {
                sendJSON(socket, { error: "TODO не найдено" });
                return;
            }

            sendJSON(socket, { message: "TODO удалено" });
            break;
        }

        default:
            sendJSON(socket, { error: "Неизвестная команда" });
    }
}

// Сначала подключаем Redis, затем запускаем WebSocket-сервер
async function startServer() {
    await redisClient.connect();

    const server = new WebSocket.Server({ port: PORT });

    server.on("listening", () => {
        console.log(`WebSocket-сервер запущен на порту ${PORT}`);
    });

    server.on("connection", (socket) => {
        console.log("Клиент подключился");

        socket.on("message", (message) => {
            // Перехватываем ошибки асинхронной обработки сообщений.
            handleMessage(socket, message).catch((error) => {
                console.error("Ошибка обработки сообщения:", error.message);

                sendJSON(socket, {
                    error: "Ошибка выполнения команды",
                });
            });
        });

        socket.on("close", () => {
            console.log("Клиент отключился");
        });

        socket.on("error", (error) => {
            console.error("Ошибка клиента:", error.message);
        });
    });

    server.on("error", (error) => {
        console.error("Ошибка WebSocket-сервера:", error.message);
        process.exit(1);
    });
}

startServer().catch((error) => {
    console.error("Не удалось запустить сервер:", error.message);
    process.exit(1);
});