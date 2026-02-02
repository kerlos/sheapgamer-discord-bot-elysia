import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';

// Define the shape of our news item
export interface NewsItem {
    title: string;
    link: string;
    summary: string;
    guid: string;
    image: string | null;
}

interface StateData {
    last_seen_id: string | null;
    updated_at: string;
}

export class RssService {
    private feedUrl: string;
    private dbFile: string;
    private parser: Parser;
    private lastSeenId: string | null;

    constructor(feedUrl: string, dbFile: string = "news_state.json") {
        this.feedUrl = feedUrl;
        this.dbFile = dbFile;
        // Configure parser to fetch specific fields like media:content
        this.parser = new Parser({
            customFields: {
                item: [['media:content', 'mediaContent', { keepArray: true }]]
            }
        });
        this.lastSeenId = this.loadState();
    }

    private loadState(): string | null {
        if (fs.existsSync(this.dbFile)) {
            try {
                const data = fs.readFileSync(this.dbFile, 'utf-8');
                const json: StateData = JSON.parse(data);
                return json.last_seen_id;
            } catch (e) {
                console.error("Error reading state file:", e);
            }
        }
        return null;
    }

    private saveState(lastId: string): void {
        const data: StateData = {
            last_seen_id: lastId,
            updated_at: new Date().toISOString()
        };
        fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
        this.lastSeenId = lastId;
    }

    private cleanHtml(rawHtml: string): string {
        if (!rawHtml) return "No description available.";
        // Simple regex to strip tags, similar to the Python version
        return rawHtml.replace(/<[^>]*>?/gm, '').trim();
    }

    async checkForNews(): Promise<NewsItem[]> {
        try {
            const feed = await this.parser.parseURL(this.feedUrl);
            
            if (!feed.items || feed.items.length === 0) return [];

            const latestItem = feed.items[0];
            const latestGuid = latestItem.guid || latestItem.link || '';

            // If latest GUID matches what we have, no new news
            if (latestGuid === this.lastSeenId) {
                return [];
            }

            const newArticles: NewsItem[] = [];

            for (const item of feed.items) {
                const guid = item.guid || item.link || '';
                
                // Stop if we reach the last seen news
                if (guid === this.lastSeenId) break;

                // Clean summary
                const rawSummary = item.summary || item.contentSnippet || '';
                let cleanSummary = this.cleanHtml(rawSummary);
                if (cleanSummary.length > 300) {
                    cleanSummary = cleanSummary.substring(0, 297) + "...";
                }

                // Extract Image
                let imageUrl: string | null = null;
                
                // 1. Try custom media:content parsing
                if ((item as any).mediaContent) {
                    const media = (item as any).mediaContent;
                    // mediaContent is often an array or object depending on XML structure
                    if (Array.isArray(media)) {
                        const img = media.find((m: any) => m.$?.medium === 'image' || m.$.url);
                        if (img) imageUrl = img.$.url;
                    } else if (media?.$?.url) {
                        imageUrl = media.$.url;
                    }
                }

                // 2. Fallback: Check enclosure (standard RSS)
                if (!imageUrl && item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
                    imageUrl = item.enclosure.url;
                }

                newArticles.push({
                    title: item.title || 'Untitled',
                    link: item.link || '',
                    summary: cleanSummary,
                    guid: guid,
                    image: imageUrl
                });
            }

            if (newArticles.length > 0) {
                // Determine the "newest" GUID (which is the first one in the loop)
                // Since we iterate top-down, the first item processed was the newest
                // Wait, logic check: in loop we go top down. 
                // We should update state to the absolute latest item's GUID.
                this.saveState(latestGuid);
            }

            return newArticles;

        } catch (error) {
            console.error("Error fetching RSS:", error);
            return [];
        }
    }
}