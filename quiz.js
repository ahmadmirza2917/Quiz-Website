const SOURCE = [
  { q:"What does HTML stand for?",
    options:["Hyper Text Markup Language","High Transfer Machine Language","Hyper Text Machine Learning","Home Text Markup Language"],
    answer:0, cat:"html", explanation:"HTML = Hyper Text Markup Language — the standard for creating web pages." },
  { q:"Which HTML tag is used for the largest heading?",
    options:["&lt;h6&gt;","&lt;heading&gt;","&lt;h1&gt;","&lt;head&gt;"],
    answer:2, cat:"html", explanation:"&lt;h1&gt; is the largest heading tag, ranging from h1 (biggest) to h6 (smallest)." },
  { q:"What does CSS stand for?",
    options:["Computer Style Sheets","Colorful Style Sheets","Cascading Style Sheets","Creative Styling Script"],
    answer:2, cat:"css", explanation:"CSS = Cascading Style Sheets — used to style HTML elements." },
  { q:"Which CSS property controls text size?",
    options:["font-weight","text-size","font-size","text-style"],
    answer:2, cat:"css", explanation:"font-size controls the size of text in CSS." },
  { q:"Which is NOT a valid CSS position value?",
    options:["relative","absolute","floating","fixed"],
    answer:2, cat:"css", explanation:"'floating' is not valid. The float property is separate from position." },
  { q:"What does JS stand for?",
    options:["Java System","JavaScript","JavaStyle","Just Script"],
    answer:1, cat:"js", explanation:"JS = JavaScript, the programming language of the web." },
  { q:"Which keyword declares a block-scoped variable in JS?",
    options:["var","let","define","set"],
    answer:1, cat:"js", explanation:"'let' (ES6) creates block-scoped variables, unlike 'var' which is function-scoped." },
  { q:"Which method adds an element to the END of an array?",
    options:["push()","pop()","append()","add()"],
    answer:0, cat:"js", explanation:"Array.push() adds one or more elements to the end of an array and returns the new length." },
  { q:"Bootstrap is best described as a?",
    options:["Programming language","CSS framework","Database tool","Server framework"],
    answer:1, cat:"css", explanation:"Bootstrap is a popular CSS framework for building responsive, mobile-first sites." },
  { q:"What does DOM stand for?",
    options:["Document Object Model","Data Object Manager","Design Output Module","Display Object Map"],
    answer:0, cat:"js", explanation:"The DOM (Document Object Model) is the browser API that represents the page as a tree of nodes." },
];

/* ── buildShuffledQuestion ────────────────────────────────────
   Creates a NEW question object with options in random order
   and the answer index updated to match the new position.
   The source object is never touched.                        */
function buildShuffledQuestion(src) {
  const correctText = src.options[src.answer];          // remember correct answer by TEXT
  const opts = [...src.options].sort(() => Math.random() - 0.5);
  return {
    q: src.q,
    options: opts,
    answer: opts.indexOf(correctText),                  // find where it landed
    cat: src.cat,
    explanation: src.explanation
  };
}

/* ── State ───────────────────────────────────────────────── */
let filteredQ = [], currentCat = 'all';
let current = 0, score = 0, wrongs = 0, streak = 0, bestStreak = 0;
let timeLeft = 30, timerInterval;
let muted = false, isDark = true;
let questionStartTime, totalTime = 0, answeredCount = 0, answered = false;

/* ── Audio (Web Audio API, no files) ─────────────────────── */
let audioCtx;
function getAC() { if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function playTone(type) {
  if (muted) return;
  try {
    const ac = getAC(), now = ac.currentTime;
    function note(freq, start, dur, wave='sine', vol=0.25) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = wave; o.connect(g); g.connect(ac.destination);
      o.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(vol, now + start);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.start(now + start); o.stop(now + start + dur);
    }
    if (type==='correct') { note(523,0,0.15); note(659,0.12,0.15); note(784,0.24,0.3); }
    else if (type==='wrong') { note(220,0,0.18,'sawtooth',0.2); note(165,0.15,0.25,'sawtooth',0.15); }
    else if (type==='tick')  { note(880,0,0.07,'sine',0.04); }
    else if (type==='timeout'){ note(300,0,0.15,'square',0.18); note(180,0.15,0.25,'square',0.15); }
    else if (type==='next')  { note(440,0,0.15,'sine',0.12); }
    else if (type==='finish'){ [523,659,784,1047].forEach((f,i)=>note(f,i*0.15,0.3,'sine',0.22)); }
  } catch(e){}
}

/* ── DOM refs ────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const timeDisplay  = $('timeDisplay'), timerRing = $('timerRing');
const progressBar  = $('progressBar'), progPct   = $('progPct');
const questionNum  = $('questionNum'), questionText = $('questionText');
const optionsGrid  = $('optionsGrid'), explanationEl = $('explanation');
const nextBtn      = $('nextBtn'),     qCount    = $('qCount');
const scoreCount   = $('scoreCount'), wrongCount = $('wrongCount');
const questionBody = $('questionBody'),resultScreen = $('resultScreen');
const toastEl      = $('toastMsg');

/* ── Toast ───────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, dur=1800) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

/* ── Timer ───────────────────────────────────────────────── */
const TOTAL_TIME = 30, CIRCUM = 2*Math.PI*22;
function startTimer() {
  timeLeft = TOTAL_TIME; updateTimerUI(); clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft<=5 && timeLeft>0) playTone('tick');
    if (timeLeft<=0) { clearInterval(timerInterval); playTone('timeout'); showToast("⏰ Time's up!"); autoTimeout(); }
  }, 1000);
}
function updateTimerUI() {
  timeDisplay.textContent = timeLeft;
  timerRing.style.strokeDashoffset = CIRCUM*(1-timeLeft/TOTAL_TIME);
  timerRing.style.stroke = timeLeft<=5?'#ef4444':timeLeft<=10?'#f59e0b':'var(--accent)';
}
function autoTimeout() {
  if (answered) return;
  answered = true; wrongs++; streak = 0;
  wrongCount.textContent = wrongs;
  const btns = optionsGrid.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled=true);
  btns[filteredQ[current].answer].classList.add('correct');
  showExplanation(); nextBtn.classList.add('show');
}

/* ── Progress ────────────────────────────────────────────── */
function updateProgress() {
  const pct = Math.round(current/filteredQ.length*100);
  progressBar.style.width = pct+'%';
  progPct.textContent = pct+'%';
  qCount.textContent  = `${current+1}/${filteredQ.length}`;
  questionNum.textContent = `Question ${current+1} of ${filteredQ.length}`;
}

/* ── Load question ───────────────────────────────────────── */
const LETTERS = ['A','B','C','D'];
function loadQuestion() {
  answered = false;
  questionStartTime = Date.now();
  const q = filteredQ[current];
  questionText.innerHTML = q.q;
  optionsGrid.innerHTML  = '';
  explanationEl.classList.remove('show');
  nextBtn.classList.remove('show');
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${opt}</span>`;
    btn.onclick = () => selectAnswer(btn, i);
    optionsGrid.appendChild(btn);
  });
  updateProgress();
  startTimer();
}

/* ── Select answer ───────────────────────────────────────── */
function selectAnswer(el, chosen) {
  if (answered) return;
  answered = true;
  clearInterval(timerInterval);
  totalTime += Math.round((Date.now()-questionStartTime)/1000);
  answeredCount++;
  const correct = filteredQ[current].answer;
  const btns = optionsGrid.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled=true);
  if (chosen === correct) {
    el.classList.add('correct');
    score++; streak++;
    if (streak>bestStreak) bestStreak=streak;
    scoreCount.textContent = score;
    playTone('correct');
    const msgs=['🔥 Correct!','✨ Nailed it!','⚡ Brilliant!','🎯 Spot on!'];
    showToast(msgs[Math.floor(Math.random()*msgs.length)]);
    if (streak>=3) setTimeout(()=>showToast(`🔥 ${streak} in a row!`), 1900);
  } else {
    el.classList.add('wrong');
    btns[correct].classList.add('correct');
    wrongs++; streak=0;
    wrongCount.textContent = wrongs;
    playTone('wrong');
    const msgs=['😬 Not quite!','💡 Close one!','📖 Review that!'];
    showToast(msgs[Math.floor(Math.random()*msgs.length)]);
  }
  showExplanation();
  nextBtn.classList.add('show');
}

function showExplanation() {
  const q = filteredQ[current];
  if (q.explanation) {
    explanationEl.innerHTML = `<strong>💡 Did you know?</strong> ${q.explanation}`;
    explanationEl.classList.add('show');
  }
}

/* ── Next ────────────────────────────────────────────────── */
nextBtn.onclick = () => {
  playTone('next'); current++;
  if (current<filteredQ.length) loadQuestion(); else finishQuiz();
};

/* ── Finish ──────────────────────────────────────────────── */
function finishQuiz() {
  clearInterval(timerInterval);
  questionBody.classList.add('hide');
  resultScreen.classList.add('show');
  playTone('finish');
  const total=filteredQ.length, pct=Math.round(score/total*100);
  const avgTime=answeredCount>0?Math.round(totalTime/answeredCount):0;
  let emoji='😅',title='Keep Practicing!';
  if(pct>=90){emoji='🏆';title='Legendary!';}
  else if(pct>=70){emoji='🎉';title='Great Job!';}
  else if(pct>=50){emoji='👍';title='Not Bad!';}
  $('resultEmoji').textContent=emoji; $('resultTitle').textContent=title;
  $('resultSub').textContent=`You scored ${score} out of ${total}`;
  $('scorePct').textContent=pct+'%';
  $('rCorrect').textContent=score; $('rWrong').textContent=wrongs;
  $('rStreak').textContent=bestStreak; $('rTime').textContent=avgTime+'s';
  const C=2*Math.PI*55, ring=$('scoreRing');
  ring.style.transition='none'; ring.style.strokeDasharray=C; ring.style.strokeDashoffset=C;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    ring.style.transition='stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) 0.3s,stroke 0.3s';
    ring.style.strokeDashoffset=C*(1-pct/100);
    ring.style.stroke=pct>=70?'var(--correct)':pct>=50?'#f59e0b':'var(--wrong)';
  }));
  if(pct>=70) setTimeout(()=>confetti({particleCount:120,spread:80,origin:{y:0.55}}),400);
  const h=JSON.parse(localStorage.getItem('qmHistory')||'[]');
  h.push({pct,score,total,date:new Date().toISOString()});
  localStorage.setItem('qmHistory',JSON.stringify(h));
}

/* ── Restart ─────────────────────────────────────────────── */
$('restartBtn').onclick = startQuiz;

/* ── Category filter ─────────────────────────────────────── */
document.querySelectorAll('.cat-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentCat=btn.dataset.cat;
    startQuiz();
  };
});

/* ── Theme / mute ────────────────────────────────────────── */
$('toggleMode').onclick=()=>{
  isDark=!isDark;
  document.body.classList.toggle('light-mode',!isDark);
  $('toggleMode').textContent=isDark?'🌙':'☀️';
};
$('muteBtn').onclick=()=>{
  muted=!muted;
  $('muteBtn').textContent=muted?'🔇':'🔊';
  showToast(muted?'🔇 Muted':'🔊 Sound on');
};

/* ── Start ───────────────────────────────────────────────────
   Always rebuilds filteredQ from SOURCE so nothing carries
   over between rounds and answer indices are always fresh.  */
function startQuiz() {
  current=0; score=0; wrongs=0; streak=0; bestStreak=0;
  totalTime=0; answeredCount=0;
  scoreCount.textContent=0; wrongCount.textContent=0;

  const pool = (currentCat==='all' ? SOURCE : SOURCE.filter(q=>q.cat===currentCat))
                 .sort(()=>Math.random()-0.5);

  /* KEY FIX: each question gets its own fresh shuffled copy */
  filteredQ = pool.map(src => buildShuffledQuestion(src));

  questionBody.classList.remove('hide');
  resultScreen.classList.remove('show');
  loadQuestion();
}

document.addEventListener('click',()=>{try{getAC();}catch(e){}},{once:true});
startQuiz();