import asyncio
import logging
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, PreCheckoutQueryHandler, MessageHandler, filters

BOT_TOKEN = "8513833879:AAF9bnHK7ri5CJQp9jAQph2a2nlINpRZhII"
CHIPS_PER_STAR = 10
MIN_BET = 10
MAX_BET = 500

logging.basicConfig(level=logging.INFO)

SUITS = ['♠','♥','♦','♣']
RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
VALUES = {'A':11,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10}

def new_deck():
    deck = [(r,s) for s in SUITS for r in RANKS]
    random.shuffle(deck)
    return deck

def card_str(c): return f"{c[0]}{c[1]}"
def hand_str(h): return ' '.join(card_str(c) for c in h)
def hand_value(h):
    t = sum(VALUES[c[0]] for c in h)
    a = sum(1 for c in h if c[0]=='A')
    while t > 21 and a:
        t -= 10; a -= 1
    return t
def is_bj(h): return len(h)==2 and hand_value(h)==21

users = {}
games = {}

def get_user(uid):
    if uid not in users:
        users[uid] = {'chips':0,'played':0,'wins':0}
    return users[uid]

def bet_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("10",callback_data="bet_10"),
         InlineKeyboardButton("25",callback_data="bet_25"),
         InlineKeyboardButton("50",callback_data="bet_50")],
        [InlineKeyboardButton("100",callback_data="bet_100"),
         InlineKeyboardButton("200",callback_data="bet_200"),
         InlineKeyboardButton("ALL IN 🔥",callback_data="bet_allin")]
    ])

def buy_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⭐ 10 Stars → 100 chips",callback_data="buy_10")],
        [InlineKeyboardButton("⭐ 50 Stars → 500 chips",callback_data="buy_50")],
        [InlineKeyboardButton("⭐ 100 Stars → 1000 chips",callback_data="buy_100")],
    ])

def game_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Hit 🃏",callback_data="hit"),
         InlineKeyboardButton("Stand ✋",callback_data="stand")],
        [InlineKeyboardButton("Double Down 💰",callback_data="double")]
    ])

def again_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Play Again 🎮",callback_data="play_again"),
         InlineKeyboardButton("Buy Chips ⭐",callback_data="show_buy")]
    ])

async def start(update, ctx):
    u = get_user(update.effective_user.id)
    args = ctx.args
    if args and args[0].startswith('buy'):
        await update.message.reply_text(
            f"⭐ *Buy Chips*\n\nYour chips: *{u['chips']}*\n\n1 ⭐ = {CHIPS_PER_STAR} chips",
            parse_mode='Markdown', reply_markup=buy_kb())
        return
    await update.message.reply_text(
        f"🃏 *Welcome to BlackJack Bot!*\n\nYour chips: *{u['chips']}*",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Play Blackjack", web_app={"url": "https://frontend-iota-two-17.vercel.app"})],
        ]))

async def play(update, ctx):
    u = get_user(update.effective_user.id)
    if u['chips'] < MIN_BET:
        await update.message.reply_text("❌ Not enough chips! Buy some first:", reply_markup=buy_kb())
        return
    await update.message.reply_text(
        f"💰 Chips: *{u['chips']}*\n\nChoose your bet:",
        parse_mode='Markdown', reply_markup=bet_kb())

async def button(update, ctx):
    q = update.callback_query
    await q.answer()
    uid = q.from_user.id
    u = get_user(uid)
    d = q.data

    if d == 'show_buy':
        await q.edit_message_text(f"⭐ *Buy Chips*\n\nYour chips: {u['chips']}",
            parse_mode='Markdown', reply_markup=buy_kb())
        return

    if d.startswith('buy_'):
        stars = int(d.split('_')[1])
        await ctx.bot.send_invoice(
            chat_id=uid,
            title=f"🃏 {stars*CHIPS_PER_STAR} Blackjack Chips",
            description=f"{stars*CHIPS_PER_STAR} chips to play Blackjack.",
            payload=f"chips_{stars*CHIPS_PER_STAR}",
            currency="XTR",
            provider_token="",
            prices=[{"label":f"{stars*CHIPS_PER_STAR} Chips","amount":stars}],
        )
        return

    if d == 'play_again':
        if u['chips'] < MIN_BET:
            await q.edit_message_text("❌ Not enough chips!", reply_markup=buy_kb())
            return
        await q.edit_message_text(f"💰 Chips: *{u['chips']}*\n\nChoose your bet:",
            parse_mode='Markdown', reply_markup=bet_kb())
        return

    if d.startswith('bet_'):
        amt = d.split('_')[1]
        bet = min(u['chips'], MAX_BET) if amt == 'allin' else int(amt)
        if bet > u['chips'] or bet < MIN_BET:
            await q.edit_message_text("❌ Invalid bet!", reply_markup=bet_kb())
            return
        deck = new_deck()
        player = [deck.pop(), deck.pop()]
        dealer = [deck.pop(), deck.pop()]
        games[uid] = {'deck':deck,'player':player,'dealer':dealer,'bet':bet}
        u['chips'] -= bet
        if is_bj(player):
            win = int(bet*2.5)
            u['chips'] += win; u['wins'] += 1; u['played'] += 1
            del games[uid]
            await q.edit_message_text(
                f"🃏 *BLACKJACK!* 🎉\n\nYour hand: {hand_str(player)} = {hand_value(player)}\n"
                f"Won: +{win-bet} chips\n💰 Balance: {u['chips']}",
                parse_mode='Markdown', reply_markup=again_kb())
            return
        await q.edit_message_text(
            f"🃏 Bet: {bet} chips\n\nYour hand: {hand_str(player)} = *{hand_value(player)}*\n"
            f"Dealer shows: {card_str(dealer[0])} 🂠\n\n💰 Remaining: {u['chips']}",
            parse_mode='Markdown', reply_markup=game_kb())
        return

    if uid not in games:
        await q.edit_message_text("No active game! Use /play")
        return

    g = games[uid]
    player, dealer, deck, bet = g['player'], g['dealer'], g['deck'], g['bet']

    if d == 'hit':
        player.append(deck.pop())
        pv = hand_value(player)
        if pv > 21:
            u['played'] += 1; del games[uid]
            await q.edit_message_text(
                f"💥 *BUST!*\n\nYour hand: {hand_str(player)} = {pv}\n"
                f"Lost: -{bet} chips\n💰 Balance: {u['chips']}",
                parse_mode='Markdown', reply_markup=again_kb())
        else:
            await q.edit_message_text(
                f"🃏 Bet: {bet} chips\n\nYour hand: {hand_str(player)} = *{pv}*\n"
                f"Dealer shows: {card_str(dealer[0])} 🂠\n\n💰 Remaining: {u['chips']}",
                parse_mode='Markdown', reply_markup=game_kb())

    elif d in ('stand', 'double'):
        if d == 'double':
            if u['chips'] < bet:
                await q.answer("Not enough chips!", show_alert=True); return
            u['chips'] -= bet; g['bet'] = bet*2; bet = g['bet']
            player.append(deck.pop())
            if hand_value(player) > 21:
                u['played'] += 1; del games[uid]
                await q.edit_message_text(
                    f"💥 *BUST on double!*\n\nLost: -{bet} chips\n💰 Balance: {u['chips']}",
                    parse_mode='Markdown', reply_markup=again_kb())
                return
        while hand_value(dealer) < 17:
            dealer.append(deck.pop())
        pv, dv = hand_value(player), hand_value(dealer)
        u['played'] += 1
        if dv > 21 or pv > dv:
            u['chips'] += bet*2; u['wins'] += 1
            msg = (f"✅ *YOU WIN!* 🎉\n\nYour: {hand_str(player)} = {pv}\n"
                   f"Dealer: {hand_str(dealer)} = {'BUST' if dv>21 else dv}\n\n"
                   f"Won: +{bet} chips\n💰 Balance: {u['chips']}")
        elif pv == dv:
            u['chips'] += bet
            msg = (f"🤝 *PUSH!*\n\nYour: {hand_str(player)} = {pv}\n"
                   f"Dealer: {hand_str(dealer)} = {dv}\n\nBet returned\n💰 Balance: {u['chips']}")
        else:
            msg = (f"❌ *DEALER WINS*\n\nYour: {hand_str(player)} = {pv}\n"
                   f"Dealer: {hand_str(dealer)} = {dv}\n\n"
                   f"Lost: -{bet} chips\n💰 Balance: {u['chips']}")
        del games[uid]
        await q.edit_message_text(msg, parse_mode='Markdown', reply_markup=again_kb())

async def precheckout(update, ctx):
    await update.pre_checkout_query.answer(ok=True)

async def paid(update, ctx):
    uid = update.effective_user.id
    name = update.effective_user.first_name or "Player"
    u = get_user(uid)
    chips = int(update.message.successful_payment.invoice_payload.split('_')[1])
    stars = update.message.successful_payment.total_amount
    u['chips'] += chips
    import httpx
    async with httpx.AsyncClient() as client:
        await client.post("https://blackjack-api-e31a.onrender.com/chips/add",
            json={"user_id": uid, "amount": chips, "name": name})
    await update.message.reply_text(
        f"⭐ {stars} Stars received! +{chips} chips added.\n\n💰 Balance: {u['chips']} chips",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🎮 Play Blackjack", web_app={"url": "https://frontend-iota-two-17.vercel.app"})
        ]]))

async def main():
    app = (Application.builder()
           .token(BOT_TOKEN)
           .connect_timeout(30)
           .read_timeout(30)
           .write_timeout(30)
           .build())
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("play", play))
    app.add_handler(CallbackQueryHandler(button))
    app.add_handler(PreCheckoutQueryHandler(precheckout))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, paid))

    async with app:
        await app.start()
        print("🃏 BlackJack Bot is running! Message your bot on Telegram.")
        await app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
        await asyncio.sleep(float('inf'))

asyncio.run(main())
