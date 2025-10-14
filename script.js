// JS Attempt: 1  (bump jsAttempt variable when you update)
window.addEventListener("DOMContentLoaded", () => {
  // Attempt numbers - update these values when you change files
  const htmlAttempt = 1;
  const cssAttempt = 1;
  const jsAttempt  = 1;

  // show them in UI
  const elHtmlAttempt = document.getElementById("htmlAttempt");
  const elCssAttempt  = document.getElementById("cssAttempt");
  const elJsAttempt   = document.getElementById("jsAttempt");
  if(elHtmlAttempt) elHtmlAttempt.textContent = htmlAttempt;
  if(elCssAttempt)  elCssAttempt.textContent = cssAttempt;
  if(elJsAttempt)   elJsAttempt.textContent = jsAttempt;

  // DOM refs
  const connectWalletBtn = document.getElementById("connectWalletBtn");
  const walletStatus = document.getElementById("walletStatus");
  const joinArea = document.getElementById("join-area");
  const joinQuizBtn = document.getElementById("joinQuizBtn");
  const discordNameInput = document.getElementById("discordName");
  const joinStatus = document.getElementById("joinStatus");
  const quizArea = document.getElementById("quiz-area");
  const quizDiv = document.getElementById("quiz");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitQuizBtn = document.getElementById("submitQuizBtn");
  const leaderboardArea = document.getElementById("leaderboard-area");
  const leaderboardList = document.getElementById("leaderboard");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminPassInput = document.getElementById("adminPass");
  const adminPanel = document.getElementById("adminPanel");

  // Contract config (update to your deployed contract)
  const CONTRACT_ADDRESS = "0x2779529ca08560a7b977a92879bdd141b2e35ae9";
  const CONTRACT_ABI = [
    "function submitScore(uint256 score, string discordName) public payable",
    "function getLeaderboard() public view returns (string[] memory names, uint256[] memory scores)",
    "function entryFee() public view returns (uint256)"
  ];

  // Quiz questions (you can edit via admin later)
  let quizQuestions = [
    { q: "Is GoKite.ai free to use?", options: ["Yes","No","Not sure","Later"], correct: 0 },
    { q: "Does GoKite use blockchain?", options: ["Yes","No","Maybe","Later"], correct: 0 },
    { q: "Can users earn tokens?", options: ["Yes","No","Maybe","Later"], correct: 0 },
    { q: "Is Discord required?", options: ["Yes","No","Optional","Later"], correct: 0 },
    { q: "Can leaderboard show Discord names?", options: ["Yes","No","Email","Name"], correct: 0 },
    { q: "Is this testnet only?", options: ["Yes","No","Both","Later"], correct: 0 },
    { q: "Do admins control points?", options: ["Yes","No","Some","Later"], correct: 0 },
    { q: "Can questions change weekly?", options: ["Yes","No","Monthly","Later"], correct: 0 },
    { q: "Does it support many wallets?", options: ["Yes","No","Some","Later"], correct: 0 },
    { q: "Is the UI responsive?", options: ["Yes","No","Sometimes","Later"], correct: 0 }
  ];

  // State
  let provider = null;
  let signer = null;
  let contract = null;
  let userAddress = null;
  let currentSlide = 0;
  const adminSecret = "PRASAD_ADMIN_713"; // change this to your secret

  // --- Utility ---
  function setWalletStatus(txt){ if(walletStatus) walletStatus.textContent = txt; }
  function qEl(text){ const p=document.createElement('p'); p.textContent=text; return p; }

  // --- Connect Wallet (keeps as your stable working flow) ---
  connectWalletBtn.addEventListener("click", async () => {
    try {
      if(!window.ethereum) {
        alert("No injected wallet detected. Install MetaMask or a compatible wallet.");
        return;
      }

      // Support multiple injected providers
      let chosenProvider = window.ethereum;
      if(Array.isArray(window.ethereum.providers)){
        // prefer MetaMask if available
        const mm = window.ethereum.providers.find(p => p.isMetaMask);
        if(mm) chosenProvider = mm;
        else chosenProvider = window.ethereum.providers[0];
      }

      // request accounts
      await chosenProvider.request({ method: "eth_requestAccounts" });

      // create ethers provider
      provider = new ethers.providers.Web3Provider(chosenProvider, "any");
      signer = provider.getSigner();
      userAddress = await signer.getAddress();

      // init contract instance
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setWalletStatus(`✅ Connected: ${userAddress}`);
      // show join area
      if(joinArea) joinArea.classList.remove("hidden");

      // Try to load leaderboard (if contract supports)
      try{ await loadLeaderboard(); }catch(e){ console.log("Leaderboard load:", e); }

      // attach listeners to handle account/chain changes
      if(typeof chosenProvider.on === "function"){
        chosenProvider.on("accountsChanged", (accounts) => {
          if(!accounts || accounts.length === 0){
            setWalletStatus("Wallet disconnected");
            if(joinArea) joinArea.classList.add("hidden");
          } else {
            userAddress = accounts[0];
            setWalletStatus(`✅ Connected: ${userAddress}`);
          }
        });
        chosenProvider.on("chainChanged", () => { window.location.reload(); });
      }

    } catch (err) {
      console.error("Connect failed:", err);
      setWalletStatus("❌ Connect failed — check console");
      alert("Wallet connection failed. See console for details.");
    }
  });

  // --- Join: pay entry fee and allow quiz ---
  joinQuizBtn.addEventListener("click", async () => {
    const discord = (discordNameInput && discordNameInput.value) ? discordNameInput.value.trim() : "";
    if(!discord) { alert("Enter Discord name (visible on leaderboard)"); return; }
    if(!contract) { alert("Not connected to contract."); return; }

    try {
      setWalletStatus("⏳ Waiting for entryFee...");
      const fee = await contract.entryFee();
      setWalletStatus(`⏳ Sending tx with entryFee ${ethers.utils.formatEther(fee)}...`);
      const tx = await contract.submitScore(0, discord, { value: fee });
      await tx.wait();
      setWalletStatus("✅ Joined (entry fee paid). Quiz unlocked.");
      // show quiz area
      if(quizArea) quizArea.classList.remove("hidden");
      renderQuiz();
      showSlide(0);
    } catch (err) {
      console.error("Join failed:", err);
      alert("Join failed: " + (err?.message || err));
      setWalletStatus("❌ Join failed — check console");
    }
  });

  // --- QUIZ rendering & flow ---
  function renderQuiz(){
    if(!quizDiv) return;
    quizDiv.innerHTML = "";
    quizQuestions.forEach((q, i) => {
      const slide = document.createElement("div");
      slide.className = "slide";
      slide.id = `slide-${i}`;
      const title = document.createElement("h3");
      title.textContent = `Q${i+1}: ${q.q}`;
      slide.appendChild(title);
      q.options.forEach((opt, idx) => {
        const label = document.createElement("label");
        label.style.display = "block";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `q${i}`;
        radio.value = idx;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(" " + opt));
        slide.appendChild(label);
      });
      quizDiv.appendChild(slide);
    });
  }

  function showSlide(n){
    const slides = document.querySelectorAll(".slide");
    if(slides.length === 0) return;
    if(n < 0) n = 0;
    if(n >= slides.length) n = slides.length - 1;
    slides.forEach(s => s.classList.remove("active-slide"));
    slides[n].classList.add("active-slide");
    currentSlide = n;
    prevBtn.classList.toggle("hidden", n === 0);
    nextBtn.classList.toggle("hidden", n === slides.length - 1);
    submitQuizBtn.classList.toggle("hidden", n !== slides.length - 1);
  }

  prevBtn.addEventListener("click", () => showSlide(currentSlide - 1));
  nextBtn.addEventListener("click", () => showSlide(currentSlide + 1));

  // Submit quiz: compute score and send to chain (no extra fee)
  submitQuizBtn.addEventListener("click", async () => {
    let score = 0;
    quizQuestions.forEach((q, i) => {
      const sel = document.querySelector(`input[name=q${i}]:checked`);
      if(sel && parseInt(sel.value) === q.correct) score++;
      else score--; // wrong => -1 as requested
    });
    const discord = (discordNameInput && discordNameInput.value) ? discordNameInput.value.trim() : "";
    if(!discord) return alert("Discord name missing.");
    try {
      setWalletStatus("⏳ Submitting score...");
      const tx = await contract.submitScore(score, discord, { value: 0 });
      await tx.wait();
      setWalletStatus(`✅ Score ${score} submitted`);
      await loadLeaderboard();
      // show leaderboard
      if(leaderboardArea) leaderboardArea.classList.remove("hidden");
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Submit failed: " + (err?.message || err));
      setWalletStatus("❌ Submit failed");
    }
  });

  // --- load leaderboard from contract ---
  async function loadLeaderboard(){
    if(!contract) throw new Error("Contract not initialized");
    try {
      const res = await contract.getLeaderboard();
      const names = res[0] || [];
      const scores = res[1] || [];
      leaderboardList.innerHTML = "";
      for(let i=0;i<Math.min(names.length, 100); i++){
        const li = document.createElement("li");
        li.textContent = `${i+1}. ${names[i]} — ${scores[i]} pts`;
        leaderboardList.appendChild(li);
      }
    } catch (err) {
      console.error("loadLeaderboard error", err);
      throw err;
    }
  }

  // --- Admin login (local secret) ---
  adminLoginBtn.addEventListener("click", () => {
    const val = adminPassInput.value;
    if(val === adminSecret){
      adminPanel.classList.remove("hidden");
      alert("Admin unlocked");
    } else {
      alert("Wrong admin password");
    }
  });

  // --- initial UI state ---
  setWalletStatus("Wallet not connected");
  if(joinArea) joinArea.classList.add("hidden");
  if(quizArea) quizArea.classList.add("hidden");
  if(leaderboardArea) leaderboardArea.classList.add("hidden");
});
