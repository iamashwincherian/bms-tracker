import asyncio
import json
import urllib.request

REGIONS_URL = "https://assets-in.bmscdn.com/discovery-catalog/response-cache/regions.json"

_cache = None


def _region_to_city(region, popular):
    return {
        "name": region["RegionName"],
        "code": region["RegionCode"],
        "slug": region["RegionSlug"],
        "aliases": region.get("Alias", []),
        "popular": popular,
    }


def _fetch_cities_sync():
    req = urllib.request.Request(REGIONS_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)

    regions = data["BookMyShow"]
    cities = [_region_to_city(r, popular=True) for r in regions["TopCities"]]
    cities += [_region_to_city(r, popular=False) for r in regions["OtherCities"]]
    return cities


async def get_cities():
    """
    List of cities BookMyShow supports, sourced from the same region
    directory their own city picker uses. Cached in-process since this
    data changes rarely.
    """
    global _cache
    if _cache is None:
        _cache = await asyncio.to_thread(_fetch_cities_sync)
    return _cache
