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

function isBlackjack(hand) { return hand.length === 2 && handTotal(hand) === 21; }
function isPair(hand) { return hand.length === 2 && hand[0].value === hand[1].value; }

function Card({ card, hidden }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      initial={{ y: -40, opacity: 0, rotateY: 90 }}
      animate={{ y: 0, opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        width: 70, height: 98, borderRadius: 12,
        background: hidden ? "linear-gradient(135deg, #1e1b4b, #3730a3)" : "white",
        display: "grid", gridTemplateRows: "1fr 1.5fr 1fr", padding: 7,
        boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
      }}
    >
      {hidden ? (
        <div style={{ gridColumn: 1, gridRow: "1/4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, color: "rgba(255,255,255,0.15)", fontWeight: 900 }}>?</div>
      ) : (
        <>
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: isRed ? "#e63946" : "#111" }}>{card.value}</div>
          <div style={{ fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", color: isRed ? "#e63946" : "#111" }}>{card.suit}</div>
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, textAlign: "right", transform: "rotate(180deg)", color: isRed ? "#e63946" : "#111" }}>{card.value}</div>
        </>
      )}
    </motion.div>
  );
}

export default function App() {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id || 1283355111;
  const userName = tg?.initDataUnsafe?.user?.first_name || "Player";

  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [splitHand, setSplitHand] = useState(null);
  const [dealerHand, setDealerHand] = useState([]);
  const [chips, setChips] = useState(0);
  const [bet, setBet] = useState(0);
  const [splitBet, setSplitBet] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const [phase, setPhase] = useState("betting");
  const [activeHand, setActiveHand] = useState("main");
  const [message, setMessage] = useState("Loading...");
  const [showBuy, setShowBuy] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [buying, setBuying] = useState(false);
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    if (tg) tg.ready();
    loadChips();
    loadLeaderboard();
  }, []);

  function loadChips() {
    fetch(`${API}/chips/${userId}?name=${userName}`)
      .then(r => r.json())
      .then(data => { setChips(data.chips); setMessage("Place your bet!"); })
      .catch(() => { setChips(1000); setMessage("Place your bet!"); });
  }

  function loadLeaderboard() {
    fetch(`${API}/leaderboard`)
      .then(r => r.json())
      .then(data => setLeaders(data.leaderboard || []))
      .catch(() => {});
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
          if (status === "paid") setTimeout(() => { loadChips(); setShowBuy(false); }, 4000);
        });
      }
    } catch (e) { console.error(e); }
    setBuying(false);
  }

  async function updateChips(amount, won) {
    const res = await fetch(`${API}${won ? "/chips/add" : "/chips/deduct"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, amount: Math.abs(amount), name: userName })
    });
    const data = await res.json();
    if (data.chips !== undefined) { setChips(data.chips); loadLeaderboard(); }
  }

  function startGame() {
    if (bet === 0) return setMessage("Place a bet first!");
    if (chips < bet) return setMessage("Not enough chips!");
    setLastBet(bet);
    const newDeck = createDeck();
    const p = [newDeck.pop(), newDeck.pop()];
    const d = [newDeck.pop(), newDeck.pop()];
    setDeck(newDeck); setPlayerHand(p); setDealerHand(d);
    setSplitHand(null); setSplitBet(0); setActiveHand("main");
    if (isBlackjack(p) && !isBlackjack(d)) {
      const win = Math.floor(bet * 1.5);
      setPhase("done"); setMessage(`🃏 BLACKJACK! +${win} chips!`);
      updateChips(win, true);
    } else if (isBlackjack(p) && isBlackjack(d)) {
      setPhase("done"); setMessage("Both Blackjack! Push 🤝");
    } else {
      setPhase("playing"); setMessage("Hit or Stand?");
    }
  }

  function hit() {
    const newDeck = [...deck];
    if (activeHand === "main") {
      const newHand = [...playerHand, newDeck.pop()];
      setDeck(newDeck); setPlayerHand(newHand);
      if (handTotal(newHand) > 21) {
        if (splitHand) { setActiveHand("split"); setMessage("Split hand!"); }
        else { setPhase("done"); setMessage("Bust! 💸"); updateChips(bet, false); }
      }
    } else {
      const newSplit = [...splitHand, newDeck.pop()];
      setDeck(newDeck); setSplitHand(newSplit);
      if (handTotal(newSplit) > 21) finishDealer(newDeck, playerHand, newSplit);
    }
  }

  function stand() {
    if (activeHand === "main" && splitHand) { setActiveHand("split"); setMessage("Split hand!"); return; }
    finishDealer([...deck], playerHand, splitHand);
  }

  function finishDealer(currentDeck, pHand, sHand) {
    let dHand = [...dealerHand];
    while (handTotal(dHand) < 17) dHand.push(currentDeck.pop());
    setDealerHand(dHand); setDeck(currentDeck); setPhase("done");
    const dv = handTotal(dHand);
    const pv = handTotal(pHand);
    let msg = "";
    if (pv > 21) { msg += "Bust 💸 "; updateChips(bet, false); }
    else if (dv > 21 || pv > dv) { msg += "You Win! 🎉 "; updateChips(bet, true); }
    else if (pv === dv) { msg += "Push 🤝 "; }
    else { msg += "Dealer Wins 😔 "; updateChips(bet, false); }
    if (sHand) {
      const sv = handTotal(sHand);
      if (sv > 21) { msg += "| Split: Bust"; updateChips(splitBet, false); }
      else if (dv > 21 || sv > dv) { msg += "| Split: Win! 🎉"; updateChips(splitBet, true); }
      else if (sv === dv) { msg += "| Split: Push"; }
      else { msg += "| Split: Lose"; updateChips(splitBet, false); }
    }
    setMessage(msg);
  }

  function doubleDown() {
    if (chips < bet) return;
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    const newBet = bet * 2;
    setDeck(newDeck); setPlayerHand(newHand); setBet(newBet);
    if (handTotal(newHand) > 21) { setPhase("done"); setMessage("Bust on Double! 💸"); updateChips(newBet, false); }
    else finishDealer(newDeck, newHand, splitHand);
  }

  function split() {
    if (chips < bet || !isPair(playerHand)) return;
    const newDeck = [...deck];
    const hand1 = [playerHand[0], newDeck.pop()];
    const hand2 = [playerHand[1], newDeck.pop()];
    setDeck(newDeck); setPlayerHand(hand1); setSplitHand(hand2);
    setSplitBet(bet); setActiveHand("main"); setMessage("Main hand first!");
    updateChips(bet, false);
  }

  function adjustBet(type) {
    if (type === "half") setBet(b => Math.max(10, Math.floor(b / 2)));
    if (type === "double") setBet(b => Math.min(chips, b * 2));
    if (type === "max") setBet(chips);
  }

  function reset() {
    setPlayerHand([]); setDealerHand([]);
    setSplitHand(null); setSplitBet(0);
    setBet(lastBet); setPhase("betting"); setActiveHand("main");
    setMessage("Place your bet!");
  }

  const s = {
    app: { minHeight: "100vh", background: "#0d1117", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" },
    topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" },
    balancePill: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "7px 14px", color: "white", fontSize: 14, fontWeight: "bold" },
    title: { color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 3 },
    buyPill: { background: "linear-gradient(135deg, #7c3aed, #a855f7)", borderRadius: 20, padding: "7px 16px", color: "white", fontSize: 13, fontWeight: "bold", border: "none", cursor: "pointer" },
    lbBtn: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "7px 12px", color: "white", fontSize: 16, cursor: "pointer" },
    tableZone: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", gap: 16 },
    handArea: { width: "100%", display: "flex", flexDirection: "column", alignItems: "center" },
    handLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 },
    scoreBadge: { display: "inline-block", background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, padding: "2px 10px", color: "#c084fc", fontSize: 13, fontWeight: "bold", marginLeft: 8 },
    cardsRow: { display: "flex", gap: 10, justifyContent: "center" },
    bottomPanel: { background: "#161b27", borderRadius: "24px 24px 0 0", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 10 },
    actionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    actBtn: { padding: 18, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1e2537", color: "white", fontSize: 16, fontWeight: "bold", cursor: "pointer" },
    dealBtn: { width: "100%", padding: 16, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #d97706, #fbbf24)", color: "#1a0a00", fontSize: 18, fontWeight: 900, cursor: "pointer" },
    betRow: { display: "flex", alignItems: "center", background: "#1e2537", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" },
    betAmount: { flex: 1, padding: "12px 16px", color: "white", fontSize: 18, fontWeight: "bold" },
    betCtrlBtn: { padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: "bold", cursor: "pointer" },
    msg: { color: "#a855f7", fontSize: 20, fontWeight: 900, textAlign: "center" },
    top3Row: { display: "flex", gap: 6, width: "100%", justifyContent: "center" },
    top3Card: { flex: 1, background: "#161b27", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "8px 6px", textAlign: "center" },
  };

  // Full leaderboard screen
  if (showLeaderboard) return (
    <div style={s.app}>
      <div style={s.topbar}>
        <button onClick={() => setShowLeaderboard(false)} style={{...s.actBtn, padding: "8px 16px", fontSize: 13}}>← Back</button>
        <div style={{color: "white", fontWeight: 900, fontSize: 16}}>🏆 Leaderboard</div>
        <div style={{width: 70}} />
      </div>
      <div style={{ padding: "0 16px", flex: 1, overflowY: "auto" }}>
        {leaders.map((p, i) => (
          <div key={p.user_id} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: String(p.user_id) === String(userId) ? "rgba(168,85,247,0.15)" : "#161b27",
            border: String(p.user_id) === String(userId) ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "14px 16px", marginBottom: 10
          }}>
            <div style={{ fontSize: 22, width: 32, textAlign: "center" }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{color: "rgba(255,255,255,0.3)", fontSize: 14}}>#{i+1}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>{p.name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{p.wins} wins · {p.played} played</div>
            </div>
            <div style={{ color: "#ffd700", fontWeight: 900, fontSize: 16 }}>🪙 {p.chips}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Buy chips screen
  if (showBuy) return (
    <div style={{...s.app, alignItems: "center", justifyContent: "center"}}>
      <h2 style={{ color: "#ffd700", marginBottom: 8 }}>⭐ Buy Chips</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Balance: {chips} chips</p>
      {[[10, 100], [50, 500], [100, 1000]].map(([stars, chipsAmt]) => (
        <button key={stars} onClick={() => buyChips(stars)} disabled={buying}
          style={{ ...s.dealBtn, width: 240, marginBottom: 12, opacity: buying ? 0.6 : 1 }}>
          ⭐ {stars} Stars → {chipsAmt} chips
        </button>
      ))}
      <button onClick={() => setShowBuy(false)} style={{ ...s.actBtn, width: 240, marginTop: 8, textAlign: "center" }}>← Back</button>
    </div>
  );

  // Main game screen
  return (
    <div style={s.app}>
      <div style={s.topbar}>
        <div style={s.balancePill}>🪙 {chips}</div>
        <button style={s.lbBtn} onClick={() => { loadLeaderboard(); setShowLeaderboard(true); }}>🏆 Leaderboard</button>
        <button style={s.buyPill} onClick={() => setShowBuy(true)}>+ Buy</button>
      </div>

      {/* Top 3 mini leaderboard */}
      {leaders.length > 0 && phase === "betting" && (
        <div style={{ padding: "0 16px 8px" }}>
          <div style={s.top3Row}>
            {leaders.slice(0, 3).map((p, i) => (
              <div key={p.user_id} style={{...s.top3Card, borderColor: i === 0 ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.06)"}}>
                <div style={{ fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                <div style={{ color: "white", fontSize: 11, fontWeight: "bold", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ color: "#ffd700", fontSize: 12, fontWeight: "bold" }}>🪙 {p.chips}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.tableZone}>
        {dealerHand.length > 0 && (
          <div style={s.handArea}>
            <div style={s.handLabel}>Dealer <span style={s.scoreBadge}>{phase === "done" ? handTotal(dealerHand) : "?"}</span></div>
            <div style={s.cardsRow}>
              {dealerHand.map((card, i) => <Card key={i} card={card} hidden={phase === "playing" && i === 1} />)}
            </div>
          </div>
        )}

        <motion.div key={message} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={s.msg}>
          {message}
        </motion.div>

        {playerHand.length > 0 && (
          <div style={s.handArea}>
            <div style={s.handLabel}>
              {splitHand ? (activeHand === "main" ? "👉 Main" : "Main") : "You"}
              <span style={s.scoreBadge}>{handTotal(playerHand)}</span>
            </div>
            <div style={s.cardsRow}>
              {playerHand.map((card, i) => <Card key={i} card={card} hidden={false} />)}
            </div>
          </div>
        )}

        {splitHand && (
          <div style={s.handArea}>
            <div style={s.handLabel}>
              {activeHand === "split" ? "👉 Split" : "Split"}
              <span style={s.scoreBadge}>{handTotal(splitHand)}</span>
            </div>
            <div style={s.cardsRow}>
              {splitHand.map((card, i) => <Card key={i} card={card} hidden={false} />)}
            </div>
          </div>
        )}
      </div>

      <div style={s.bottomPanel}>
        {phase === "playing" && (
          <div style={s.actionGrid}>
            <button style={s.actBtn} onClick={hit}>👆 Hit</button>
            <button style={s.actBtn} onClick={stand}>✋ Stand</button>
            {playerHand.length === 2 && !splitHand && chips >= bet && (
              <button style={s.actBtn} onClick={doubleDown}>💰 Double</button>
            )}
            {isPair(playerHand) && !splitHand && chips >= bet && (
              <button style={s.actBtn} onClick={split}>✂️ Split</button>
            )}
          </div>
        )}

        {phase === "done" && (
          <button style={s.dealBtn} onClick={reset}>🔄 New Hand</button>
        )}

        {phase === "betting" && (
          <>
            <button style={s.dealBtn} onClick={startGame}>🃏 Start Game</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>🎯 Main Bet</div>
              <div style={s.betRow}>
                <div style={s.betAmount}>⭐ {bet}</div>
                <div style={{ display: "flex" }}>
                  <button style={s.betCtrlBtn} onClick={() => adjustBet("half")}>½</button>
                  <button style={s.betCtrlBtn} onClick={() => adjustBet("double")}>2×</button>
                  <button style={s.betCtrlBtn} onClick={() => adjustBet("max")}>Max</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[10, 50, 100, 500].map(amount => (
                  <button key={amount} onClick={() => setBet(b => Math.min(chips, b + amount))}
                    style={{ flex: 1, padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#1e2537", color: "white", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
