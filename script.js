// 🧩 GoKite Quiz - Script Attempt 1

const connectWalletBtn = document.getElementById("connectWalletBtn");
const joinQuizBtn = document.getElementById("joinQuizBtn");
const walletAddressDiv = document.getElementById("walletAddress");
const statusMessage = document.getElementById("statusMessage");

// Your deployed smart contract address:
const contractAddress = "0x2779529ca08560a7b977a92879bdd141b2e35ae9";

// Minimal ABI with joinQuiz
const contractABI = [
  "function joinQuiz() public payable",
  "function getEntryFee() public view returns (uint256)"
];

// Ensure ethers is loaded
if (typeof ethers === "undefined") {
  console.error("❌ Ethers not loaded. Check your HTML <script> order!");
  alert("Ethers not loaded, please refresh the page!");
}

// Connect Wallet
connectWalletBtn.addEventListener("click", async () => {
  if (!window.ethereum) {
    alert("Please install MetaMask or Nightly Wallet!");
    return;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const wallet = accounts[0];
    walletAddressDiv.textContent = `✅ Connected: ${wallet}`;
    joinQuizBtn.classList.remove("hidden");
    statusMessage.textContent = "Ready to join quiz!";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "❌ Wallet connection failed.";
  }
});

// Join Quiz
joinQuizBtn.addEventListener("click", async () => {
  if (!window.ethereum) {
    alert("Wallet not detected!");
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    const entryFee = await contract.getEntryFee();
    statusMessage.textContent = "⏳ Processing transaction...";

    const tx = await contract.joinQuiz({ value: entryFee });
    await tx.wait();

    statusMessage.textContent = "✅ Transaction successful! You joined the quiz!";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "❌ Transaction failed. Check console.";
  }
});
