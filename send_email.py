import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any
import os
from dotenv import load_dotenv

load_dotenv()

async def send_email(receiver_email: str, res: Any) -> None:
    """
    Send an email with the result JSON data
    
    Args:
        res: The result object containing show availability data
    """
    # Email configuration
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    # Create message
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = "BMS Show Availability Alert"

    # Convert result to JSON string for email body
    try:
        if hasattr(res, '__dict__'):
            # If it's an object with attributes, convert to dict
            res_dict = res.__dict__
        else:
            # If it's already a dict or other type
            res_dict = res

        res_json = json.dumps(res_dict, indent=2, default=str)
    except Exception as e:
        res_json = f"Error serializing result: {str(e)}\nResult type: {type(res)}"

    # Email body
    body = f"""
    🎬 BMS Show Availability Alert 🎬
    
    A movie show has been found available on BookMyShow!
    
    📋 Details:
    {res_json}
    
    ---
    This is an automated alert from your BMS Scraper API.
    """

    msg.attach(MIMEText(body, 'plain'))

    try:
        # Create SMTP session
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()

        # Login to the server
        server.login(sender_email, sender_password)

        # Send email
        text = msg.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()

        print(f"✅ Email sent successfully to {receiver_email}")

    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        # Don't raise the exception to avoid breaking the main flow
