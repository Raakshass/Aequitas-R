import os
import sys
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

# ==============================================================================
# --------- NETWORK & CONTRACT CONFIG (DYNAMIC) ---------
# ==============================================================================

# 1) Load Env Var from sibling directory: app/packages/nextjs/.env.local
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "../nextjs/.env.local")

print(f"📂 Loading env from: {os.path.abspath(env_path)}")
load_dotenv(env_path)

alchemy_key = os.getenv("NEXT_PUBLIC_ALCHEMY_API_KEY")
if not alchemy_key:
    print("❌ Error: NEXT_PUBLIC_ALCHEMY_API_KEY not found in .env.local")
    sys.exit(1)

DEPLOYER_PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")
if not DEPLOYER_PRIVATE_KEY:
    print("❌ Error: DEPLOYER_PRIVATE_KEY not found in .env.local")
    print("   Please add DEPLOYER_PRIVATE_KEY=your_key to packages/nextjs/.env.local")
    sys.exit(1)

RPC_URL = f"https://eth-sepolia.g.alchemy.com/v2/{alchemy_key}"
print(f"🔗 RPC URL constructed with key ending in ...{alchemy_key[-4:]}")

# 2) Deployed contract addresses on Sepolia
AEQUITAS_CORE_ADDRESS = "0x009ceEd949BbA9d4ee292D6D29577c5D453D3Fc0"  # AequitasCore
MOCK_SHUTTER_ADDRESS  = "0x57c776951acaf2686Bb16eFD3160dFB3e2Df654F"  # MockShutter
MEDIANIZER_ADDRESS    = "0x1Ab8d57324Ca77e4949C154745f94CbFFFdd3F8B"  # Medianizer

# ==============================================================================
# ---------- ABIs ----------
# ==============================================================================

AEQUITAS_CORE_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "batchId", "type": "uint256"},
        ],
        "name": "BatchClosed",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "batchId", "type": "uint256"},
            {"internalType": "uint256", "name": "clearingPrice", "type": "uint256"},
            {"internalType": "address[]", "name": "buyers", "type": "address[]"},
            {"internalType": "address[]", "name": "sellers", "type": "address[]"},
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"},
        ],
        "name": "proposeSettlement",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "currentBatchId",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

MOCK_SHUTTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "batchId", "type": "uint256"},
        ],
        "name": "getBatchPayload",
        "outputs": [
            {"internalType": "bytes", "name": "", "type": "bytes"},
            {"internalType": "string", "name": "", "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

ORACLE_ABI = [
    {
        "inputs": [],
        "name": "peek",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]


def main():
    w3 = Web3(Web3.HTTPProvider(RPC_URL))

    if not w3.is_connected():
        print("❌ Cannot connect to RPC node.")
        sys.exit(1)

    # 1. Setup Account (same as your deployer 0xDf37... that has Sepolia ETH)
    try:
        account = Account.from_key(DEPLOYER_PRIVATE_KEY)
        print(f"🔌 Connected to RPC. Solver Address: {account.address}")
    except Exception as e:
        print(f"❌ Error loading private key: {e}")
        return

    core = w3.eth.contract(address=AEQUITAS_CORE_ADDRESS, abi=AEQUITAS_CORE_ABI)
    shutter = w3.eth.contract(address=MOCK_SHUTTER_ADDRESS, abi=MOCK_SHUTTER_ABI)
    medianizer = w3.eth.contract(address=MEDIANIZER_ADDRESS, abi=ORACLE_ABI)

    # Use current batch
    try:
        batch_id = core.functions.currentBatchId().call()
        print(f"📦 Using batch id: {batch_id}")
    except Exception as e:
        print(f"❌ Error fetching batch ID: {e}")
        return

    # Fetch payload
    ciphertext, key = shutter.functions.getBatchPayload(batch_id).call()
    print(f"Batch {batch_id} ciphertext (hex): {ciphertext.hex()}")
    print(f"Batch {batch_id} decryption key  : {key}")

    if len(ciphertext) == 0:
        print("⚠️ No ciphertext stored for this batch. Did you submit an order from the UI?")
        return

    # Oracle price
    try:
        oracle_price, updated_at = medianizer.functions.peek().call()
        print(f"🔮 Oracle Price: {oracle_price / 10**18} (timestamp: {updated_at})")
    except Exception as e:
        print(f"⚠️ Could not read oracle: {e}")
        return

    # Decode orders
    try:
        orders_text = ciphertext.decode("utf-8")
    except Exception as e:
        print(f"❌ Failed to decode ciphertext as utf-8: {e}")
        return

    print(f"Decoded orders: {orders_text}")
    orders = orders_text.split("|")
    buys, sells = [], []

    for i, order in enumerate(orders):
        if order.strip():
            try:
                side, price_str, amount_str = order.split(",")
                price = int(price_str)
                amount = int(amount_str)
                print(f"  Order {i+1}: {side} {amount} @ {price}")

                if side == "buy":
                    buys.append({"price": price, "amount": amount})
                elif side == "sell":
                    sells.append({"price": price, "amount": amount})
            except ValueError:
                print(f"  Order {i+1}: malformed '{order}' (skipped)")

    print(f"\n📊 Buys: {len(buys)}, 📉 Sells: {len(sells)}")

    # Compute UCP
    def find_ucp(buys, sells):
        all_prices = sorted({o["price"] for o in buys + sells}, reverse=True)
        best_price, best_diff, best_vol = None, float("inf"), 0
        for price in all_prices:
            buy_qty = sum(o["amount"] for o in buys if o["price"] >= price)
            sell_qty = sum(o["amount"] for o in sells if o["price"] <= price)
            diff = abs(buy_qty - sell_qty)
            if diff < best_diff or (diff == best_diff and min(buy_qty, sell_qty) > best_vol):
                best_diff = diff
                best_price = price
                best_vol = min(buy_qty, sell_qty)
        if best_price is None:
            return None, 0
        return best_price, best_vol

    ucp, volume = find_ucp(buys, sells)
    print(f"🎯 UCP: ${ucp} (volume: {volume})")

    # ----------------------------------------------------------------------
    # If NO valid UCP (only buys or only sells), propose EMPTY settlement
    # so the batch can finalize and the next batch can open.
    # ----------------------------------------------------------------------
    if ucp is None or volume == 0:
        print("❌ No valid UCP — proposing empty settlement so batch can finalize")

        clearing_price_wei = oracle_price  # already in Wei
        nonce = w3.eth.get_transaction_count(account.address)

        txn = core.functions.proposeSettlement(
            batch_id,
            clearing_price_wei,
            [],  # buyers
            [],  # sellers
            [],  # amounts
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 500000,
            "gasPrice": w3.to_wei("1", "gwei"),  # keep gas cost tiny
        })

        signed = w3.eth.account.sign_transaction(txn, DEPLOYER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"✅ Empty settlement submitted: {tx_hash.hex()}")
        return
    # ----------------------------------------------------------------------

    # Otherwise: real settlement (for demo you can keep this simple)
    buyer_addr = account.address
    seller_addr = account.address
    buyers_list = [buyer_addr]
    sellers_list = [seller_addr]
    amounts = [volume * (10 ** 18)]

    print("🚀 Submitting settlement with:")
    print("  Buyer:", buyers_list)
    print("  Seller:", sellers_list)
    print("  Amounts:", amounts)

    nonce = w3.eth.get_transaction_count(account.address)

    txn = core.functions.proposeSettlement(
        batch_id,
        ucp * (10 ** 18),
        buyers_list,
        sellers_list,
        amounts,
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 500000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })

    signed = w3.eth.account.sign_transaction(txn, DEPLOYER_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print("✅ Settlement submitted:", tx_hash.hex())


if __name__ == "__main__":
    main()
