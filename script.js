window.addEventListener("DOMContentLoaded", () => {
  let provider, signer, userAddress, contract;
  const adminSecret = "PRASAD_ADMIN_713"; // 🔐 You can change this

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
    { q: "Can leaderboard show Discord names?", options: ["Yes", "No"], correct: 0 },
    { q: "Is this testnet only?", options: ["Yes", "No"], correct: 0 },
    { q: "Do admins control points?", options: ["Yes", "No"], correct: 0 },
    { q: "Can questions change weekly?", options: ["Yes", "No"], correct: 0 },
    { q: "Does it support any wallet?", options: ["Yes", "No"], correct: 0 },
    { q: "Is the UI responsive?", options: ["Yes", "No"], correct: 0 },
  ];

  let currentSlide = 0;

  const connectBtn = document.getElementById("connectWallet");
  const payFeeBtn = document.getElementById("payFeeBtn");
  const submitQuizBtn = document.getElementById("submitQuiz");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const adminLoginBtn = document.getElementById("adminLogin");

  connectBtn.addEventListener("click", async () => {
    if (window.ethereum) {
      try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        document.getElementById("walletStatus").innerText = `Connected: ${userAddress}`;
        document.getElementById("wallet-container").classList.add("hidden");
        document.getElementById("discord-container").classList.remove("hidden");
      } catch (err) {
        console.error(err);
        alert("Wallet connection failed.");
      }
    } else {
      alert("No wallet detected. Install MetaMask or Nightly Wallet.");
    }
  });

  payFeeBtn.addEventListener("click", async () => {
    const discord = document.getElementById("discordName").value;
    if (!discord) return alert("Enter your Discord name first.");

    try {
      const fee = await contract.entryFee();
      const tx = await contract.submitScore(0, discord, { value: fee });
      await tx.wait();
      alert("Entry fee paid! Quiz unlocked.");
      document.getElementById("discord-container").classList.add("hidden");
      document.getElementById("quiz-container").classList.remove("hidden");
      showSlide(0);
    } catch (err) {
      console.error(err);
      alert("Payment failed or rejected.");
    }
  });

  // Generate quiz
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
    prevBtn.style.display = n === 0 ? "none" : "inline-block";
    nextBtn.style.display = n === slides.length - 1 ? "none" : "inline-block";
    submitQuizBtn.style.display = n === slides.length - 1 ? "inline-block" : "none";
  }

  prevBtn.addEventListener("click", () => showSlide(currentSlide - 1));
  nextBtn.addEventListener("click", () => showSlide(currentSlide + 1));

  submitQuizBtn.addEventListener("click", async () => {
    let score = 0;
    quizQuestions.forEach((q, i) => {
      const selected = document.querySelector(`input[name=q${i}]:checked`);
      if (selected && parseInt(selected.value) === q.correct) score++;
    });

    const discord = document.getElementById("discordName").value;
    try {
      const tx = await contract.submitScore(score, discord, { value: 0 });
      await tx.wait();
      alert(`Quiz submitted! Score: ${score}`);
      loadLeaderboard();
      document.getElementById("quiz-container").classList.add("hidden");
      document.getElementById("leaderboard-container").classList.remove("hidden");
    } catch (err) {
      console.error(err);
      alert("Error submitting quiz.");
    }
  });

  async function loadLeaderboard() {
    try {
      const [names, scores] = await contract.getLeaderboard();
      const board = document.getElementById("leaderboard");
      board.innerHTML = "";
      names.forEach((n, i) => {
        const li = document.createElement("li");
        li.textContent = `${n}: ${scores[i]} pts`;
        board.appendChild(li);
      });
    } catch (err) {
      console.error("Leaderboard load failed:", err);
    }
  }

  adminLoginBtn.addEventListener("click", () => {
    const pass = document.getElementById("adminPass").value;
    if (pass === adminSecret) {
      alert("✅ Admin access granted!");
      document.getElementById("adminPanel").classList.remove("hidden");
    } else {
      alert("❌ Wrong password!");
    }
  });
});
