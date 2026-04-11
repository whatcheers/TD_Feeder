async function getFeed() {
  const res = await fetch('https://itunes.apple.com/search?term=tim+dillon&entity=podcast');
  const data = await res.json();
  console.log(data.results[0].feedUrl);
}
getFeed();
