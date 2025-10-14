// Attempt version
document.getElementById("jsAttempt").innerText = "1"; // JS Attempt 1

// Wait until Ethers loads
if (typeof ethers === "undefined") {
  alert("Ethers not loaded, please refresh the page!");
  throw new Error("Ethers.js not loaded!");
}

let provider, signer, userAddress, contract;

const contractAddress = "0x2779529ca08560a7b977a92879bdd141b2e35ae9";
const contractABI = [
  "function submitScore(uint256 score, string discordName) public payable",
  "function getLeaderboard() public view returns (string[] memory names, uint256[] memory scores)",
  "function entryFee() public view returns (uint256)"
];

const quizQuestions = [
  { q: "Is GoKite.ai free to use?", options: ["Yes", "No"], correct: 0 },
  { q: "Does GoKite use blockchain?", options: ["Yes", "No"], correct: 0 },
  { q: "Can users earn tokens?", options: ["Yes", "No"], correct: 0 },
  { q: "Is Discord required?", options: ["Yes", "No"], correct: 0 },
  { q: "Can leaderboard show Discord names?", options: ["Yes", "No"], correct: 0 }
];

let currentSlide = 0;

// ✅ Wallet Connect
document.getElementById("connectWallet").addEventListener("click", async () => {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    document.getElementById("walletStatus").innerText = `Connected: ${userAddress}`;
    document.getElementById("wallet-container").classList.add("hidden");
    document.getElementById("discord-container").classList.remove("hidden");
    contract = new ethers.Contract(contractAddress, contractABI, signer);
  } else {
    alert("No wallet detected!");
  }
});

// ✅ Pay fee and start quiz
document.getElementById("payFeeBtn").addEventListener("click", async () => {
  const discord = document.getElementById("discordName").value;
  if (!discord) return alert("Enter Discord Name");

  try {
    const fee = await contract.entryFee();
    const tx = await contract.submitScore(0, discord, { value: fee });
    await tx.wait();
    alert("Fee paid! Quiz starting...");
    document.getElementById("discord-container").classList.add("hidden");
    document.getElementById("quiz-container").classList.remove("hidden");
    showSlide(0);
  } catch (err) {
    console.error(err);
    alert("Payment failed or insufficient balance.");
  }
});

// ✅ Quiz setup
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

// ✅ Submit Quiz
document.getElementById("submitQuiz").addEventListener("click", async () => {
  let score = 0;
  quizQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name=q${i}]:checked`);
    if (selected && parseInt(selected.value) === q.correct) score++;
  });

  const discord = document.getElementById("discordName").value;
  try {
    const tx = await contract.submitScore(score, discord, { value: 0 });
    await tx.wait();
    alert("Quiz submitted successfully!");
    document.getElementById("quiz-container").classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Error submitting quiz");
  }
});
