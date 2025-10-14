const connectBtn = document.getElementById('connectBtn');
const walletStatus = document.getElementById('walletStatus');
const walletInfo = document.getElementById('walletInfo');

let provider;
let signer;

// ✅ Safe wait for any wallet to inject
async function waitForEthereum(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (window.ethereum) return resolve(window.ethereum);
    const interval = setInterval(() => {
      if (window.ethereum) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(window.ethereum);
      }
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Ethereum provider not found"));
    }, timeout);
  });
}

// ✅ Connect wallet safely
async function connectWallet() {
  try {
    walletStatus.textContent = "Connecting...";
    const eth = await waitForEthereum().catch(() => null);

    if (!eth) {
      walletStatus.textContent = "❌ No wallet found. Install MetaMask or Nightly.";
      return;
    }

    provider = new ethers.providers.Web3Provider(eth);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();

    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    walletStatus.textContent = `✅ Connected`;
    walletInfo.innerHTML = `
      Address: ${address}<br>
      Network: ${network.name} (${network.chainId})
    `;

    console.log("Connected:", address);
  } catch (err) {
    console.error("Wallet connect failed:", err);
    walletStatus.textContent = "❌ Connection failed. Check console.";
  }
}

connectBtn.addEventListener('click', connectWallet);

// ✅ Handle account/network changes
if (window.ethereum) {
  window.ethereum.on('accountsChanged', () => window.location.reload());
  window.ethereum.on('chainChanged', () => window.location.reload());
}
