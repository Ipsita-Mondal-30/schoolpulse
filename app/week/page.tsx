"use client";

import { useState, useMemo } from "react";

interface Pair {
  word: string;
  emoji: string;
  meaning: string;
  id: string;
}

const PAIRS: Pair[] = [
  { word: "Benevolent", emoji: "🤗", meaning: "Kind", id: "kind" },
  { word: "Elated", emoji: "🎉", meaning: "Excited", id: "excited" },
  { word: "Implement", emoji: "🛠️", meaning: "To Apply", id: "apply" },
  { word: "Astonished", emoji: "😲", meaning: "Surprised", id: "surprise" },
];

const CARDS = [
  {
    id: "kind",
    emoji: "🤗",
    word: "Benevolent",
    meaning: "Kind",
    sentence: "The benevolent king gave food to everyone.",
    semoji: "👑❤️",
    frontClass: "front-kind",
    meanClass: "mean-kind",
  },
  {
    id: "excited",
    emoji: "🎉",
    word: "Elated",
    meaning: "Excited",
    sentence: "I felt elated on my birthday!",
    semoji: "🥳🎈",
    frontClass: "front-excited",
    meanClass: "mean-excited",
  },
  {
    id: "apply",
    emoji: "🛠️",
    word: "Implement",
    meaning: "To Apply",
    sentence: "We implement the plan by doing it!",
    semoji: "✅🚀",
    frontClass: "front-apply",
    meanClass: "mean-apply",
  },
  {
    id: "surprise",
    emoji: "😲",
    word: "Astonished",
    meaning: "Surprised",
    sentence: "He was astonished by the magic trick!",
    semoji: "🎩✨",
    frontClass: "front-surprise",
    meanClass: "mean-surprise",
  },
];

function shuffle<T>(a: T[]): T[] {
  return a
    .map((v) => [Math.random(), v] as [number, T])
    .sort((x, y) => x[0] - y[0])
    .map((v) => v[1]);
}

export default function WordAdventurePage() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  // Matching game state
  const [gameKey, setGameKey] = useState(0);
  const [selWord, setSelWord] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null);

  const wordOrder = useMemo(() => shuffle(PAIRS), [gameKey]);
  const meanOrder = useMemo(() => shuffle(PAIRS), [gameKey]);

  const score = Object.keys(done).length;

  const toggleFlip = (id: string) =>
    setFlipped((f) => ({ ...f, [id]: !f[id] }));

  const pickWord = (id: string) => {
    if (done[id]) return;
    setSelWord(id);
  };

  const pickMean = (id: string) => {
    if (!selWord || done[id]) return;
    if (selWord === id) {
      setDone((d) => ({ ...d, [id]: true }));
      setSelWord(null);
    } else {
      setWrong(id);
      setTimeout(() => setWrong(null), 400);
    }
  };

  const resetGame = () => {
    setSelWord(null);
    setDone({});
    setWrong(null);
    setGameKey((k) => k + 1);
  };

  return (
    <div className="wa-root">
      <style>{css}</style>

      <div className="cloud c1" />
      <div className="cloud c2" />

      <header className="wa-header">
        <h1>
          <span className="star">⭐</span> Word Adventure{" "}
          <span className="star">⭐</span>
        </h1>
        <p>Learn 4 magic words with pictures &amp; games!</p>
      </header>

      <h2 className="section-title">🃏 Flip the Cards</h2>
      <p className="hint">Tap a card to see what the word means!</p>

      <div className="cards">
        {CARDS.map((c) => (
          <div
            key={c.id}
            className={`card ${flipped[c.id] ? "flip" : ""}`}
            onClick={() => toggleFlip(c.id)}
          >
            <div className="inner">
              <div className={`face front ${c.frontClass}`}>
                <div className="emoji">{c.emoji}</div>
                <div className="word">{c.word}</div>
                <div className="tap">tap me!</div>
              </div>
              <div className="face back">
                <div className="means">means</div>
                <div className={`meaning ${c.meanClass}`}>{c.meaning}</div>
                <div className="sentence">{c.sentence}</div>
                <div className="semoji">{c.semoji}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">🎯 Matching Game</h2>
      <p className="hint">Tap a word, then tap its meaning to match!</p>

      <div className="game">
        <div className="board">
          <div>
            <div className="col-title">Words</div>
            <div>
              {wordOrder.map((p) => (
                <div
                  key={p.id}
                  className={`chip ${selWord === p.id ? "sel" : ""} ${
                    done[p.id] ? "done" : ""
                  }`}
                  onClick={() => pickWord(p.id)}
                >
                  <span className="ce">{p.emoji}</span>
                  {p.word}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="col-title">Meanings</div>
            <div>
              {meanOrder.map((p) => (
                <div
                  key={p.id}
                  className={`chip ${done[p.id] ? "done" : ""} ${
                    wrong === p.id ? "wrong" : ""
                  }`}
                  onClick={() => pickMean(p.id)}
                >
                  {p.meaning}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="score-wrap">
          <div className="score">Stars: {score} / 4 ⭐</div>
        </div>
        <div className={`win ${score === 4 ? "show" : ""}`}>
          🎊 You did it! 🎊
        </div>
        <button className="btn" onClick={resetGame}>
          🔄 Play Again
        </button>
      </div>

      <footer className="wa-footer">
        Made with ❤️ • Class 1 Vocabulary
      </footer>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Baloo+2:wght@600;700;800&display=swap');
.wa-root{
  font-family:'Fredoka',sans-serif;
  color:#3a2e5c;
  min-height:100vh;
  position:relative;
  background:
    radial-gradient(circle at 12% 12%, #fff6b8 0 8%, transparent 9%),
    linear-gradient(180deg,#a8e6ff 0%, #c9f0d0 40%, #d7f9d9 100%);
  background-color:#bfeaff;
  overflow-x:hidden;
  padding-bottom:60px;
  margin:-1px 0 0;
}
.wa-root *{box-sizing:border-box;}

.wa-root .cloud{position:absolute;background:#fff;border-radius:50px;opacity:.7;filter:blur(.3px);z-index:0;
  animation:wa-drift linear infinite;}
.wa-root .cloud::before,.wa-root .cloud::after{content:'';position:absolute;background:#fff;border-radius:50%;}
.wa-root .c1{width:90px;height:34px;top:10%;left:-120px;animation-duration:38s;}
.wa-root .c1::before{width:44px;height:44px;top:-20px;left:14px;}
.wa-root .c1::after{width:34px;height:34px;top:-14px;left:46px;}
.wa-root .c2{width:70px;height:26px;top:26%;left:-120px;animation-duration:52s;animation-delay:6s;}
.wa-root .c2::before{width:34px;height:34px;top:-16px;left:10px;}
.wa-root .c2::after{width:26px;height:26px;top:-10px;left:36px;}
@keyframes wa-drift{to{transform:translateX(120vw);}}

.wa-header{position:relative;z-index:2;text-align:center;padding:34px 16px 10px;}
.wa-header h1{
  font-family:'Baloo 2','Fredoka',cursive;
  font-size:clamp(28px,7vw,52px);
  color:#fff;
  line-height:1.05;
  font-weight:800;
  text-shadow:0 3px 0 #ff9e42, 0 6px 0 rgba(0,0,0,.12), 0 8px 14px rgba(0,0,0,.18);
}
.wa-header p{
  margin-top:8px;font-size:clamp(15px,3.6vw,20px);font-weight:500;
  color:#41507a;background:rgba(255,255,255,.7);
  display:inline-block;padding:6px 18px;border-radius:30px;
}
.wa-root .star{display:inline-block;animation:wa-pop 1.6s ease-in-out infinite;}
@keyframes wa-pop{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.25) rotate(12deg)}}

.wa-root .section-title{
  position:relative;z-index:2;text-align:center;font-family:'Baloo 2','Fredoka';font-weight:800;
  font-size:clamp(20px,5vw,30px);color:#fff;margin:26px 0 4px;
  text-shadow:0 2px 0 #a06cd5,0 4px 8px rgba(0,0,0,.15);
}
.wa-root .hint{position:relative;z-index:2;text-align:center;color:#4a5580;font-size:15px;margin-bottom:14px;}

.wa-root .cards{
  position:relative;z-index:2;
  display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:16px;max-width:920px;margin:0 auto;padding:0 18px;
}
.wa-root .card{perspective:1000px;height:250px;cursor:pointer;}
.wa-root .inner{position:relative;width:100%;height:100%;transition:transform .6s cubic-bezier(.6,-0.28,.4,1.5);transform-style:preserve-3d;}
.wa-root .card.flip .inner{transform:rotateY(180deg);}
.wa-root .face{
  position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;
  border-radius:26px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:18px;
  box-shadow:0 10px 0 rgba(0,0,0,.12),0 14px 26px rgba(0,0,0,.18);
  border:5px solid #fff;
}
.wa-root .front .emoji{font-size:64px;line-height:1;margin-bottom:10px;
  filter:drop-shadow(0 6px 6px rgba(0,0,0,.2));animation:wa-bob 3s ease-in-out infinite;}
@keyframes wa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.wa-root .front .word{font-family:'Baloo 2','Fredoka';font-weight:800;font-size:26px;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.25);}
.wa-root .front .tap{margin-top:8px;font-size:13px;color:#fff;background:rgba(255,255,255,.3);padding:4px 12px;border-radius:20px;}

.wa-root .back{transform:rotateY(180deg);background:#fffef7;color:#3a2e5c;}
.wa-root .back .means{font-size:14px;font-weight:500;color:#8a7fb0;text-transform:uppercase;letter-spacing:1px;}
.wa-root .back .meaning{font-family:'Baloo 2','Fredoka';font-weight:800;font-size:32px;margin:6px 0 10px;}
.wa-root .back .sentence{font-size:15px;line-height:1.4;color:#5a5478;}
.wa-root .back .semoji{font-size:40px;margin-top:10px;}

.wa-root .front-kind{background:linear-gradient(160deg,#ff9a56,#ff6b9d);}
.wa-root .front-excited{background:linear-gradient(160deg,#ffd23f,#ff8c42);}
.wa-root .front-apply{background:linear-gradient(160deg,#5ec8ff,#4a6cf7);}
.wa-root .front-surprise{background:linear-gradient(160deg,#a06cd5,#ec5fc4);}
.wa-root .mean-kind{color:#ff6b9d;} .wa-root .mean-excited{color:#ff8c42;}
.wa-root .mean-apply{color:#4a6cf7;} .wa-root .mean-surprise{color:#c44fd0;}

.wa-root .game{position:relative;z-index:2;max-width:720px;margin:10px auto 0;padding:0 18px;}
.wa-root .board{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.wa-root .col-title{font-family:'Baloo 2','Fredoka';font-weight:700;text-align:center;color:#fff;font-size:18px;
  text-shadow:0 2px 4px rgba(0,0,0,.2);margin-bottom:6px;}
.wa-root .chip{
  background:#fff;border:4px solid #fff;border-radius:20px;padding:16px 10px;
  text-align:center;font-family:'Baloo 2','Fredoka';font-weight:700;font-size:19px;color:#3a2e5c;
  box-shadow:0 6px 0 rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.14);
  cursor:pointer;transition:transform .15s,box-shadow .15s;user-select:none;
  margin-bottom:14px;
}
.wa-root .chip .ce{font-size:32px;display:block;}
.wa-root .chip:hover{transform:translateY(-3px);}
.wa-root .chip.sel{border-color:#ffd23f;box-shadow:0 0 0 4px #ffd23f,0 8px 16px rgba(0,0,0,.2);transform:translateY(-3px);}
.wa-root .chip.done{background:#c8f7c5;border-color:#7ee081;color:#2e8b3d;cursor:default;opacity:.85;pointer-events:none;}
.wa-root .chip.wrong{animation:wa-shake .4s;}
@keyframes wa-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}

.wa-root .score{text-align:center;font-family:'Baloo 2','Fredoka';font-weight:700;font-size:20px;color:#fff;
  background:#a06cd5;display:inline-block;padding:8px 24px;border-radius:30px;
  margin:18px auto 0;box-shadow:0 5px 0 #7c4dbb;}
.wa-root .score-wrap{text-align:center;}
.wa-root .win{text-align:center;font-family:'Baloo 2','Fredoka';font-weight:800;font-size:26px;color:#fff;margin-top:16px;
  display:none;text-shadow:0 2px 6px rgba(0,0,0,.2);}
.wa-root .win.show{display:block;animation:wa-pop 1s ease infinite;}

.wa-root .btn{display:block;margin:22px auto 0;font-family:'Baloo 2','Fredoka';font-weight:700;font-size:18px;color:#fff;
  background:#ff6b9d;border:none;padding:12px 30px;border-radius:30px;cursor:pointer;
  box-shadow:0 5px 0 #d94f80;transition:transform .1s;}
.wa-root .btn:active{transform:translateY(4px);box-shadow:0 1px 0 #d94f80;}

.wa-footer{text-align:center;position:relative;z-index:2;margin-top:40px;color:#4a5580;font-size:14px;}
`;
