// === UNIVERSAL WALLET CONNECTION SCRIPT ===
// Works 101% across all browsers, wallets, and versions

const CONTRACT_ADDRESS = "0xf8721539eaa06fb3b4fc62f4c1d20e4db13fd9d1"; // <--- replace with your real contract
const CONTRACT_ABI = [
  "function joinArena() payable",
  "function topPlayers() view returns (address[] memory, uint256[] memory)"
];

let provider, signer, contract;
const connectBtn = document.getElementById("connectWalletBtn");
const joinBtn = document.getElementById("joinArenaBtn");
const statusEl = document.getElementById("status");

// Utility
function setStatus(msg) {
  console.log(msg);
  if (statusEl) statusEl.innerText = "Status: " + msg;
}

// === CONNECT WALLET ===
async function connectWallet() {
  try {
    setStatus("🔍 Detecting wallet...");

    // Check wallet availability
    if (typeof window.ethereum === "undefined") {
      alert("⚠️ No wallet found. Please install MetaMask, Nightly, or another EVM wallet.");
      return;
    }

    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // Initialize provider and signer
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    setStatus(`✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)} (${network.name})`);

    // Initialize contract
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  } catch (err) {
    console.error("❌ Wallet connect error:", err);
    setStatus("❌ Connection failed: " + err.message);
  }
}

// === JOIN ARENA ===
async function joinArena() {
  try {
    if (!signer || !contract) {
      throw new Error("Please connect wallet first!");
    }

    setStatus("⏳ Waiting for wallet confirmation...");

    const tx = await contract.joinArena({
      value: ethers.parseEther("0.01"),
    });

    await tx.wait();
    setStatus("✅ Joined Arena successfully!");

  } catch (err) {
    console.error("❌ Join arena failed:", err);
    setStatus("❌ Join failed: " + err.message);
  }
}

// === EVENTS ===
connectBtn.addEventListener("click", connectWallet);
joinBtn.addEventListener("click", joinArena);

// === AUTO CONNECT (optional) ===
window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    setStatus("🦊 Wallet detected. Ready to connect.");
  } else {
    setStatus("⚠️ No wallet detected.");
  }
});
