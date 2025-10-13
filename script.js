// script.js — Robust DApp logic
(async () => {
  // ---------------- app config ----------------
  const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
  const abi = [
    "function joinArena() payable",
    "function updateScore(uint256 _score, string calldata _discord)",
    "function topPlayers() view returns (string[] memory, uint256[] memory)"
  ];

  // ---------------- DOM refs ----------------
  const statusEl = document.getElementById('status');
  const connectBtn = document.getElementById('connectBtn');
  const joinBtn = document.getElementById('joinBtn');

  const discordSection = document.getElementById('discordSection');
  const discordInput = document.getElementById('discordInput');
  const startQuizBtn = document.getElementById('startQuizBtn');

  const quizSection = document.getElementById('quizSection');
  const questionTitle = document.getElementById('questionTitle');
  const answersWrap = document.getElementById('answers');

  const leaderboardSection = document.getElementById('leaderboardSection');
  const leaderboardList = document.getElementById('leaderboard');

  // ---------------- state ----------------
  let chosenProvider = null;    // raw injected provider object (window.ethereum or choice)
  let providerLib = null;      // ethers provider (BrowserProvider or Web3Provider)
  let signer = null;
  let contract = null;
  let connectedAccount = null;

  let userDiscord = '';
  let score = 0;
  let currentQ = 0;

  // Simple quiz (10 Qs) — you can replace with your dynamic questions
  const quizQuestions = [
    { q: "What is GoKite AI?", a:["Blockchain platform","App","Video codec","Database"], correct:0 },
    { q: "Token symbol used?", a:["KITE","ETH","BTC","SOL"], correct:0 },
    { q: "Wallet required to play?", a:["Yes","No","Optional","Later"], correct:0 },
    { q: "How many questions per round?", a:["10","5","20","15"], correct:0 },
    { q: "Correct answer gives:", a:["+1","+2","+5","0"], correct:0 },
    { q: "Wrong answer gives:", a:["-1","0","+1","+2"], correct:0 },
    { q: "Leaderboard shows:", a:["Discord name","Wallet address","Email","Name"], correct:0 },
    { q: "Deposit to join arena:", a:["0.01","0.1","1","0.001"], correct:0 },
    { q: "Can you withdraw contract funds (depends):", a:["Depends on contract","Yes","No","Maybe"], correct:0 },
    { q: "Hosting free on GitHub Pages?", a:["Yes","No","Only paid","Server needed"], correct:0 }
  ];

  // ---------------- helpers ----------------
  function setStatus(text, level = 'info') {
    // level not used for styles now, but could (success/error)
    statusEl.innerText = `Status: ${text}`;
    console.debug('[STATUS]', text);
  }

  // Wait for ethers library to exist
  async function waitForEthers(timeout = 5000) {
    const period = 100;
    const loops = Math.ceil(timeout / period);
    for (let i = 0; i < loops; i++) {
      if (window.ethers) return window.ethers;
      await new Promise(r => setTimeout(r, period));
    }
    return null;
  }

  // Wait for window.ethereum injected
  async function waitForInjectedEthereum(timeout = 7000) {
    const period = 150;
    const loops = Math.ceil(timeout / period);
    for (let i = 0; i < loops; i++) {
      if (window.ethereum) return window.ethereum;
      await new Promise(r => setTimeout(r, period));
    }
    return null;
  }

  // Pick provider robustly (prioritize MetaMask)
  function pickInjectedProvider() {
    if (!window.ethereum) return null;
    try {
      if (Array.isArray(window.ethereum.providers)) {
        const mm = window.ethereum.providers.find(p => p.isMetaMask);
        if (mm) return mm;
        // fallback to the first available provider
        return window.ethereum.providers[0];
      }
      return window.ethereum;
    } catch (e) {
      console.warn('pickInjectedProvider failed', e);
      return window.ethereum;
    }
  }

  // Create ethers provider object safely (tries BrowserProvider then Web3Provider)
  function makeEthersProvider(rawProvider) {
    try {
      // prefer BrowserProvider if present
      if (window.ethers?.BrowserProvider) {
        return new window.ethers.BrowserProvider(rawProvider, 'any');
      }
      // fallback to legacy Web3Provider (some UMD builds expose .providers)
      if (window.ethers?.providers?.Web3Provider) {
        return new window.ethers.providers.Web3Provider(rawProvider, 'any');
      }
      throw new Error('No compatible ethers Provider constructors found');
    } catch (err) {
      console.error('makeEthersProvider error', err);
      throw err;
    }
  }

  // request accounts via raw provider if possible (more reliable)
  async function requestAccountsRaw(rawProvider) {
    if (!rawProvider) throw new Error('No raw injected provider');
    // Some providers support provider.request({ method: 'eth_requestAccounts' })
    if (typeof rawProvider.request === 'function') {
      return rawProvider.request({ method: 'eth_requestAccounts' });
    }
    // fallback to send method if present
    if (typeof rawProvider.send === 'function') {
      return rawProvider.send('eth_requestAccounts', []);
    }
    throw new Error('Provider does not support account request');
  }

  // ---------------- connect wallet core (robust) ----------------
  async function connectWallet() {
    try {
      setStatus('initializing connection...');
      // ensure ethers library present
      const ethersLib = await waitForEthers(5000);
      if (!ethersLib) {
        setStatus('ethers.js missing — cannot continue');
        alert('Ethers.js failed to load. Check network or script blocker.');
        return false;
      }

      // wait for injected provider
      let injected = pickInjectedProvider() || await waitForInjectedEthereum(7000);
      if (!injected) {
        setStatus('No injected wallet detected (install MetaMask)');
        alert('No injected wallet found. Please install MetaMask or a compatible wallet extension.');
        return false;
      }

      // If there are many providers, pick Metamask if available
      const chosen = pickInjectedProvider() || injected;
      chosenProvider = chosen;

      // Build ethers provider object
      try {
        providerLib = makeEthersProvider(chosenProvider);
      } catch (err) {
        // last resort: try direct Web3Provider constructor path
        if (window.ethers && window.ethers.providers && window.ethers.providers.Web3Provider) {
          providerLib = new window.ethers.providers.Web3Provider(chosenProvider, 'any');
        } else {
          throw err;
        }
      }

      // Request accounts (use raw request to be more interoperable)
      await requestAccountsRaw(chosenProvider);

      // Obtain signer
      signer = providerLib.getSigner?.() || (providerLib.getSigner === undefined ? null : providerLib.getSigner());
      try {
        connectedAccount = signer ? await signer.getAddress() : null;
      } catch (e) {
        // sometimes getAddress may fail; attempt to read accounts via request
        try {
          const accs = await chosenProvider.request({ method: 'eth_accounts' });
          connectedAccount = (accs && accs[0]) || null;
        } catch (_) {
          connectedAccount = null;
        }
      }

      if (!connectedAccount) {
        setStatus('No account returned by wallet');
        alert('Please unlock your wallet and approve connection.');
        return false;
      }

      // instantiate contract with signer if available
      contract = new window.ethers.Contract(contractAddress, abi, signer || providerLib);

      // UI updates and listeners
      setStatus(`Connected: ${connectedAccount.slice(0,6)}...${connectedAccount.slice(-4)}`);
      connectBtn.disabled = true;
      joinBtn.disabled = false;

      // attach events if supported
      try {
        if (chosenProvider.on) {
          chosenProvider.on('accountsChanged', (accounts) => {
            if (!accounts || accounts.length === 0) {
              setStatus('Wallet locked');
              connectBtn.disabled = false;
              joinBtn.disabled = true;
            } else {
              connectedAccount = accounts[0];
              setStatus(`Connected: ${connectedAccount.slice(0,6)}...${connectedAccount.slice(-4)}`);
            }
          });
          chosenProvider.on('chainChanged', () => {
            setStatus('Chain changed — refreshing');
            setTimeout(()=>window.location.reload(), 800);
          });
        }
      } catch (_) { /* ignore */ }

      return true;
    } catch (err) {
      console.error('Wallet connect failed:', err);
      setStatus('Wallet connect failed: ' + (err.message || err));
      alert('Connect failed: ' + (err.message || err));
      return false;
    }
  }

  // ---------------- Join Arena ----------------
  async function joinArena() {
    if (!contract) return alert('Connect wallet first');
    try {
      setStatus('Preparing join transaction...');
      // ensure signer present
      if (!signer) {
        // try to get signer again
        signer = providerLib.getSigner?.();
        if (!signer) throw new Error('No signer available (unlock wallet)');
      }

      // Use contract with signer
      contract = contract.connect ? contract.connect(signer) : contract;

      // send tx - ensure parseEther exists
      const value = (window.ethers && window.ethers.parseEther) ? window.ethers.parseEther('0.01') : '0x2386f26fc10000'; // fallback hex for 0.01
      setStatus('Sending joinArena transaction (0.01 KITE)...');
      const tx = await contract.joinArena({ value });
      setStatus('Waiting for join tx confirmation...');
      await tx.wait();
      setStatus('🎉 Joined Arena! Enter Discord name to start quiz.');
      discordSection.classList.remove('hidden');
      joinBtn.disabled = true;
    } catch (err) {
      console.error('joinArena error', err);
      setStatus('Join failed: ' + (err.message || err));
      alert('Join failed: ' + (err.message || err));
    }
  }

  // ---------------- Quiz flow ----------------
  function startQuizUI() {
    const name = (discordInput && discordInput.value) ? discordInput.value.trim() : '';
    if (!name) return alert('Enter your Discord name first');
    userDiscord = name;
    score = 0;
    currentQ = 0;
    discordSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    renderQuestion();
  }

  function renderQuestion() {
    if (currentQ >= quizQuestions.length) return finishQuiz();
    const q = quizQuestions[currentQ];
    questionTitle.innerText = `Q${currentQ+1}: ${q.q}`;
    answersWrap.innerHTML = '';
    q.a.forEach((ans, idx) => {
      const b = document.createElement('button');
      b.innerText = ans;
      b.onclick = () => {
        if (idx === q.correct) score++; else score--;
        currentQ++;
        renderQuestion();
      };
      answersWrap.appendChild(b);
    });
  }

  async function finishQuiz() {
    quizSection.classList.add('hidden');
    setStatus('Submitting quiz score: ' + score);
    try {
      if (!contract) throw new Error('No contract available');
      // use gas estimation
      let gasLimit;
      try {
        gasLimit = await contract.estimateGas.updateScore(score, userDiscord);
        // add a small buffer
        gasLimit = gasLimit.mul ? gasLimit.mul(110).div(100) : gasLimit;
      } catch (e) {
        // gas estimate failed — still try calling without explicit gas
        gasLimit = null;
      }

      const txArgs = gasLimit ? { gasLimit } : {};
      const tx = await contract.updateScore(score, userDiscord, txArgs);
      setStatus('Waiting for score tx confirmation...');
      await tx.wait();
      setStatus('✅ Score submitted: ' + score);
      await loadLeaderboard();
    } catch (err) {
      console.error('finishQuiz error', err);
      setStatus('Submit failed: ' + (err.message || err));
      alert('Submit score failed: ' + (err.message || err));
    }
  }

  // ---------------- Leaderboard ----------------
  async function loadLeaderboard() {
    if (!contract) { setStatus('No contract to read leaderboard'); return; }
    try {
      setStatus('Loading leaderboard...');
      // call view method
      const res = await contract.topPlayers();
      // expect [names, scores]
      if (!res || !Array.isArray(res)) {
        setStatus('Leaderboard: unexpected response');
        return;
      }
      const [names, scores] = res;
      leaderboardList.innerHTML = '';
      const total = Math.min(names.length || 0, 100);
      for (let i = 0; i < total; i++) {
        const li = document.createElement('li');
        li.innerText = `${i+1}. ${names[i]} — ${scores[i]} pts`;
        leaderboardList.appendChild(li);
      }
      leaderboardSection.classList.remove('hidden');
      setStatus('Leaderboard loaded');
    } catch (err) {
      console.error('loadLeaderboard error', err);
      setStatus('Leaderboard load failed: ' + (err.message || err));
    }
  }

  // ---------------- wire UI ----------------
  connectBtn.addEventListener('click', async () => {
    const ok = await connectWallet();
    if (ok) {
      // pre-load leaderboard if contract readable (optional)
      try { await loadLeaderboard(); } catch (_) {}
    }
  });

  joinBtn.addEventListener('click', joinArena);
  startQuizBtn.addEventListener('click', startQuizUI);

  // initial status
  setStatus('Ready — connect wallet to start');

})();
