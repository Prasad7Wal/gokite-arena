// Smart contract address and ABI
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
const contractABI = [
  "function joinArena() public",
  "function updateScore(uint256 score, string discord) public",
  "function topPlayers() public view returns (string[] memory, uint256[] memory)",
  "function setQuestions(string[] memory questions, string[] memory answers) public",
  "function adminUpdateScore(string memory discord, int256 newScore) public"
];

// KiteAI Testnet (chainId 2368) network data
const chainData = {
  chainId: "0x940",
  chainName: "KiteAI Testnet",
  nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 },
  rpcUrls: ["https://rpc-testnet.gokite.ai"],
  blockExplorerUrls: ["https://testnet.kitescan.ai"]
};

// Ethers provider and contract instances
let provider, signer, contract;
// Read-only provider for leaderboard (no wallet needed)
const readProvider = new ethers.JsonRpcProvider(chainData.rpcUrls[0]);
const readContract = new ethers.Contract(contractAddress, contractABI, readProvider);

// Sample quiz questions (can be edited by admin)
let questions = [
  { q: "What is 2+2?", options: ["3", "4", "5", "6"], answer: 1 },
  { q: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], answer: 1 },
  { q: "What is the capital of France?", options: ["Rome", "Berlin", "Paris", "Madrid"], answer: 2 },
  { q: "What does HTML stand for?", options: ["Hyperlinks and Text Markup", "Home Tool Markup", "Hyper Text Markup Language", "Hyper Text Marketing Language"], answer: 2 },
  { q: "Who wrote 'Hamlet'?", options: ["Charles Dickens", "William Shakespeare", "Mark Twain", "J.K. Rowling"], answer: 1 },
  { q: "What is the boiling point of water?", options: ["90°C", "80°C", "100°C", "120°C"], answer: 2 },
  { q: "Which is the largest mammal?", options: ["Elephant", "Blue Whale", "Giraffe", "Rhino"], answer: 1 },
  { q: "Which element has the chemical symbol 'O'?", options: ["Gold", "Oxygen", "Silver", "Iron"], answer: 1 },
  { q: "Who painted the Mona Lisa?", options: ["Pablo Picasso", "Leonardo da Vinci", "Vincent van Gogh", "Claude Monet"], answer: 1 },
  { q: "What year did Apollo 11 land on the moon?", options: ["1965", "1969", "1972", "1959"], answer: 1 }
];

// Admin password (demo only; in real app use secure auth)
const adminPassword = "quizMaster123";

// On page load: generate quiz UI and load leaderboard
window.addEventListener('load', async () => {
  if (typeof window.ethereum === 'undefined') {
    alert("MetaMask (or compatible wallet) is not installed.");
    return;
  }
  generateQuiz();
  loadLeaderboard();
});

// Generate quiz questions into the DOM
function generateQuiz() {
  const quizSection = document.getElementById("quiz-section");
  quizSection.innerHTML = "";
  questions.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "question";
    let html = `<p><strong>${index+1}. ${item.q}</strong></p>`;
    item.options.forEach((opt, i) => {
      html += `<label><input type="radio" name="q${index}" value="${i}"> ${opt}</label><br>`;
    });
    div.innerHTML = html;
    quizSection.appendChild(div);
  });
}

// Load and display the leaderboard from the contract
async function loadLeaderboard() {
  try {
    const [names, scores] = await readContract.topPlayers();
    const table = document.getElementById("leaderboardTable");
    table.innerHTML = "<tr><th>Rank</th><th>Discord</th><th>Score</th></tr>";
    for (let i = 0; i < names.length; i++) {
      const row = table.insertRow();
      row.insertCell(0).innerText = i+1;
      row.insertCell(1).innerText = names[i];
      row.insertCell(2).innerText = scores[i].toString();
    }
  } catch (err) {
    console.error("Error loading leaderboard:", err);
  }
}

// Connect wallet and ensure correct network
document.getElementById("connectButton").addEventListener('click', async () => {
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    // Switch to KiteAI Testnet if needed
    const net = await provider.getNetwork();
    if (net.chainId !== parseInt(chainData.chainId, 16)) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainData.chainId }]});
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [chainData] });
        } else {
          throw switchError;
        }
      }
    }
    contract = new ethers.Contract(contractAddress, contractABI, signer);
    const userAddr = await signer.getAddress();
    document.getElementById("walletAddress").innerText = "Connected: " + userAddr;
    document.getElementById("connectButton").disabled = true;
    document.getElementById("joinButton").disabled = false;
    document.getElementById("discordName").disabled = false;
    document.getElementById("submitScoreButton").disabled = false;
  } catch (err) {
    console.error(err);
    alert("Wallet connection failed: " + err.message);
  }
});

// Join the arena (on-chain transaction)
document.getElementById("joinButton").addEventListener('click', async () => {
  try {
    const tx = await contract.joinArena();
    await tx.wait();
    alert("Successfully joined the arena!");
    document.getElementById("joinButton").disabled = true;
  } catch (err) {
    console.error(err);
    alert("joinArena() failed: " + err.message);
  }
});

// Submit quiz score (calculates +1 for correct, -1 for wrong)
document.getElementById("submitScoreButton").addEventListener('click', async () => {
  const discord = document.getElementById("discordName").value.trim();
  if (!discord) {
    alert("Enter your Discord username before submitting.");
    return;
  }
  // Calculate score
  let score = 0;
  questions.forEach((item, idx) => {
    const sel = document.querySelector(`input[name="q${idx}"]:checked`);
    if (sel) {
      if (parseInt(sel.value) === item.answer) score += 1;
      else score -= 1;
    }
  });
  try {
    const tx = await contract.updateScore(score, discord);
    await tx.wait();
    alert(`Your score (${score}) has been recorded!`);
    loadLeaderboard();
  } catch (err) {
    console.error(err);
    alert("updateScore() failed: " + err.message);
  }
});

// Admin login: reveals admin panel if password is correct
document.getElementById("adminButton").addEventListener('click', () => {
  const pwd = prompt("Enter admin password:");
  if (pwd === adminPassword) {
    document.getElementById("adminPanel").style.display = "block";
    // Populate question editor fields
    const editor = document.getElementById("questionEditor");
    editor.innerHTML = "";
    questions.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "question-edit";
      div.innerHTML = `
        <h4>Question ${idx+1}</h4>
        <input type="text" class="edit-question" value="${item.q}" placeholder="Question text"><br>
        <input type="text" class="edit-option" value="${item.options[0]}" placeholder="Option A"><br>
        <input type="text" class="edit-option" value="${item.options[1]}" placeholder="Option B"><br>
        <input type="text" class="edit-option" value="${item.options[2]}" placeholder="Option C"><br>
        <input type="text" class="edit-option" value="${item.options[3]}" placeholder="Option D"><br>
        <input type="number" min="0" max="3" class="edit-answer" value="${item.answer}" placeholder="Correct index (0-3)"><br><br>
      `;
      editor.appendChild(div);
    });
  } else {
    alert("Incorrect password.");
  }
});

// Save edited questions (updates in-memory quiz)
document.getElementById("saveQuestionsButton").addEventListener('click', () => {
  const editor = document.getElementById("questionEditor");
  const edits = editor.querySelectorAll(".question-edit");
  const newQs = [];
  edits.forEach(div => {
    const qtext = div.querySelector(".edit-question").value;
    const opts = [
      div.querySelectorAll(".edit-option")[0].value,
      div.querySelectorAll(".edit-option")[1].value,
      div.querySelectorAll(".edit-option")[2].value,
      div.querySelectorAll(".edit-option")[3].value
    ];
    const ans = parseInt(div.querySelector(".edit-answer").value);
    newQs.push({ q: qtext, options: opts, answer: ans });
  });
  questions = newQs;
  generateQuiz();
  alert("Questions updated (locally).");
  // If contract supports setQuestions, we could call it here:
  // try { 
  //   const tx = await contract.setQuestions(questions.map(q=>q.q), questions.map(q=>JSON.stringify(q.options)));
  //   await tx.wait();
  // } catch(e) { console.error("setQuestions on-chain failed", e); }
});

// Admin updates a user score manually on-chain
document.getElementById("adminUpdateScoreButton").addEventListener('click', async () => {
  const discord = document.getElementById("adminDiscord").value.trim();
  const newScore = parseInt(document.getElementById("adminScore").value);
  if (!discord || isNaN(newScore)) {
    alert("Enter valid Discord name and score.");
    return;
  }
  try {
    const tx = await contract.adminUpdateScore(discord, newScore);
    await tx.wait();
    alert("Score updated on-chain for user " + discord);
    loadLeaderboard();
  } catch (err) {
    console.error(err);
    alert("adminUpdateScore() failed: " + err.message);
  }
});

// Refresh page on account or network change for simplicity
if (window.ethereum) {
  window.ethereum.on('chainChanged', () => window.location.reload());
  window.ethereum.on('accountsChanged', () => window.location.reload());
}
