// script.js — robust wallet connect + game logic (GoKite Arena)
//
// Notes:
// - Uses ethers v6 UMD (loaded in index.html).
// - Prioritizes MetaMask if multiple providers are injected.
// - Waits for ethers and ethereum injection before creating provider.
// - Handles network/chain changes and reconnects gracefully.

(() => {
  // ---------- CONFIG ----------
  const CONTRACT_ADDRESS = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // update if needed
  const ABI = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string calldata _discord)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
  ];

  // ---------- DOM ----------
  const statusEl = document.getElementById("status");
  const connectBtn = document.getElementById("connectBtn");
  const joinBtn = document.getElementById("joinBtn");
  const discordSection = document.getElementById("discordSection");
  const discordInput = document.getElementById("discordInput");
  const startQuizBtn = document.getElementById("startQuizBtn");
  const quizSection = document.getElementById("quizSection");
  const questionTitle = document.getElementById("questionTitle");
  const answersWrap = document.getElementById("answers");
  const leaderboardSection = document.getElementById("leaderboardSection");
  const leaderboardList = document.getElementById("leaderboard");

  // ---------- STATE ----------
  let rawProvider = null;    // chosen injected provider (window.ethereum or a provider from providers array)
  let ethersProvider = null; // ethers BrowserProvider or Web3Provider
  let signer = null;
  let contract = null;
  let account = null;
  let connecting = false;

  let userDiscord = "";
  let score = 0;
  let qIndex = 0;

  const quizQuestions = [
    { q: "What is GoKite AI?", a: ["Blockchain platform","App","Video codec","Database"], correct: 0 },
    { q: "Token symbol used?", a: ["KITE","ETH","BTC","SOL"], correct: 0 },
    { q: "Wallet required?", a: ["Yes","No","Optional","Later"], correct: 0 },
    { q: "Questions per round?", a: ["10","5","20","15"], correct: 0 },
    { q: "Correct answer points?", a: ["1","2","5","0"], correct: 0 },
    { q: "Wrong answer points?", a: ["-1","0","1","2"], correct: 0 },
    { q: "Leaderboard shows?", a: ["Discord","Wallet","Email","Name"], correct: 0 },
    { q: "Deposit amount to join?", a: ["0.01","0.1","1","0.001"], correct: 0 },
    { q: "Quiz updates?", a: ["Weekly","Daily","Monthly","Never"], correct: 0 },
    { q: "Hosting on GitHub Pages free?", a: ["Yes","No","Only paid","Server needed"], correct: 0 }
  ];

  // ---------- HELPERS ----------
  function setStatus(text) {
    statusEl.innerText = `Status: ${text}`;
    console.debug("[status]", text);
  }

  function safeLog(...args) { console.log(...args); }

  // wait for ethers lib to be available
  async function waitEthers(timeout = 3000) {
    const poll = 100;
    const max = Math.ceil(timeout / poll);
    for (let i = 0; i < max; i++) {
      if (window.ethers) return window.ethers;
      await new Promise(r => setTimeout(r, poll));
    }
    return window.ethers || null;
  }

  // wait for injected window.ethereum (or providers) to appear
  async function waitForInjectedEthereum(timeout = 7000) {
    const poll = 100;
    const max = Math.ceil(timeout / poll);
    for (let i = 0; i < max; i++) {
      if (window.ethereum) return window.ethereum;
      await new Promise(r => setTimeout(r, poll));
    }
    return window.ethereum || null;
  }

  // pick provider: prefer MetaMask if multiple providers exist
  function pickInjectedProvider(rawEthereum) {
    if (!rawEthereum) return null;
    try {
      if (Array.isArray(rawEthereum.providers)) {
        const mm = rawEthereum.providers.find(p => p.isMetaMask);
        return mm || rawEthereum.providers[0] || null;
      }
    } catch (e) {
      // ignore
    }
    return rawEthereum;
  }

  // create ethers provider (BrowserProvider preferred for v6)
  function makeEthersProvider(raw) {
    if (!window.ethers) throw new Error("ethers not loaded");
    // BrowserProvider exists in ethers v6 UMD
    if (window.ethers.BrowserProvider) {
      try { return new window.ethers.BrowserProvider(raw, "any"); } catch(e) { /* fallback */ }
    }
    // fallback to providers.Web3Provider if present
    if (window.ethers.providers && window.ethers.providers.Web3Provider) {
      return new window.ethers.providers.Web3Provider(raw, "any");
    }
    // last resort - throw
    throw new Error("No compatible ethers provider constructor found");
  }

  // request accounts using raw provider (works with most)
  async function requestAccountsRaw(raw) {
    if (!raw) throw new Error("No raw provider");
    if (typeof raw.request === "function") {
      return raw.request({ method: "eth_requestAccounts" });
    }
    if (typeof raw.send === "function") {
      return raw.send("eth_requestAccounts", []);
    }
    throw new Error("Provider does not support account request");
  }

  // ---------- CORE: connect wallet robustly ----------
  async function connectWallet() {
    if (connecting) return;
    connecting = true;
    setStatus("initializing...");

    try {
      // ensure ethers loaded
      await waitEthers(3000);
      if (!window.ethers) {
        setStatus("ethers library not loaded");
        alert("ethers.js failed to load. Check network or script blocker.");
        connecting = false;
        return false;
      }

      // find injected provider (wait if necessary)
      let injected = pickInjectedProvider(window.ethereum) || await waitForInjectedEthereum(7000);
      if (!injected) {
        setStatus("No injected wallet found");
        alert("No wallet detected. Install MetaMask or a compatible wallet.");
        connecting = false;
        return false;
      }

      // prefer MetaMask provider if multiple providers exist inside injected
      const chosen = pickInjectedProvider(injected) || injected;
      rawProvider = chosen;

      // create ethers provider safely
      try {
        ethersProvider = makeEthersProvider(rawProvider);
      } catch (e) {
        // fallback: try Web3Provider path explicitly
        if (window.ethers && window.ethers.providers && window.ethers.providers.Web3Provider) {
          ethersProvider = new window.ethers.providers.Web3Provider(rawProvider, "any");
        } else {
          throw e;
        }
      }

      // request accounts
      try {
        await requestAccountsRaw(rawProvider);
      } catch (reqErr) {
        // request failed; try through ethers provider
        try {
          await ethersProvider.send("eth_requestAccounts", []);
        } catch (e2) {
          throw new Error("Account request denied or failed");
        }
      }

      // get signer & account
      signer = ethersProvider.getSigner?.() || null;
      try {
        account = signer ? await signer.getAddress() : null;
      } catch (e) {
        // fallback to eth_accounts
        const accs = await rawProvider.request?.({ method: "eth_accounts" }).catch(()=>null);
        account = (accs && accs[0]) || null;
      }

      if (!account) {
        setStatus("No account available (unlock wallet)");
        alert("Please unlock your wallet and approve connection.");
        connecting = false;
        return false;
      }

     // instantiate contract with signer (must await in ethers v6)
if (ethersProvider.getSigner) {
  signer = await ethersProvider.getSigner();
}
if (!signer) {
  setStatus("Signer not available — using read-only mode");
  contract = new window.ethers.Contract(CONTRACT_ADDRESS, ABI, ethersProvider);
} else {
  contract = new window.ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

      // attach listeners (safe)
      try {
        if (rawProvider.on) {
          rawProvider.on("accountsChanged", (accounts) => {
            if (!accounts || accounts.length === 0) {
              setStatus("Wallet locked");
              connectBtn.disabled = false;
              joinBtn.disabled = true;
            } else {
              account = accounts[0];
              setStatus(`Connected: ${account.slice(0,6)}...${account.slice(-4)}`);
            }
          });
          rawProvider.on("chainChanged", async () => {
            // network changed: re-create provider & signer quietly
            setStatus("Network changed — reconnecting provider...");
            try {
              // small delay to allow provider internal state catch up
              await new Promise(r=>setTimeout(r, 600));
              await connectWallet(); // re-run connect flow
            } catch(e) {
              console.warn("reconnect after chainChanged failed", e);
            }
          });
        }
      } catch (e) { /* ignore listener errors */ }

      // try to preload leaderboard
      loadLeaderboard().catch(()=>{});
      connecting = false;
      return true;

    } catch (err) {
      console.error("Wallet connect failed:", err);
      setStatus("Not connected");
      alert("Wallet connect failed: " + (err && err.message ? err.message : err));
      connecting = false;
      return false;
    }
  }

  // ---------- Join arena ----------
async function joinArena() {
  try {
    if (!window.signer || !window.contract) {
      throw new Error("Wallet not connected properly");
    }

    document.getElementById("status").innerText = "Joining arena...";

    // Call your contract function safely
    const tx = await window.contract.connect(window.signer).joinArena({
      value: ethers.parseEther("0.01"),
    });

    await tx.wait();

    document.getElementById("status").innerText = "Joined arena successfully!";
  } catch (err) {
    console.error("joinArena failed", err);
    document.getElementById("status").innerText = "Join failed: " + err.message;
  }
}


  // ---------- QUIZ FLOW ----------
  function startQuiz() {
    const name = (discordInput.value || "").trim();
    if (!name) {
      alert("Enter Discord name");
      return;
    }
    userDiscord = name;
    score = 0;
    qIndex = 0;
    discordSection.classList.add("hidden");
    quizSection.classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    if (qIndex >= quizQuestions.length) return finishQuiz();
    const q = quizQuestions[qIndex];
    questionTitle.innerText = `Q${qIndex+1}: ${q.q}`;
    answersWrap.innerHTML = "";
    q.a.forEach((ans, idx) => {
      const b = document.createElement("button");
      b.innerText = ans;
      b.onclick = () => {
        if (idx === q.correct) score++; else score--;
        qIndex++;
        renderQuestion();
      };
      answersWrap.appendChild(b);
    });
  }

  async function finishQuiz() {
    quizSection.classList.add("hidden");
    setStatus("Submitting score...");
    try {
      // estimate gas if possible
      let tx;
      try {
        const gas = await contract.estimateGas.updateScore(score, userDiscord).catch(()=>null);
        if (gas) {
          const gasWithBuffer = gas.mul ? gas.mul(110).div(100) : gas;
          tx = await contract.updateScore(score, userDiscord, { gasLimit: gasWithBuffer });
        } else {
          tx = await contract.updateScore(score, userDiscord);
        }
      } catch (e) {
        // fallback
        tx = await contract.updateScore(score, userDiscord);
      }
      await tx.wait();
      setStatus("Score submitted!");
      await loadLeaderboard();
    } catch (e) {
      console.error("submit score failed", e);
      alert("Submit failed: " + (e && e.message ? e.message : e));
      setStatus("Submit failed");
    }
  }

  // ---------- LEADERBOARD ----------
async function loadLeaderboard() {
  try {
    if (!window.contract) throw new Error("Contract not initialized");
    
    const result = await window.contract.topPlayers();
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No leaderboard data found");
    }

    console.log("Leaderboard:", result);
    document.getElementById("status").innerText = "Leaderboard loaded";
  } catch (err) {
    console.error("loadLeaderboard error", err);
    document.getElementById("status").innerText = "Leaderboard load failed: " + err.message;
  }
}


  // ---------- WIRING ----------
  connectBtn.addEventListener("click", connectWallet);
  joinBtn.addEventListener("click", joinArena);
  startQuizBtn.addEventListener("click", startQuiz);

  // initial UI
  setStatus("Ready — connect wallet");
  joinBtn.disabled = true;
  discordSection.classList.add("hidden");
  quizSection.classList.add("hidden");

  // Auto-attempt to detect provider quietly (improves first-click experience)
  (async function prewarm() {
    try {
      // small non-blocking pre-warm to help providers that inject after load
      await waitForInjectedEthereum(1200);
      // no auto-connect — require explicit user click for security
    } catch (e) { /* ignore */ }
  })();

})();
