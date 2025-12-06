# Aequitas-R: The Resilient Decentralized Dark Pool

![Aequitas-R Logo](./path/to/Gemini_Generated_Image_zhk8rkzhk8rkzhk8.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.19-363636)]()
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)]()
[![Framework](https://img.shields.io/badge/Framework-Next.js-black)]()

**Aequitas-R** is a next-generation decentralized exchange (DEX) designed to solve the critical vulnerabilities of traditional "Lit Pools": MEV extraction, front-running, and irreversible smart contract exploits. By combining **encrypted batch execution** with a novel **partial finality state machine**, Aequitas-R ensures that trade ordering is mathematically fair and that protocol invariants are enforced before funds are permanently unlocked.

---

## 📑 Table of Contents

- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
- [Core Features](#core-features)
- [Technical Mechanisms](#technical-mechanisms)
  - [The Dark Pool (Privacy)](#the-dark-pool-privacy)
  - [The Safety Valve (Oracles)](#the-safety-valve-oracles)
  - [The Undo Button (Reversibility)](#the-undo-button-reversibility)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Executive Summary

Standard AMMs broadcast trade intent to the mempool, allowing predatory actors to extract value via front-running and sandwich attacks. Aequitas-R utilizes **Threshold Encryption** to hide order details until a batch is closed.

Once closed, a **Solver** calculates a Uniform Clearing Price (UCP) off-chain. This solution is verified on-chain against a **Medianized Oracle**. If the price is valid, funds are moved to a **Reversible Vault** (Ghost Tokens), where they remain challengeable for a specific window before final settlement. This architecture transforms the standard "Trust Code" paradigm into a "Verify, then Finalize" model.

---

## System Architecture

The Aequitas-R protocol operates via a cyclical interaction between the Frontend (User/Sentinel), the Off-chain Solver Node, and the On-chain EVM Contracts.

![Aequitas-R Architecture Diagram](./path/to/Gemini_Generated_Image_vgbzj0vgbzj0vgbz.png)

### The Workflow
1.  **Submission:** Traders submit encrypted orders via the **Trader Dashboard**.
2.  **Aggregation:** Orders enter the Mempool. The content (price/size) is invisible to validators.
3.  **Solving:** Once the batch window closes, the **Solver Node** (Python) decrypts the batch, calculates the clearing price, and submits a settlement proof.
4.  **Verification:** The **AequitasCore** contract checks the proof against the **Medianizer Oracle**.
5.  **Partial Finality:** If valid, the state updates. Users receive "Ghost Tokens" in the **ReversibleVault**.
6.  **Finalization:** After a dispute window (e.g., 24 hours or 2 minutes), the state finalizes, and tokens become withdrawable.

---

## Core Features

| Feature | Description |
| :--- | :--- |
| **🛡️ MEV Resistance** | Orders are encrypted until execution. Front-running is mathematically impossible because the order content is unknown. |
| **⚖️ Uniform Clearing** | All orders in a batch clear at the same price (UCP). No user is penalized for their position within the block. |
| **↩️ Reversible Settlement** | Funds enter a "Ghost State" before unlocking. Governance or Sentinels can revert a batch if a bug or exploit is detected. |
| **👁️ Sentinel Dashboard** | A "God View" admin interface allowing auditors to monitor batch health, simulate oracle failures, and trigger disputes. |
| **🤖 Hybrid Architecture** | Offloads complex computation (matching logic) to Python solvers while keeping settlement and verification trustless on-chain. |

---

## Technical Mechanisms

### The Dark Pool (Privacy)
Aequitas-R utilizes a `MockShutter` contract (simulating Shutter Network) to handle encryption.
* **User Action:** Signs an order `(Token A -> Token B)`.
* **System Action:** Encrypts the payload. The transaction is mined, but the data is effectively "noise" to observers.
* **Decryption:** Only occurs *after* the batch window is closed and no new orders can be added.

### The Safety Valve (Oracles)
To prevent a malicious solver from settling trades at bad prices:
* **Medianizer Oracle:** Aggregates feeds from Chainlink, Pyth, and Uniswap TWAP.
* **Invariant Check:** The smart contract calculates the median of these feeds. If the Solver's proposed price deviates by more than `5%` (configurable) from the median, the batch is **auto-rejected**.

### The Undo Button (Reversibility)
Based on the ERC-20R and Opt-In Reversibility standards:
1.  **Proposed State:** Balance is updated, but tokens are `locked`.
2.  **Challenge Window:** A countdown timer starts.
3.  **Dispute:** If a Sentinel calls `revertState()` with valid proof of fraud, the batch is rolled back.
4.  **Finalized:** Timer ends -> `locked` balance moves to `available` balance.

---

## Repository Layout

This is a monorepo containing the full stack of the protocol.

```
root/
├── packages/
│   ├── hardhat/           # EVM Smart Contracts & Deployment Scripts
│   │   ├── contracts/     # Solidity Source Code
│   │   ├── deploy/        # Deployment configurations
│   │   └── scripts/       # Keeper/Orchestrator scripts
│   ├── nextjs/            # Frontend (Trader & Sentinel Dashboards)
│   │   ├── app/           # Next.js 14 App Router
│   │   └── components/    # UI Components
│   └── solver/            # Off-chain Python Computation Node
│       ├── solver.py      # Main logic: Decrypt -> Solve -> Transact
│       └── requirements.txt
├── README.md              # Documentation
└── yarn.lock              # Dependency Lockfile
````

-----

## Getting Started

### Prerequisites

  * **Node.js** v18+
  * **Yarn** or **NPM**
  * **Python** 3.10+ (for the Solver)
  * **Git**

### Installation

1.  **Clone the repository**

    ```bash
    git clone [https://github.com/Raakshass/Aequitas-R.git](https://github.com/Raakshass/Aequitas-R.git)
    cd Aequitas-R
    ```

2.  **Install JavaScript Dependencies**

    ```bash
    yarn install
    ```

3.  **Setup Python Environment (Solver)**

    ```bash
    cd packages/solver
    python -m venv .venv
    source .venv/bin/activate  # or .venv\Scripts\activate on Windows
    pip install -r requirements.txt
    ```

### Environment Variables

Create a `.env.local` file in `packages/nextjs/` and a `.env` in `packages/hardhat/`.

**`packages/nextjs/.env.local`**

```env
# Alchemy or Infura Provider
NEXT_PUBLIC_ALCHEMY_API_KEY=your_api_key
# Wallet Connect Project ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_id
# Deployed Contract Addresses (Autofilled by scaffold-eth usually)
```

**`packages/solver/.env` (or set in shell)**

```env
DEPLOYER_PRIVATE_KEY=0x_your_private_key_here
RPC_URL=[https://eth-sepolia.g.alchemy.com/v2/your_key](https://eth-sepolia.g.alchemy.com/v2/your_key)
```

-----

## Running Locally

### 1\. Start the Local Blockchain

In the first terminal:

```bash
cd packages/hardhat
yarn chain
```

### 2\. Deploy Contracts

In a second terminal:

```bash
cd packages/hardhat
yarn deploy
```

### 3\. Start the Frontend

In a third terminal:

```bash
cd packages/nextjs
yarn dev
```

Visit `http://localhost:3000` to view the dashboards.

### 4\. Run the Keeper/Solver Loop

To simulate the passage of time and process batches automatically:

```bash
cd packages/hardhat
yarn keeper:local
```

*This script will watch the blockchain, trigger the Python solver when a batch closes, and submit the settlement transactions.*

-----

## Deployment

### Frontend (Vercel)

The `packages/nextjs` folder is configured for immediate deployment on Vercel. Ensure you add the environment variables in the Vercel dashboard.

### Backend/Keeper (Render/Railway)

The Keeper script (`packages/hardhat/scripts/keeper_full_loop.js`) and the Solver (`packages/solver/`) should be deployed as a **Background Worker**.

  * **Build Command:** `yarn install`
  * **Start Command:** `cd packages/hardhat && npx hardhat run scripts/keeper_full_loop.js --network sepolia`

-----

## Contributing

We welcome contributions to the Core Contracts, Solver Logic, and UI.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

-----

## License

Distributed under the MIT License. See `LICENSE` for more information.

-----

*Built with ❤️ for the Future of Decentralized Finance.*

```

### Instructions for adding the images:
1.  Create a folder in your repository named `assets` or `docs/images`.
2.  Place the two images you uploaded (`Gemini_Generated_Image_vgbzj0vgbzj0vgbz.png` and `Gemini_Generated_Image_zhk8rkzhk8rkzhk8.png`) into that folder.
3.  Rename them to something simpler, e.g., `architecture-diagram.png` and `project-logo.png`.
4.  Update the `![Alt Text](path/to/...)` links in the README code block above to point to those specific files.
