// Wait until everything is loaded
window.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.getElementById('connectBtn');
  const walletStatus = document.getElementById('walletStatus');
  const walletInfo = document.getElementById('walletInfo');

  let provider;
  let signer;

  // ✅ Wait until any wallet injects `window.ethereum`
  async function waitForEthereum(timeout = 6000) {
    return new Promise((resolve, reject) => {
      if (window.ethereum) return resolve(window.ethereum);

      const check = setInterval(() => {
        if (window.ethereum) {
          clearInterval(check);
          clearTimeout(timer);
          resolve(window.ethereum);
        }
      }, 200);

      const timer = setTimeout(() => {
        clearInterval(check);
        reject(new Error("Ethereum provider not found"));
      }, timeout);
    });
  }

  // ✅ Connect wallet safely
  async function connectWallet() {
    try {
      walletStatus.textContent = "⏳ Connecting...";
      const eth = await waitForEthereum().catch(() => null);

      if (!eth) {
        walletStatus.textContent = "❌ No wallet detected. Install MetaMask or Nightly.";
        return;
      }

      provider = new ethers.providers.Web3Provider(eth);
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();

      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      walletStatus.textContent = "✅ Connected";
      walletInfo.innerHTML = `
        <b>Address:</b> ${address}<br>
        <b>Network:</b> ${network.name} (${network.chainId})
      `;

      console.log("Connected wallet:", address);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      walletStatus.textContent = "❌ Connection failed. See console.";
    }
  }

  connectBtn.addEventListener('click', connectWallet);

  // ✅ React to wallet events
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
  }
});
