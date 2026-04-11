import Parser from 'rss-parser';
const parser = new Parser();
async function test() {
  try {
    const feed = await parser.parseURL('https://audioboom.com/channels/5093219.rss');
    console.log('Success! Items:', feed.items.length);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
