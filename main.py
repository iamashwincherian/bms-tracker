from fastapi.responses import JSONResponse
from fastapi import FastAPI, HTTPException
from typing import Optional

from bms import BMS
from send_email import send_email

app = FastAPI(title="BMS Scraper API", description="API for scraping BookMyShow website")

@app.get("/theatres")
async def get_theatre_names(
    city: str,
    movie: str,
    date: str,
):
    """
    Get the theatre names for a given city, movie, and date

    - **city**: City name (e.g., kochi, mumbai, delhi)
    - **movie**: Movie name (e.g., The Dark Knight, The Dark Knight Rises, The Dark Knight)
    - **date**: Date in YYYYMMDD format (e.g., 20250830)
    """
    try:
        bms = BMS(city, movie, date)
        await bms.init()
        try:
            res = await bms.get_theatre_names()
            await bms.close()
            return JSONResponse(content={"success": True, "theatres": res})
        finally:
            await bms.close()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/shows")
async def search_shows(
    city: str,
    movie: str,
    id=str,
    date: str,
    theatre: Optional[str] = None,
    send_email_to: Optional[str] = None
):
    """
    Scan BMS website for movie tickets
    
    - **city**: City name (e.g., kochi, mumbai, delhi)
    - **date**: Date in YYYYMMDD format (e.g., 20250830)
    - **theatre**: Theatre name to filter (e.g., PVR, INOX) - optional
    """
    bms = BMS(city, movie, date, theatre, movie_id=id)
    await bms.init()
    try:
        res = await bms.get_shows()
        if send_email_to and res["show_available"]:
            await send_email(send_email_to, res)
        return JSONResponse(content=res)
    finally:
        await bms.close()

@app.get("/movies")
async def search_movies(
    query: str,
    city: Optional[str] = ""
):
    """
    Search for movies
    """
    bms = BMS(city=city)
    await bms.init()

    try:
        res = await bms.search_movies(query)
        return JSONResponse(content=res)
    finally:
        await bms.close()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "BMS Scraper API is running"}
