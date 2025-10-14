window.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.getElementById('connectBtn');
  const walletStatus = document.getElementById('walletStatus');
  const walletInfo = document.getElementById('walletInfo');

  let provider;
  let signer;

  // ✅ Wait for wallet injection (fixes first-click problem)
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
        reject(new Error("No wallet detected"));
      }, timeout);
    });
  }

  // ✅ Connect wallet
  async function connectWallet() {
    try {
      walletStatus.textContent = "⏳ Detecting wallet...";
      const eth = await waitForEthereum();

      if (!eth) {
        walletStatus.textContent = "❌ No wallet found. Install MetaMask or Nightly.";
        return;
      }

      // Handle multiple providers (MetaMask + others)
      const providerObj = Array.isArray(eth.providers)
        ? eth.providers.find(p => p.isMetaMask) || eth.providers[0]
        : eth;

      provider = new ethers.providers.Web3Provider(providerObj, "any");

      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();

      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      walletStatus.textContent = "✅ Connected";
      walletInfo.innerHTML = `
        <b>Address:</b> ${address}<br>
        <b>Network:</b> ${network.name} (${network.chainId})
      `;

      connectBtn.disabled = true;

      // 🧩 Add listeners for dynamic updates
      providerObj.on("accountsChanged", () => window.location.reload());
      providerObj.on("chainChanged", () => window.location.reload());
    } catch (err) {
      console.error("❌ Wallet connection failed:", err);
      walletStatus.textContent = "❌ Failed: " + (err.message || "Unknown error");
    }
  }

  connectBtn.addEventListener("click", connectWallet);
});
