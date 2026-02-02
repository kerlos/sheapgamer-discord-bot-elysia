import { Elysia } from 'elysia';
import { DiscordBot } from './bot';

// Check Environment Variables
const RSS_URL = process.env.RSS_URL;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    console.error("❌ Error: DISCORD_TOKEN is missing in .env");
    process.exit(1);
}

// 1. Start Discord Bot
console.log("Starting Discord Bot...");
const bot = new DiscordBot(DISCORD_TOKEN, RSS_URL);
bot.start();

// 2. Start Elysia Server (Health Check)
// This keeps the process alive and gives you a URL to ping
const app = new Elysia()
    .get("/", () => "🤖 Discord RSS Bot is Running!")
    .get("/health", () => {
        return { status: "ok", timestamp: new Date() };
    })
    .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);