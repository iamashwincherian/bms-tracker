from browser import Browser
import json
import re

URL = "https://in.bookmyshow.com"

class BMS:
    """
    This class is used to scrape the BMS website
    """
    def __init__(self, city="", movie="", date="", theatre=""):
        self.base_url = URL
        self.city = city
        self.movie = movie
        self.date = date
        self.theatre = theatre
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
            data = json.loads(json_match.group(1))
            if not data or not data["hits"]:
                return None

            result = [{
                "name": item["TITLE"],
                "id": item["ID"],
                "slug": item["SLUG"],
            } for item in data["hits"]]

            return result

        except Exception as e:
            return {
                "success": False,
                "error": f"Error fetching data: {str(e)}"
            }

    async def get_theatre_names(self):
        """
        Scrape movies from BMS
        """
        show_available_theatres = []
        page = await self.browser.open(f'{self.base_url}/movies/{self.city.lower()}/{self.movie.lower()}/buytickets/ET00493207/{self.date}')
        element = await page.query_selector(".ReactVirtualized__Grid__innerScrollContainer")
        if element:
            try:
                children = await element.query_selector_all(":scope > *")
                for child in children:
                    theatre_item = await child.query_selector(":first-child > :first-child > :nth-child(2) > :first-child > :first-child > :first-child > :first-child > span")
                    name = await theatre_item.inner_text()
                    show_available_theatres.append(name)
                    print(name)

            except Exception as e:
                print(f"Error during navigation: {e}")
        return show_available_theatres

    # Add your scraping methods here
    async def get_shows(self):
        """
        Scrape movies from BMS
        """
        is_show_available = False
        show_available_theatres = []
        url_to_search = f'{self.base_url}/movies/{self.city.lower()}/{self.movie.lower()}/buytickets/ET00493207/{self.date}'
        page = await self.browser.open(url_to_search)
        print(url_to_search)
        element = await page.query_selector(".ReactVirtualized__Grid__innerScrollContainer")
        if element:
            try:
                children = await element.query_selector_all(":scope > *")
                for child in children:
                    theatre_item = await child.query_selector(":first-child > :first-child > :nth-child(2) > :first-child > :first-child > :first-child > :first-child > span")
                    name = await theatre_item.inner_text()
                    if self.theatre.lower() in name.lower():
                        is_show_available = True
                        show_available_theatres.append(name)

            except Exception as e:
                print(f"Error during navigation: {e}")

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
