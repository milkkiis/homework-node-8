const { createClient } = require("redis");

// Подключаемся к Redis через порт, опубликованный Docker-контейнером
const redisClient = createClient({
    url: "redis://127.0.0.1:6379",
});

// Событие ready означает, что клиент готов выполнять команды
redisClient.on("ready", () => {
    console.log("Подключено к Redis");
});

// Обрабатываем ошибки соединения
redisClient.on("error", (error) => {
    console.error("Ошибка Redis:", error.message);
});

module.exports = redisClient;