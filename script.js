(async () => {

    // --- CONTRACT CONFIG ---
    const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; 
    const abi = [
        "function joinArena() payable",
        "function updateScore(uint256 _score, string calldata _discord)",
        "function topPlayers() view returns (string[] memory, uint256[] memory)"
    ];

    // --- DOM ELEMENTS ---
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

    let provider, signer, contract;
    let userDiscord = "";
    let score = 0;
    let currentQuestion = 0;

    const quizQuestions = [
        { q: "What is GoKite AI?", a: ["Blockchain platform", "App", "Video codec", "Database"], correct: 0 },
        { q: "Token symbol used?", a: ["KITE","ETH","BTC","SOL"], correct: 0 },
        { q: "Wallet required?", a: ["Yes","No","Optional","Later"], correct: 0 },
        { q: "Quiz questions per round?", a: ["10","5","20","15"], correct: 0 },
        { q: "Points for correct?", a: ["1","2","5","0"], correct: 0 },
        { q: "Points for wrong?", a: ["-1","0","1","2"], correct: 0 },
        { q: "Leaderboard shows?", a: ["Discord","Wallet","Email","Name"], correct: 0 },
        { q: "Deposit amount?", a: ["0.01","0.1","1","0.001"], correct: 0 },
        { q: "Should wait for provider?", a: ["Yes","No","Sometimes","Never"], correct: 0 },
        { q: "Hosting free on GitHub Pages?", a: ["Yes","No","Only paid","Server needed"], correct: 0 }
    ];

    function setStatus(msg) { statusText.innerText = msg; }

    // --- WALLET CONNECT ---
    async function connectWallet() {
        try {
            if (!window.ethereum) throw new Error("MetaMask or compatible wallet not found!");
            provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            const account = await signer.getAddress();
            contract = new ethers.Contract(contractAddress, abi, signer);
            setStatus("Connected: " + account.slice(0,6) + "..." + account.slice(-4));
            connectBtn.disabled = true;
            joinBtn.disabled = false;

            // Listen for account/chain changes
            window.ethereum.on("accountsChanged", accounts => {
                if (accounts.length === 0) {
                    setStatus("Wallet locked");
                    connectBtn.disabled = false;
                    joinBtn.disabled = true;
                } else {
                    setStatus("Connected: " + accounts[0].slice(0,6) + "..." + accounts[0].slice(-4));
                }
            });
            window.ethereum.on("chainChanged", () => window.location.reload());

        } catch(err) {
            console.error(err);
            alert("Wallet connection failed: " + err.message);
            setStatus("Not connected");
        }
    }

    // --- JOIN ARENA ---
    async function joinArena() {
        try {
            if (!contract) return alert("Connect wallet first!");
            setStatus("Joining arena...");
            const tx = await contract.joinArena({ value: ethers.utils.parseEther("0.01") });
            await tx.wait();
            setStatus("🎉 Joined Arena! Enter Discord name to start quiz.");
            discordDiv.style.display = "block";
            joinBtn.disabled = true;
        } catch(e) {
            console.error(e);
            alert("Join failed: " + (e.reason || e.message || e));
            setStatus("Join arena failed");
        }
    }

    // --- QUIZ ---
    function startQuiz() {
        const name = discordInput.value.trim();
        if (!name) return alert("Enter Discord name!");
        userDiscord = name;
        score = 0;
        currentQuestion = 0;
        discordDiv.style.display = "none";
        quizDiv.style.display = "block";
        loadQuestion();
    }

    function loadQuestion() {
        if (currentQuestion >= quizQuestions.length) return finishQuiz();
        const q = quizQuestions[currentQuestion];
        questionText.textContent = `Q${currentQuestion+1}: ${q.q}`;
        answersDiv.innerHTML = "";
        q.a.forEach((ans, idx) => {
            const btn = document.createElement("button");
            btn.textContent = ans;
            btn.onclick = () => {
                if (idx === q.correct) score += 1;
                else score -= 1;
                currentQuestion++;
                loadQuestion();
            };
            answersDiv.appendChild(btn);
        });
    }

    // --- SUBMIT SCORE ---
    async function finishQuiz() {
        quizDiv.style.display = "none";
        setStatus("Submitting score...");
        try {
            const gas = await contract.estimateGas.updateScore(score, userDiscord);
            const tx = await contract.updateScore(score, userDiscord, { gasLimit: gas });
            await tx.wait();
            setStatus("✅ Score submitted!");
            await loadLeaderboard();
        } catch(e) {
            console.error(e);
            alert("Submit failed: " + (e.reason || e.message || e));
            setStatus("Score submission failed");
        }
    }

    // --- LEADERBOARD ---
    async function loadLeaderboard() {
        if (!contract) return;
        setStatus("Loading leaderboard...");
        try {
            const [names, scores] = await contract.topPlayers();
            leaderboardUl.innerHTML = "";
            for (let i = 0; i < Math.min(names.length, 100); i++) {
                const li = document.createElement("li");
                li.textContent = `${i+1}. ${names[i]} — ${scores[i]} pts`;
                leaderboardUl.appendChild(li);
            }
            setStatus("Leaderboard loaded");
        } catch(e) {
            console.error(e);
            setStatus("Leaderboard failed");
        }
    }

    // --- EVENT LISTENERS ---
    connectBtn.onclick = connectWallet;
    joinBtn.onclick = joinArena;
    saveDiscordBtn.onclick = startQuiz;

})();
