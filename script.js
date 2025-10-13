// script.js — Robust wallet + quiz + leaderboard frontend
// Make sure index.html includes ethers UMD before this script (we use `defer`).

/*
  NOTES:
  - This uses injected wallets (MetaMask / Brave / other extension-injected providers).
  - If you want WalletConnect/mobile support, we must add an external library.
*/

(() => {
  // ---- CONFIG ----
  const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // replace with your contract
  const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string calldata _discord)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
  ];

  // ---- UI refs ----
  const statusText = document.getElementById("statusText");
  const connectBtn = document.getElementById("connectWalletBtn");
  const joinBtn = document.getElementById("joinArenaBtn");
  const discordDiv = document.getElementById("discordDiv");
  const saveDiscordBtn = document.getElementById("saveDiscordBtn");
  const discordInput = document.getElementById("discordName");
  const quizDiv = document.getElementById("quizDiv");
  const questionText = document.getElementById("questionText");
  const answersDiv = document.getElementById("answers");
  const leaderboardUl = document.getElementById("leaderboard");
  const qIndexSpan = document.getElementById("qIndex");

  // ---- state ----
  let provider = null;
  let signer = null;
  let contract = null;
  let currentAccount = null;
  let userDiscord = "";
  let score = 0;
  let currentQuestion = 0;

  // ---- quiz bank (10 questions) ----
  const quizQuestions = [
    { q: "What is GoKite AI?", a: ["Blockchain platform for AI and games", "A messaging app", "A database", "A video codec"], correct: 0 },
    { q: "Which token symbol did we use in examples?", a: ["KITE", "ETH", "BTC", "SOL"], correct: 0 },
    { q: "Do you need a wallet to join the arena?", a: ["Yes", "No","Sometimes","Only admin"], correct: 0 },
    { q: "How many questions in a quiz round?", a: ["10","5","20","1"], correct: 0 },
    { q: "What happens on a correct answer?", a: ["+1 point","-1 point","No change","Kick"], correct: 0 },
    { q: "Where are join and score transactions recorded?", a: ["Blockchain","Local file","Server DB only","Nowhere"], correct: 0 },
    { q: "Can leaderboard show Discord names", a: ["Yes", "No", "Only wallet", "Only ENS"], correct: 0 },
    { q: "Is the example deposit 0.01 value in Ether units?", a: ["Yes (converted to chain token)", "No","It is 1","It is 0.001"], correct: 0 },
    { q: "Should UI wait for provider injection to avoid errors?", a: ["Yes","No","Only sometimes","Never"], correct: 0 },
    { q: "Is this front-end free to host on GitHub Pages?", a: ["Yes", "No", "Only paid", "Requires server"], correct: 0 }
  ];

  // ---- utility: update status ----
  function setStatus(msg) {
    statusText.innerText = msg;
  }

  // ---- utility: wait for ethers global and provider injection ----
  async function ensureEthersLoaded(timeout = 3000) {
    // wait for ethers global
    const start = Date.now();
    while (typeof window.ethers === "undefined") {
      if (Date.now() - start > timeout) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return typeof window.ethers !== "undefined";
  }

  async function waitForInjectedProvider(timeout = 5000) {
    // Some extensions inject a provider after page load. poll for it.
    const interval = 200;
    const attempts = Math.ceil(timeout / interval);
    for (let i = 0; i < attempts; i++) {
      if (window.ethereum) return window.ethereum;
      await new Promise(r => setTimeout(r, interval));
    }
    return null;
  }

  // Choose provider if multiple (e.g. Wallets that expose multiple providers)
  function pickInjectedProvider() {
    // If multiple providers exposed (window.ethereum.providers), choose sensible one:
    if (window.ethereum && Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
      // try to prefer MetaMask if available
      const mm = window.ethereum.providers.find(p => p.isMetaMask);
      if (mm) return mm;
      return window.ethereum.providers[0];
    }
    return window.ethereum || null;
  }

  // ---- connect flow ----
  async function connectWalletFlow() {
    try {
      setStatus("Initializing...");
      // ensure ethers script has loaded
      const ok = await ensureEthersLoaded(3000);
      if (!ok) {
        alert("Ethers.js failed to load — check your internet or CDN. Make sure the ethers UMD script is included before script.js.");
        setStatus("Ethers.js not loaded");
        return;
      }

      // wait for injected provider, then pick a provider
      const injected = await waitForInjectedProvider(4000);
      if (!injected) {
        alert("No injected wallet found. Install MetaMask (or use a browser extension wallet) and retry.");
        setStatus("No injected wallet");
        return;
      }
      const chosen = pickInjectedProvider();
      if (!chosen) {
        alert("No usable injected provider detected.");
        setStatus("Provider not found");
        return;
      }

      // Create ethers provider and request accounts
      provider = new ethers.providers.Web3Provider(chosen, "any"); // 'any' lets user change chain
      // Request accounts (this will prompt MetaMask)
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();
      currentAccount = await signer.getAddress();

      // instantiate contract with signer
      contract = new ethers.Contract(contractAddress, abi, signer);

      setStatus(`Connected: ${short(currentAccount)}`);
      connectBtn.disabled = true;
      joinBtn.disabled = false;

      // subscribe to account/chain changes (for injected provider)
      try {
        // Use chosen.request if available (EIP-1193)
        if (chosen.on) {
          chosen.on("accountsChanged", handleAccountsChanged);
          chosen.on("chainChanged", handleChainChanged);
          chosen.on("disconnect", handleDisconnect);
        }
      } catch (e) {
        console.debug("provider event attach failed", e);
      }

      console.log("Connected:", { provider, signer, contract });
    } catch (err) {
      console.error("connectWalletFlow error:", err);
      alert("Wallet connection failed: " + (err && err.message ? err.message : String(err)));
      setStatus("Not connected");
    }
  }

  function short(addr) {
    if (!addr) return "";
    return addr.slice(0,6) + "..." + addr.slice(-4);
  }

  // ---- provider event handlers ----
  function handleAccountsChanged(accounts) {
    if (!accounts || !accounts.length) {
      setStatus("No accounts (locked)");
      connectBtn.disabled = false;
      joinBtn.disabled = true;
      currentAccount = null;
    } else {
      currentAccount = accounts[0];
      setStatus("Connected: " + short(currentAccount));
    }
  }
  function handleChainChanged(chainId) {
    console.log("chainChanged", chainId);
    setStatus(`Connected (chain ${chainId})`);
    // optional: reload to reinitialize provider-based values
  }
  function handleDisconnect() {
    setStatus("Wallet disconnected");
    connectBtn.disabled = false;
    joinBtn.disabled = true;
    currentAccount = null;
  }

  // ---- Join arena (deposit) ----
  async function joinArena() {
    if (!contract || !signer) {
      alert("Connect wallet first.");
      return;
    }
    try {
      setStatus("Sending join tx...");
      // value is 0.01 (in native chain token) — adapt to chain decimals if required by your contract env
      const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
      await tx.wait();
      setStatus("Joined arena — enter Discord name to start quiz");
      discordDiv.hidden = false;
      joinBtn.disabled = true;
    } catch (e) {
      console.error("joinArena error", e);
      alert("Error joining arena: " + (e && e.message ? e.message : e));
      setStatus("Join failed");
    }
  }

  // ---- quiz flow ----
  function startQuiz() {
    const name = (discordInput.value || "").trim();
    if (!name) return alert("Enter your Discord name.");
    userDiscord = name;
    score = 0;
    currentQuestion = 0;
    discordDiv.hidden = true;
    quizDiv.hidden = false;
    loadQuestion();
  }

  function loadQuestion() {
    if (currentQuestion >= quizQuestions.length) {
      finishQuiz();
      return;
    }
    const q = quizQuestions[currentQuestion];
    questionText.textContent = q.q;
    answersDiv.innerHTML = "";
    qIndexSpan.textContent = (currentQuestion + 1);
    q.a.forEach((ans, idx) => {
      const b = document.createElement("button");
      b.textContent = ans;
      b.onclick = () => {
        if (idx === q.correct) score += 1;
        else score -= 1;
        currentQuestion++;
        loadQuestion();
      };
      answersDiv.appendChild(b);
    });
  }

  async function finishQuiz() {
    quizDiv.hidden = true;
    setStatus("Submitting score...");
    try {
      // call updateScore(score, discord)
      const tx = await contract.updateScore(score, userDiscord);
      await tx.wait();
      setStatus(`Score ${score} submitted. Loading leaderboard...`);
      await loadLeaderboard();
    } catch (e) {
      console.error("finishQuiz error", e);
      alert("Failed to submit score: " + (e && e.message ? e.message : e));
      setStatus("Score submit failed");
    }
  }

  // ---- leaderboard ----
  async function loadLeaderboard() {
    if (!contract) return;
    setStatus("Loading leaderboard...");
    try {
      const [names, scores] = await contract.topPlayers();
      leaderboardUl.innerHTML = "";
      const N = Math.min(names.length, 100);
      for (let i = 0; i < N; i++) {
        const li = document.createElement("li");
        li.textContent = `${i+1}. ${names[i]} — ${scores[i]} pts`;
        leaderboardUl.appendChild(li);
      }
      setStatus("Leaderboard loaded");
    } catch (e) {
      console.error("loadLeaderboard error", e);
      setStatus("Leaderboard failed");
    }
  }

  // ---- wire UI ----
  connectBtn.addEventListener("click", connectWalletFlow);
  joinBtn.addEventListener("click", joinArena);
  saveDiscordBtn.addEventListener("click", startQuiz);

  // ---- initial UI state ----
  setStatus("Not connected");
  joinBtn.disabled = true;
  discordDiv.hidden = true;
  quizDiv.hidden = true;

  // Optionally try to pre-load leaderboard if a provider exists and contract is accessible:
  (async () => {
    // if ethers is present and a provider is auto-injected, wire up a readonly provider to load leaderboard
    await ensureEthersLoadedSafe();
    const maybeProvider = pickInjectedProvider();
    if (maybeProvider) {
      try {
        const readProvider = new ethers.providers.Web3Provider(maybeProvider, "any");
        const readContract = new ethers.Contract(contractAddress, abi, readProvider);
        const [names, scores] = await readContract.topPlayers().catch(()=>[[],[]]);
        // populate if there are results
        if (names && names.length) {
          leaderboardUl.innerHTML = "";
          for (let i = 0; i < Math.min(names.length, 100); i++) {
            const li = document.createElement("li");
            li.textContent = `${i+1}. ${names[i]} — ${scores[i]} pts`;
            leaderboardUl.appendChild(li);
          }
          setStatus("Leaderboard loaded (readonly)");
        }
      } catch(e) {
        // ignore read errors
      }
    }
  })();

  // helper: ensure ethers global loaded (for optional pre-load)
  async function ensureEthersLoadedSafe(timeout = 2000) {
    const start = Date.now();
    while (typeof window.ethers === "undefined") {
      if (Date.now() - start > timeout) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return typeof window.ethers !== "undefined";
  }

})();
