import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./App.css";

const API = "https://blackjack-api-e31a.onrender.com";
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (["J", "Q", "K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return parseInt(card.value);
}

function handTotal(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function Card({ card, hidden }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      initial={{ y: -60, opacity: 0, rotateY: 90 }}
      animate={{ y: 0, opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        width: 70, height: 100, borderRadius: 8,
        background: hidden ? "#1a3a5c" : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: "bold",
        color: hidden ? "white" : isRed ? "#cc0000" : "#111",
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        margin: "0 4px", userSelect: "none"
      }}
    >
      {hidden ? "🂠" : `${card.value}${card.suit}`}
    </motion.div>
  );
}

export default function App() {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id || tg?.initDataUnsafe?.user?.id || 1283355111;
  const userName = tg?.initDataUnsafe?.user?.first_name || "Player";

  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [chips, setChips] = useState(0);
  const [bet, setBet] = useState(0);
  const [phase, setPhase] = useState("betting");
  const [message, setMessage] = useState("Loading...");
  const [showBuy, setShowBuy] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (tg) tg.ready();
    loadChips();
  }, []);

  function loadChips() {
    fetch(`${API}/chips/${userId}?name=${userName}`)
      .then(r => r.json())
      .then(data => { setChips(data.chips); setMessage("Place your bet!"); })
      .catch(() => { setChips(1000); setMessage("Place your bet!"); });
  }

  async function buyChips(stars) {
    setBuying(true);
    try {
      const res = await fetch(`${API}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, stars })
      });
      const data = await res.json();
      if (data.invoice_link && tg) {
        tg.openInvoice(data.invoice_link, (status) => {
          if (status === "paid") {
            setTimeout(() => { loadChips(); setShowBuy(false); }, 4000);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
    setBuying(false);
  }

  async function updateChips(amount, won) {
    const endpoint = won ? "/chips/add" : "/chips/deduct";
    const res = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, amount: Math.abs(amount), name: userName })
    });
    const data = await res.json();
    if (data.chips !== undefined) setChips(data.chips);
  }

  function startGame() {
    if (bet === 0) return setMessage("Place a bet first!");
    if (chips < bet) return setMessage("Not enough chips!");
    const newDeck = createDeck();
    const p = [newDeck.pop(), newDeck.pop()];
    const d = [newDeck.pop(), newDeck.pop()];
    setDeck(newDeck); setPlayerHand(p); setDealerHand(d);
    setPhase("playing"); setMessage("Hit or Stand?");
  }

  function hit() {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck); setPlayerHand(newHand);
    if (handTotal(newHand) > 21) {
      setPhase("done"); setMessage("Bust! You lose 💸");
      updateChips(bet, false);
    }
  }

  function stand() {
    let newDeck = [...deck];
    let dHand = [...dealerHand];
    while (handTotal(dHand) < 17) dHand.push(newDeck.pop());
    setDealerHand(dHand); setDeck(newDeck); setPhase("done");
    const p = handTotal(playerHand);
    const d = handTotal(dHand);
    if (d > 21 || p > d) { setMessage("You win! 🎉"); updateChips(bet, true); }
    else if (p === d) { setMessage("Push! Tie 🤝"); }
    else { setMessage("Dealer wins 😔"); updateChips(bet, false); }
  }

  function reset() {
    setPlayerHand([]); setDealerHand([]);
    setBet(0); setPhase("betting"); setMessage("Place your bet!");
  }

  function placeBet(amount) {
    if (chips >= bet + amount) setBet(b => b + amount);
  }

  if (showBuy) return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0a1628 0%, #1a2f4e 50%, #0d2137 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily: "Georgia, serif", color: "white", padding: 20
    }}>
      <h2 style={{ color: "#ffd700", marginBottom: 8 }}>⭐ Buy Chips</h2>
      <p style={{ color: "#aaa", marginBottom: 24 }}>Your chips: {chips}</p>
      {[[10, 100], [50, 500], [100, 1000]].map(([stars, chipsAmt]) => (
        <button key={stars} onClick={() => buyChips(stars)} disabled={buying}
          style={{...btnStyle("#b8860b"), marginBottom: 12, width: 240, opacity: buying ? 0.6 : 1}}>
          ⭐ {stars} Stars → {chipsAmt} chips
        </button>
      ))}
      <button onClick={() => setShowBuy(false)} style={{...btnStyle("#555"), marginTop: 8}}>← Back</button>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0a1628 0%, #1a2f4e 50%, #0d2137 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily: "Georgia, serif", color: "white", padding: 20
    }}>
      <h1 style={{ fontSize: 26, color: "#ffd700", marginBottom: 4, textShadow: "0 0 20px rgba(255,215,0,0.5)" }}>
        ♠ Blackjack Tournament ♠
      </h1>
      <div style={{ fontSize: 16, color: "#ffd700", marginBottom: 4 }}>
        Chips: {chips} | Bet: {bet}
      </div>
      <button onClick={() => setShowBuy(true)} style={{...btnStyle("#b8860b"), fontSize: 13, padding: "6px 16px", marginBottom: 16}}>
        ⭐ Buy Chips
      </button>
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ color: "#aaa", marginBottom: 6 }}>Dealer {phase === "done" ? `(${handTotal(dealerHand)})` : ""}</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {dealerHand.map((card, i) => <Card key={i} card={card} hidden={phase === "playing" && i === 1} />)}
        </div>
      </div>
      <motion.div key={message} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontSize: 20, fontWeight: "bold", color: "#ffd700", margin: "12px 0", textAlign: "center" }}>
        {message}
      </motion.div>
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ color: "#aaa", marginBottom: 6 }}>You {playerHand.length > 0 ? `(${handTotal(playerHand)})` : ""}</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {playerHand.map((card, i) => <Card key={i} card={card} hidden={false} />)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {phase === "betting" && (
          <>
            {[10, 50, 100, 500].map(amount => (
              <button key={amount} onClick={() => placeBet(amount)} style={btnStyle("#1a5c2a")}>+{amount}</button>
            ))}
            <button onClick={startGame} style={btnStyle("#8B0000")}>Deal 🃏</button>
            {bet > 0 && <button onClick={() => setBet(0)} style={btnStyle("#555")}>Clear</button>}
          </>
        )}
        {phase === "playing" && (
          <>
            <button onClick={hit} style={btnStyle("#1a5c2a")}>Hit 👆</button>
            <button onClick={stand} style={btnStyle("#8B0000")}>Stand ✋</button>
          </>
        )}
        {phase === "done" && <button onClick={reset} style={btnStyle("#1a3a8B")}>New Hand 🔄</button>}
      </div>
    </div>
  );
}

function btnStyle(bg) {
  return {
    background: bg, color: "white", border: "2px solid rgba(255,215,0,0.3)",
    padding: "12px 24px", borderRadius: 8, fontSize: 16, cursor: "pointer",
    fontFamily: "Georgia, serif", fontWeight: "bold",
    boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
  };
}
