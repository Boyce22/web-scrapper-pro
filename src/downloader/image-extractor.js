export async function extractImageUrls(page, baseUrl) {
  const urls = await page.evaluate(() => {
    const imageElements = document.querySelectorAll('img');
    const urls = [];

    for (const img of imageElements) {
      const sources = [
        img.currentSrc,
        img.src,
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy'),
        img.getAttribute('data-original'),
        img.getAttribute('srcset'),
        img.getAttribute('data-srcset'),
      ];

      for (const source of sources) {
        if (source) {
          urls.push(source);
        }
      }
    }

    return urls;
  });

  const uniqueUrls = new Set();

  for (const url of urls) {
    const splitUrls = url
      .split(',')
      .map((part) => part.trim().split(' ')[0])
      .filter(Boolean);

    for (const splitUrl of splitUrls) {
      const absoluteUrl = new URL(splitUrl, baseUrl).href;
      uniqueUrls.add(absoluteUrl);
    }
  }

  return Array.from(uniqueUrls);
}
