export async function scrollToEnd(page, timeoutMs = 30000, stepMs = 1000) {
  const start = Date.now();
  let lastHeight = await page.evaluate(() => document.body.scrollHeight);

  while (Date.now() - start < timeoutMs) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
     await new Promise((resolve) => setTimeout(resolve, stepMs));

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }
}