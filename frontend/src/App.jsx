import { useState, useEffect } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { motion, AnimatePresence } from "framer-motion";

const API = "https://blackjack-api-e31a.onrender.com";

export default function App() {
  const [competitions, setCompetitions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [buying, setBuying] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [draws, setDraws] = useState([]);
  const [tab, setTab] = useState("competitions");
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id || "test123";
  const userName = tg?.initDataUnsafe?.user?.first_name || "Player";

  useEffect(() => {
    if (tg) tg.ready();
    loadCompetitions();
    loadDraws();
    const interval = setInterval(loadCompetitions, 10000);
    return () => clearInterval(interval);
  }, []);

  function loadCompetitions() {
    fetch(`${API}/competitions`)
      .then(r => r.json())
      .then(d => setCompetitions(d.competitions || []))
      .catch(() => {});
  }

  function loadDraws() {
    fetch(`${API}/draws`)
      .then(r => r.json())
      .then(d => setDraws(d.draws || []))
      .catch(() => {});
  }

  async function selectComp(comp) {
    setSelected(comp);
    setTab("detail");
    const res = await fetch(`${API}/competitions/${comp.id}`);
    const data = await res.json();
    setTickets(data.tickets || []);
  }

  async function buyTicket() {
    if (!wallet) return setMessage("Connect your TON wallet first!");
    setBuying(true);
    setMessage("Waiting for payment...");
    try {
      const priceInNano = String(Math.floor(selected.ticket_price_ton * quantity * 1000000000));
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: "UQAJN57OwMZ7zThD8E28dPML0lqwsEX8bzEG7vI2QUTd6PBc",
          amount: priceInNano,
          payload: undefined
        }]
      };
      const result = await tonConnectUI.sendTransaction(tx);
      setMessage("Payment sent! Recording ticket...");
      const res = await fetch(`${API}/tickets/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: selected.id,
          user_telegram_id: String(userId),
          user_name: userName,
          ton_address: wallet.account.address,
          tx_hash: result.boc
        })
      });
      const data = await res.json();
      if (data.ticket_number) {
        setMessage(`🎟️ You got ticket #${data.ticket_number}! ${data.remaining} remaining!`);
        loadCompetitions();
        selectComp(selected);
      } else {
        setMessage(data.detail || "Error buying ticket");
      }
    } catch(e) {
      setMessage("Error: " + (e?.message || String(e)));
    }
    setBuying(false);
  }

  const s = {
    app: { minHeight: "100vh", background: "#0a0e1a", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" },
    topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
    logo: { color: "white", fontSize: 18, fontWeight: 900 },
    logoSpan: { color: "#ffd700" },
    content: { flex: 1, padding: "16px" },
    compCard: { background: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" },
    prize: { color: "#ffd700", fontSize: 24, fontWeight: 900, marginBottom: 4 },
    compName: { color: "white", fontSize: 14, marginBottom: 12 },
    progressBar: { background: "rgba(255,255,255,0.1)", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 8 },
    progressFill: (pct) => ({ height: "100%", background: pct > 80 ? "#ff6b6b" : pct > 50 ? "#ffd700" : "#4ade80", width: `${pct}%`, borderRadius: 8, transition: "width 0.5s" }),
    tickets: { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)", fontSize: 12 },
    buyBtn: { width: "100%", padding: 16, borderRadius: 12, border: "none", background: "#ffd700", color: "#1a0a00", fontSize: 16, fontWeight: 900, cursor: "pointer", marginTop: 16 },
    backBtn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 13, cursor: "pointer" },
    msg: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, padding: "10px 14px", color: "#c084fc", fontSize: 13, marginTop: 12, textAlign: "center" },
    ticketGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 12 },
    ticketNum: (mine) => ({ background: mine ? "#ffd700" : "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 4px", textAlign: "center", color: mine ? "#1a0a00" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: mine ? 900 : 400 }),
    bottomNav: { display: "flex", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 0 4px" },
    navItem: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: active ? 1 : 0.4 }),
    navLabel: (active) => ({ color: active ? "#ffd700" : "rgba(255,255,255,0.5)", fontSize: 10 }),
    drawCard: { background: "#111827", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid rgba(255,255,255,0.07)" },
  };

  return (
    <div style={s.app}>
      <div style={s.topbar}>
        <div style={s.logo}>Ton<span style={s.logoSpan}>Competitions</span></div>
        <TonConnectButton />
      </div>

      <div style={s.content}>
        {tab === "competitions" && (
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 16, letterSpacing: 1 }}>ACTIVE COMPETITIONS</div>
            {competitions.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 40 }}>Loading competitions...</div>
            )}
            {competitions.map(comp => {
              const pct = Math.round((comp.tickets_sold / comp.max_tickets) * 100);
              return (
                <motion.div key={comp.id} style={s.compCard} onClick={() => selectComp(comp)}
                  whileTap={{ scale: 0.98 }}>
                  <div style={s.prize}>🏆 {comp.prize_description}</div>
                  <div style={s.compName}>{comp.name}</div>
                  <div style={s.progressBar}>
                    <div style={s.progressFill(pct)} />
                  </div>
                  <div style={s.tickets}>
                    <span>{comp.tickets_sold} / {comp.max_tickets} tickets sold</span>
                    <span style={{ color: pct > 80 ? "#ff6b6b" : "#4ade80" }}>{pct}% full</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 6 }}>
                    🎫 {comp.ticket_price_ton} TON per ticket
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {tab === "detail" && selected && (
          <div>
            <button style={s.backBtn} onClick={() => setTab("competitions")}>← Back</button>
            <div style={{ marginTop: 16 }}>
              <div style={s.prize}>🏆 {selected.prize_description}</div>
              <div style={{ color: "white", fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 16 }}>{selected.description}</div>

              {(() => {
                const pct = Math.round((selected.tickets_sold / selected.max_tickets) * 100);
                return (
                  <>
                    <div style={s.progressBar}>
                      <div style={s.progressFill(pct)} />
                    </div>
                    <div style={s.tickets}>
                      <span style={{ color: "white" }}>{selected.tickets_sold} / {selected.max_tickets} tickets</span>
                      <span style={{ color: pct > 80 ? "#ff6b6b" : "#4ade80", fontWeight: 900 }}>{100 - pct}% remaining</span>
                    </div>
                  </>
                );
              })()}

              <div style={{ background: "#111827", borderRadius: 12, padding: 14, marginTop: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8 }}>HOW IT WORKS</div>
                {selected.ticket_price_ton === 0 ? (
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.8 }}>
                    🎁 Completely FREE to enter<br/>
                    🔗 Share your unique referral link<br/>
                    👥 Every friend who joins = 1 free ticket<br/>
                    🏆 More referrals = more chances to win<br/>
                    🎰 Winner picked by the TonCompetitions team
                  </div>
                ) : (
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.8 }}>
                    🎫 Each ticket costs {selected.ticket_price_ton} TON<br/>
                    🎰 When all {selected.max_tickets} tickets sell, draw happens instantly<br/>
                    🔢 Winner picked using blockchain randomness<br/>
                    🏆 Prize sent directly to winner's TON wallet<br/>
                    🔍 Fully verifiable on tonviewer.com
                  </div>
                )}
              </div>

              {selected.ticket_price_ton === 0 ? (
                <button style={{...s.buyBtn, marginTop: 16, background: "linear-gradient(135deg, #7c3aed, #a855f7)"}}
                  onClick={() => {
                    const refLink = `https://t.me/TonCompetitions_bot?start=ref_${userId}`;
                    const text = "🎁 FREE 100 TON Giveaway! Join TonCompetitions and we both get free tickets to win 100 TON! No purchase needed 👇";
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`, "_blank");
                  }}>
                  🔗 Share & Get Free Tickets
                </button>
              ) : !wallet ? (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 10 }}>Connect your TON wallet to buy tickets</div>
                  <TonConnectButton />
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16, marginBottom: 16 }}>
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      style={{ width: 50, height: 50, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#1e2537", color: "white", fontSize: 24, cursor: "pointer", fontWeight: 900 }}>−</button>
                    <div style={{ width: 80, textAlign: "center", color: "white", fontSize: 24, fontWeight: 900 }}>{quantity}</div>
                    <button onClick={() => setQuantity(q => Math.min(50, q + 1))}
                      style={{ width: 50, height: 50, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#1e2537", color: "white", fontSize: 24, cursor: "pointer", fontWeight: 900 }}>+</button>
                  </div>
                  <button style={s.buyBtn} onClick={buyTicket} disabled={buying}>
                    {buying ? "Processing..." : "🎟️ Buy " + quantity + (quantity > 1 ? " Tickets" : " Ticket") + " — " + (selected.ticket_price_ton * quantity).toFixed(2) + " TON"}
                  </button>
                </div>
              )}

              {message && <div style={s.msg}>{message}</div>}

              {tickets.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8 }}>ALL TICKETS</div>
                  <div style={s.ticketGrid}>
                    {tickets.map(t => (
                      <div key={t.id} style={s.ticketNum(t.user_telegram_id === String(userId))}>
                        #{t.ticket_number}
                        <div style={{ fontSize: 9, marginTop: 2 }}>{t.user_name?.slice(0,6)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "winners" && (
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 16, letterSpacing: 1 }}>PAST WINNERS</div>
            {draws.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 40 }}>No draws yet — be the first winner!</div>
            )}
            {draws.map(d => (
              <div key={d.id} style={s.drawCard}>
                <div style={{ color: "#ffd700", fontSize: 16, fontWeight: 900 }}>🏆 {d.winner_name}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>Ticket #{d.winning_ticket}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 4, fontFamily: "monospace" }}>
                  Hash: {d.block_hash?.slice(0, 20)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={s.bottomNav}>
        {[["competitions","🎟️","Competitions"],["winners","🏆","Winners"]].map(([t,icon,label]) => (
          <div key={t} style={s.navItem(tab===t)} onClick={() => setTab(t)}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={s.navLabel(tab===t)}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
