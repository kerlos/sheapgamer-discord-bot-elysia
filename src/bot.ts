import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import { RssService } from './rssService';

const SUBSCRIPTION_FILE = "channels.json";

interface Subscriptions {
    [guildId: string]: string;
}

export class DiscordBot {
    private client: Client;
    private rssService: RssService | null;
    private token: string;

    constructor(token: string, rssUrl: string | undefined) {
        this.token = token;
        this.rssService = rssUrl ? new RssService(rssUrl) : null;

        // Initialize Discord Client
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.registerEvents();
    }

    private loadSubscriptions(): Subscriptions {
        if (fs.existsSync(SUBSCRIPTION_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(SUBSCRIPTION_FILE, 'utf-8'));
            } catch { return {}; }
        }
        return {};
    }

    private saveSubscription(guildId: string, channelId: string) {
        const subs = this.loadSubscriptions();
        subs[guildId] = channelId;
        fs.writeFileSync(SUBSCRIPTION_FILE, JSON.stringify(subs, null, 2));
    }

    private removeSubscription(guildId: string): boolean {
        const subs = this.loadSubscriptions();
        if (subs[guildId]) {
            delete subs[guildId];
            fs.writeFileSync(SUBSCRIPTION_FILE, JSON.stringify(subs, null, 2));
            return true;
        }
        return false;
    }

    private registerEvents() {
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user?.tag}`);
            
            // Generate Invite Link
            const permissions = [
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.ReadMessageHistory
            ];
            
            // Note: In discord.js invite generation is slightly different, 
            // but we can construct the URL manually or use generateInvite if needed.
            // Simplified URL construction for console output:
            const clientId = this.client.user?.id;
            const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=274878024768&scope=bot`;
            
            console.log("----------------------------------------------------------------");
            console.log(`👉 INVITE LINK: ${link}`);
            console.log("----------------------------------------------------------------");

            // Start the Loop (Every 20 minutes)
            this.runFeedCheck();
            setInterval(() => this.runFeedCheck(), 20 * 60 * 1000);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            // Check for admin permissions
            if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

            if (message.content === '!subscribe_sheapgamer') {
                this.saveSubscription(message.guildId!, message.channelId);
                await message.channel.send(`✅ ตั้งช่องข่าวสารเป็น <#${message.channelId}> เรียบร้อยแล้วค่ะ วาริรินจะโพสต์ข่าวสารที่นี่ค่ะ.`);
            }

            if (message.content === '!unsubscribe_sheapgamer') {
                if (this.removeSubscription(message.guildId!)) {
                    await message.channel.send("✅ หยุดการอัปเดตข่าวสารสำหรับเซิร์ฟเวอร์นี้แล้วค่ะ.");
                } else {
                    await message.channel.send("ℹ️ ยังไม่มีการตั้งค่าช่องข่าวสารสำหรับเซิร์ฟเวอร์นี้ค่ะ.");
                }
            }
        });
    }

    private async runFeedCheck() {
        if (!this.rssService) {
            console.log("RSS Service not initialized.");
            return;
        }

        console.log("Checking for news...");
        const newItems = await this.rssService.checkForNews();

        if (newItems.length === 0) {
            console.log("No new items found.");
            return;
        }

        console.log(`Found ${newItems.length} new items. Broadcasting...`);
        const subs = this.loadSubscriptions();

        // Items are usually newest first from RSS, but our logic pushed them in order.
        // We broadcast them.
        for (const item of newItems) {
            const embed = new EmbedBuilder()
                .setTitle(item.title)
                .setURL(item.link)
                .setColor(0x00ff00)
                .setFooter({ text: "ข่าวล่ามาไวจากเกมถูก" });

            if (item.image) {
                embed.setImage(item.image);
            }

            // Send to all channels
            for (const [guildId, channelId] of Object.entries(subs)) {
                try {
                    const channel = await this.client.channels.fetch(channelId) as TextChannel;
                    if (channel) {
                        await channel.send({ embeds: [embed] });
                    }
                } catch (e) {
                    console.error(`Failed to send to guild ${guildId}:`, e);
                }
            }
        }
    }

    public start() {
        this.client.login(this.token);
    }
}
