from browser import Browser
import json
import re

URL = "https://in.bookmyshow.com"

# BMS's search API has no dedicated language field - it only ever shows up
# (inconsistently) as a trailing "(Language)" in the title itself, e.g.
# "Crazy Loka (Kannada)". This is the only way to recover it "if available".
KNOWN_LANGUAGES = {
    "hindi", "english", "tamil", "telugu", "malayalam", "kannada", "bengali",
    "marathi", "punjabi", "gujarati", "bhojpuri", "odia", "oriya", "assamese",
    "urdu", "konkani", "tulu", "rajasthani", "nepali", "sanskrit", "sindhi",
    "french", "spanish", "german", "japanese", "korean", "mandarin", "chinese",
}


def _extract_language(title):
    match = re.search(r"\(([A-Za-z]+)\)\s*$", title)
    if match and match.group(1).lower() in KNOWN_LANGUAGES:
        return match.group(1).capitalize()
    return None

class BMS:
    """
    This class is used to scrape the BMS website
    """
    def __init__(self, city="", movie="", date="", theatre="", movie_id=""):
        self.base_url = URL
        self.city = city
        self.movie = movie
        self.date = date
        self.theatre = theatre
        self.movie_id=movie_id
        self.browser = Browser()

    async def init(self):
        """Initialize the browser"""
        await self.browser.init()

    async def close(self):
        """Close the browser and cleanup resources"""
        if hasattr(self, 'browser') and self.browser:
            await self.browser.close()

    async def search_movies(self, query=""):
        """
        Fetch JSON data from BookMyShow quickbook search API
        
        Args:
            query (str): Search query (default: "lokah")
            city (str): City code (default: "KOCH")
            lat (str): Latitude (default: "13.056")
            lng (str): Longitude (default: "80.206")
            size (str): Number of results (default: "15")
            
        Returns:
            dict: JSON response from the API
        """
        try:
            url = f"{self.base_url}/quickbook-search.bms?c=&r={self.city}&sr=&em=&sc=&st=&f=json&t=rzPkrsC0lV&iss=N&cat=MT&q={query}"

            page = await self.browser.open(url)
            content = await page.content()
            json_match = re.search(r'<pre>(.*?)</pre>', content, re.DOTALL)
            if not json_match:
                # BMS didn't return the expected JSON - most often because
                # Cloudflare blocked/challenged the request based on the
                # server's IP reputation (common for datacenter/VPS IPs,
                # independent of how good the browser automation looks).
                # Log the full response so the real cause is visible in the
                # logs instead of a bare "NoneType has no attribute group".
                blocked = "cloudflare" in content.lower() or "attention required" in content.lower()
                print(f"search_movies: no <pre> JSON in response (blocked_by_cloudflare={blocked}). Full response below:\n{content}")
                return {
                    "success": False,
                    "error": (
                        "BMS blocked this request (likely Cloudflare flagging the server's IP)"
                        if blocked else
                        "BMS returned an unexpected response instead of search results"
                    ),
                }
            data = json.loads(json_match.group(1))
            if not data or not data["hits"]:
                return None

            result = [{
                "name": item["TITLE"],
                "id": item["ID"],
                "slug": item["SLUG"],
                "poster": item.get("POSTER_URL") or None,
                "language": _extract_language(item["TITLE"]),
            } for item in data["hits"]]

            return result

        except Exception as e:
            return {
                "success": False,
                "error": f"Error fetching data: {str(e)}"
            }

    @staticmethod
    async def _log_page_content(page, where):
        """
        When a scrape comes back empty because the expected grid never
        rendered, log the full page content so a blocked/challenged
        request and a genuine "nothing here" result - which otherwise
        look identical from the API response alone - can be told apart.
        """
        try:
            content = await page.content()
        except Exception:
            return
        lowered = content.lower()
        blocked = "cloudflare" in lowered or "attention required" in lowered or "captcha" in lowered
        print(f"{where}: grid not found (blocked_by_cloudflare={blocked}). Full response below:\n{content}")

    @staticmethod
    def _date_from_url(url):
        """
        Extract the trailing YYYYMMDD path segment from a buytickets URL.
        """
        path = url.split("?")[0].rstrip("/")
        segment = path.rsplit("/", 1)[-1]
        return segment if re.fullmatch(r"\d{8}", segment) else None

    @staticmethod
    async def _read_theatre_row(row):
        """
        Given one theatre row from the buytickets grid, return its
        (name, showtimes) pair. Showtimes are read from the showtime
        buttons' aria-label (e.g. "10:00 PM" or "11:45 PM, INSIGNIA"),
        which is stable accessibility markup rather than BMS's
        auto-generated, frequently-changing CSS class names.
        """
        name_el = await row.query_selector(":first-child > :first-child > :nth-child(2) > :first-child > :first-child > :first-child > :first-child > span")
        if not name_el:
            return None, []
        name = await name_el.inner_text()

        showtimes = []
        for button in await row.query_selector_all('[role="button"][aria-label]'):
            label = await button.get_attribute("aria-label")
            if label:
                showtimes.append(label)

        return name, showtimes

    async def get_cinemas(self):
        """
        Scrape the full directory of cinemas in self.city (independent of
        any specific movie or date), from BMS's own "/{city}/cinemas" page.
        """
        cinemas = []
        page = await self.browser.open(f'{self.base_url}/{self.city.lower()}/cinemas')
        element = await page.query_selector(".ReactVirtualized__Grid__innerScrollContainer")
        if element:
            try:
                cells = await element.query_selector_all(":scope > *")
                for cell in cells:
                    content = await cell.query_selector('div[role="button"]:not([aria-label])')
                    if not content:
                        continue
                    divs = await content.query_selector_all(":scope > div")
                    if len(divs) >= 2:
                        name = await divs[0].inner_text()
                        address = await divs[1].inner_text()
                        cinemas.append({"name": name, "address": address})
            except Exception as e:
                print(f"Error during navigation: {e}")
        else:
            await self._log_page_content(page, "get_cinemas")
        return cinemas

    async def get_theatre_names(self):
        """
        Scrape theatres (with their showtimes) for a movie/city/date from BMS
        """
        show_available_theatres = []
        page = await self.browser.open(f'{self.base_url}/movies/{self.city.lower()}/{self.movie.lower()}/buytickets/{self.movie_id}/{self.date}')
        element = await page.query_selector(".ReactVirtualized__Grid__innerScrollContainer")
        if self._date_from_url(page.url) != self.date:
            # BMS silently redirects back to a bookable date (e.g. today) when
            # the requested date is outside its booking window, instead of
            # showing an error - without this check we'd scrape and return
            # that other date's real showtimes as if they were self.date's.
            return []
        if element:
            try:
                children = await element.query_selector_all(":scope > *")
                for child in children:
                    name, showtimes = await self._read_theatre_row(child)
                    if name:
                        show_available_theatres.append({"name": name, "showtimes": showtimes})

            except Exception as e:
                print(f"Error during navigation: {e}")
        else:
            await self._log_page_content(page, "get_theatre_names")
        return show_available_theatres

    # Add your scraping methods here
    async def get_shows(self):
        """
        Scrape theatres (with their showtimes) for a movie/city/date from BMS,
        optionally filtered to theatre names matching self.theatre
        """
        is_show_available = False
        show_available_theatres = []
        theatre_filter = (self.theatre or "").lower()
        url_to_search = f'{self.base_url}/movies/{self.city.lower()}/{self.movie.lower()}/buytickets/{self.movie_id}/{self.date}'
        page = await self.browser.open(url_to_search)
        print(url_to_search)
        element = await page.query_selector(".ReactVirtualized__Grid__innerScrollContainer")
        if self._date_from_url(page.url) != self.date:
            # BMS silently redirects back to a bookable date (e.g. today) when
            # the requested date is outside its booking window, instead of
            # showing an error - without this check we'd scrape and return
            # that other date's real showtimes as if they were self.date's.
            return {
                "success": False,
                "message": f"No show available on {self.date}",
                "show_available": False,
            }
        if element:
            try:
                children = await element.query_selector_all(":scope > *")
                for child in children:
                    name, showtimes = await self._read_theatre_row(child)
                    if name and (not theatre_filter or theatre_filter in name.lower()):
                        is_show_available = True
                        show_available_theatres.append({"name": name, "showtimes": showtimes})

            except Exception as e:
                print(f"Error during navigation: {e}")
        else:
            await self._log_page_content(page, "get_shows")

        if not is_show_available:
            return {
                "success": False,
                "message": f"No show available on {self.date}",
                "show_available": False,
            }

        return {
            "success": True,
            "title": self.movie,
            "date": self.date,
            "city": self.city,
            "theatre_filter": self.theatre,
            "theatres": show_available_theatres,
            "show_available": is_show_available,
            "message": f"Show available on {self.date}"
        }
