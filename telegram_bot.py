import os
from warnings import filterwarnings
from dotenv import load_dotenv
from telegram import ReplyKeyboardMarkup, Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters, ConversationHandler, CallbackQueryHandler
from telegram.warnings import PTBUserWarning

# Load environment variables from .env file
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN not found!.")

START_CONVO = "START_CONVO"
ENTER_CITY = "ENTER_CITY"

filterwarnings(action="ignore", message=r".*CallbackQueryHandler", category=PTBUserWarning)

async def start(update: Update, _: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("Search Movies", callback_data="movies")],
        [InlineKeyboardButton("Search Theatres", callback_data="theatres")],
        [InlineKeyboardButton("Search Shows", callback_data="shows")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Choose an option :", reply_markup=reply_markup)
    return START_CONVO

async def choose_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    choice = query.data
    context.user_data['conversation_choice'] = choice

    if choice == "movies":
        await query.edit_message_text("Enter your city")
        return ENTER_CITY
    elif choice == "theatres":
        # await query.edit_message_text("You chose Conversation 2.\nQuestion 1: What's your hobby?")
        return ENTER_CITY

async def enter_city_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    city = update.message.text
    context.user_data['city'] = city
    await update.message.reply_text(f"You entered: {city}")
    return ConversationHandler.END

async def help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "/start - Start the bot\n"
        "/help - Show this help message"
    )
    await update.message.reply_text(help_text)

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f'You said: {update.message.text}')

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return ConversationHandler.END

def start_bot():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("help", help))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            START_CONVO: [CallbackQueryHandler(choose_conversation), MessageHandler(filters.TEXT & ~filters.COMMAND, choose_conversation)],
            ENTER_CITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, enter_city_callback)],
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )

    app.add_handler(conv_handler)
    print("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    start_bot()
