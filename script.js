let provider;
let signer;
let userAddress;
let contract;

// Your contract info
const contractAddress = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1";
const contractABI = [
  // Minimal ABI for demonstration
  "function submitScore(uint256 score, string discordName) public",
  "function getLeaderboard() public view returns (string[] memory names, uint256[] memory scores)"
];

const quizQuestions = [
  { q: "Is GoKite.ai free to use?", options: ["Yes", "No"], correct: 0 },
  { q: "Does GoKite use blockchain?", options: ["Yes", "No"], correct: 0 },
  { q: "Can users earn tokens?", options: ["Yes", "No"], correct: 0 },
  { q: "Is Discord required?", options: ["Yes", "No"], correct: 0 },
  { q: "Can leaderboard show Discord names?", options: ["Yes", "No"], correct: 0 },
  { q: "Is this testnet only?", options: ["Yes", "No"], correct: 0 },
  { q: "Do admins control points?", options: ["Yes", "No"], correct: 0 },
  { q: "Can questions change weekly?", options: ["Yes", "No"], correct: 0 },
  { q: "Does it support any wallet?", options: ["Yes", "No"], correct: 0 },
  { q: "Is the UI responsive?", options: ["Yes", "No"], correct: 0 },
];

let currentSlide = 0;
let quizAnswers = [];

// Wallet connect
document.getElementById("connectWallet").addEventListener("click", async () => {
  if (window.ethereum) {
    try {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();
      document.getElementById("walletStatus").innerText = `Connected: ${userAddress}`;
      document.getElementById("wallet-container").classList.add("hidden");
      document.getElementById("discord-container").classList.remove("hidden");
      contract = new ethers.Contract(contractAddress, contractABI, signer);
    } catch (err) {
      console.error(err);
      alert("Wallet connection failed");
    }
  } else {
    alert("No Web3 wallet detected!");
  }
});

// Start quiz
document.getElementById("startQuiz").addEventListener("click", () => {
  const discord = document.getElementById("discordName").value;
  if (!discord) return alert("Enter Discord Name");
  document.getElementById("discord-container").classList.add("hidden");
  document.getElementById("quiz-container").classList.remove("hidden");
  showSlide(0);
});

// Generate quiz slides
const quizDiv = document.getElementById("quiz");
quizQuestions.forEach((q, i) => {
  const slide = document.createElement("div");
  slide.classList.add("slide");
  let optionsHTML = "";
  q.options.forEach((opt, idx) => {
    optionsHTML += `<label><input type="radio" name="q${i}" value="${idx}"> ${opt}</label><br>`;
  });
  slide.innerHTML = `<p>${q.q}</p>${optionsHTML}`;
  quizDiv.appendChild(slide);
});

function showSlide(n) {
  const slides = document.querySelectorAll(".slide");
  slides.forEach(s => s.classList.remove("active-slide"));
  slides[n].classList.add("active-slide");
  currentSlide = n;

  document.getElementById("prevBtn").style.display = n === 0 ? "none" : "inline-block";
  document.getElementById("nextBtn").style.display = n === slides.length - 1 ? "none" : "inline-block";
  document.getElementById("submitQuiz").style.display = n === slides.length - 1 ? "inline-block" : "none";
}

document.getElementById("prevBtn").addEventListener("click", () => showSlide(currentSlide - 1));
document.getElementById("nextBtn").addEventListener("click", () => showSlide(currentSlide + 1));

// Submit quiz
document.getElementById("submitQuiz").addEventListener("click", async () => {
  let score = 0;
  quizQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name=q${i}]:checked`);
    if (selected && parseInt(selected.value) === q.correct) score++;
  });

  const discord = document.getElementById("discordName").value;
  try {
    const tx = await contract.submitScore(score, discord);
    await tx.wait();
    alert("Quiz submitted successfully!");
    loadLeaderboard();
    document.getElementById("quiz-container").classList.add("hidden");
    document.getElementById("leaderboard-container").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("Error submitting quiz to blockchain");
  }
});

// Load leaderboard
async function loadLeaderboard() {
  try {
    const [names, scores] = await contract.getLeaderboard();
    const lb = document.getElementById("leaderboard");
    lb.innerHTML = "";
    for (let i = 0; i < names.length; i++) {
      const li = document.createElement("li");
      li.innerText = `${names[i]} - ${scores[i]} points`;
      lb.appendChild(li);
    }
  } catch (err) {
    console.error(err);
  }
}

// Admin login
document.getElementById("adminLoginBtn").addEventListener("click", () => {
  const pwd = document.getElementById("adminPassword").value;
  if (pwd === "YOUR_ADMIN_PASSWORD") {
    alert("Admin logged in! You can now manage questions and points.");
    // Implement admin controls here
  } else {
    alert("Incorrect password");
  }
});
