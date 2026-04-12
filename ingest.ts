import 'dotenv/config';
import Parser from 'rss-parser';
import { Feed } from 'feed';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const PUBLIC_FEED_URL = 'https://audioboom.com/channels/5093219.rss';
const OUT_DIR = path.join(process.cwd(), 'data');
const OUT_FILE = path.join(OUT_DIR, 'main.rss');

type Source = 'public' | 'patreon';

interface NormalizedItem {
  title: string;
  guid: string;
  link: string;
  date: Date;
  description: string;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number;
  imageUrl?: string;
  source: Source;
}

type ParsedFeed = Awaited<ReturnType<Parser['parseURL']>>;

function normalize(feed: ParsedFeed, source: Source): NormalizedItem[] {
  const channelImage = (feed as any).itunes?.image || feed.image?.url;
  const items: NormalizedItem[] = [];
  for (const item of feed.items) {
    const enclosureUrl = item.enclosure?.url;
    if (!enclosureUrl) continue;
    const dateStr = (item as any).isoDate || item.pubDate;
    const date = dateStr ? new Date(dateStr) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    items.push({
      title: item.title || '(untitled)',
      guid: item.guid || (item as any).id || item.link || enclosureUrl,
      link: item.link || '',
      date,
      description: (item as any).content || item.contentSnippet || '',
      enclosureUrl,
      enclosureType: item.enclosure?.type || 'audio/mpeg',
      enclosureLength: Number(item.enclosure?.length) || 0,
      imageUrl: (item as any).itunes?.image || channelImage,
      source,
    });
  }
  return items;
}

async function fetchFeed(parser: Parser, url: string, label: string): Promise<ParsedFeed | null> {
  try {
    const feed = await parser.parseURL(url);
    console.log(`  ${label}: ${feed.items.length} items`);
    return feed;
  } catch (err) {
    console.error(`  ${label}: failed — ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const parser = new Parser();

  const patreonUrl = process.argv[2] || process.env.PATREON_FEED_URL || '';
  if (!patreonUrl) {
    console.warn('No PATREON_FEED_URL set (and no CLI arg) — continuing with public feed only.');
  }

  console.log('Fetching feeds...');
  const [publicFeed, patreonFeed] = await Promise.all([
    fetchFeed(parser, PUBLIC_FEED_URL, 'public '),
    patreonUrl ? fetchFeed(parser, patreonUrl, 'patreon') : Promise.resolve(null),
  ]);

  if (!publicFeed && !patreonFeed) {
    console.error('Both feeds failed. Nothing to write.');
    process.exit(1);
  }

  const items: NormalizedItem[] = [];
  if (publicFeed) items.push(...normalize(publicFeed, 'public'));
  if (patreonFeed) items.push(...normalize(patreonFeed, 'patreon'));
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  const channelImage =
    (publicFeed as any)?.itunes?.image || publicFeed?.image?.url || undefined;
  const siteLink = publicFeed?.link || 'https://audioboom.com/channels/5093219';

  const feed = new Feed({
    title: 'Tim Dillon Show — Combined',
    description: 'Personal archive combining public and Patreon episodes in chronological order.',
    id: siteLink,
    link: siteLink,
    language: 'en',
    image: channelImage,
    favicon: channelImage,
    copyright: '',
    updated: items[0]?.date ?? new Date(),
    generator: 'td_feeder ingest',
  });

  for (const it of items) {
    const title = it.source === 'patreon' ? `[Patreon] ${it.title}` : it.title;
    feed.addItem({
      title,
      id: it.guid,
      link: it.link || it.enclosureUrl,
      description: it.description,
      date: it.date,
      enclosure: {
        url: it.enclosureUrl,
        type: it.enclosureType,
        length: it.enclosureLength,
      },
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, feed.rss2(), 'utf8');

  const publicCount = items.filter((i) => i.source === 'public').length;
  const patreonCount = items.filter((i) => i.source === 'patreon').length;
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT_FILE)} — ${items.length} items (${publicCount} public, ${patreonCount} patreon)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
