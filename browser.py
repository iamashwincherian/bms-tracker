from playwright.async_api import async_playwright
from playwright_stealth import Stealth

class Browser:
    """
    This class is used to create a browser instance
    """
    def __init__(self):
        self.browser = None
        self.page = None
        self.playwright = None

    async def init(self):
        """Initialize the browser asynchronously"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
            ]
        )
        context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/118.0.5993.90 Safari/537.36",
        )

        self.page = await context.new_page()
        await Stealth().apply_stealth_async(self.page)

    async def close(self):
        """Close the browser and cleanup resources"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def open(self, url):
        """Open a URL and evaluate navigator.webdriver"""
        await self.page.goto(url)
        await self.page.evaluate("navigator.webdriver")
        return self.page